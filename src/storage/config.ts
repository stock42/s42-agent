import { access, mkdir, realpath, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { Selection } from "../agent/messages.ts";
import { bindings, type Bindings } from "../ui/bindings.ts";
import { palettes, type PaletteId } from "../ui/theme.ts";
import type { Language } from "../ui/i18n.ts";

export interface Project { id: string; name: string; path: string; selection?: Selection; lastSessionId?: string }
export interface Model { id: string; name: string; contextWindow: number; maxOutputTokens: number; capabilities: { tools: boolean; images: boolean } }
export interface Provider { id: string; name: string; kind: "llama.cpp" | "openai-compatible"; baseUrl: string; apiKeyEnv?: string; apiKeySecret?: string; models: Model[] }
export interface McpServer { id:string; name:string; enabled:boolean; transport:"stdio"|"http"; command?:string; args?:string[]; cwd?:string; envRefs?:Record<string,string>; url?:string; apiKeyEnv?:string }
export interface Skill { id:string; name:string; path:string; enabled:boolean; projectId?:string; source?:string }
export interface Prompting { id: string; name: string; text: string }
export interface ResourceIndicators { cpu: boolean; ram: boolean; disk: boolean; gpu: boolean }
export interface Config {
  version: 1; projects: Project[]; providers: Provider[];
  mcpServers: McpServer[]; skills: Skill[]; promptings: Prompting[];
  defaults: Selection & { projectId?: string }; lastProjectId?: string;
  workspace?: { openProjectIds: string[] };
  ui: { vimMode: boolean; color: "auto" | "never"; palette: PaletteId; language: Language; showReasoning: boolean; resources: ResourceIndicators; bindings?: Bindings };
  limits: { maxSteps: number; shellTimeoutMs: number; firstEventMs: number; idleMs: number };
}

export function storagePaths(configPath?: string, env = process.env, platform = process.platform) {
  const home = homedir();
  const base = platform === "darwin" ? join(home, "Library/Application Support/s42-agent")
    : platform === "win32" ? join(env.APPDATA || join(home, "AppData/Roaming"), "s42-agent") : join(env.XDG_CONFIG_HOME || join(home, ".config"), "s42-agent");
  return { config: resolve(configPath ?? join(base, "config.json")),
    sessions: configPath ? join(dirname(resolve(configPath)), "sessions") : platform === "linux"
      ? join(env.XDG_STATE_HOME || join(home, ".local/state"), "s42-agent/sessions")
      : platform === "win32" ? join(env.LOCALAPPDATA || join(home, "AppData/Local"), "s42-agent/sessions") : join(base, "sessions") };
}

// Older configs saved the catalog but only remembered choices inside a session.
// Recover a sole configured model locally; never guess among multiple models.
export function modelSelection(config: Config, ...choices: (Selection | undefined)[]): Selection {
  for (const selection of [...choices, config.defaults]) {
    if (selection && config.providers.some(p => p.id === selection.providerId && p.models.some(m => m.id === selection.modelId)))
      return { providerId: selection.providerId, modelId: selection.modelId };
  }
  const provider = config.providers.find(p => p.id === config.defaults.providerId);
  if (provider?.models.length === 1) return { providerId: provider.id, modelId: provider.models[0]!.id };
  return { providerId: config.defaults.providerId };
}

export function defaultProviders(): Provider[] {
  return [
    { id: "llama.cpp", name: "Local · llama.cpp", kind: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1", models: [] },
    { id: "deepseek", name: "DeepSeek", kind: "openai-compatible", baseUrl: "https://api.deepseek.com", apiKeyEnv: "DEEPSEEK_API_KEY", models: [] },
  ];
}

export function defaultConfig(): Config {
  return { version: 1, projects: [], mcpServers:[], skills:[], promptings: [], providers: defaultProviders(),
    defaults: { providerId: "llama.cpp" }, ui: { vimMode: true, color: "auto", palette: "qbasic", language: "es", showReasoning: true, resources: { cpu: true, ram: true, disk: true, gpu: true } },
    limits: { maxSteps: 30, shellTimeoutMs: 120000, firstEventMs: 120000, idleMs: 120000 } };
}
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
export function validateConfig(value: unknown): Config {
  const c = value as Config;
  if (!c || c.version !== 1 || !Array.isArray(c.projects) || !Array.isArray(c.providers) || !c.defaults || !text(c.defaults.providerId)
    || !c.ui || typeof c.ui.vimMode !== "boolean" || !["auto", "never"].includes(c.ui.color)) throw new Error("Configuración v1 inválida");
  if (c.ui.palette === undefined) c.ui.palette = "qbasic";
  if (typeof c.ui.palette !== "string" || !Object.hasOwn(palettes, c.ui.palette)) throw new Error("Paleta inválida: usá qbasic, grayscale, green, nord, dracula o gruvbox");
  if (c.ui.language === undefined) c.ui.language = "es";
  if (c.ui.language !== "es" && c.ui.language !== "en") throw new Error("Idioma inválido: usá es o en");
  if (c.ui.showReasoning === undefined) c.ui.showReasoning = true;
  if (typeof c.ui.showReasoning !== "boolean") throw new Error("Ver razonamiento debe ser true o false");
  if (c.ui.resources === undefined) c.ui.resources = defaultConfig().ui.resources;
  if (!c.ui.resources || typeof c.ui.resources !== "object" || Array.isArray(c.ui.resources)
    || ["cpu", "ram", "disk", "gpu"].some(key => typeof c.ui.resources[key as keyof ResourceIndicators] !== "boolean")) throw new Error("Indicadores de recursos inválidos");
  const unique = (values: string[]) => new Set(values).size === values.length;
  for (const p of c.projects) if (!p || !text(p.id) || !text(p.name) || !text(p.path) || !isAbsolute(p.path)
    || (p.selection && (!text(p.selection.providerId) || (p.selection.modelId !== undefined && !text(p.selection.modelId))))) throw new Error("Proyecto inválido en config");
  for (const p of c.providers) {
    if (!p || !text(p.id) || !text(p.name) || !["llama.cpp", "openai-compatible"].includes(p.kind) || !Array.isArray(p.models)
      || (p.apiKeyEnv !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.apiKeyEnv))
      || (p.apiKeySecret !== undefined && !text(p.apiKeySecret))) throw new Error("Proveedor inválido en config");
    let url: URL; try { url = new URL(p.baseUrl); } catch { throw new Error(`Endpoint inválido: ${p.name}`); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`Endpoint inválido: ${p.name}`);
    for (const m of p.models) if (!m || !text(m.id) || !text(m.name) || !positive(m.contextWindow) || !positive(m.maxOutputTokens)
      || m.maxOutputTokens >= m.contextWindow || !m.capabilities || typeof m.capabilities.tools !== "boolean" || typeof m.capabilities.images !== "boolean") throw new Error(`Modelo inválido: ${p.name}`);
    if (!unique(p.models.map(m => m.id))) throw new Error(`Modelos duplicados: ${p.name}`);
  }
  if (!unique(c.projects.map(p => p.id)) || !unique(c.projects.map(p => p.path)) || !unique(c.providers.map(p => p.id))) throw new Error("IDs o carpetas duplicados en config");
  c.mcpServers ??=[];c.skills ??=[];
  if(!Array.isArray(c.mcpServers)||!Array.isArray(c.skills))throw new Error("MCP/skills inválidos en config");
  const envName=(v:unknown)=>typeof v==="string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
  for(const server of c.mcpServers){
    if(!server || !text(server.id)||!text(server.name)||typeof server.enabled!=="boolean"||!["stdio","http"].includes(server.transport))throw new Error("Servidor MCP inválido");
    if(server.transport==="stdio" && (!text(server.command)||!Array.isArray(server.args)||!server.args.every(a=>typeof a==="string")))throw new Error("MCP stdio requiere command y args JSON");
    if(server.cwd!==undefined && !isAbsolute(server.cwd))throw new Error("MCP cwd debe ser absoluto");
    if(server.envRefs!==undefined && (!server.envRefs || Array.isArray(server.envRefs)||typeof server.envRefs!=="object"||!Object.entries(server.envRefs).every(([key,value])=>envName(key)&&envName(value))))throw new Error("MCP envRefs debe mapear nombres de variables");
    if(server.apiKeyEnv!==undefined && !envName(server.apiKeyEnv))throw new Error("Variable API key MCP inválida");
    if(server.transport==="http"){let url:URL;try{url=new URL(server.url!);}catch{throw new Error("URL MCP inválida");}if(!["http:","https:"].includes(url.protocol))throw new Error("URL MCP requiere http/https");}
  }
  for(const skill of c.skills)if(!skill || !text(skill.id)||!text(skill.name)||!text(skill.path)||!isAbsolute(skill.path)||typeof skill.enabled!=="boolean"||(skill.projectId!==undefined&&!c.projects.some(p=>p.id===skill.projectId)))throw new Error("Skill inválida");
  if(!unique(c.mcpServers.map(s=>s.id))||!unique(c.skills.map(s=>s.id))||!unique(c.skills.map(s=>s.path)))throw new Error("MCP/skills duplicados");
  if (c.promptings === undefined) c.promptings = [];
  if (!Array.isArray(c.promptings) || c.promptings.some(p => !p || !text(p.id) || !text(p.name) || !text(p.text))) throw new Error("Prompting inválido: requiere id, name y text");
  if (!unique(c.promptings.map(p => p.id))) throw new Error("IDs de promptings duplicados");
  if (c.workspace !== undefined && (!c.workspace || !Array.isArray(c.workspace.openProjectIds)
    || !c.workspace.openProjectIds.every(id => text(id) && c.projects.some(p => p.id === id))
    || !unique(c.workspace.openProjectIds))) throw new Error("Pestañas inválidas en config");
  c.limits ??= defaultConfig().limits;
  if (![c.limits.maxSteps, c.limits.shellTimeoutMs, c.limits.firstEventMs, c.limits.idleMs].every(positive)) throw new Error("Límites inválidos en config");
  bindings(c.ui.bindings);
  return c;
}

export async function normalizeFolder(path: string, cwd: string): Promise<string> {
  const expanded = path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
  const normalized = await realpath(resolve(cwd, expanded));
  if (!(await stat(normalized)).isDirectory()) throw new Error("La ruta debe ser una carpeta");
  await access(normalized); return normalized;
}

export class ConfigStore {
  constructor(readonly path: string, public value: Config) {}
  static async load(path: string): Promise<ConfigStore> {
    const file = Bun.file(path);
    const config = await file.exists() ? validateConfig(await file.json()) : defaultConfig();
    if (config.defaults.modelId === undefined) config.defaults = { ...config.defaults, ...modelSelection(config) };
    return new ConfigStore(path, config);
  }
  async save(next: Config): Promise<void> {
    validateConfig(next); await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${crypto.randomUUID()}.tmp`;
    try { await Bun.write(temporary, JSON.stringify(next, null, 2) + "\n"); await rename(temporary, this.path); this.value = next; }
    finally { await unlink(temporary).catch(() => {}); }
  }
  async project(name: string, path: string, cwd: string, id: string = crypto.randomUUID()): Promise<Project> {
    if (!name.trim()) throw new Error("Escribí un nombre de proyecto");
    const folder = await normalizeFolder(path, cwd);
    if (this.value.projects.some(p => p.id !== id && p.path === folder)) throw new Error("La carpeta ya está registrada");
    const project = { ...this.value.projects.find(p => p.id === id), id, name: name.trim(), path: folder };
    const next = structuredClone(this.value); next.projects = [...next.projects.filter(p => p.id !== id), project]; await this.save(next); return project;
  }
  resolveProject(input: string): Project {
    const matches = this.value.projects.filter(p => p.id === input || p.name === input);
    if (matches.length !== 1) throw new Error(matches.length ? "Nombre ambiguo: usá el ID del proyecto" : `Proyecto no registrado: ${input}`);
    return matches[0]!;
  }
}
