import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { promptVariables, renderPrompting } from "../src/prompts.ts";
import { ConfigStore, defaultConfig, validateConfig } from "../src/storage/config.ts";
import { Input } from "../src/ui/components/input.ts";
import { TextArea } from "../src/ui/components/text-area.ts";

const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
const field = <T extends Input | TextArea>(app: App, id: string) => app.desktop.modal!.controls.find(c => c.id === id) as T;
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout en Promptings");
}
const openAction = (app: App, index: number) => {
  key(app, "alt+t"); key(app, "enter");
  for (let i = 0; i < index; i++) key(app, "down");
  key(app, "enter");
};

test("metavariables únicas, sustitución literal de Unicode/multilínea, vacíos y expresiones sin evaluar", () => {
  const template = "{{archivo}} {{ lenguaje }} {{archivo}}\n{{__proto__}} {{_1}} {{1inválido}} {{bad-name}} {\"key\":1}";
  expect(promptVariables(template)).toEqual(["archivo", "lenguaje", "__proto__", "_1"]);
  const values = new Map([["archivo", "á 文 🙂\n$& {{lenguaje}}"], ["lenguaje", "TypeScript"], ["__proto__", "literal"], ["_1", ""]]);
  expect(renderPrompting(template, values)).toBe("á 文 🙂\n$& {{lenguaje}} TypeScript á 文 🙂\n$& {{lenguaje}}\nliteral  {{1inválido}} {{bad-name}} {\"key\":1}");
  expect(() => renderPrompting(template, new Map())).toThrow("{{archivo}}");
  expect(promptVariables("{{archivo}} {{archivo}} {{ lenguaje }}")).toEqual(["archivo", "lenguaje"]);
  expect(renderPrompting("sin variables", new Map())).toBe("sin variables");
});

test("config anterior migra sin reemplazar datos; promptings inválidos no sobrescriben el archivo", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-prompt-config-")), path = join(root, "config.json");
  try {
    const legacy = defaultConfig() as any; delete legacy.promptings; legacy.providers[0].baseUrl = "http://127.0.0.1:9000/v1";
    await Bun.write(path, JSON.stringify(legacy)); const before = await Bun.file(path).text();
    const store = await ConfigStore.load(path); expect(store.value.promptings).toEqual([]);
    expect(store.value.providers[0]!.baseUrl).toContain(":9000/v1"); expect(await Bun.file(path).text()).toBe(before);
    for (const promptings of [null, {}, [null], [{ id: "p", name: "", text: "body" }], [{ id: "p", name: "Name", text: " " }], [{ id: "p", name: "Name", text: 7 }]]) {
      expect(() => validateConfig({ ...defaultConfig(), promptings })).toThrow("Prompting inválido");
    }
    const p = { id: "p", name: "Revisar", text: "{{archivo}}" };
    expect(() => validateConfig({ ...defaultConfig(), promptings: [p, p] })).toThrow("duplicados");
    const invalid = JSON.stringify({ ...legacy, promptings: null }); await Bun.write(path, invalid);
    await expect(ConfigStore.load(path)).rejects.toThrow("Prompting inválido"); expect(await Bun.file(path).text()).toBe(invalid);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("TUI CRUD persistente, guardar borrador, Enter/Shift+Enter, mouse y cancelar metavariables sin cambiar draft", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-prompt-ui-")), config = join(root, "config.json");
  const app = await App.open({ config, cwd: root }); let closed = false;
  try {
    app.desktop.resize(60, 16); app.view.prompt.setValue("Revisá {{archivo}} en {{lenguaje}} y {{archivo}}.");
    app.desktop.menu.menus.find(menu => menu.label === "Promptings")!.items.find(i => i.label === "Guardar prompt actual")!.run();
    expect(field<TextArea>(app, "text").value).toBe(app.view.prompt.value);
    key(app, "enter"); expect(app.desktop.modal!.focusedId).toBe("text"); key(app, "enter");
    await until(() => app.desktop.draw().lines().join("\n").includes("Escribí un nombre"));
    field<Input>(app, "name").setValue("Revisión"); app.desktop.modal!.focusedId = "text";
    key(app, "shift+enter"); app.desktop.handle({ type: "paste", text: "Sin modificar archivos." }); key(app, "enter");
    await until(() => app.desktop.modal?.title === "Promptings");
    const saved = app.store.value.promptings[0]!; expect(saved.text).toContain(".\nSin modificar"); expect(app.session!.state.messages).toHaveLength(0);
    key(app, "escape"); const draft = app.view.prompt.value;
    openAction(app, 0); expect(app.desktop.draw().lines().join("\n")).toContain("1/2 · {{archivo}}");
    expect(app.desktop.modal!.bounds.y + app.desktop.modal!.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);
    const promptRows = app.desktop.draw().lines().slice(app.view.promptWindow.bounds.y, 15);
    app.desktop.handle({ type: "paste", text: "á 文.ts" }); key(app, "enter");
    expect(app.desktop.draw().lines().join("\n")).toContain("2/2 · {{lenguaje}}");
    app.desktop.handle({ type: "paste", text: "TypeScript" }); key(app, "shift+enter"); app.desktop.handle({ type: "paste", text: "Bun" });
    app.desktop.resize(80, 24); app.desktop.resize(60, 16);
    expect(field<TextArea>(app, "value").value).toBe("TypeScript\nBun");
    expect(app.desktop.draw().lines().slice(app.view.promptWindow.bounds.y, 15)).toEqual(promptRows);
    const previous = app.desktop.modal!.controls.find(c => c.id === "previous")!;
    const rect = app.desktop.modal!.controlRect(previous);
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, x: rect.x + 2, y: rect.y, button: 0, delta: 0 });
    expect(field<TextArea>(app, "value").value).toBe("á 文.ts");
    key(app, "escape"); expect(app.view.prompt.value).toBe(draft); expect(app.store.value.promptings[0]!.text).toBe(saved.text);
    openAction(app, 0); app.desktop.handle({ type: "paste", text: "code.ts" }); key(app, "enter");
    app.desktop.handle({ type: "paste", text: "TypeScript" }); key(app, "enter");
    await until(() => !app.desktop.modal);
    expect(app.view.prompt.value).toBe("Revisá code.ts en TypeScript y code.ts.\nSin modificar archivos.");
    expect(app.desktop.active).toBe(app.view.promptWindow); expect(app.mode).toBe("INSERT"); expect(app.session!.state.messages).toHaveLength(0);
    openAction(app, 2); field<Input>(app, "name").setValue("Revisión editada"); field<TextArea>(app, "text").setValue("Resumen sin variables");
    app.desktop.modal!.focusedId = "text"; key(app, "enter"); await until(() => app.desktop.modal?.title === "Promptings"); key(app, "escape");
    expect(app.store.value.promptings[0]!.id).toBe(saved.id);
    await app.desktop.onBeforeExit!(); closed = true;
    const reopened = await App.open({ config });
    try {
      expect(reopened.store.value.promptings[0]).toEqual({ id: saved.id, name: "Revisión editada", text: "Resumen sin variables" });
      openAction(reopened, 0); await until(() => reopened.view.prompt.value === "Resumen sin variables");
      openAction(reopened, 3); await until(() => reopened.store.value.promptings.length === 0); key(reopened, "escape");
      expect((await Bun.file(config).json()).promptings).toEqual([]);
      reopened.view.prompt.setValue("/promp"); key(reopened, "tab"); expect(reopened.view.prompt.value).toBe("/promptings");
      await reopened.submit(); expect(reopened.desktop.modal?.title).toBe("Promptings"); key(reopened, "escape");
      key(reopened, "escape"); reopened.desktop.handle({ type: "key", key: "space", text: " " }); reopened.desktop.handle({ type: "key", key: "t", text: "t" });
      expect(reopened.desktop.modal?.title).toBe("Promptings"); key(reopened, "escape");
    } finally { await reopened.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("modelo ausente conserva prompting completo; turno activo no reemplaza draft ni cierra preguntas", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-prompt-errors-")), config = join(root, "config.json"), initial = defaultConfig();
  initial.promptings = [{ id: "p", name: "Revisar", text: "Revisá {{archivo}}" }]; await Bun.write(config, JSON.stringify(initial));
  const app = await App.open({ config, cwd: root });
  try {
    app.view.prompt.setValue("borrador intacto"); openAction(app, 0); field<TextArea>(app, "value").setValue("code.ts");
    app.busy = true; key(app, "enter"); await until(() => app.status.includes("turno activo"));
    expect(app.view.prompt.value).toBe("borrador intacto"); expect(app.desktop.modal).toBeDefined();
    app.busy = false; key(app, "enter"); await until(() => !app.desktop.modal); expect(app.view.prompt.value).toBe("Revisá code.ts");
    openAction(app, 1); field<TextArea>(app, "value").setValue("otro.ts"); key(app, "enter");
    await until(() => app.status.includes("No hay modelo configurado")); expect(app.desktop.modal).toBeUndefined();
    expect(app.view.prompt.value).toBe("Revisá otro.ts"); expect(app.session!.state.messages).toHaveLength(0);
    expect((await Bun.file(config).json()).promptings[0].text).toBe("Revisá {{archivo}}");
  } finally { app.busy = false; await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("index.ts en PTY: crear plantilla, completar variables, ejecutar con SSE y reabrir biblioteca", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-prompt-pty-")), config = join(root, "config.json");
  let output = "", requests = 0, received = "";
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any; requests++; received = body.messages.findLast((m: any) => m.role === "user").content;
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Reviso la plantilla", content: "Prompting ejecutado correctamente" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
  } });
  const initial = defaultConfig(); initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
  initial.providers[0]!.models = [{ id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
  initial.defaults.modelId = "fixture"; await Bun.write(config, JSON.stringify(initial));
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => { output += new TextDecoder().decode(data); } });
  let child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--cwd", root, "--no-color"], { cwd: root, env: { ...process.env, TERM: "xterm-256color" }, terminal });
  try {
    await until(() => output.includes("llama.cpp · fixture")); terminal.write("\x1bt"); await until(() => output.includes("+ Nuevo prompting"));
    terminal.write("\r"); await until(() => output.includes("Texto · Shift+Enter"));
    terminal.write("PTY revisión\r/quit {{archivo}}\x1b[13;2u{{lenguaje}} {{archivo}}\r");
    await until(() => output.includes("PTY revisión · 2 metavariables"));
    expect(requests).toBe(0); expect((await Bun.file(config).json()).promptings[0].text).toBe("/quit {{archivo}}\n{{lenguaje}} {{archivo}}");
    terminal.write("\r\x1b[B\r"); await until(() => output.includes("1/2 · {{archivo}}"));
    terminal.write("\x1b[200~á 文.ts\x1b[201~\r"); await until(() => output.includes("2/2 · {{lenguaje}}"));
    terminal.resize(60, 16); child.kill("SIGWINCH"); await Bun.sleep(30);
    terminal.write("TypeScript\x1b[13;2uBun\r"); await until(() => output.includes("Prompting ejecutado correctamente"));
    expect(received).toBe("/quit á 文.ts\nTypeScript\nBun á 文.ts"); expect(requests).toBe(1); expect(output).toContain("Razonamiento:");
    expect((await Bun.file(config).json()).promptings[0].text).toBe("/quit {{archivo}}\n{{lenguaje}} {{archivo}}");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?25h\x1b[?1049l");
    output = ""; child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], { cwd: root, env: { ...process.env, TERM: "xterm-256color" }, terminal });
    await until(() => output.includes("Prompting ejecutado correctamente")); terminal.write("\x1bt"); await until(() => output.includes("PTY revisión"));
    expect(requests).toBe(1); terminal.write("\x11"); expect(await child.exited).toBe(0);
  } catch (e) { throw new Error(`${(e as Error).message} · ${Bun.stripANSI(output.slice(-3000))}`); }
  finally { child.kill(); await child.exited; terminal.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
