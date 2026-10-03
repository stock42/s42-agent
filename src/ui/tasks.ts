import { watch, type FSWatcher } from "node:fs";
import { TaskStore, TaskConflict, type TaskCard, type TaskDocument, type TaskStatus } from "../storage/tasks.ts";
import type { SessionEvent } from "../storage/sessions.ts";
import type { TaskEvent } from "../agent/tasks.ts";
import { fingerprints, taskPolicy, verificationRuns } from "../agent/tasks.ts";
import { gitRepository } from "../system/git.ts";
import { instructions } from "../agent/tools.ts";
import { Component } from "./components/component.ts";
import { SelectList } from "./components/select-list.ts";
import { Button } from "./components/button.ts";
import { form, choose, info } from "./dialogs.ts";
import type { Desktop } from "./desktop.ts";
import type { Canvas } from "./canvas.ts";
import { contains, type InputEvent, type Rect } from "./types.ts";
import { theme } from "./theme.ts";

const states: TaskStatus[] = ["pending", "doing", "done"];
const labels = { pending: "Pendientes", doing: "En progreso", done: "Terminadas" };
export interface TaskPanelContext {
  cwd: string; desktop: Desktop; events: () => SessionEvent[];
  record: (event: TaskEvent) => Promise<void>; loadEvents: () => Promise<SessionEvent[]>;
  verify: (card: TaskCard) => void; continue: (card: TaskCard) => void;
}
class TaskColumn extends Component {
  readonly list: SelectList;
  constructor(readonly state: TaskStatus, private board: TaskBoard) {
    super(`tasks-${state}`, { x: 0, y: 2, width: 24, height: 8 });
    this.list = new SelectList(`${this.id}-list`, { x: 0, y: 1, width: 24, height: 7 }, [], () => board.select(this.state, this.list.selected));
  }
  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    Object.assign(this.list.bounds, { width: bounds.width, height: Math.max(1, bounds.height - 1) });
    canvas.text(bounds.x, bounds.y, this.board.ctx.desktop.t(labels[this.state]), this.board.destination === this.state ? theme.selected : theme.title, bounds.width);
    this.list.draw(canvas, { ...bounds, y: bounds.y + 1, height: Math.max(1, bounds.height - 1) }, focused);
  }
  handle(event: InputEvent): boolean {
    if (this.disabled) return false;
    if (event.type === "mouse") {
      if (event.action === "move" && this.board.dragging) { this.board.dragTo(event.x + this.bounds.x, event.y + this.bounds.y); return true; }
      if (event.action === "release" && this.board.dragging) { this.board.drop(event.cancelled ?? false); return true; }
      const handled = this.list.handle({ ...event, y: event.y - 1 });
      if (event.action === "press") {
        const index = this.list.indexAt(event.x, event.y - 1);
        if (index !== undefined) { this.board.select(this.state, index); this.board.dragging = this.board.selected?.id; }
      }
      return handled;
    }
    if (event.type === "key") {
      if (event.key === "enter") { this.board.open(); return true; }
      if (event.key === "left" || event.key === "right") { this.board.column(states[(states.indexOf(this.state) + (event.key === "right" ? 1 : 2)) % 3]!); return true; }
      if (event.key === "shift+left" || event.key === "shift+right") {
        const next = states[(states.indexOf(this.state) + (event.key === "shift+right" ? 1 : 2)) % 3]!;
        if (this.board.selected) this.board.act(() => this.board.move(this.board.selected!, next)); return true;
      }
      if (event.key === "ctrl+up" || event.key === "ctrl+down") { this.board.act(() => this.board.reorder(event.key === "ctrl+up" ? -1 : 1)); return true; }
    }
    return this.list.handle(event);
  }
}
export class TaskBoard {
  readonly columns = states.map(s => new TaskColumn(s, this));
  readonly controls: Component[];
  readonly buttons: Button[];
  document?: TaskDocument;
  state: TaskStatus = "pending";
  selectedId?: string;
  destination?: TaskStatus;
  dragging?: string;
  notice = "";
  private store?: TaskStore;
  private watcher?: FSWatcher;
  private generation = 0;
  private visible = false;
  private narrow = false;
  private history: SessionEvent[] = [];
  constructor(readonly ctx: TaskPanelContext) {
    this.buttons = [
      ["new", "Nueva tarea", () => this.edit()], ["edit", "Editar", () => this.edit(this.selected)],
      ["verify", "Verificación", () => { if (this.selected) ctx.verify(this.selected); }],
      ["resume", "Continuar tarea", () => { if (this.selected) ctx.continue(this.selected); }],
      ["refresh", "Refrescar", () => { void this.refresh(); }], ["column", "Columna", () => this.column(states[(states.indexOf(this.state) + 1) % 3]!)],
    ].map(([id, label, action]) => new Button(`task-${id}`, { x: 0, y: 0, width: 12, height: 1 }, label as string, action as () => void));
    for (const button of this.buttons) button.translate = ctx.desktop.t;
    this.controls = [...this.buttons, ...this.columns];
  }
  get selected(): TaskCard | undefined { return this.document?.tasks.find(t => t.id === this.selectedId); }
  get events(): SessionEvent[] { return [...this.history, ...this.ctx.events()].filter((e, i, all) => all.findIndex(v => v.id === e.id) === i); }
  tasks(state: TaskStatus): TaskCard[] { return this.document?.tasks.filter(t => t.status === state) ?? []; }
  select(state: TaskStatus, index: number): void { this.state = state; this.selectedId = this.tasks(state)[index]?.id; this.ctx.desktop.invalidate(); }
  column(state: TaskStatus): void {
    this.state = state; const column = this.columns[states.indexOf(state)]!;
    this.selectedId = this.tasks(state)[column.list.selected]?.id;
    const window = this.ctx.desktop.windows.find(w => w.controls.includes(column));
    if (window) { window.focusedId = column.id; if (this.narrow) this.layout(window.client); }
    this.ctx.desktop.invalidate();
  }
  show(): void {
    this.visible = true; void this.refresh();
    if (!this.watcher) this.watcher = watch(this.ctx.cwd, (_, filename) => { if (filename === "TODO.md" || filename === null) void this.refresh(); });
  }
  hide(): void { this.visible = false; this.generation++; this.watcher?.close(); this.watcher = undefined; this.dragging = undefined; this.destination = undefined; }
  async refresh(): Promise<void> {
    const generation = ++this.generation;
    try {
      this.store ??= await TaskStore.open(this.ctx.cwd);
      const [document, history] = await Promise.all([this.store.read(), this.ctx.loadEvents()]);
      if (!this.visible || generation !== this.generation) return;
      this.document = document; this.history = history;
      this.notice = document.problems.join(" · ") || (!document.compatible ? "TODO.md usa otro formato; adaptación con preview" : "");
      for (const column of this.columns) {
        const tasks = this.tasks(column.state), prior = column.list.items[column.list.selected];
        const items = await Promise.all(tasks.map(async t => {
          const runs = verificationRuns(this.events, t.id);
          const valid = await Promise.all(t.verification.map(async v => { const run = runs.findLast(r => r.specId === v.id); return run?.state === "passed" && (v.kind !== "command" || v.command === run.command) && JSON.stringify(run.files) === JSON.stringify(await fingerprints(this.ctx.cwd, v.paths)); }));
          const passed = valid.filter(Boolean).length;
          return `${t.title}${t.blocked ? " [!]" : ""} · ${passed}/${t.verification.length}`;
        }));
        if (!this.visible || generation !== this.generation) return;
        const selected = this.selectedId ? tasks.findIndex(t => t.id === this.selectedId) : -1;
        column.list.setItems(items, selected >= 0 ? selected : Math.max(0, items.indexOf(prior ?? "")));
        column.list.emptyText = this.ctx.desktop.t("Sin tareas");
      }
      if (!this.selected || this.selected.status !== this.state) this.select(this.state, this.columns[states.indexOf(this.state)]!.list.selected);
      this.ctx.desktop.invalidate();
    } catch (error) { if (generation === this.generation) { this.notice = (error as Error).message; this.ctx.desktop.invalidate(); } }
  }
  layout(client: Rect): void {
    this.narrow = client.width < 90;
    const buttonWidth = Math.max(1, Math.floor(client.width / 3));
    this.buttons.forEach((button, i) => Object.assign(button.bounds, { x: (i % 3) * buttonWidth, y: Math.floor(i / 3), width: buttonWidth }));
    const width = this.narrow ? client.width : Math.floor(client.width / 3);
    this.columns.forEach((column, index) => {
      column.disabled = this.narrow && column.state !== this.state;
      Object.assign(column.bounds, { x: this.narrow ? 0 : index * width, y: 3, width: column.disabled ? 0 : width, height: Math.max(2, client.height - 4) });
    });
    this.buttons[1]!.disabled = this.buttons[2]!.disabled = this.buttons[3]!.disabled = !this.selected;
  }
  draw(canvas: Canvas, client: Rect): void {
    canvas.text(client.x, client.y + 2, this.notice || this.ctx.desktop.t("←/→ columna · Shift+←/→ mover · Ctrl+↑/↓ ordenar · Enter abrir"), theme.window, client.width);
    const selected = this.selected;
    canvas.text(client.x, client.y + client.height - 1, selected ? `${selected.id} · ${this.ctx.desktop.t(selected.origin === "user" ? "Origen: usuario" : "Origen: agente")}` : this.ctx.cwd, theme.window, client.width);
  }
  act(work: () => Promise<void>): void {
    void work().catch(error => {
      this.notice = (error as Error).message;
      if (error instanceof TaskConflict) info(this.ctx.desktop, this.ctx.desktop.t("Conflicto en TODO.md"), [this.notice, this.ctx.desktop.t("Versión editada"), JSON.stringify(error.expected, null, 2), this.ctx.desktop.t("Versión actual"), JSON.stringify(error.current, null, 2)]);
    }).finally(() => this.ctx.desktop.invalidate());
  }
  async save(cards: TaskCard[], base = this.document, adapt = false): Promise<void> {
    if (!base) throw new Error("Tablero no cargado");
    this.store ??= await TaskStore.open(this.ctx.cwd);
    for (const card of cards) if (!this.events.some(e => e.type === "task-request" && e.request.requestId === card.requestId))
      await this.ctx.record({ type: "task-request", request: { requestId: card.requestId, objective: card.description || card.title, baseline: await gitRepository(this.ctx.cwd), policy: taskPolicy(await instructions(this.ctx.cwd)), mode: "execution" } });
    await this.store.save(cards, base, { adapt, record: (phase, revision) => this.ctx.record({ type: "task-record", requestId: cards[0]!.requestId, taskIds: cards.map(c => c.id), phase, revision }) });
    await this.refresh();
  }
  async move(card: TaskCard, status: TaskStatus): Promise<void> { await this.save([{ ...card, status, origin: "user" }]); this.column(status); this.selectedId = card.id; }
  async reorder(direction: number): Promise<void> {
    const card = this.selected; if (!card || !this.store || !this.document) return;
    const tasks = this.tasks(card.status), index = tasks.findIndex(t => t.id === card.id), target = tasks[index + direction]; if (!target) return;
    await this.store.reorder(card.id, target.id, this.document, { record: (phase, revision) => this.ctx.record({ type: "task-record", requestId: card.requestId, taskIds: [card.id], phase, revision }) });
    await this.refresh();
  }
  dragTo(x: number, y: number): void { this.destination = this.columns.find(c => !c.disabled && contains(c.bounds, x, y))?.state; this.ctx.desktop.invalidate(); }
  drop(cancelled: boolean): void {
    const card = this.document?.tasks.find(t => t.id === this.dragging), target = this.destination;
    this.dragging = undefined; this.destination = undefined;
    if (!cancelled && card && target && card.status !== target) this.act(() => this.move(card, target));
  }
  open(): void {
    const card = this.selected; if (!card) return;
    choose(this.ctx.desktop, card.title, ["Editar", "Verificación", "Continuar tarea", ...states.map(s => labels[s])].map(value => ({ label: this.ctx.desktop.t(value), value })), action => {
      if (action === "Editar") this.edit(card);
      else if (action === "Verificación") this.ctx.verify(card);
      else if (action === "Continuar tarea") this.ctx.continue(card);
      else this.act(() => this.move(card, states.find(s => labels[s] === action)!));
    });
  }
  edit(card?: TaskCard): void {
    if (!this.document) return;
    const base = this.document;
    const show = () => form(this.ctx.desktop, this.ctx.desktop.t(card ? "Editar tarea" : "Nueva tarea"), [
      { label: "Título", value: card?.title ?? "" }, { label: "Descripción", value: card?.description ?? "" }, { label: "Criterio", value: card?.criterion ?? "" },
      { label: "Dependencias (IDs)", value: card?.dependencies.join(", ") ?? "" }, { label: "Verificación prevista", value: card?.verification[0]?.description ?? "Revisión manual" },
      { label: "Comando (opcional)", value: card?.verification[0]?.command ?? "" }, { label: "Archivos (JSON)", value: JSON.stringify(card?.verification[0]?.paths ?? []) },
      { label: "Resultado", value: card?.result ?? "pendiente" }, { label: "Bloqueo", value: card?.blocked ?? "" },
    ], async ([title, description, criterion, dependencies, verification, command, paths, result, blocked]) => {
      const files: unknown = JSON.parse(paths!); if (!Array.isArray(files) || files.some(p => typeof p !== "string")) throw new Error("Archivos debe ser un array JSON de rutas");
      const next: TaskCard = { id: card?.id ?? `T-${crypto.randomUUID()}`, requestId: card?.requestId ?? `R-${crypto.randomUUID()}`, title: title!, description: description!, criterion: criterion!,
        dependencies: dependencies?.trim() ? dependencies.split(",").map(s => s.trim()) : [], status: card?.status ?? "pending", result: result!, blocked: blocked || undefined,
        verification: [{ id: card?.verification[0]?.id ?? `V-${crypto.randomUUID()}`, kind: command?.trim() ? "command" : "review", description: verification!, command: command?.trim() || undefined, required: true, paths: files }, ...(card?.verification.slice(1) ?? [])], origin: "user", acceptanceEvidence: card && card.criterion === criterion ? card.acceptanceEvidence : [] };
      await this.save([next], base, !base.compatible); this.selectedId = next.id;
    });
    if (!base.compatible) info(this.ctx.desktop, this.ctx.desktop.t("Adaptar TODO.md"), [base.source, this.ctx.desktop.t("Se conservará el contenido existente y se agregarán secciones de tareas.")]);
    // The preview must close before the explicit adaptation action can run.
    if (!base.compatible) {
      const preview = this.ctx.desktop.modal!;
      const apply = new Button("adapt-todo", { x: 20, y: preview.client.height - 1, width: 25, height: 1 }, "Adaptar y crear tarea", () => { this.ctx.desktop.close(preview); show(); });
      apply.translate = this.ctx.desktop.t; preview.controls.push(apply);
    } else show();
  }
}
