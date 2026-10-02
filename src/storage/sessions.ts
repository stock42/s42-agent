import { mkdir, open, readdir, unlink, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { isDatabase, openDatabase, insertEvent } from "./database.ts";
import type { Message, Selection } from "../agent/messages.ts";
import type { ContextUsage, TokenUsage } from "../agent/usage.ts";

export type EventData =
  | { type: "notice"; text: string }
  | { type: "session"; title: string }
  | { type: "selection"; selection: Selection }
  | { type: "draft"; text: string; attachments: string[] }
  | { type: "message"; message: Message }
  | { type: "context-usage"; usage: ContextUsage }
  | { type: "compaction"; through: number; summary: string }
  | { type: "compaction-part"; message: Message }
  | { type: "tool-start"; callId: string; name: string; arguments: string }
  | { type: "tool-result"; callId: string; output: string; failed: boolean }
  | { type: "turn"; state: "completed" | "cancelled" | "failed"; detail: string; tokens?: TokenUsage };
export type SessionEvent = EventData & { version: 1; id: string; projectId: string; at: string };
export interface SessionState { id: string; projectId: string; title: string; selection?: Selection; draft: string; attachments: string[]; messages: Message[]; events: SessionEvent[]; notices: string[];
  compaction?: { through: number; summary: string }; contextUsage?: ContextUsage }

function parseEvent(value: unknown, projectId: string): SessionEvent {
  const e = value as SessionEvent;
  if (!e || e.version !== 1 || typeof e.id !== "string" || e.projectId !== projectId || typeof e.at !== "string") throw new Error("Evento de sesión inválido");
  switch (e.type) {
    case "context-usage": if (e.usage && typeof e.usage.providerId === "string" && typeof e.usage.modelId === "string" && typeof e.usage.estimated === "boolean"
      && [e.usage.window, e.usage.used, e.usage.inputWeight, e.usage.inputTokens].every(v => v === undefined || Number.isSafeInteger(v) && v >= 0)) return e; break;
    case "compaction": if (Number.isSafeInteger(e.through) && e.through >= 0 && typeof e.summary === "string" && e.summary.trim()) return e; break;
    case "compaction-part": if (e.message?.role === "assistant" && typeof e.message.content === "string"
      && (e.message.reasoning_content === undefined || typeof e.message.reasoning_content === "string") && (e.message.reasoning === undefined || typeof e.message.reasoning === "string")) return e; break;
    case "notice": if(typeof e.text==="string")return e;break;
    case "session": if (typeof e.title === "string") return e; break;
    case "selection": if (e.selection && typeof e.selection.providerId === "string" && (e.selection.modelId === undefined || typeof e.selection.modelId === "string")) return e; break;
    case "draft": if (typeof e.text === "string" && Array.isArray(e.attachments) && e.attachments.every(p => typeof p === "string")) return e; break;
    case "message": if (e.message && ["user", "assistant", "tool"].includes(e.message.role) && (e.message.content === null || typeof e.message.content === "string" || Array.isArray(e.message.content))
      && (e.message.reasoning_content===undefined || typeof e.message.reasoning_content==="string") && (e.message.reasoning===undefined || typeof e.message.reasoning==="string")) return e; break;
    case "tool-start": if ([e.callId, e.name, e.arguments].every(v => typeof v === "string")) return e; break;
    case "tool-result": if (typeof e.callId === "string" && typeof e.output === "string" && typeof e.failed === "boolean") return e; break;
    case "turn": if (["completed", "cancelled", "failed"].includes(e.state) && typeof e.detail === "string"
      && (e.tokens === undefined || e.tokens && [e.tokens.requests, e.tokens.reported].every(v => Number.isSafeInteger(v) && v >= 0)
        && typeof e.tokens.partial === "boolean" && [e.tokens.input, e.tokens.output, e.tokens.total, e.tokens.timedOutput].every(v => v === undefined || Number.isSafeInteger(v) && v >= 0)
        && (e.tokens.generationMs === undefined || Number.isFinite(e.tokens.generationMs) && e.tokens.generationMs > 0))) return e;
  }
  throw new Error("Evento de sesión inválido");
}

export class Session {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private constructor(readonly path: string, readonly lock: string, private token: string, private fd: FileHandle | undefined, readonly state: SessionState, private db?: Database) {}
  static async open(root: string, projectId: string, id: string = crypto.randomUUID()): Promise<Session> {
    if (![projectId, id].every(v => /^[A-Za-z0-9._-]+$/.test(v) && v !== "." && v !== "..")) throw new Error("ID de sesión/proyecto inválido");
    const sqlite = isDatabase(root);
    const folder = join(sqlite ? `${root}.locks` : root, projectId); await mkdir(folder, { recursive: true });
    const path = sqlite ? root : join(folder, `${id}.jsonl`), lock = join(folder, `${id}.jsonl.lock`), token = crypto.randomUUID();
    for (let attempt = 0; ; attempt++) {
      try { const owner = await open(lock, "wx"); try { await owner.writeFile(JSON.stringify({ pid: process.pid, token })); } finally { await owner.close(); } break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt) throw new Error("La sesión ya está abierta en otra instancia");
        let pid: number;
        try { pid = (await Bun.file(lock).json()).pid; if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(); }
        catch { throw new Error("Lock de sesión incompleto: usá una sesión nueva"); }
        try { process.kill(pid, 0); throw new Error("La sesión ya está abierta en otra instancia"); }
        catch (probe) { if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe; }
        await unlink(lock);
      }
    }
    let db: Database | undefined;
    try {
      if (sqlite) db = await openDatabase(path);
      const file = Bun.file(path), source = db
        ? db.query<{ data: string }, [string, string]>("SELECT data FROM events WHERE project_id=? AND session_id=? ORDER BY seq").all(projectId, id).map(row => row.data + "\n").join("")
        : await file.exists() ? await file.text() : "";
      const state: SessionState = { id, projectId, title: "Nueva sesión", draft: "", attachments: [], messages: [], events: [], notices: [] };
      let validBytes = 0;
      const lines = source.split("\n");
      for (const [index, line] of lines.entries()) {
        if (!source.endsWith("\n") && index === lines.length - 1 && line) { state.notices.push("Último registro incompleto recuperado"); break; }
        if (!line) { if (index < lines.length - 1) validBytes++; continue; }
        try { state.events.push(parseEvent(JSON.parse(line), projectId)); } catch { throw new Error(`Sesión corrupta: línea ${index + 1}`); }
        validBytes += Buffer.byteLength(line + "\n");
      }
      const pending = new Map<string, string>();
      for (const e of state.events) {
        if (e.type === "context-usage") state.contextUsage = e.usage;
        if (e.type === "compaction") {
          if (e.through > state.messages.length) throw new Error("Compactación inválida: historial incompleto");
          state.compaction = { through: e.through, summary: e.summary };
        }
        if(e.type==="notice")state.notices.push(e.text);
        if (e.type === "session") state.title = e.title;
        if (e.type === "draft") { state.draft = e.text; state.attachments = e.attachments; }
        if (e.type === "selection") state.selection = e.selection;
        if (e.type === "message") {
          const callIndex = e.message.role === "tool" ? state.messages.findIndex(m => m.tool_calls?.some(c => c.id === e.message.tool_call_id)) : -1;
          if (callIndex < 0) state.messages.push(e.message);
          else { let index = callIndex + 1; while (state.messages[index]?.role === "tool") index++; state.messages.splice(index, 0, e.message); }
        }
        if (e.type === "tool-start") pending.set(e.callId, e.name);
        if (e.type === "tool-result") pending.delete(e.callId);
        if (e.type === "turn" && e.state !== "completed") state.notices.push(e.detail);
      }
      for (const [callId, name] of pending) {
        state.notices.push(`Herramienta interrumpida: ${name}; pudo haber tenido efectos`);
      }
      // Restore each persisted call/result pair, including a crash between result and message.
      const repairs: Message[] = [];
      for (const message of [...state.messages]) for (const call of message.tool_calls ?? []) {
        if (state.messages.some(m => m.role === "tool" && m.tool_call_id === call.id)) continue;
        const result = state.events.findLast(e => e.type === "tool-result" && e.callId === call.id);
        const content = result?.type === "tool-result" ? result.output : "Interrumpida al cerrar. No reejecutar automáticamente; pudo haber tenido efectos.";
        const repaired: Message = { role: "tool", tool_call_id: call.id, content };
        // A recovered tool result must immediately follow the assistant's call group.
        let index = state.messages.indexOf(message) + 1;
        while (state.messages[index]?.role === "tool") index++;
        state.messages.splice(index, 0, repaired); repairs.push(repaired);
        if (!result && !pending.has(call.id)) state.notices.push(`Llamada interrumpida: ${call.function.name}; no se reejecutó`);
      }
      const fd = db ? undefined : await open(path, "a");
      if (state.notices.some(n => n.startsWith("Último"))) await fd?.truncate(validBytes);
      const session = new Session(path, lock, token, fd, state, db);
      for (const message of repairs) await session.append({ type: "message", message });
      return session;
    } catch (error) { db?.close(true); await unlink(lock); throw error; }
  }
  append(data: EventData): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Sesión cerrada"));
    const event = { ...data, version: 1 as const, projectId: this.state.projectId, id: crypto.randomUUID(), at: new Date().toISOString() };
    this.queue = this.queue.then(async () => { if (this.db) this.db.transaction(() => insertEvent(this.db!, this.state.id, event))();
      else { await this.fd!.appendFile(JSON.stringify(event) + "\n"); await this.fd!.sync(); } this.state.events.push(event); });
    return this.queue;
  }
  async close(): Promise<void> {
    if (this.closed) return; this.closed = true;
    try { await this.queue; } finally { await this.fd?.close(); this.db?.close(true); if ((await Bun.file(this.lock).json()).token === this.token) await unlink(this.lock); }
  }
}

export async function listSessions(root: string, projectId: string): Promise<{ id: string; title: string }[]> {
  if (isDatabase(root)) {
    const db = await openDatabase(root);
    try { return db.query<{ id: string; title: string }, [string]>("SELECT id,title FROM sessions WHERE project_id=? ORDER BY updated_at DESC,id").all(projectId); }
    finally { db.close(true); }
  }
  const folder = join(root, projectId); let files: string[];
  try { files = await readdir(folder); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  const result: { id: string; title: string }[] = [];
  for (const name of files.filter(n => n.endsWith(".jsonl")).sort()) {
    const first = (await Bun.file(join(folder, name)).text()).split("\n")[0];
    try { result.push({ id: name.slice(0, -6), title: JSON.parse(first ?? "").title ?? name.slice(0, 8) }); }
    catch { result.push({ id: name.slice(0, -6), title: `${name.slice(0, 8)} (revisar)` }); }
  }
  return result;
}

// Read and validate old logs before committing the migration. Originals remain untouched.
export async function legacySessions(root: string): Promise<{ id: string; events: SessionEvent[] }[]> {
  const result: { id: string; events: SessionEvent[] }[] = [];
  let projects;
  try { projects = await readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return result; throw error; }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const folder = join(root, project.name);
    for (const name of await readdir(folder)) {
      if (!name.endsWith(".jsonl")) continue;
      const path = join(folder, name), lock = Bun.file(`${path}.lock`);
      if (await lock.exists()) {
        const { pid } = await lock.json();
        if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Lock de sesión incompleto durante migración");
        try { process.kill(pid, 0); throw new Error("Cerrá la instancia anterior antes de migrar a SQLite"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
      }
      const source = await Bun.file(path).text(), lines = source.split("\n"), events: SessionEvent[] = [];
      for (const [index, line] of lines.entries()) {
        if (!line || index === lines.length - 1 && !source.endsWith("\n")) continue;
        try { events.push(parseEvent(JSON.parse(line), project.name)); }
        catch { throw new Error(`Sesión corrupta durante migración: ${project.name}/${name}, línea ${index + 1}`); }
      }
      if (source && !source.endsWith("\n")) events.push({ type: "notice", text: "Último registro incompleto recuperado", version: 1, projectId: project.name, id: crypto.randomUUID(), at: new Date().toISOString() });
      result.push({ id: name.slice(0, -6), events });
    }
  }
  return result;
}
