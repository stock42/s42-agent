import { link, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

export type TaskStatus = "pending" | "doing" | "done";
export interface VerificationSpec { id: string; kind: "command" | "review" | "browser"; description: string; command?: string; required: boolean; paths: string[] }
export interface TaskCard {
  id: string; requestId: string; title: string; description: string; criterion: string; dependencies: string[];
  status: TaskStatus; verification: VerificationSpec[]; result: string; blocked?: string;
  origin: "agent" | "user"; acceptanceEvidence: string[];
}
export interface TaskDocument {
  source: string; revision: string; tasks: TaskCard[]; problems: string[]; compatible: boolean;
  spans: { id: string; start: number; end: number; raw: string }[];
}
const sections: Record<TaskStatus, string> = { pending: "Pendientes", doing: "En progreso", done: "Terminadas" };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const taskId = new RegExp(`^T-${uuid}$`, "i"), requestId = new RegExp(`^R-${uuid}$`, "i");
export const revision = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const field = (value: string): string => { if (value.startsWith('"')) { try { const parsed: unknown = JSON.parse(value); if (typeof parsed === "string") return parsed; } catch {} } return value; };

export function parseTasks(source: string): TaskDocument {
  const document: TaskDocument = { source, revision: revision(source), tasks: [], problems: [], compatible: !source, spans: [] };
  const headers = [...source.matchAll(/^#{2,3} .*$/gm)];
  let status: TaskStatus | undefined;
  for (let index = 0; index < headers.length; index++) {
    const header = headers[index]!, title = header[0];
    if (title.startsWith("## ")) {
      status = (Object.entries(sections) as [TaskStatus, string][]).find(([, name]) => title.replace(/\r$/, "") === `## ${name}`)?.[0];
      if (status) document.compatible = true;
      continue;
    }
    if (!title.startsWith("### [T-")) continue;
    const start = header.index!, end = headers[index + 1]?.index ?? source.length;
    const raw = source.slice(start, end), match = new RegExp(`^### \\[(T-${uuid})\\] (.+?)\\r?$`, "i").exec(title);
    try {
      if (!match || !status) throw new Error("ID o sección inválida");
      const fields = Object.fromEntries(raw.split(/\r?\n/).slice(1).flatMap(line => {
        const pair = /^([^:]+):\s*(.*)$/.exec(line); return pair ? [[pair[1]!, field(pair[2]!)]] : [];
      }));
      const verification: unknown = fields.Verificaciones ? JSON.parse(fields.Verificaciones) : [];
      const evidence: unknown = fields["Evidencia de aceptación"] ? JSON.parse(fields["Evidencia de aceptación"]) : [];
      if (!requestId.test(fields.Pedido ?? "") || !fields.Criterio?.trim() || !Array.isArray(verification) || !Array.isArray(evidence) || evidence.some(e => typeof e !== "string")) throw new Error("campos incompletos");
      validateVerification(verification);
      const dependencies = fields["Depende de"] === "ninguna" || !fields["Depende de"] ? [] : fields["Depende de"].split(",").map(s => s.trim());
      if (dependencies.some(id => !taskId.test(id))) throw new Error("dependencias inválidas");
      const card: TaskCard = { id: match[1]!, title: match[2]!, requestId: fields.Pedido!, criterion: fields.Criterio!,
        description: fields["Descripción"] ?? "", dependencies, status, verification, result: fields.Resultado ?? "pendiente",
        origin: fields.Origen === "user" ? "user" : "agent", acceptanceEvidence: evidence,
        ...(fields.Bloqueo ? { blocked: fields.Bloqueo } : {}) };
      if (document.tasks.some(t => t.id === card.id)) throw new Error("ID duplicado");
      document.tasks.push(card); document.spans.push({ id: card.id, start, end, raw });
    } catch (error) { document.problems.push(`${title}: ${(error as Error).message}`); }
  }
  return document;
}

export function validateVerification(value: unknown): asserts value is VerificationSpec[] {
  if (!Array.isArray(value)) throw new Error("Verificaciones debe ser un array");
  const ids = new Set<string>();
  for (const v of value) {
    if (!v || typeof v !== "object" || typeof v.id !== "string" || !v.id || ids.has(v.id)
      || !["command", "review", "browser"].includes(v.kind) || typeof v.description !== "string" || !v.description.trim()
      || typeof v.required !== "boolean" || !Array.isArray(v.paths) || v.paths.some((p: unknown) => typeof p !== "string")
      || v.kind === "command" && (typeof v.command !== "string" || !v.command.trim())
      || Object.keys(v).some(key => !["id", "kind", "description", "command", "required", "paths"].includes(key))) throw new Error("Verificación inválida o duplicada");
    ids.add(v.id);
  }
}
function serialize(card: TaskCard, original = ""): string {
  // Retain unknown fields, comments and user prose belonging to this card.
  const known = /^(Pedido|Depende de|Descripción|Criterio|Verificación prevista|Verificaciones|Resultado|Bloqueo|Origen|Evidencia de aceptación):/;
  const extra = original.split(/\r?\n/).slice(1).filter(line => line.trim() && !known.test(line)).join("\n");
  return `### [${card.id}] ${card.title}\nPedido: ${card.requestId}\nDepende de: ${card.dependencies.join(", ") || "ninguna"}\nDescripción: ${JSON.stringify(card.description)}\nCriterio: ${JSON.stringify(card.criterion)}\nVerificación prevista: ${JSON.stringify(card.verification.map(v => v.description).join("; "))}\nVerificaciones: ${JSON.stringify(card.verification)}\nResultado: ${JSON.stringify(card.result)}\nBloqueo: ${JSON.stringify(card.blocked ?? "")}\nOrigen: ${card.origin}\nEvidencia de aceptación: ${JSON.stringify(card.acceptanceEvidence)}\n${extra ? extra + "\n" : ""}\n`;
}
function insert(source: string, card: TaskCard, raw: string): string {
  const section = new RegExp(`^## ${sections[card.status]}\\r?$`, "m").exec(source);
  if (!section) return source + `${source.endsWith("\n") ? "" : "\n"}\n## ${sections[card.status]}\n\n${raw}`;
  const after = section.index + section[0].length;
  const next = /^## /m.exec(source.slice(after));
  const position = next ? after + next.index : source.length;
  return source.slice(0, position) + (source.slice(0, position).endsWith("\n\n") ? "" : "\n") + raw + source.slice(position);
}
export class TaskConflict extends Error {
  constructor(readonly id: string, readonly expected: TaskCard | undefined, readonly current: TaskCard | undefined) { super(`TODO.md: colisión en ${id}; recargá y revisá ambas versiones`); }
}

// Locks coordinate canonical folders across tabs and processes. Active writers
// are waited for until cancellation, with no deadline or task quota.
async function lock(path: string, signal?: AbortSignal): Promise<() => Promise<void>> {
  const token = crypto.randomUUID();
  const candidate = path + `.${token}.tmp`;
  const fd = await open(candidate, "wx");
  try { await fd.writeFile(JSON.stringify({ pid: process.pid, token })); await fd.sync(); } finally { await fd.close(); }
  try {
  for (;;) {
    signal?.throwIfAborted();
    try {
      await link(candidate, path);
      return async () => { if ((await Bun.file(path).json()).token === token) await unlink(path); };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let owner;
      try { owner = await Bun.file(path).json(); } catch { throw new Error(`Lock incompleto: ${path}; revisar antes de escribir`); }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error(`Lock inválido: ${path}`);
      try { process.kill(owner.pid, 0); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") { if ((await Bun.file(path).json()).token === owner.token) await unlink(path).catch(() => {}); continue; } throw error; }
      await Bun.sleep(25);
    }
  }
  } finally { await unlink(candidate).catch(() => {}); }
}
export class TaskStore {
  private constructor(readonly root: string, readonly path: string) {}
  static async open(root: string): Promise<TaskStore> { const canonical = await realpath(root); return new TaskStore(canonical, join(canonical, "TODO.md")); }
  async read(): Promise<TaskDocument> { const file = Bun.file(this.path); return parseTasks(await file.exists() ? await file.text() : ""); }
  async save(cards: TaskCard[], base: TaskDocument, options: { signal?: AbortSignal; record?: (phase: "intent" | "confirmed", revision: string) => Promise<void>; adapt?: boolean } = {}): Promise<TaskDocument> {
    const release = await lock(this.path + ".s42-lock", options.signal);
    const temporary = this.path + `.s42-${crypto.randomUUID()}.tmp`;
    try {
      const current = await this.read();
      if (!current.compatible && !options.adapt) throw new Error("TODO.md usa otro formato; requiere preview y adaptación elegida por el usuario");
      if (current.problems.length) throw new Error(current.problems.join("\n"));
      let source = current.source || "# TODO\n\n## Pendientes\n\n## En progreso\n\n## Terminadas\n\n";
      for (const card of cards) {
        if (!taskId.test(card.id) || !requestId.test(card.requestId) || !card.title.trim() || /[\r\n]/.test(card.title) || !card.criterion.trim() || !Object.hasOwn(sections, card.status)) throw new Error("Tarjeta inválida");
        validateVerification(card.verification);
        const expected = base.tasks.find(t => t.id === card.id), actual = current.tasks.find(t => t.id === card.id);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new TaskConflict(card.id, expected, actual);
        const parsed = parseTasks(source), span = parsed.spans.find(s => s.id === card.id);
        const raw = serialize(card, span?.raw);
        if (span && actual?.status === card.status) source = source.slice(0, span.start) + raw + source.slice(span.end);
        else {
          if (span) source = source.slice(0, span.start) + source.slice(span.end);
          source = insert(source, card, raw);
        }
      }
      if (source === current.source) return current;
      await options.record?.("intent", revision(source));
      const fd = await open(temporary, "wx");
      try { await fd.writeFile(source); await fd.sync(); } finally { await fd.close(); }
      options.signal?.throwIfAborted();
      // External editors do not use our lock. Refuse if one raced the prepare.
      if ((await this.read()).revision !== current.revision) throw new TaskConflict("document", undefined, undefined);
      await rename(temporary, this.path);
      await options.record?.("confirmed", revision(source));
      return parseTasks(source);
    } finally { await unlink(temporary).catch(() => {}); await release(); }
  }
}
