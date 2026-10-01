import { basename } from "node:path";
import type { AppOptions } from "./app.ts";
import { ConfigStore, normalizeFolder, storagePaths, type Model, type Provider } from "./storage/config.ts";
import { Session } from "./storage/sessions.ts";
import { CompletionError, credential, discoverModels } from "./llm/client.ts";
import { runTurn } from "./agent/loop.ts";
import { emptyUsage, tokensPerSecond } from "./agent/usage.ts";
import type { Message } from "./agent/messages.ts";

export interface CliOptions extends AppOptions {
  prompting?: string;
  llmServer?: string;
  llmPort?: number;
  llmApiKey?: string;
  reasoning?: "on" | "off";
}

function endpoint(provider: Provider, options: CliOptions): string {
  const input = options.llmServer;
  let url: URL;
  try { url = new URL(input ? (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `http://${input}`) : provider.baseUrl); }
  catch { throw new Error("--llm_server requiere un host o una URL HTTP/HTTPS válida"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("--llm_server requiere un host o una URL HTTP/HTTPS sin credenciales, query ni fragmento");
  if (options.llmPort !== undefined) url.port = String(options.llmPort);
  if (input && url.pathname === "/") url.pathname = "/v1";
  return url.toString().replace(/\/+$/, "");
}

// Same agent loop and persistence as the TUI; no Desktop, raw mode or rendering.
export async function runCli(options: CliOptions): Promise<number> {
  const controller = new AbortController();
  let interrupted = 0, session: Session | undefined, tokens = emptyUsage(), wroteAnswer = false, answerBoundary = false, reasoningBoundary = false;
  const interrupt = (code: number) => { interrupted ||= code; controller.abort(new Error("Turno cancelado")); };
  const sigint = () => interrupt(130), sigterm = () => interrupt(143);
  process.on("SIGINT", sigint); process.on("SIGTERM", sigterm);
  const log = (text: string) => { if (reasoningBoundary) { process.stderr.write("\n"); reasoningBoundary = false; } process.stderr.write(text + "\n"); };
  const save = async (message: Message) => { await session!.append({ type: "message", message }); session!.state.messages.push(message); };
  try {
    if (!options.prompting?.trim()) throw new Error("--prompting requiere un pedido no vacío");
    const paths = storagePaths(options.config), store = await ConfigStore.load(paths.config), config = store.value;
    const folder = options.project ? store.resolveProject(options.project).path : options.cwd ?? process.cwd();
    const path = await normalizeFolder(folder, process.cwd());
    const project = config.projects.find(project => project.path === path) ?? {
      id: `cli-${new Bun.CryptoHasher("sha256").update(path).digest("hex").slice(0, 16)}`, name: basename(path) || path, path,
    };
    const configuredSelection = project.selection ?? config.defaults;
    // Validate the endpoint before creating a session. CLI overrides stay in memory.
    const configuredProvider = config.providers.find(provider => provider.id === (options.provider ?? configuredSelection.providerId));
    if (!configuredProvider) throw new Error(`Proveedor no registrado: ${options.provider ?? configuredSelection.providerId}`);
    endpoint(configuredProvider, options);
    session = await Session.open(paths.sessions, project.id, options.session);
    const selection = session.state.selection ?? configuredSelection;
    const source = config.providers.find(provider => provider.id === (options.provider ?? selection.providerId));
    if (!source) throw new Error(`Proveedor no registrado: ${options.provider ?? selection.providerId}`);
    const baseUrl = endpoint(source, options), changedEndpoint = baseUrl !== source.baseUrl.replace(/\/+$/, "");
    const provider = { ...source, baseUrl, ...(changedEndpoint ? { models: [], apiKeyEnv: undefined } : {}) };
    const key = credential(provider, options.llmApiKey);
    const selectedId = options.model ?? (!changedEndpoint && provider.id === selection.providerId ? selection.modelId : undefined);
    let model: Model | undefined = provider.models.find(model => model.id === selectedId);
    if (!model && selectedId) {
      // An explicit ID also works with servers that do not expose /models.
      model = { id: selectedId, name: selectedId, contextWindow: 8192, maxOutputTokens: 2048, capabilities: { tools: true, images: false } };
    }
    if (!model) {
      const available = provider.models.length ? provider.models : await discoverModels(provider, key,
        AbortSignal.any([controller.signal, AbortSignal.timeout(config.limits.firstEventMs)]));
      model = available[0];
      if (!model) throw new Error("El servidor no tiene modelos disponibles. Indicá un ID con --model.");
      if (!provider.models.length) model = { ...model, capabilities: { ...model.capabilities, tools: true } };
    }
    if (!model.capabilities.images && session.state.messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === "image_url")))
      throw new Error("La sesión contiene imágenes; elegí otro modelo o una sesión nueva");
    controller.signal.throwIfAborted();
    if (!session.state.events.length) await session.append({ type: "session", title: options.prompting.slice(0, 80) });
    await session.append({ type: "selection", selection: { providerId: provider.id, modelId: model.id } });
    await save({ role: "user", content: options.prompting });
    log(`Proyecto: ${project.name} · Modelo: ${model.id}\nSesión: ${session.path}`);
    for (const notice of session.state.notices) log(notice);
    const showReasoning = options.reasoning ? options.reasoning === "on" : config.ui.showReasoning;
    const toolNames = new Map<string, string>();
    const result = await runTurn({ project, session, provider, model, key, signal: controller.signal,
      limits: config.limits, mcpServers: config.mcpServers, skills: config.skills,
      onDelta: text => {
        if (!text) return;
        if (answerBoundary && wroteAnswer) process.stdout.write("\n\n");
        answerBoundary = false; wroteAnswer = true; process.stdout.write(text);
      },
      onReasoning: text => {
        if (!showReasoning || !text) return;
        if (!reasoningBoundary) { process.stderr.write("Razonamiento: "); reasoningBoundary = true; }
        process.stderr.write(text);
      },
      onToolStart: call => { toolNames.set(call.id, call.function.name); log(`Tool ${call.function.name}: ${call.function.arguments}`); },
      onNotice: log,
      onUsage: usage => { tokens = usage; },
      onState: state => { if (state === "Conectando…") answerBoundary = true; },
      onMessage: () => {
        const message = session!.state.messages.at(-1);
        if (message?.role === "tool") log(`Resultado ${toolNames.get(message.tool_call_id!) ?? message.tool_call_id}: ${message.content}`);
      },
    });
    tokens = result.tokens;
    await session.append({ type: "turn", state: "completed", detail: "CLI: completado", tokens });
    const rate = tokensPerSecond(tokens);
    log(`Tokens E/S ${tokens.input ?? "N/D"}/${tokens.output ?? "N/D"} · Prom. ${rate === undefined ? "N/D" : rate.toFixed(1)} tok/s${tokens.partial ? " (parcial)" : ""}`);
    return 0;
  } catch (error) {
    if (session) {
      if (error instanceof CompletionError && (error.partial.content || error.partial.reasoning_content || error.partial.reasoning)) {
        const { tool_calls: _incomplete, ...partial } = error.partial; await save(partial);
      }
      await session.append({ type: "turn", state: interrupted ? "cancelled" : "failed", detail: error instanceof Error ? error.message : String(error), tokens });
    }
    log(error instanceof Error ? error.message : String(error));
    return interrupted || 1;
  } finally {
    if (wroteAnswer) process.stdout.write("\n");
    if (reasoningBoundary) process.stderr.write("\n");
    try { await session?.close(); }
    finally { process.off("SIGINT", sigint); process.off("SIGTERM", sigterm); }
  }
}
