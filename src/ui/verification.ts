import { form } from "./dialogs.ts";
import { join } from "node:path";
import { fingerprints, verificationRuns, type TaskEvent, type VerificationRun } from "../agent/tasks.ts";
import { TaskStore, type TaskCard, type VerificationSpec } from "../storage/tasks.ts";
import type { SessionEvent } from "../storage/sessions.ts";
import { gitRepository, gitCommand, gitCommitDetail } from "../system/git.ts";
import { runCommand } from "../system/command.ts";
import { SelectList } from "./components/select-list.ts";
import { TextArea } from "./components/text-area.ts";
import { Button } from "./components/button.ts";
import type { Component } from "./components/component.ts";
import type { TaskPanelContext } from "./tasks.ts";
import type { Canvas } from "./canvas.ts";
import type { Rect } from "./types.ts";
import { theme } from "./theme.ts";

export interface VerificationContext extends TaskPanelContext {
  task: <T>(label: string, work: (signal: AbortSignal) => Promise<T>) => Promise<T>;
  cancel: () => void;
  closeout: (card: TaskCard, files: string[], message: string, summary: string) => Promise<void>;
}
export class VerificationPanel {
  readonly list = new SelectList("verification-list", { x: 0, y: 3, width: 22, height: 7 }, [], () => { void this.detail(); });
  readonly text = new TextArea("verification-detail", { x: 23, y: 3, width: 50, height: 7 });
  readonly buttons: Button[];
  readonly controls: Component[];
  taskId?: string;
  card?: TaskCard;
  private history: SessionEvent[] = [];
  private runs: VerificationRun[] = [];
  private generation = 0;
  private detailGeneration = 0;
  private visible = false;
  private notice = "";
  private store?: TaskStore;
  constructor(readonly ctx: VerificationContext) {
    this.text.readOnly = true; this.text.lineNumbers = true; this.text.onSelect = text => ctx.desktop.copyToClipboard(text);
    this.buttons = [
      ["run", "Ejecutar prueba", () => this.act(() => this.run())], ["cancel", "Cancelar", () => ctx.cancel()],
      ["manual", "Confirmar revisión", () => this.act(() => this.confirm())], ["refresh", "Refrescar", () => { void this.refresh(); }],
      ["closeout", "Cerrar tarea / commit", () => { if (this.card) { const card = this.card; form(ctx.desktop, ctx.desktop.t("Cerrar tarea / commit"), [{ label: "Archivos (JSON)", value: JSON.stringify([...new Set(card.verification.flatMap(v => v.paths))]) }, { label: "Mensaje commit", value: card.title }, { label: "Resultado", value: card.result }], async ([files, message, summary]) => { const paths: unknown = JSON.parse(files!); if (!Array.isArray(paths) || paths.some(p => typeof p !== "string")) throw new Error("Archivos debe ser un array JSON"); await ctx.closeout(card, paths, message!, summary!); await this.refresh(); }); } }],
      ["changes", "Cambios de tarea", () => this.act(() => this.changes())], ["resume", "Continuar tarea", () => { if (this.card) ctx.continue(this.card); }],
    ].map(([id, label, action]) => new Button(`verification-${id}`, { x: 0, y: 0, width: 12, height: 1 }, label as string, action as () => void));
    for (const button of this.buttons) button.translate = ctx.desktop.t;
    this.controls = [...this.buttons, this.list, this.text];
  }
  show(taskId?: string): void { if (taskId) this.taskId = taskId; this.visible = true; void this.refresh(); }
  hide(): void { this.visible = false; this.generation++; this.detailGeneration++; }
  async refresh(): Promise<void> {
    const generation = ++this.generation;
    try {
      this.store ??= await TaskStore.open(this.ctx.cwd);
      const [document, history] = await Promise.all([this.store.read(), this.ctx.loadEvents()]);
      if (!this.visible || generation !== this.generation) return;
      this.card = document.tasks.find(t => t.id === this.taskId) ?? document.tasks.find(t => t.status === "doing") ?? document.tasks[0];
      this.taskId = this.card?.id; this.history = [...history, ...this.ctx.events()].filter((e, i, all) => all.findIndex(v => v.id === e.id) === i);
      this.runs = verificationRuns(this.history, this.taskId);
      this.list.setItems(this.card?.verification.map(v => v.description) ?? [], this.list.selected);
      this.list.emptyText = this.ctx.desktop.t("Sin verificaciones");
      await this.detail();
    } catch (error) { if (generation === this.generation) this.notice = (error as Error).message; }
    finally { this.ctx.desktop.invalidate(); }
  }
  layout(client: Rect): void {
    const buttonWidth = Math.max(1, Math.floor(client.width / 3));
    this.buttons.forEach((button, i) => Object.assign(button.bounds, { x: (i % 3) * buttonWidth, y: Math.floor(i / 3), width: buttonWidth }));
    const width = Math.max(12, Math.floor(client.width / 3)), rows = Math.max(1, client.height - 3);
    Object.assign(this.list.bounds, { x: 0, y: 4, width, height: Math.max(1, rows - 1) });
    Object.assign(this.text.bounds, { x: width, y: 4, width: Math.max(1, client.width - width), height: Math.max(1, rows - 1) });
    this.buttons[0]!.disabled = !this.card || this.card.verification[this.list.selected]?.kind !== "command";
    this.buttons[2]!.disabled = !this.card || this.card.verification[this.list.selected]?.kind !== "review";
    this.buttons[4]!.disabled = this.buttons[5]!.disabled = this.buttons[6]!.disabled = !this.card;
  }
  draw(canvas: Canvas, client: Rect): void {
    canvas.text(client.x, client.y + 3, this.notice || this.card?.title || this.ctx.desktop.t("Sin tareas"), theme.window, client.width);
  }
  private act(work: () => Promise<void>): void {
    void work().catch(error => { this.notice = (error as Error).message; }).finally(() => this.ctx.desktop.invalidate());
  }
  async detail(): Promise<void> {
    const generation = ++this.detailGeneration, card = this.card;
    if (!card) { this.text.setValue(this.ctx.desktop.t("Sin tareas")); return; }
    const t = this.ctx.desktop.t, spec = card.verification[this.list.selected];
    const lines = [`${card.id}\n${card.title}`, `${t("Criterio")}: ${card.criterion}`, `${t("Estado de ejecución")}: ${card.status}${card.blocked ? ` · ${card.blocked}` : ""}`,
      `${t("Origen")}: ${card.origin}`, `${t("Aceptación")}: ${card.acceptanceEvidence.join(", ") || t("Pendiente")}`, card.result, ""];
    const request = this.history.findLast(e => e.type === "task-request" && e.request.requestId === card.requestId);
    if (request?.type === "task-request") lines.push(`${t("Git inicial")}: ${JSON.stringify(request.request.baseline)}`);
    const close = this.history.findLast(e => e.type === "task-closeout" && e.requestId === card.requestId);
    lines.push(`${t("Cierre Git")}: ${close?.type === "task-closeout" ? `${close.state} · ${close.sha ?? ""}\n${close.detail}` : t("Pendiente")}`);
    if (spec) {
      lines.push("", `${t("Verificación prevista")}: ${spec.description}`, `${t("Tipo")}: ${spec.kind}`, `${t("Comando")}: ${spec.command ?? ""}`);
      const runs = this.runs.filter(r => r.specId === spec.id);
      if (!runs.length) lines.push(t("Pendiente"));
      for (const run of runs) {
        const stale = JSON.stringify(run.files) !== JSON.stringify(await fingerprints(this.ctx.cwd, spec.paths)) || spec.kind === "command" && spec.command !== run.command;
        lines.push("", run.id, `${t("Estado")}: ${t(run.state === "passed" ? "Aprobada" : run.state === "failed" ? "Fallida" : run.state === "cancelled" ? "Cancelada" : run.state === "interrupted" ? "Interrumpida" : "Ejecutando")}${stale ? ` · ${t("Requiere revalidación")}` : ""}`,
          `${t("Origen")}: ${run.origin}`, `${t("Inicio")}: ${run.started}`, `${t("Fin")}: ${run.ended ?? ""}`, `cwd: ${run.cwd}`, `exit: ${run.exitCode ?? "N/D"}`, run.stdout, run.stderr);
        for (const path of run.evidence ?? []) if (!this.history.some(e => e.id === path || e.type === "tool-result" && e.callId === path || e.type === "task-verification" && e.run.id === path))
          lines.push(`${t("Evidencia")}: ${path} · ${await Bun.file(join(this.ctx.cwd, path)).exists() ? t("Disponible") : t("Archivo ausente")}`);
      }
    }
    if (this.visible && generation === this.detailGeneration) { const text = lines.join("\n"); if (this.text.value !== text) this.text.setValue(text, "start"); this.notice = ""; this.ctx.desktop.invalidate(); }
  }
  async run(): Promise<void> {
    const card = this.card, spec = card?.verification[this.list.selected]; if (!card || spec?.kind !== "command" || !spec.command) return;
    const command = spec.command;
    await this.ctx.task("Ejecutando verificación…", async signal => {
      const run: VerificationRun = { id: `V-run-${crypto.randomUUID()}`, taskId: card.id, specId: spec.id, state: "running", command: spec.command,
        cwd: this.ctx.cwd, started: new Date().toISOString(), stdout: "", stderr: "", files: await fingerprints(this.ctx.cwd, spec.paths), origin: "harness" };
      await this.ctx.record({ type: "task-verification", run: structuredClone(run) });
      const pendingOutput: Promise<void>[] = [];
      try {
        const result = await runCommand(command, { cwd: this.ctx.cwd, signal, onOutput: (stream, text) => {
          run[stream] += text;
          const pending = this.ctx.record({ type: "task-verification-output", runId: run.id, stream, text }); pendingOutput.push(pending); void pending.catch(() => {});
          if (this.visible && this.card?.id === card.id) { this.text.update(`${run.command}\n${run.stdout}\n${run.stderr}`); this.ctx.desktop.invalidate(); }
        } });
        run.exitCode = result.exitCode; run.stdout = result.stdout; run.stderr = result.stderr;
        run.state = result.cancelled ? "cancelled" : result.failed ? "failed" : "passed";
      } catch (error) { run.state = signal.aborted ? "cancelled" : "failed"; run.stderr += (error as Error).message; }
      await Promise.all(pendingOutput); run.ended = new Date().toISOString(); await this.ctx.record({ type: "task-verification", run });
    }); await this.refresh();
  }
  async confirm(): Promise<void> {
    const card = this.card, spec = card?.verification[this.list.selected]; if (!card || spec?.kind !== "review") return;
    // This button is an explicit human observation, never callable by a model.
    const now = new Date().toISOString(), run: VerificationRun = { id: `V-run-${crypto.randomUUID()}`, taskId: card.id, specId: spec.id, state: "passed", cwd: this.ctx.cwd,
      started: now, ended: now, stdout: spec.description, stderr: "", files: await fingerprints(this.ctx.cwd, spec.paths), origin: "user" };
    await this.ctx.record({ type: "task-verification", run }); await this.refresh();
  }
  async changes(): Promise<void> {
    const card = this.card; if (!card) return;
    const lines = [this.ctx.desktop.t("Ediciones del pedido registradas por tools nativas"), card.requestId];
    const effects = this.history.filter(e => e.type === "task-file" && e.requestId === card.requestId && e.phase === "confirmed");
    for (const effect of effects) if (effect.type === "task-file") {
      const decode = (value: string | null) => { if (value === null) return this.ctx.desktop.t("Archivo ausente"); const bytes = Buffer.from(value, "base64"); try { if (bytes.includes(0)) throw new Error(); return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return this.ctx.desktop.t("Archivo binario"); } };
      lines.push("", effect.path, this.ctx.desktop.t("Antes"), decode(effect.before), this.ctx.desktop.t("Después"), decode(effect.after));
    }
    const repo = await gitRepository(this.ctx.cwd), request = this.history.findLast(e => e.type === "task-request" && e.request.requestId === card.requestId);
    lines.push("", this.ctx.desktop.t("Cambios observados; autoría desconocida"));
    if (repo.state === "ready" && request?.type === "task-request" && request.request.baseline.state === "ready" && request.request.baseline.status.head) {
      const result = await gitCommand(repo.root, ["diff", "--no-ext-diff", "--no-textconv", request.request.baseline.status.head, "--"]);
      lines.push(result.stdout || result.stderr);
    }
    const closeouts = this.history.filter(e => e.type === "task-closeout" && e.requestId === card.requestId && e.sha);
    for (const close of closeouts) if (close.type === "task-closeout" && repo.state === "ready") lines.push(await gitCommitDetail(repo.root, close.sha!));
    if (this.visible && this.card?.id === card.id) { this.text.setValue(lines.join("\n"), "start"); this.ctx.desktop.invalidate(); }
  }
}
