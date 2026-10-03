import type { Canvas } from "./canvas.ts";
import { Button } from "./components/button.ts";
import { SelectList } from "./components/select-list.ts";
import { TextArea } from "./components/text-area.ts";
import type { Component } from "./components/component.ts";
import type { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";
import type { Rect } from "./types.ts";
import { gitRepository, gitHistory, gitBranches, gitDiff, gitCommitDetail, gitChangelog, type GitRepository, type GitCommit } from "../system/git.ts";

export type GitView = "changes" | "history" | "branches" | "changelog";
const views = { changes: "Cambios", history: "Historial", branches: "Ramas", changelog: "CHANGELOG" } as const;

export class GitPanel {
  view: GitView = "changes";
  repository?: GitRepository;
  readonly list = new SelectList("git-list", { x: 0, y: 3, width: 24, height: 7 }, [], () => { void this.detail(); });
  readonly text = new TextArea("git-diff", { x: 25, y: 3, width: 50, height: 7 });
  readonly controls: Component[];
  private readonly buttons: Button[];
  private commits: GitCommit[] = [];
  private logHead?: string;
  private more = false;
  private controller?: AbortController;
  private generation = 0;
  private detailController?: AbortController;
  private detailGeneration = 0;
  private staged = false;
  private notice = "";
  private visible = false;
  constructor(readonly cwd: string, private desktop: Desktop) {
    this.text.readOnly = true; this.text.lineNumbers = true;
    this.text.onSelect = text => desktop.copyToClipboard(text);
    this.buttons = (Object.entries(views) as [GitView, string][]).map(([view, label]) => new Button(`git-${view}`, { x: 0, y: 0, width: 12, height: 1 }, label,
      () => { if (this.view !== view) { this.view = view; this.list.setItems([]); this.text.setValue(""); } void this.refresh(); }));
    this.buttons.push(new Button("git-refresh", { x: 0, y: 0, width: 13, height: 1 }, "Refrescar", () => { void this.refresh(); }),
      new Button("git-index", { x: 0, y: 0, width: 16, height: 1 }, "Índice / archivo", () => { this.staged = !this.staged; void this.detail(); }));
    for (const button of this.buttons) button.translate = desktop.t;
    this.controls = [...this.buttons, this.list, this.text];
    const handle = this.list.handle.bind(this.list);
    this.list.handle = event => {
      const result = handle(event);
      if (event.type === "key" && event.key === "enter") { void this.detail(); return true; }
      if (this.view === "history" && this.more && this.list.selected >= this.commits.length - 1 && event.type === "key" && ["down", "pagedown", "end"].includes(event.key)) void this.loadMore();
      if (this.view === "history" && event.type === "mouse" && event.action === "wheel" && event.delta > 0 && this.more) void this.loadMore();
      return result;
    };
  }
  show(): void { this.visible = true; void this.refresh(); }
  hide(): void { this.visible = false; this.generation++; this.detailGeneration++; this.controller?.abort(); this.detailController?.abort(); }
  layout(client: Rect): void {
    const rowWidth = Math.max(1, Math.floor(client.width / 3));
    this.buttons.forEach((button, i) => Object.assign(button.bounds, { x: (i % 3) * rowWidth, y: Math.floor(i / 3), width: rowWidth }));
    this.buttons[5]!.disabled = this.view !== "changes";
    const top = 4, rows = Math.max(1, client.height - top);
    const listWidth = this.view === "changes" || this.view === "history" ? Math.max(10, Math.floor(client.width / 3)) : 0;
    this.list.disabled = !listWidth;
    Object.assign(this.list.bounds, { x: 0, y: top, width: listWidth, height: rows });
    Object.assign(this.text.bounds, { x: listWidth, y: top, width: Math.max(1, client.width - listWidth), height: rows });
  }
  draw(canvas: Canvas, client: Rect): void {
    const repo = this.repository;
    const heading = repo?.state === "ready" ? `${repo.status.branch ?? "HEAD"} · ${repo.root}` : this.cwd;
    canvas.text(client.x, client.y + 2, heading, theme.window, client.width);
    canvas.text(client.x, client.y + 3, this.desktop.t(this.notice), theme.window, client.width);
  }
  async refresh(): Promise<void> {
    if (!this.visible) return;
    const generation = ++this.generation;
    this.controller?.abort(); this.detailController?.abort(); this.detailGeneration++;
    const controller = this.controller = new AbortController();
    this.notice = "Consultando Git…"; this.desktop.invalidate();
    try {
      const repo = await gitRepository(this.cwd, controller.signal);
      if (generation !== this.generation) return;
      this.repository = repo;
      if (repo.state !== "ready") {
        this.list.setItems([]); this.setText(`${this.desktop.t(repo.state === "missing" ? "Sin repositorio Git" : repo.state === "unavailable" ? "Git no está instalado" : "Error de Git")}\n${repo.message}`);
        this.notice = ""; return;
      }
      this.notice = "Referencias remotas locales; sin consulta de red";
      if (this.view === "changes") {
        const selected = this.list.items[this.list.selected];
        const items = repo.status.changes.map(c => `${c.index}${c.worktree} ${JSON.stringify(c.path)}${c.originalPath ? ` ← ${JSON.stringify(c.originalPath)}` : ""}`);
        this.list.setItems(items, Math.max(0, items.indexOf(selected ?? "")));
        this.list.emptyText = this.desktop.t("Sin cambios"); await this.detail();
      } else if (this.view === "history") {
        this.logHead = repo.status.head;
        const commits = this.logHead ? await gitHistory(repo.root, 0, 40, controller.signal, this.logHead) : [];
        if (generation !== this.generation) return;
        const selected = this.commits[this.list.selected]?.sha;
        this.commits = commits; this.more = commits.length === 40;
        this.updateHistory(Math.max(0, commits.findIndex(c => c.sha === selected))); await this.detail();
      } else if (this.view === "branches") {
        const branches = await gitBranches(repo.root, controller.signal);
        if (generation !== this.generation) return;
        this.setText(`${repo.status.branch ?? "HEAD"} · ${repo.status.upstream ?? this.desktop.t("Sin upstream")}\n${repo.status.ahead === undefined ? "" : `+${repo.status.ahead} / -${repo.status.behind}`}\n\n` + branches.map(b => `${b.current ? "*" : " "} ${b.name}\n  ${b.sha}\n  ${b.upstream} ${b.tracking}`).join("\n"));
      } else {
        const text = await gitChangelog(this.cwd);
        if (generation === this.generation) this.setText(text ?? this.desktop.t("No existe CHANGELOG.md"));
      }
    } catch (error) { if (generation === this.generation) { this.notice = (error as Error).message; } }
    finally { if (generation === this.generation) this.desktop.invalidate(); }
  }
  private updateHistory(selected = this.list.selected): void {
    this.list.setItems(this.commits.map(c => `${c.sha.slice(0, 8)} ${c.subject}`), selected);
    this.list.emptyText = this.desktop.t("Sin commits");
    this.notice = this.more ? "↓ / rueda: cargar más commits" : "Referencias remotas locales; sin consulta de red";
  }
  private async loadMore(): Promise<void> {
    if (this.controller?.signal.aborted || !this.more || !this.logHead || this.repository?.state !== "ready") return;
    this.more = false; const generation = this.generation;
    try {
      const commits = await gitHistory(this.repository.root, this.commits.length, 40, this.controller?.signal, this.logHead);
      if (generation !== this.generation) return;
      this.commits.push(...commits); this.more = commits.length === 40; this.updateHistory(); this.desktop.invalidate();
    } catch (error) { if (generation === this.generation) { this.more = true; this.notice = (error as Error).message; this.desktop.invalidate(); } }
  }
  async detail(): Promise<void> {
    if (!this.visible || this.repository?.state !== "ready") return;
    const generation = ++this.detailGeneration;
    this.detailController?.abort(); const controller = this.detailController = new AbortController();
    const repo = this.repository;
    try {
      let text = "";
      if (this.view === "changes") {
        const change = repo.status.changes[this.list.selected];
        text = change ? `${this.desktop.t(this.staged ? "Índice" : "Archivo")} · ${JSON.stringify(change.path)}\n` + await gitDiff(repo.root, change, this.staged, controller.signal) : this.desktop.t("Sin cambios");
      } else if (this.view === "history") {
        const commit = this.commits[this.list.selected];
        text = commit ? await gitCommitDetail(repo.root, commit.sha, controller.signal) : this.desktop.t("Sin commits");
      } else return;
      if (generation === this.detailGeneration) this.setText(text);
    } catch (error) { if (generation === this.detailGeneration) this.setText((error as Error).message); }
    finally { this.desktop.invalidate(); }
  }
  private setText(value: string): void { if (this.text.value !== value) this.text.setValue(value, "start"); }
}
