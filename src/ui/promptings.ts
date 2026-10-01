import { promptVariables, renderPrompting } from "../prompts.ts";
import type { ConfigStore, Prompting } from "../storage/config.ts";
import { Button } from "./components/button.ts";
import { Input } from "./components/input.ts";
import { TextArea } from "./components/text-area.ts";
import { Window } from "./components/window.ts";
import type { Desktop } from "./desktop.ts";
import { choose } from "./dialogs.ts";
import { theme } from "./theme.ts";

interface Context {
  desktop: Desktop; store: ConfigStore;
  idle: () => void;
  change: (work: () => Promise<void>) => Promise<void>;
  run: (work: () => Promise<void>) => void;
  load: (text: string, execute: boolean) => Promise<void>;
  status: (text: string) => void;
}

export class Promptings {
  constructor(private readonly ctx: Context) {}

  library(selectedId?: string): void {
    const entries: { label: string; value: Prompting | undefined }[] = this.ctx.store.value.promptings.map(value => {
      const count = promptVariables(value.text).length;
      return { label: `${value.name} · ${count} metavariable${count === 1 ? "" : "s"}`, value };
    });
    entries.push({ label: "+ Nuevo prompting", value: undefined });
    choose(this.ctx.desktop, "Promptings", entries, prompting => prompting ? this.actions(prompting) : this.editor(),
      selectedId === undefined ? 0 : Math.max(0, entries.findIndex(entry => entry.value?.id === selectedId)));
  }

  private actions(prompting: Prompting): void {
    choose(this.ctx.desktop, prompting.name, [
      { label: "Cargar en el editor", value: "load" },
      { label: "Ejecutar con modelo actual", value: "execute" },
      { label: "Ver / editar", value: "edit" },
      { label: "Eliminar", value: "delete" },
    ], action => {
      if (action === "edit") this.editor(prompting);
      else if (action === "delete") this.ctx.run(async () => {
        const next = structuredClone(this.ctx.store.value);
        next.promptings = next.promptings.filter(p => p.id !== prompting.id);
        await this.ctx.store.save(next);
        this.ctx.status(`Prompting eliminado: ${prompting.name}`);
        this.library();
      });
      else this.use(prompting, action === "execute");
    });
  }

  private window(title: string): Window | undefined {
    const desktop = this.ctx.desktop;
    if (desktop.modal) return;
    const area = desktop.floatingArea ?? { y: 1, height: desktop.height - 2 };
    const height = Math.min(15, area.height);
    const window = new Window(`prompting-${crypto.randomUUID()}`, title, {
      x: Math.max(0, (desktop.width - 58) >> 1), y: area.y + Math.max(0, (area.height - height) >> 1), width: 58, height,
    });
    window.modal = true;
    return window;
  }

  editor(prompting?: Prompting, initialText = ""): void {
    const { desktop, store } = this.ctx;
    const window = this.window(prompting ? "Editar prompting" : "Nuevo prompting");
    if (!window) return;
    const name = new Input("name", { x: 10, y: 0, width: 44, height: 1 }, prompting?.name ?? "");
    const text = new TextArea("text", { x: 1, y: 2, width: 54, height: 7 });
    text.setValue(prompting?.text ?? initialText);
    text.placeholder = "Escribí el prompting con {{metavariables}}";
    let error = "", saving = false;
    const save = new Button("save", { x: 1, y: 0, width: 16, height: 1 }, "Guardar", () => {
      if (saving) return;
      const value: Prompting = { id: prompting?.id ?? crypto.randomUUID(), name: name.value.trim(), text: text.value };
      saving = true; error = "Guardando…";
      for (const control of window.controls) control.disabled = true;
      desktop.invalidate();
      void this.ctx.change(async () => {
        if (!value.name) throw new Error("Escribí un nombre");
        if (!value.text.trim()) throw new Error("Escribí el texto del prompting");
        const next = structuredClone(store.value);
        const index = next.promptings.findIndex(p => p.id === value.id);
        if (prompting && index < 0) throw new Error("El prompting ya fue eliminado");
        if (index < 0) next.promptings.push(value); else next.promptings[index] = value;
        await store.save(next);
      }).then(() => {
        const visible = desktop.windows.includes(window);
        desktop.close(window); this.ctx.status(`Prompting guardado: ${value.name}`);
        if (visible) this.library(value.id);
      }, e => { error = (e as Error).message; }).finally(() => {
        saving = false;
        for (const control of window.controls) control.disabled = false;
        desktop.invalidate();
      });
    });
    text.onSubmit = () => save.onClick();
    const handle = name.handle.bind(name);
    name.handle = event => event.type === "key" && event.key === "enter" ? (window.focusedId = text.id, true) : handle(event);
    const cancel = new Button("cancel", { x: 19, y: 0, width: 16, height: 1 }, "Cancelar", () => desktop.close(window));
    window.controls.push(name, text, save, cancel);
    window.onLayout = client => {
      name.bounds.width = Math.max(1, client.width - 11);
      text.bounds.width = client.width - 2; text.bounds.height = Math.max(1, client.height - 4);
      save.bounds.y = cancel.bounds.y = client.height - 1;
    };
    window.onDraw = (canvas, client) => {
      canvas.text(client.x + 1, client.y, "Nombre", theme.dialog, 8);
      canvas.text(client.x + 1, client.y + 1, "Texto · Shift+Enter línea · Enter guardar · Tab foco", theme.dialog, client.width - 2);
      canvas.text(client.x + 1, client.y + client.height - 2, error, theme.dialog, client.width - 2);
    };
    desktop.add(window);
  }

  private use(prompting: Prompting, execute: boolean): void {
    const names = promptVariables(prompting.text), { desktop } = this.ctx;
    if (!names.length) { this.ctx.run(() => this.ctx.load(prompting.text, execute)); return; }
    const window = this.window(`Metavariables · ${prompting.name}`);
    if (!window) return;
    const values = new Map(names.map(name => [name, ""]));
    let page = 0, error = "", applying = false;
    const value = new TextArea("value", { x: 1, y: 1, width: 54, height: 8 });
    const capture = () => values.set(names[page]!, value.value);
    const refresh = () => {
      value.setValue(values.get(names[page]!)!);
      previous.disabled = page === 0; next.disabled = page === names.length - 1;
      accept.disabled = page !== names.length - 1;
      error = ""; window.focusedId = value.id; desktop.invalidate();
    };
    const previous = new Button("previous", { x: 1, y: 0, width: 14, height: 1 }, "Anterior", () => {
      if (page === 0 || applying) return; capture(); page--; refresh();
    });
    const next = new Button("next", { x: 16, y: 0, width: 15, height: 1 }, "Siguiente", () => {
      if (page === names.length - 1 || applying) return; capture(); page++; refresh();
    });
    const accept = new Button("apply", { x: 34, y: 0, width: 18, height: 1 }, execute ? "Ejecutar" : "Cargar", () => {
      if (applying || page !== names.length - 1) return;
      capture(); applying = true;
      for (const control of window.controls) control.disabled = true;
      void this.ctx.change(async () => {
        this.ctx.idle();
        if (!desktop.windows.includes(window)) return;
        const filled = renderPrompting(prompting.text, values);
        desktop.close(window);
        await this.ctx.load(filled, execute);
      }).catch(e => { error = (e as Error).message; this.ctx.status(error); }).finally(() => {
        applying = false; for (const control of window.controls) control.disabled = false;
        previous.disabled = page === 0; next.disabled = page === names.length - 1; accept.disabled = page !== names.length - 1;
        desktop.invalidate();
      });
    });
    value.onSubmit = () => page === names.length - 1 ? accept.onClick() : next.onClick();
    window.controls.push(value, previous, next, accept);
    window.onLayout = client => {
      value.bounds.width = client.width - 2; value.bounds.height = Math.max(1, client.height - 3);
      for (const button of [previous, next, accept]) button.bounds.y = client.height - 1;
      accept.bounds.x = client.width - accept.bounds.width - 1;
    };
    window.onDraw = (canvas, client) => {
      canvas.text(client.x + 1, client.y, `${page + 1}/${names.length} · {{${names[page]}}}`, theme.dialog, client.width - 2);
      canvas.text(client.x + 1, client.y + client.height - 2, error || `Shift+Enter línea · Enter ${page === names.length - 1 ? (execute ? "ejecutar" : "cargar") : "siguiente"} · Esc cancelar`, theme.dialog, client.width - 2);
    };
    refresh(); desktop.add(window);
  }
}
