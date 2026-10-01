import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, parse } from "node:path";
import { normalizeFolder } from "../../storage/config.ts";
import { info } from "../dialogs.ts";
import type { Desktop } from "../desktop.ts";
import { theme } from "../theme.ts";
import { Button } from "./button.ts";
import { Input } from "./input.ts";
import { SelectList } from "./select-list.ts";
import { Window } from "./window.ts";

interface Entry { path: string; name: string; directory: boolean; link?: boolean }
interface Options { parent?: Window; initialPath?: string; pickFolder?: (path: string) => void; attach?: (path: string) => Promise<void> }

export class FileExplorer {
  readonly window: Window;
  readonly pathInput: Input;
  readonly list: SelectList;
  folder: string;
  entries: Entry[] = [];
  status = "Cargando…";
  private generation = 0;
  private loading = false;
  private click?: { path: string; at: number };
  private select: Button;

  constructor(private desktop: Desktop, start: string, private options: Options = {}) {
    this.folder = start;
    const area = desktop.floatingArea ?? { y: 1, height: desktop.height - 2 }, height = Math.min(15, area.height);
    this.window = new Window(`explorer-${crypto.randomUUID()}`, options.pickFolder ? "Elegir folder" : "Explorador de archivos", {
      x: Math.max(0, (desktop.width - 72) >> 1), y: area.y + Math.max(0, (area.height - height) >> 1), width: 72, height,
    });
    this.window.modal = true;
    this.pathInput = new Input("path", { x: 0, y: 0, width: 60, height: 1 }, start);
    const pathHandle = this.pathInput.handle.bind(this.pathInput);
    this.pathInput.handle = event => event.type === "key" && event.key === "enter" ? (this.run(() => this.navigate(this.pathInput.value)), true) : pathHandle(event);
    this.list = new SelectList("files", { x: 0, y: 1, width: 70, height: 9 }, []);
    const listHandle = this.list.handle.bind(this.list);
    this.list.handle = event => {
      if(this.loading)return false;
      if (event.type === "key") {
        this.click = undefined;
        if (event.key === "enter" || event.key === "right" || event.text === "l") { this.run(() => this.openSelected()); return true; }
        if (event.key === "left" || event.key === "backspace" || event.text === "h") { this.run(() => this.navigate(dirname(this.folder))); return true; }
        if (event.text === "j" || event.text === "k") return listHandle({ type: "key", key: event.text === "j" ? "down" : "up" });
      }
      const changed = listHandle(event);
      if (event.type === "mouse" && event.action === "press" && event.button === 0 && !this.list.disabled) {
        const index=this.list.indexAt(event.x,event.y), entry = index===undefined ? undefined : this.entries[index], at = performance.now();
        if (entry && this.click?.path === entry.path && at - this.click.at < 350) { this.click = undefined; this.run(() => this.openSelected()); }
        else if (entry) this.click = { path: entry.path, at };
        else this.click=undefined;
      }
      return changed;
    };
    const go = new Button("go", { x: 0, y: 0, width: 7, height: 1 }, "Ir", () => this.run(() => this.navigate(this.pathInput.value)));
    const up = new Button("up", { x: 0, y: 0, width: 10, height: 1 }, "Subir", () => this.run(() => this.navigate(dirname(this.folder))));
    const root = new Button("root", { x: 11, y: 0, width: 9, height: 1 }, "Raíz", () => this.run(() => this.navigate(parse(this.folder).root)));
    const open = new Button("open", { x: 21, y: 0, width: 10, height: 1 }, "Abrir", () => this.run(() => this.openSelected()));
    const select = new Button("select", { x: 0, y: 0, width: 18, height: 1 }, options.pickFolder ? "Elegir folder" : "Adjuntar", () => this.run(async () => {
      if (options.pickFolder) { const folder = await normalizeFolder(this.folder, this.folder); this.desktop.close(this.window); options.pickFolder(folder); }
      else {
        const entry = this.entries[this.list.selected]; if (!entry || (await stat(entry.path)).isDirectory()) throw new Error("Elegí un archivo para adjuntar");
        await options.attach?.(entry.path); this.status = "Adjunto preparado en Prompt";
      }
    }));
    select.disabled = !options.pickFolder && !options.attach;
    this.select = select;
    this.window.controls.push(this.pathInput, go, this.list, up, root, open, select);
    this.window.focusedId = this.list.id;
    this.window.onLayout = client => {
      this.pathInput.bounds.width = Math.max(1, client.width - 8); go.bounds.x = client.width - 7;
      this.list.bounds.width = client.width; this.list.bounds.height = Math.max(3, client.height - 3);
      for (const button of [up, root, open, select]) button.bounds.y = client.height - 1;
      select.bounds.x = client.width - select.bounds.width;
    };
    this.window.onDraw = (canvas, client) => canvas.text(client.x + 1, client.y + client.height - 2, this.status, theme.dialog, client.width - 2);
  }

  async show(): Promise<void> {
    if (this.desktop.modal && this.desktop.modal !== this.options.parent) return;
    this.desktop.add(this.window); await this.navigate(this.options.initialPath ?? this.folder);
  }

  private run(work: () => Promise<void>): void {
    void work().catch(error => { this.status = (error as Error).message; }).finally(() => this.desktop.invalidate());
  }

  async navigate(path: string): Promise<void> {
    const request = ++this.generation; this.loading=true;this.select.disabled = true; this.click=undefined;this.status = "Cargando…"; this.desktop.invalidate();
    const previous = this.folder;
    try {
      const folder = await normalizeFolder(path, this.folder), children = await readdir(folder, { withFileTypes: true });
      const entries: Entry[] = children.map(entry => ({ path: join(folder, entry.name), name: entry.name, directory: entry.isDirectory(), link: entry.isSymbolicLink() }));
      entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, "es", { numeric: true }));
      if (dirname(folder) !== folder) entries.unshift({ path: dirname(folder), name: "..", directory: true });
      if (request !== this.generation || !this.desktop.windows.includes(this.window)) return;
      this.folder = folder; this.pathInput.setValue(folder); this.entries = entries; this.click = undefined;
      this.list.setItems(entries.map(e => `${e.directory ? "[D]" : e.link ? "[L]" : "[F]"} ${e.name}${e.directory ? "/" : ""}`), entries.findIndex(e => e.path === previous));
      this.status = `${children.length} ${children.length===1 ? "entrada" : "entradas"} · Enter abrir · ← subir · doble clic`;
    } catch (error) { if (request === this.generation) this.status = (error as Error).message; }
    finally { if (request === this.generation) { this.loading=false;this.select.disabled=!this.options.pickFolder && !this.options.attach; this.desktop.invalidate(); } }
  }

  async openSelected(): Promise<void> {
    if (this.loading) return;
    const entry = this.entries[this.list.selected], revision=this.generation; if (!entry) return;
    const metadata = await stat(entry.path);
    if (!this.desktop.windows.includes(this.window) || revision!==this.generation) return;
    if (metadata.isDirectory()) { await this.navigate(entry.path); return; }
    if (!metadata.isFile()) throw new Error("Esta entrada no es un archivo regular");
    const bytes = new Uint8Array(await Bun.file(entry.path).slice(0, 65536).arrayBuffer());
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: metadata.size > bytes.length }); if (text.includes("\0")) throw new Error(); }
    catch { text = "Archivo binario; la vista previa admite texto UTF-8."; }
    if (!this.desktop.windows.includes(this.window) || revision!==this.generation) return;
    // info is a child modal: keep navigation state/focus underneath the preview.
    info(this.desktop, basename(entry.path), [entry.path, `${metadata.size} bytes · solo lectura`, "", text, ...(metadata.size > bytes.length ? ["", "[Vista recortada a 64 KiB]"] : [])],this.window);
  }
}
