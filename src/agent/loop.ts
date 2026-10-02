import { dirname } from "node:path";
import type { Message, ToolCall } from "./messages.ts";
import type { Model, Project, Provider, Config, McpServer, Skill } from "../storage/config.ts";
import type { Session } from "../storage/sessions.ts";
import { McpConnections } from "../mcp/client.ts";
import { SkillCatalog } from "../skills/index.ts";
import { complete, CompletionError, runtimeModel, type Completion } from "../llm/client.ts";
import { stageReply, stageRequest, stageStream } from "./stages.ts";
import { execute, instructions, toolDefinitions } from "./tools.ts";
import { addUsage, emptyUsage, type TokenUsage, type ProviderUsage } from "./usage.ts";
import { agentPrompt } from "./prompt.ts";

export async function runTurn(options: { project: Project; session: Session; provider: Provider; model: Model; key?: string; signal: AbortSignal;
  limits: Config["limits"]; mcpServers?:McpServer[]; skills?:Skill[]; onNotice?:(text:string)=>void; onDelta: (text: string) => void; onReasoning?: (text: string) => void; onToolCall?: (index: number, call: ToolCall) => void;
  onModel?: (model: Model) => Promise<void>; onToolStart?: (call: ToolCall) => void; onUsage?: (usage: TokenUsage) => void; onState: (state: string) => void; onMessage: () => void }): Promise<{ usage?: number; tokens: TokenUsage }> {
  const { session, project, signal } = options;
  const model = await runtimeModel(options.provider, options.model, options.key,
    signal, Math.min(5000, options.limits.firstEventMs));
  await options.onModel?.(model);
  const save = async (message: Message) => { await session.append({ type: "message", message }); session.state.messages.push(message); options.onMessage(); };
  const mcp=new McpConnections(),skills=new SkillCatalog();
  const notice=async(text:string)=>{await session.append({type:"notice",text});session.state.notices.push(text);options.onNotice?.(text);options.onMessage();};
  const pendingNotices:Promise<void>[]=[];const progress=(text:string)=>{const pending=notice(text);pendingNotices.push(pending);void pending.catch(()=>{});};
  try {
  await skills.open(options.skills??[],project.id,progress);
  if(model.capabilities.tools)await mcp.open(options.mcpServers??[],project.path,signal,progress,options.limits.shellTimeoutMs);
  await Promise.all(pendingNotices);
  const user=session.state.messages.findLast(m=>m.role==="user");const content=typeof user?.content==="string"?user.content:user?.content?.filter(p=>p.type==="text").map(p=>p.text).join("\n")??"";
  const invoked=/^\/skill\s+(\S+)/.exec(content)?.[1];const explicit=invoked?skills.entries.find(s=>s.name===invoked):undefined;
  if(invoked && !explicit)throw new Error(`Skill no disponible: ${invoked}`);
  if(explicit)await notice(`Skill ${explicit.name}: instrucciones cargadas por pedido`);
  const guidance = await instructions(project.path);
  const system: Message = { role: "system", content: agentPrompt({ cwd: project.path, tools: model.capabilities.tools, projectInstructions: guidance, externalSkills: skills.guidance,
    outputTokens: model.maxOutputTokens, invokedSkill: explicit ? `Skill invocada ${explicit.name} (base directory: ${dirname(explicit.path)}):\n${explicit.body}` : undefined }) };
  let tokens = emptyUsage();
  const recordUsage = (usage: ProviderUsage | undefined, durationMs: number) => { tokens=addUsage(tokens,usage,durationMs); options.onUsage?.(tokens); };
  let stage = 0;
  let stageStart = 0;
  for (let step = 0; ; step++) {
    signal.throwIfAborted(); options.onState("Conectando…");
    const tools = model.capabilities.tools ? [...toolDefinitions,...(skills.entries.length?[skills.definition]:[]),...await mcp.definitions(signal)] : undefined;
    const history = session.state.messages;
    const messages: Message[] = stage
      ? [system, ...history.slice(0, stageStart), { role: "user", content: stageRequest(stage, model.maxOutputTokens) }, ...history.slice(stageStart)]
      : [system, ...history];
    options.onState("Respondiendo…");
    const stream = stage ? stageStream(options.onDelta) : undefined;
    let result: Completion;
    const started = performance.now();
    try {
      result = await complete({ ...options, model, messages, tools,
        onProgress: usage => options.onUsage?.(addUsage(tokens, usage, performance.now() - started)), onDelta: stream?.push ?? options.onDelta,
        firstEventMs: options.limits.firstEventMs, idleMs: options.limits.idleMs });
    } catch (error) {
      recordUsage(error instanceof CompletionError ? error.usage : undefined, performance.now() - started);
      stream?.end();
      if (stage && error instanceof CompletionError && typeof error.partial.content === "string") error.partial.content = stageReply(error.partial.content).text;
      if (!(error instanceof CompletionError) || error.finishReason !== "length" || signal.aborted) throw error;
      const { tool_calls: _discarded, ...partial } = error.partial;
      if (typeof partial.content === "string" && stage) partial.content = stageReply(partial.content).text;
      if (partial.content || partial.reasoning_content || partial.reasoning) await save(partial);
      await notice("Límite de salida alcanzado; conservando el parcial y dividiendo el pedido en etapas pequeñas.");
      if (step >= options.limits.maxSteps) throw new Error("Límite de etapas alcanzado; el avance quedó guardado. Continuá con un pedido más pequeño.");
      stage ||= 1;
      stageStart = session.state.messages.length;
      await notice(`Etapa ${stage} · recuperando respuesta`);
      continue;
    }
    recordUsage(result.usage, performance.now() - started);
    stream?.end();
    const calls = result.message.tool_calls ?? [];
    const reply = stage && typeof result.message.content === "string" ? stageReply(result.message.content) : undefined;
    if (reply) result.message.content = reply.text;
    await save(result.message);
    if (!calls.length) {
      if (!reply?.more) return { usage: tokens.total, tokens };
      if (step >= options.limits.maxSteps) throw new Error("Límite de etapas alcanzado; el avance quedó guardado. Continuá con un pedido más pequeño.");
      stage++; stageStart = session.state.messages.length; await notice(`Etapa ${stage} · continuando el pedido`); continue;
    }
    let aborted: Error | undefined;
    for (const call of calls) {
      const stopped = signal.aborted || step >= options.limits.maxSteps || !model.capabilities.tools;
      let output: string, failed: boolean;
      if (stopped) { output = signal.aborted ? "Cancelado: herramienta no ejecutada" : !model.capabilities.tools ? "El modelo no tiene tools habilitadas" : "Límite de pasos alcanzado; herramienta no ejecutada"; failed = true; aborted = new Error(output); }
      else {
        await session.append({ type: "tool-start", callId: call.id, name: call.function.name, arguments: call.function.arguments });
        options.onState(`Ejecutando ${call.function.name}…`);
        options.onToolStart?.(call);
        const tool = call.function.name==="skill" ? await skills.execute(call.function.arguments,signal) : mcp.has(call.function.name) ? await mcp.execute(call.function.name,call.function.arguments,signal) : await execute(call.function.name, call.function.arguments, project.path, signal, options.limits.shellTimeoutMs);
        failed = tool.failed; output = JSON.stringify(tool);
        if (signal.aborted) aborted = new Error("Turno cancelado; los efectos ya realizados se conservan");
      }
      await session.append({ type: "tool-result", callId: call.id, output, failed });
      await save({ role: "tool", tool_call_id: call.id, content: output });
    }
    if (aborted) throw aborted;
  }
  }finally{await mcp.close();await Promise.all(pendingNotices);}
}
