import { dirname } from "node:path";
import type { Message, ToolCall } from "./messages.ts";
import type { Model, Project, Provider, McpServer, Skill } from "../storage/config.ts";
import type { Session } from "../storage/sessions.ts";
import { McpConnections } from "../mcp/client.ts";
import { SkillCatalog } from "../skills/index.ts";
import { complete, CompletionError, runtimeModel, type Completion } from "../llm/client.ts";
import { stageReply, stageRequest, stageStream } from "./stages.ts";
import { execute, instructions, toolDefinitions } from "./tools.ts";
import { addUsage, emptyUsage, type ContextUsage, type TokenUsage, type ProviderUsage } from "./usage.ts";
import { agentPrompt } from "./prompt.ts";
import { activeHistory, compactContext, contextWeight, estimateContext, nearContextWindow, reportedContext } from "./context.ts";

export async function runTurn(options: { project: Project; session: Session; provider: Provider; model: Model; key?: string; signal: AbortSignal;
  mcpServers?:McpServer[]; skills?:Skill[]; onNotice?:(text:string)=>void; onDelta: (text: string) => void; onReasoning?: (text: string) => void; onToolCall?: (index: number, call: ToolCall) => void;
  onModel?: (model: Model) => Promise<void>; onContext?: (usage: ContextUsage) => void; onToolStart?: (call: ToolCall) => void;
  onToolOutput?: (call: ToolCall, stream: "stdout" | "stderr", text: string) => void;
  onUsage?: (usage: TokenUsage) => void; onState: (state: string) => void; onMessage: () => void }): Promise<{ usage?: number; tokens: TokenUsage }> {
  const { session, project, signal } = options;
  const model = await runtimeModel(options.provider, options.model, options.key, signal);
  const previousContext = session.state.contextUsage;
  if (model.contextWindow === undefined && previousContext?.providerId === options.provider.id && previousContext.modelId === model.id)
    model.contextWindow = previousContext.window;
  await options.onModel?.(model);
  const save = async (message: Message) => { await session.append({ type: "message", message }); session.state.messages.push(message); options.onMessage(); };
  const mcp=new McpConnections(),skills=new SkillCatalog();
  const notice=async(text:string)=>{await session.append({type:"notice",text});session.state.notices.push(text);options.onNotice?.(text);options.onMessage();};
  const pendingNotices:Promise<void>[]=[];const progress=(text:string)=>{const pending=notice(text);pendingNotices.push(pending);void pending.catch(()=>{});};
  try {
  await skills.open(options.skills??[],project.id,progress);
  if(model.capabilities.tools)await mcp.open(options.mcpServers??[],project.path,signal,progress);
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
  let occupancy: ContextUsage = { providerId: options.provider.id, modelId: model.id, window: model.contextWindow, estimated: true };
  const publishContext = (usage: ContextUsage) => { occupancy = usage; session.state.contextUsage = usage; options.onContext?.(usage); };
  const persistContext = () => session.append({ type: "context-usage", usage: occupancy });
  const requestMessages = (): Message[] => {
    const history = activeHistory(session.state);
    return stage ? [system, ...history.slice(0, stageStart), { role: "user", content: stageRequest(stage, model.maxOutputTokens) }, ...history.slice(stageStart)] : [system, ...history];
  };
  const compact = async (tools?: Parameters<typeof contextWeight>[1]) => {
    if (!model.contextWindow) throw new Error("El proveedor no informa la ventana de contexto del modelo");
    const original = { ...occupancy, window: model.contextWindow }, messages = requestMessages(), weight = contextWeight(messages, tools);
    const scale = original.inputWeight && original.inputTokens ? original.inputTokens / original.inputWeight : 1;
    options.onState("Compactando contexto…"); await notice("Compactando contexto completo; el historial original se conserva.");
    try {
      const summary = await compactContext({ messages, tools, fixed: [system], window: model.contextWindow, scale, signal,
        summarize: async (messages, contextTokens) => {
          const started = performance.now(), weight = contextWeight(messages);
          const current = estimateContext(options.provider.id, model.id, model.contextWindow, messages, undefined, original);
          publishContext(current);
          try {
            const result = await complete({ provider: options.provider, model, key: options.key, signal, messages, contextTokens, onDelta: () => {},
              onReasoning: delta => { options.onReasoning?.(delta); options.onState("Compactando contexto…"); }, onProgress: usage => {
                options.onUsage?.(addUsage(tokens, usage, performance.now() - started)); publishContext(reportedContext(current, weight, usage));
              } });
            recordUsage(result.usage, performance.now() - started); return result;
          } catch (error) { recordUsage(error instanceof CompletionError ? error.usage : undefined, performance.now() - started); throw error; }
        },
        onPart: async message => { await session.append({ type: "compaction-part", message }); options.onMessage(); },
      });
      const checkpoint = { through: session.state.messages.length, summary };
      const nextMessages: Message[] = [system, ...activeHistory({ messages: session.state.messages, compaction: checkpoint })];
      if (contextWeight(nextMessages, tools) >= weight) throw new Error("El resumen no redujo el contexto; historial conservado");
      signal.throwIfAborted(); await session.append({ type: "compaction", ...checkpoint }); session.state.compaction = checkpoint;
      stageStart = activeHistory(session.state).length;
      publishContext(estimateContext(options.provider.id, model.id, model.contextWindow, requestMessages(), tools, original)); await persistContext();
      await notice("Contexto compactado; continuando el pedido.");
    } catch (error) { publishContext(original); await persistContext(); throw new Error(`No se pudo compactar el contexto: ${(error as Error).message}`); }
  };
  for (;;) {
    signal.throwIfAborted(); options.onState("Conectando…");
    const tools = model.capabilities.tools ? [...toolDefinitions,...(skills.entries.length?[skills.definition]:[]),...await mcp.definitions(signal)] : undefined;
    let messages = requestMessages();
    publishContext(estimateContext(options.provider.id, model.id, model.contextWindow, messages, tools, session.state.contextUsage));
    if (nearContextWindow(occupancy)) { await compact(tools); messages = requestMessages(); }
    const weight = contextWeight(messages, tools), current = occupancy;
    let generatedWeight = 0; const streamedCalls = new Map<number, ToolCall>();
    const measureDelta = (delta: string) => {
      generatedWeight += contextWeight([{ role: "assistant", content: delta }]) - contextWeight([{ role: "assistant", content: "" }]);
      if (!occupancy.estimated) return;
      const scale = occupancy.inputWeight && occupancy.inputTokens ? occupancy.inputTokens / occupancy.inputWeight : 1;
      publishContext({ ...occupancy, used: (occupancy.inputTokens ?? current.used ?? 0) + Math.ceil(generatedWeight * scale) });
    };
    options.onState("Respondiendo…");
    const stream = stage ? stageStream(options.onDelta) : undefined;
    let result: Completion;
    const started = performance.now();
    try {
      result = await complete({ ...options, model, messages, tools,
        contextTokens: model.contextWindow ? occupancy.used : undefined,
        onProgress: usage => { options.onUsage?.(addUsage(tokens, usage, performance.now() - started)); publishContext(reportedContext(current, weight, usage)); },
        onReasoning: delta => { measureDelta(delta); options.onReasoning?.(delta); },
        onToolCall: (index, call) => { const previous = streamedCalls.get(index); measureDelta(call.function.arguments.slice(previous?.function.arguments.length ?? 0)); streamedCalls.set(index, call); options.onToolCall?.(index, call); },
        onDelta: delta => { measureDelta(delta); (stream?.push ?? options.onDelta)(delta); } });
    } catch (error) {
      recordUsage(error instanceof CompletionError ? error.usage : undefined, performance.now() - started);
      if (error instanceof CompletionError && error.usage) publishContext(reportedContext(occupancy, weight, error.usage)); await persistContext();
      stream?.end();
      if (error instanceof CompletionError && error.contextExceeded && !signal.aborted && (error.contextWindow || model.contextWindow)) {
        model.contextWindow = error.contextWindow ?? model.contextWindow; await options.onModel?.(model); await compact(tools); continue;
      }
      if (stage && error instanceof CompletionError && typeof error.partial.content === "string") error.partial.content = stageReply(error.partial.content).text;
      if (!(error instanceof CompletionError) || error.finishReason !== "length" || signal.aborted) throw error;
      const { tool_calls: _discarded, ...partial } = error.partial;
      if (typeof partial.content === "string" && stage) partial.content = stageReply(partial.content).text;
      if (partial.content || partial.reasoning_content || partial.reasoning) await save(partial);
      await notice("Límite de salida alcanzado; conservando el parcial y dividiendo el pedido en etapas pequeñas.");
      stage ||= 1;
      stageStart = activeHistory(session.state).length;
      await notice(`Etapa ${stage} · recuperando respuesta`);
      continue;
    }
    recordUsage(result.usage, performance.now() - started);
    publishContext(reportedContext(occupancy, weight, result.usage));
    stream?.end();
    const calls = result.message.tool_calls ?? [];
    const reply = stage && typeof result.message.content === "string" ? stageReply(result.message.content) : undefined;
    if (reply) result.message.content = reply.text;
    await save(result.message);
    if (occupancy.estimated) publishContext(estimateContext(options.provider.id, model.id, model.contextWindow, requestMessages(), tools, occupancy));
    await persistContext();
    if (!calls.length) {
      if (!reply?.more) { if (nearContextWindow(occupancy)) await compact(tools); return { usage: tokens.total, tokens }; }
      stage++; stageStart = activeHistory(session.state).length; await notice(`Etapa ${stage} · continuando el pedido`); continue;
    }
    let aborted: Error | undefined;
    const toolHistory = session.state.messages.slice(0, -1);
    for (const call of calls) {
      const stopped = signal.aborted || !model.capabilities.tools;
      let output: string, failed: boolean;
      if (stopped) { output = signal.aborted ? "Cancelado: herramienta no ejecutada" : "El modelo no tiene tools habilitadas"; failed = true; aborted = new Error(output); }
      else {
        await session.append({ type: "tool-start", callId: call.id, name: call.function.name, arguments: call.function.arguments });
        options.onState(`Ejecutando ${call.function.name}…`);
        options.onToolStart?.(call);
        const tool = call.function.name==="skill" ? await skills.execute(call.function.arguments,signal) : mcp.has(call.function.name) ? await mcp.execute(call.function.name,call.function.arguments,signal) : await execute(call.function.name, call.function.arguments, project.path, signal,
          options.onToolOutput && ((stream, text) => options.onToolOutput!(call, stream, text)), toolHistory);
        failed = tool.failed; output = JSON.stringify(tool);
        if (signal.aborted) aborted = new Error("Turno cancelado; los efectos ya realizados se conservan");
      }
      await session.append({ type: "tool-result", callId: call.id, output, failed });
      await save({ role: "tool", tool_call_id: call.id, content: output });
    }
    publishContext(estimateContext(options.provider.id, model.id, model.contextWindow, requestMessages(), tools, occupancy)); await persistContext();
    if (aborted) throw aborted;
  }
  }finally{await mcp.close();await Promise.all(pendingNotices);}
}
