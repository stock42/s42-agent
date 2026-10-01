import type { Message, ToolCall } from "../agent/messages.ts";
import type { Model, Provider } from "../storage/config.ts";

export interface ToolDefinition { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface Completion { message: Message; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; finishReason?: string }
export class CompletionError extends Error { constructor(message: string, readonly partial: Message) { super(message); } }

export class SSEParser {
  private decoder = new TextDecoder(); private buffer = ""; private lines: string[] = [];
  constructor(private emit: (data: string) => void) {}
  feed(bytes: Uint8Array): void { this.buffer += this.decoder.decode(bytes, { stream: true }); this.drain(); }
  private drain(): void {
    let end: number;
    while ((end = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, end).replace(/\r$/, ""); this.buffer = this.buffer.slice(end + 1);
      if (!line) { if (this.lines.length) this.emit(this.lines.join("\n")); this.lines = []; }
      else if (line.startsWith("data:")) this.lines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  end(): void { this.buffer += this.decoder.decode(); this.drain(); if (this.buffer.trim() || this.lines.length) throw new Error("SSE incompleto al desconectarse"); }
}

export function credential(provider: Provider, sessionKey?: string): string | undefined {
  if (provider.apiKeyEnv) { const key = process.env[provider.apiKeyEnv]; if (!key) throw new Error(`Falta la variable ${provider.apiKeyEnv} para ${provider.name}`); return key; }
  return sessionKey || undefined;
}
export async function discoverModels(provider: Provider, key?: string, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: signal ?? AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Models: HTTP ${response.status}`);
  const body = await response.json() as { data?: { id?: string }[] };
  if (!Array.isArray(body.data)) throw new Error("/models no devolvió una lista válida");
  return body.data.map(m => m.id).filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function complete(options: { provider: Provider; model: Model; messages: Message[]; tools?: ToolDefinition[]; key?: string; signal: AbortSignal;
  firstEventMs: number; idleMs: number; onDelta: (text: string) => void; onReasoning?: (text: string) => void; onToolCall?: (index: number, call: ToolCall) => void }): Promise<Completion> {
  const controller = new AbortController(), relay = () => controller.abort(options.signal.reason);
  if (options.signal.aborted) relay(); else options.signal.addEventListener("abort", relay, { once: true });
  let timer: ReturnType<typeof setTimeout>, reader: { cancel(): Promise<void> } | undefined;
  const arm = (ms: number, detail: string) => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new Error(detail)), ms); };
  let text = "", reasoning = "", reasoningField: "reasoning_content" | "reasoning" = "reasoning_content", done = false, received = false, finishReason: string | undefined, usage: Completion["usage"];
  const calls = new Map<number, ToolCall>();
  const partial = (): Message => ({ role: "assistant", content: text || null, ...(reasoning ? {[reasoningField]:reasoning} : {}), ...(calls.size ? { tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, c]) => c) } : {}) });
  try {
    arm(options.firstEventMs, "Timeout esperando el primer evento del modelo");
    const response = await fetch(`${options.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}) },
      body: JSON.stringify({ model: options.model.id, messages: options.messages, stream: true, max_tokens: options.model.maxOutputTokens,
        ...(options.tools?.length ? { tools: options.tools } : {}) }),
    });
    if (!response.ok) throw new Error(`Proveedor: HTTP ${response.status}${response.status === 401 ? " · revisar API key" : response.status === 404 ? " · revisar endpoint/modelo" : response.status === 429 ? " · límite del proveedor" : ""}`);
    if (!response.body) throw new Error("El proveedor no devolvió un stream");
    const parser = new SSEParser(data => {
      if (done) return;
      received = true; arm(options.idleMs, "Stream sin actividad del modelo");
      if (data.trim() === "[DONE]") { done = true; return; }
      const packet = JSON.parse(data);
      if (packet.error) throw new Error("El proveedor reportó un error durante el stream");
      if (packet.usage) usage = packet.usage;
      const choice = packet.choices?.[0]; if (!choice) return;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      const thought = delta?.reasoning_content || delta?.reasoning;
      if (typeof thought === "string") { reasoningField=delta.reasoning_content ? "reasoning_content" : "reasoning"; reasoning+=thought; options.onReasoning?.(thought); }
      if (typeof delta?.content === "string") { text += delta.content; options.onDelta(delta.content); }
      for (const call of delta?.tool_calls ?? []) {
        if (!Number.isSafeInteger(call.index) || call.index < 0) throw new Error("Índice de tool call inválido");
        const existing = calls.get(call.index) ?? { id: "", type: "function", function: { name: "", arguments: "" } };
        if (call.id) existing.id = call.id;
        if (call.function?.name) existing.function.name += call.function.name;
        if (typeof call.function?.arguments === "string") existing.function.arguments += call.function.arguments;
        calls.set(call.index, existing);
        options.onToolCall?.(call.index, {...existing,function:{...existing.function}});
      }
    });
    const streamReader = response.body.getReader(); reader = streamReader;
    while (!done) {
      const chunk = await streamReader.read(); if (chunk.done) break;
      if (received) arm(options.idleMs, "Stream sin actividad del modelo"); parser.feed(chunk.value);
    }
    if (!done) { parser.end(); if (!finishReason) throw new Error("El stream se desconectó sin completar la respuesta"); }
    if (controller.signal.aborted) throw controller.signal.reason;
    if (finishReason === "length") throw new Error("El modelo alcanzó el límite de salida; respuesta incompleta");
    const message = partial();
    if (message.tool_calls?.some(c => !c.id || !c.function.name) || new Set(message.tool_calls?.map(c => c.id)).size !== (message.tool_calls?.length ?? 0)) throw new Error("Tool calls incompletas o IDs duplicados");
    return { message, usage, finishReason };
  } catch (e) { throw new CompletionError(controller.signal.aborted ? (controller.signal.reason as Error)?.message ?? "Cancelado" : (e as Error).message, partial()); }
  finally { clearTimeout(timer!); options.signal.removeEventListener("abort", relay); await reader?.cancel().catch(() => {}); }
}
