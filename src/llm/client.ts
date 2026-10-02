import type { Message, ToolCall } from "../agent/messages.ts";
import type { Model, Provider } from "../storage/config.ts";
import type { ProviderUsage } from "../agent/usage.ts";
export { credential } from "../storage/credentials.ts";

export interface ToolDefinition { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface Completion { message: Message; usage?: ProviderUsage; finishReason?: string }
export class CompletionError extends Error { constructor(message: string, readonly partial: Message, readonly finishReason?: string, readonly usage?: ProviderUsage) { super(message); } }

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

// llama.cpp publishes template capabilities/context in /props; remote providers use /models.
// Never reuse guessed output ceilings from old automatic catalogs.
export async function runtimeModel(provider: Provider, model: Model, key?: string, signal?: AbortSignal, timeoutMs = 5000): Promise<Model> {
  if (model.manual) return model;
  const automatic = { ...model, maxOutputTokens: undefined };
  if (provider.kind !== "llama.cpp") {
    // Refresh actual provider metadata when a turn starts; startup stays offline.
    try {
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
      return (await discoverModels(provider, key, requestSignal)).find(m => m.id === model.id) ?? automatic;
    } catch (error) { if (signal?.aborted) throw error; return automatic; }
  }
  const url = new URL(provider.baseUrl); url.pathname = url.pathname.replace(/\/v1\/?$/, "").replace(/\/$/, "") + "/props";
  url.searchParams.set("model", model.id);
  try {
    const response = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return automatic;
    const props = await response.json() as { model_alias?: string; default_generation_settings?: { n_ctx?: number }; chat_template_caps?: { supports_tools?: boolean; supports_tool_calls?: boolean }; modalities?: { vision?: boolean } };
    if (props.model_alias && props.model_alias !== model.id) return automatic;
    if (!props.default_generation_settings && !props.chat_template_caps && !props.modalities) return automatic;
    const context = props.default_generation_settings?.n_ctx;
    const contextWindow = Number.isSafeInteger(context) && context! > 1 ? context! : model.contextWindow;
    const tools = props.chat_template_caps?.supports_tools;
    return { ...automatic, contextWindow, capabilities: {
      tools: typeof tools === "boolean" ? tools : model.capabilities.tools,
      images: typeof props.modalities?.vision === "boolean" ? props.modalities.vision : model.capabilities.images,
    } };
  } catch (error) { if (signal?.aborted) throw error; return automatic; }
}

export async function discoverModels(provider: Provider, key?: string, signal?: AbortSignal): Promise<Model[]> {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: signal ?? AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Models: HTTP ${response.status}${response.status === 401 ? " · revisar API key" : ""}`);
  const body = await response.json() as { data?: { id?: string; name?: string; context_window?: number; max_output_tokens?: number; input_modalities?: string[] }[] };
  if (!Array.isArray(body?.data)) throw new Error("/models no devolvió una lista válida");
  const models = new Map<string, Model>();
  for (const m of body.data) {
    if (!m || typeof m.id !== "string" || !m.id.trim() || models.has(m.id)) continue;
    const contextWindow = Number.isSafeInteger(m.context_window) && m.context_window! > 1 ? m.context_window! : undefined;
    const maxOutputTokens = Number.isSafeInteger(m.max_output_tokens) && m.max_output_tokens! > 0 ? m.max_output_tokens! : undefined;
    models.set(m.id, { id: m.id, name: typeof m.name === "string" && m.name.trim() ? m.name : m.id,
      contextWindow, maxOutputTokens,
      capabilities: { tools: true, images: Array.isArray(m.input_modalities) && m.input_modalities.includes("image") } });
  }
  return provider.kind === "llama.cpp" ? Promise.all([...models.values()].map(model => runtimeModel(provider, model, key, signal))) : [...models.values()];
}

export async function complete(options: { provider: Provider; model: Model; messages: Message[]; tools?: ToolDefinition[]; key?: string; signal: AbortSignal;
  firstEventMs: number; idleMs: number; onDelta: (text: string) => void; onReasoning?: (text: string) => void; onToolCall?: (index: number, call: ToolCall) => void; onProgress?: (usage: ProviderUsage) => void }): Promise<Completion> {
  const controller = new AbortController(), relay = () => controller.abort(options.signal.reason);
  if (options.signal.aborted) relay(); else options.signal.addEventListener("abort", relay, { once: true });
  let timer: ReturnType<typeof setTimeout>, reader: { cancel(): Promise<void> } | undefined;
  const arm = (ms: number, detail: string) => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new Error(detail)), ms); };
  let text = "", reasoning = "", reasoningField: "reasoning_content" | "reasoning" = "reasoning_content", done = false, received = false, finishReason: string | undefined, usage: Completion["usage"];
  const calls = new Map<number, ToolCall>();
  const partial = (): Message => ({ role: "assistant", content: text || null, ...(reasoning ? {[reasoningField]:reasoning} : {}), ...(calls.size ? { tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, c]) => c) } : {}) });
  try {
    arm(options.firstEventMs, "Timeout esperando el primer evento del modelo");
    // DeepSeek rejects reasoning-only partials with null content. An empty
    // string preserves their reasoning in context without changing the session.
    const messages = options.messages.map(message => message.role === "assistant" && message.content === null && !message.tool_calls?.length ? { ...message, content: "" } : message);
    const response = await fetch(`${options.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}) },
      body: JSON.stringify({ model: options.model.id, messages, stream: true, stream_options: { include_usage: true }, max_tokens: options.model.maxOutputTokens,
        ...(options.tools?.length ? { tools: options.tools } : {}), ...(options.provider.kind === "llama.cpp" ? { timings_per_token: true } : {}) }),
    });
    if (!response.ok) {
      const body = await response.text(); let detail = body.trim();
      try { const error = JSON.parse(body)?.error; if (typeof error?.message === "string") detail = error.message; } catch {}
      const hint = response.status === 401 ? " · revisar API key" : response.status === 404 ? " · revisar endpoint/modelo" : response.status === 429 ? " · límite del proveedor" : "";
      throw new Error(`Proveedor: HTTP ${response.status}${hint}${detail ? `: ${detail.slice(0, 2000)}` : ""}`);
    }
    if (!response.body) throw new Error("El proveedor no devolvió un stream");
    const parser = new SSEParser(data => {
      if (done) return;
      received = true; arm(options.idleMs, "Stream sin actividad del modelo");
      if (data.trim() === "[DONE]") { done = true; return; }
      const packet = JSON.parse(data);
      if (packet.error) throw new Error("El proveedor reportó un error durante el stream");
      if (packet.usage) { usage = packet.usage; options.onProgress?.(usage!); }
      else if (packet.timings) {
        const timing = packet.timings;
        const valid = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
        if (valid(timing.cache_n) && valid(timing.prompt_n) && valid(timing.predicted_n)) {
          usage = { prompt_tokens: timing.cache_n + timing.prompt_n, completion_tokens: timing.predicted_n,
            total_tokens: timing.cache_n + timing.prompt_n + timing.predicted_n };
          options.onProgress?.(usage);
        }
      }
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
    if (finishReason === "length") throw new CompletionError("El modelo alcanzó el límite de salida; respuesta incompleta", partial(), "length", usage);
    const message = partial();
    if (message.tool_calls?.some(c => !c.id || !c.function.name) || new Set(message.tool_calls?.map(c => c.id)).size !== (message.tool_calls?.length ?? 0)) throw new Error("Tool calls incompletas o IDs duplicados");
    return { message, usage, finishReason };
  } catch (e) {
    if (e instanceof CompletionError && !controller.signal.aborted) throw e;
    throw new CompletionError(controller.signal.aborted ? (controller.signal.reason as Error)?.message ?? "Cancelado" : (e as Error).message, partial(), undefined, usage);
  }
  finally { clearTimeout(timer!); options.signal.removeEventListener("abort", relay); await reader?.cancel().catch(() => {}); }
}
