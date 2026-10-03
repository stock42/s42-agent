import { resolve } from "node:path";
import type { Session, SessionEvent } from "../storage/sessions.ts";
import { TaskStore, type TaskCard, type TaskDocument, type VerificationSpec } from "../storage/tasks.ts";
import { gitRepository, type GitRepository } from "../system/git.ts";
import { runCommand, type CommandOutput } from "../system/command.ts";

export interface TaskPolicy { changelog: boolean; commit: boolean; push: boolean }
export interface TaskRequest { requestId: string; objective: string; baseline: GitRepository; policy: TaskPolicy; mode?: "execution" | "planning" }
export interface VerificationRun {
  id: string; taskId: string; specId: string; state: "running" | "passed" | "failed" | "cancelled" | "interrupted";
  command?: string; cwd: string; started: string; ended?: string; exitCode?: number; stdout: string; stderr: string;
  browser?: { url: string; steps: string[]; expected: string; observed: string };
  files: Record<string, string | null>; origin: "harness" | "browser" | "user"; evidence?: string[];
}
export type TaskEvent =
  | { type: "task-request"; request: TaskRequest }
  | { type: "task-focus"; requestId: string }
  | { type: "task-record"; requestId: string; taskIds: string[]; phase: "intent" | "confirmed"; revision: string }
  | { type: "task-file"; requestId: string; callId: string; path: string; before: string | null; after: string | null; phase: "intent" | "confirmed" }
  | { type: "task-verification"; run: VerificationRun }
  | { type: "task-verification-output"; runId: string; stream: "stdout" | "stderr"; text: string }
  | { type: "task-closeout-intent"; requestId: string; parent?: string; tree: string; paths: string[]; message: string; indexEntries?: Record<string, string> }
  | { type: "task-closeout"; requestId: string; state: "pending" | "failed" | "committed" | "pushed" | "unavailable"; sha?: string; detail: string };
export interface PlannedTask {
  id?: string; title: string; description?: string; criterion: string; dependencies?: string[];
  verification: Omit<VerificationSpec, "id">[];
}
const fingerprint = (data: Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex");
export async function fingerprints(cwd: string, paths: string[]): Promise<Record<string, string | null>> {
  const pairs = await Promise.all(paths.map(async path => {
    const file = Bun.file(resolve(cwd, path)); return [path, await file.exists() ? fingerprint(await file.bytes()) : null] as const;
  })); return Object.fromEntries(pairs);
}
export function verificationRuns(events: SessionEvent[], taskId?: string): VerificationRun[] {
  const runs = new Map<string, VerificationRun>();
  for (const event of events) {
    if (event.type === "task-verification" && (!taskId || event.run.taskId === taskId)) runs.set(event.run.id, structuredClone(event.run));
    if (event.type === "task-verification-output") { const run = runs.get(event.runId); if (run?.state === "running") run[event.stream] += event.text; }
  }
  return [...runs.values()];
}
export function taskPolicy(instructions: string): TaskPolicy {
  // Recognize the literal rules produced by AGENTS generation and common
  // explicit policies. Ambiguous natural-language instructions remain visible
  // to the model; unrelated repositories never inherit this repo's policy.
  const positive = instructions.split("\n").filter(line => !/\b(?:no|never|don't|do not)\b[^.;]*(?:push|commit|changelog)/i.test(line)).join("\n");
  return { changelog: /(?:siempre|always|al terminar|after each task|at the end)[^\n]*CHANGELOG|CHANGELOG[^\n]*(?:cada tarea|each task)/i.test(positive),
    commit: /(?:siempre|always|al terminar|at the end)[^\n]*(?:commit|commite)|(?:commit|commite)[^\n]*(?:terminar|finish|each task)/i.test(positive),
    push: /(?:siempre|always|al terminar|at the end)[^\n]*push|(?:hacer|do|must)[^\n]*push/i.test(positive) };
}
export class TurnTasks {
  request?: TaskRequest;
  attempted = false;
  private constructor(readonly store: TaskStore, readonly session: Session, readonly signal: AbortSignal, readonly policy: TaskPolicy) {}
  static async open(cwd: string, session: Session, signal: AbortSignal, guidance: string): Promise<TurnTasks> {
    const state = new TurnTasks(await TaskStore.open(cwd), session, signal, taskPolicy(guidance));
    const document = await state.store.read();
    for (const intent of [...session.state.events]) if (intent.type === "task-record" && intent.phase === "intent"
      && !session.state.events.some(e => e.type === "task-record" && e.phase === "confirmed" && e.revision === intent.revision && e.requestId === intent.requestId)) {
      if (document.revision === intent.revision) await session.append({ type: "task-record", requestId: intent.requestId, taskIds: intent.taskIds, phase: "confirmed", revision: document.revision });
    }
    // A task-focus is explicit continuity; simply reopening a chat does not
    // silently attach a new user request to an unfinished request.
    const focus = session.state.events.findLast(e => e.type === "task-focus");
    if (focus?.type === "task-focus") {
      const request = session.state.events.findLast(e => e.type === "task-request" && e.request.requestId === focus.requestId);
      if (request?.type === "task-request") state.request = request.request;
    }
    return state;
  }
  private record(document: TaskDocument, cards: TaskCard[]) {
    return this.store.save(cards, document, { signal: this.signal, record: (phase, revision) => this.session.append({ type: "task-record", requestId: this.request!.requestId, taskIds: cards.map(c => c.id), phase, revision }) });
  }
  async plan(objective: string, steps: PlannedTask[], mode: "execution" | "planning" = "execution"): Promise<TaskCard[]> {
    if (!objective.trim() || !steps.length) throw new Error("El plan requiere objetivo y etapas con criterios/verificaciones");
    const base = await this.store.read();
    const fresh = !this.request;
    if (!this.request) {
      this.request = { requestId: `R-${crypto.randomUUID()}`, objective, baseline: await gitRepository(this.store.root, this.signal), policy: this.policy, mode };
      await this.session.append({ type: "task-request", request: this.request });
    }
    const cards: TaskCard[] = steps.map(step => {
      const old = step.id ? base.tasks.find(t => t.id === step.id && t.requestId === this.request!.requestId) : undefined;
      if (step.id && !old) throw new Error(`ID no pertenece al pedido: ${step.id}`);
      if (!step.criterion?.trim() || !Array.isArray(step.verification) || !step.verification.length) throw new Error("Cada etapa requiere criterio y verificación proporcional, incluso una revisión documental");
      return { id: old?.id ?? `T-${crypto.randomUUID()}`, requestId: this.request!.requestId, title: step.title, description: step.description ?? old?.description ?? "",
        criterion: step.criterion, dependencies: step.dependencies ?? old?.dependencies ?? [], status: old?.status ?? "pending",
        verification: step.verification.map((v, index) => ({ ...v, id: old?.verification[index]?.id ?? `V-${crypto.randomUUID()}` })),
        result: old?.result ?? "pendiente", origin: "agent", acceptanceEvidence: [] };
    });
    const ids = new Set([...base.tasks.map(t => t.id), ...cards.map(t => t.id)]);
    if (cards.some(c => c.dependencies.some(id => !ids.has(id) || id === c.id))) throw new Error("Dependencia inexistente o circular sobre la misma tarea");
    const all = [...base.tasks.filter(t => !cards.some(c => c.id === t.id)), ...cards], visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string) => { if (visiting.has(id)) throw new Error("Dependencias circulares"); if (visited.has(id)) return; visiting.add(id); for (const dep of all.find(t => t.id === id)?.dependencies ?? []) visit(dep); visiting.delete(id); visited.add(id); };
    for (const card of all) visit(card.id);
    try { await this.record(base, cards); } catch (error) { if (fresh) this.request = undefined; throw error; }
    return cards;
  }
  async requirePlan(): Promise<void> {
    this.attempted = true;
    const document = await this.store.read();
    if (!this.request || !document.tasks.some(t => t.requestId === this.request!.requestId)) throw new Error("Plan requerido: usá task_plan con objetivo, etapas, criterios y verificaciones antes de ejecutar mutaciones o shell");
    if (this.request.mode === "planning") throw new Error("Pedido de planificación: implementación no autorizada por este plan");
    if (document.problems.length) throw new Error(document.problems.join("\n"));
    if (document.tasks.filter(t => t.requestId === this.request!.requestId).every(t => t.status === "done")) throw new Error("Todas las etapas están terminadas: revisá el plan antes de realizar nuevas mutaciones");
  }
  async update(id: string, values: { status?: TaskCard["status"]; result?: string; blocked?: string; acceptanceEvidence?: string[] }): Promise<TaskCard> {
    const document = await this.store.read(), card = document.tasks.find(t => t.id === id && t.requestId === this.request?.requestId);
    if (!card) throw new Error("Tarea no pertenece al pedido activo");
    const next = { ...card, ...values, origin: "agent" as const };
    if (next.status !== "pending" && next.dependencies.some(id => document.tasks.find(t => t.id === id)?.status !== "done")) throw new Error("Dependencias pendientes");
    if (next.acceptanceEvidence.some(id => !this.evidenceExists(id))) throw new Error("Referencia de evidencia inexistente/fallida; no se puede simular una confirmación humana");
    if (next.status === "done") { const pending = await this.cardPending(next); if (pending.length) throw new Error(pending.join("\n")); }
    await this.record(document, [next]); return next;
  }
  private evidenceExists(id: string): boolean {
    return this.session.state.events.some(e => e.type === "tool-result" && e.callId === id && !e.failed)
      || verificationRuns(this.session.state.events).some(v => v.id === id && v.state === "passed");
  }
  async verify(taskId: string, specId: string, onOutput?: CommandOutput): Promise<VerificationRun> {
    await this.requirePlan();
    const card = (await this.store.read()).tasks.find(t => t.id === taskId && t.requestId === this.request?.requestId);
    const spec = card?.verification.find(v => v.id === specId);
    if (!card || !spec) throw new Error("Verificación no pertenece al pedido activo");
    if (spec.kind !== "command" || !spec.command) throw new Error("Revisión/navegador requiere evidencia observada; task_verify ejecuta comandos previstos");
    const run: VerificationRun = { id: `V-run-${crypto.randomUUID()}`, taskId, specId, state: "running", command: spec.command,
      cwd: this.store.root, started: new Date().toISOString(), stdout: "", stderr: "", files: await fingerprints(this.store.root, spec.paths), origin: "harness" };
    await this.session.append({ type: "task-verification", run: structuredClone(run) });
    const pendingOutput: Promise<void>[] = [];
    try {
      const result = await runCommand(spec.command, { cwd: this.store.root, signal: this.signal, onOutput: (stream, text) => {
        run[stream] += text; onOutput?.(stream, text);
        const pending = this.session.append({ type: "task-verification-output", runId: run.id, stream, text }); pendingOutput.push(pending); void pending.catch(() => {});
      } });
      run.stdout = result.stdout; run.stderr = result.stderr; run.exitCode = result.exitCode;
      run.state = result.cancelled ? "cancelled" : result.failed ? "failed" : "passed";
    } catch (error) { run.state = this.signal.aborted ? "cancelled" : "failed"; run.stderr += (error as Error).message; }
    await Promise.all(pendingOutput); run.ended = new Date().toISOString(); await this.session.append({ type: "task-verification", run }); return run;
  }
  async review(taskId: string, specId: string, evidence: string[]): Promise<VerificationRun> {
    const card = (await this.store.read()).tasks.find(t => t.id === taskId && t.requestId === this.request?.requestId), spec = card?.verification.find(v => v.id === specId);
    if (!card || spec?.kind !== "review" || !evidence.length || evidence.some(id => !this.evidenceExists(id))) throw new Error("La revisión exige referencias a resultados existentes");
    const now = new Date().toISOString(), run: VerificationRun = { id: `V-run-${crypto.randomUUID()}`, taskId, specId, state: "passed", cwd: this.store.root,
      started: now, ended: now, stdout: spec.description, stderr: "", origin: "harness", evidence, files: await fingerprints(this.store.root, spec.paths) };
    await this.session.append({ type: "task-verification", run }); return run;
  }
  async browserReview(taskId: string, specId: string, evidence: string[], browser: NonNullable<VerificationRun["browser"]>, passed: boolean): Promise<VerificationRun> {
    const card = (await this.store.read()).tasks.find(t => t.id === taskId && t.requestId === this.request?.requestId), spec = card?.verification.find(v => v.id === specId);
    if (!card || spec?.kind !== "browser" || !browser.url || !browser.steps.length || !browser.expected || !browser.observed || !evidence.length) throw new Error("Prueba web requiere URL, pasos, esperado, observado y referencias reales");
    const observations = evidence.map(id => this.session.state.events.findLast(e => e.type === "browser-observation" && e.requestId === card.requestId && e.callId === id));
    const invalid = evidence.filter((id, i) => { const event = observations[i]; return event?.type === "browser-observation" ? passed && event.failed : !this.evidenceExists(id); });
    if (!observations.some(e => e?.type === "browser-observation") || invalid.length) throw new Error(`Evidencia web requiere observación del pedido y referencias válidas; IDs inválidos: ${invalid.join(", ")}`);
    const now = new Date().toISOString(), run: VerificationRun = { id: `V-run-${crypto.randomUUID()}`, taskId, specId, state: passed ? "passed" : "failed", cwd: this.store.root, started: now, ended: now, stdout: browser.observed, stderr: passed ? "" : `Esperado: ${browser.expected}`, files: await fingerprints(this.store.root, spec.paths), origin: "browser", evidence, browser };
    await this.session.append({ type: "task-verification", run }); return run;
  }
  async cardPending(card: TaskCard): Promise<string[]> {
    const pending: string[] = [];
    if (!card.acceptanceEvidence.length) pending.push(`${card.id}: criterio sin evidencia registrada`);
    for (const spec of card.verification.filter(v => v.required)) {
      const last = verificationRuns(this.session.state.events, card.id).findLast(v => v.specId === spec.id);
      if (!last || last.state !== "passed") { pending.push(`${card.id}: ${spec.description} (${last?.state ?? "pending"})`); continue; }
      if (last.command !== spec.command && spec.kind === "command" || JSON.stringify(last.files) !== JSON.stringify(await fingerprints(this.store.root, spec.paths))) pending.push(`${card.id}: ${spec.description} requiere revalidación`);
    }
    return pending;
  }
  async finalization(): Promise<{ state: "completed" | "blocked" | "incomplete" | "guidance"; pending: string[] }> {
    if (!this.request) return { state: this.attempted ? "incomplete" : "guidance", pending: this.attempted ? ["Registrar plan con task_plan; las mutaciones rechazadas no se ejecutaron"] : [] };
    if (this.request.mode === "planning") return { state: "guidance", pending: [] };
    const document = await this.store.read(), cards = document.tasks.filter(t => t.requestId === this.request!.requestId), pending = [...document.problems];
    for (const card of cards) { if (card.status !== "done") pending.push(`${card.id}: ${card.title} (${card.status})`); pending.push(...await this.cardPending(card)); }
    if (!cards.length) pending.push("El plan no tiene tarjetas reconocidas en TODO.md");
    const policy = this.request.policy;
    const closeout = this.session.state.events.findLast(e => e.type === "task-closeout" && e.requestId === this.request!.requestId);
    const repository = await gitRepository(this.store.root, this.signal);
    if ((policy.commit || policy.changelog) && repository.state === "ready"
      && !(closeout?.type === "task-closeout" && ["committed", "pushed"].includes(closeout.state))) pending.push("Cierre documental/Git requerido por AGENTS.md pendiente");
    if (policy.push && repository.state === "ready" && !(closeout?.type === "task-closeout" && closeout.state === "pushed")) pending.push("Push autorizado por el proyecto pendiente");
    return { state: !pending.length ? "completed" : cards.some(t => t.status !== "done" && t.blocked?.trim()) ? "blocked" : "incomplete", pending };
  }
  async context(): Promise<string> {
    if (!this.request) return "";
    const tasks = (await this.store.read()).tasks.filter(t => t.requestId === this.request!.requestId);
    const runs = verificationRuns(this.session.state.events).filter(v => tasks.some(t => t.id === v.taskId)).map(({ id, taskId, specId, state, exitCode, files }) => ({ id, taskId, specId, state, exitCode, files }));
    return `Active task request ${this.request.requestId}: ${this.request.objective}\nTODO.md is authoritative. Task IDs, criteria, verification IDs and progress:\n${JSON.stringify(tasks)}\nVerification runs (original output in session_history):\n${JSON.stringify(runs)}\nCompleted turn is distinct from completed task. Recover original results with session_history; do not repeat prior effects.`;
  }
  async fileEffect(callId: string, path: string, work: () => Promise<unknown>): Promise<unknown> {
    await this.requirePlan(); const file = Bun.file(path), before = await file.exists() ? Buffer.from(await file.bytes()).toString("base64") : null;
    await this.session.append({ type: "task-file", requestId: this.request!.requestId, callId, path, before, after: null, phase: "intent" });
    const result = await work();
    const after = await file.exists() ? Buffer.from(await file.bytes()).toString("base64") : null;
    await this.session.append({ type: "task-file", requestId: this.request!.requestId, callId, path, before, after, phase: "confirmed" });
    return result;
  }
}
