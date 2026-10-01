import type { Message } from "./messages.ts";
import type { Model, Project, Provider, Config } from "../storage/config.ts";
import type { Session } from "../storage/sessions.ts";
import { complete } from "../llm/client.ts";
import { execute, instructions, toolDefinitions } from "./tools.ts";

export async function runTurn(options: { project: Project; session: Session; provider: Provider; model: Model; key?: string; signal: AbortSignal;
  limits: Config["limits"]; onDelta: (text: string) => void; onState: (state: string) => void; onMessage: () => void }): Promise<{ usage?: number }> {
  const { session, project, signal, model } = options;
  const save = async (message: Message) => { await session.append({ type: "message", message }); session.state.messages.push(message); options.onMessage(); };
  const guidance = await instructions(project.path);
  const system: Message = { role: "system", content: `Sos un agente de coding. Trabajás en ${project.path}. Usá herramientas para leer, cambiar y verificar archivos. Informá resultados reales y errores. Las herramientas tienen efectos reales y no existe sandbox. Respetá las instrucciones del proyecto.\n\n${guidance}` };
  let usage: number | undefined;
  for (let step = 0; ; step++) {
    signal.throwIfAborted(); options.onState("Conectando…");
    const tools = model.capabilities.tools ? toolDefinitions : undefined;
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
        const tool = await execute(call.function.name, call.function.arguments, project.path, signal, options.limits.shellTimeoutMs);
        failed = tool.failed; output = JSON.stringify(tool);
        if (signal.aborted) aborted = new Error("Turno cancelado; los efectos ya realizados se conservan");
      }
      await session.append({ type: "tool-result", callId: call.id, output, failed });
      await save({ role: "tool", tool_call_id: call.id, content: output });
    }
    if (aborted) throw aborted;
  }
}
