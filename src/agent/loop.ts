import { dirname } from "node:path";
import type { Message, ToolCall } from "./messages.ts";
import type { Model, Project, Provider, Config, McpServer, Skill } from "../storage/config.ts";
import type { Session } from "../storage/sessions.ts";
import { McpConnections } from "../mcp/client.ts";
import { SkillCatalog } from "../skills/index.ts";
import { complete } from "../llm/client.ts";
import { execute, instructions, toolDefinitions } from "./tools.ts";

export async function runTurn(options: { project: Project; session: Session; provider: Provider; model: Model; key?: string; signal: AbortSignal;
  limits: Config["limits"]; mcpServers?:McpServer[]; skills?:Skill[]; onNotice?:(text:string)=>void; onDelta: (text: string) => void; onReasoning?: (text: string) => void; onToolCall?: (index: number, call: ToolCall) => void;
  onToolStart?: (call: ToolCall) => void; onState: (state: string) => void; onMessage: () => void }): Promise<{ usage?: number }> {
  const { session, project, signal, model } = options;
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
  const system: Message = { role: "system", content: `Sos un agente de coding. Trabajás en ${project.path}. Usá herramientas para leer, cambiar y verificar archivos. Informá resultados reales y errores. Las herramientas tienen efectos reales y no existe sandbox. Respetá las instrucciones del proyecto.\n\n${guidance}\n\n${skills.guidance}\n\n${explicit?`Skill invocada ${explicit.name} (base directory: ${dirname(explicit.path)}):\n${explicit.body}`:""}` };
  let usage: number | undefined;
  for (let step = 0; ; step++) {
    signal.throwIfAborted(); options.onState("Conectando…");
    const tools = model.capabilities.tools ? [...toolDefinitions,...(skills.entries.length?[skills.definition]:[]),...await mcp.definitions(signal)] : undefined;
    const messages = [system, ...session.state.messages];
    let images = 0;
    const estimated = messages.map(m => ({...m, content:Array.isArray(m.content)?m.content.map(p=>p.type==='image_url'?(images++,{type:'image_url',image_url:{url:'[image]'}}):p):m.content}));
    const approximateTokens = Math.ceil(Buffer.byteLength(JSON.stringify({ messages:estimated, tools })) / 4) + images * 1024;
    if (approximateTokens + model.maxOutputTokens > model.contextWindow) throw new Error(`Contexto estimado excedido (${approximateTokens} tokens aprox.). Usá /new.`);
    options.onState("Respondiendo…");
    const result = await complete({ ...options, messages, tools, firstEventMs: options.limits.firstEventMs, idleMs: options.limits.idleMs });
    usage = result.usage?.total_tokens;
    const calls = result.message.tool_calls ?? [];
    await save(result.message);
    if (!calls.length) return { usage };
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
