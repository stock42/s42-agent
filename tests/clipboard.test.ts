import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import { Canvas } from "../src/ui/canvas.ts";
import { TextArea } from "../src/ui/components/text-area.ts";
import { Window } from "../src/ui/components/window.ts";

const mouse = (x: number, y: number, action: "press" | "move" | "release") => ({ type: "mouse" as const, x, y, action, button: 0, delta: 0 });
const key = (key: string) => ({ type: "key" as const, key });

test("selección del chat copia al soltar, conserva grafemas/saltos reales y excluye margen y wrap", () => {
  const area = new TextArea("chat", { x: 0, y: 0, width: 12, height: 6 }, "áé文🙂xy\nsegunda");
  area.readOnly = area.lineNumbers = true; area.setValue(area.value, "start");
  const copied: string[] = []; area.onSelect = text => copied.push(text);
  area.handle(mouse(5, 0, "press")); area.handle(mouse(7, 1, "move"));
  expect(copied).toEqual([]); area.handle(mouse(7, 1, "release"));
  expect(copied).toEqual(["áé文🙂xy"]); // Soft wrap is not a source newline.
  area.handle(mouse(7, 1, "release")); expect(copied).toHaveLength(1);
  area.handle(mouse(5, 2, "press")); area.handle(mouse(5, 0, "move")); area.handle(mouse(-1, -1, "release"));
  expect(copied.at(-1)).toBe("áé文🙂xy\n");
  area.handle(mouse(5, 0, "press")); area.handle(mouse(5, 0, "release")); expect(copied).toHaveLength(2);
  area.handle(mouse(5, 0, "press")); area.handle(mouse(7, 0, "move"));
  area.update(area.value + "\nTexto que llegó mientras seleccionaba");
  area.handle(mouse(7, 0, "release")); expect(copied.at(-1)).toBe("áé");
  area.draw(new Canvas(12, 6), area.bounds, true);
  area.handle({ type: "paste", text: "sobrescribir" }); expect(area.value).toContain("Texto que llegó");
});

test("Ctrl+A y Shift+flechas copian selección por grafemas; mover o vaciar selección no borra el portapapeles", () => {
  const area = new TextArea("chat", { x: 0, y: 0, width: 30, height: 4 }, "áé文🙂\nsegunda"); area.readOnly = true;
  const copied: string[] = []; area.onSelect = text => copied.push(text);
  area.handle(key("ctrl+home")); area.handle(key("shift+right")); area.handle(key("shift+right"));
  expect(copied).toEqual(["á", "áé"]);
  area.handle(key("left")); expect(copied).toHaveLength(2);
  area.handle(key("shift+left")); expect(copied).toHaveLength(2);
  area.handle(key("ctrl+a")); expect(copied.at(-1)).toBe(area.value);
  area.setValue(""); area.handle(key("ctrl+a")); expect(copied).toHaveLength(3);
});

test("cada pestaña del chat copia y el prompt/modal no copia ni confirma un arrastre cancelado", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-clipboard-tabs-")), path = join(root, "config.json"), initial = defaultConfig();
  for (const id of ["A", "B"]) { const folder = join(root, id); await mkdir(folder); initial.projects.push({ id, name: id, path: folder }); }
  await Bun.write(path, JSON.stringify(initial)); const app = await App.open({ config: path }); const copied: string[] = [];
  app.desktop.copyToClipboard = text => copied.push(text);
  try {
    for (const project of initial.projects) {
      await app.switchProject(project); const response = app.view.response; response.setValue(`Respuesta ${project.id} á文🙂`, "start");
      app.desktop.draw(); const rect = app.view.editorWindow.controlRect(response), x = rect.x + 5;
      app.desktop.handle(mouse(x, rect.y, "press")); app.desktop.handle(mouse(x + 9, rect.y, "move"));
      app.desktop.handle(mouse(79, 23, "release")); expect(copied.at(-1)).toBe(`Respuesta`);
      app.view.prompt.setValue("borrador"); app.desktop.focus(app.view.promptWindow); const before = copied.length;
      app.desktop.handle(key("ctrl+a")); expect(copied).toHaveLength(before); expect(app.view.prompt.value).toBe("borrador");
      app.desktop.handle(mouse(x, rect.y, "press")); app.desktop.handle(mouse(x + 3, rect.y, "move"));
      const modal = new Window("modal", "Modal", { x: 15, y: 5, width: 20, height: 5 }); modal.modal = true; app.desktop.add(modal);
      app.desktop.handle(mouse(x + 3, rect.y, "release")); expect(copied).toHaveLength(before); app.desktop.close(modal);
    }
    expect(copied).toHaveLength(2);
    await app.activateTab(app.tabs[0]!.id); app.desktop.focus(app.view.editorWindow); app.desktop.handle(key("ctrl+a"));
    expect(copied.at(-1)).toBe("Respuesta A á文🙂");
    app.desktop.language = "en"; app.desktop.onHelp(); app.desktop.draw();
    app.desktop.handle(key("pagedown")); app.desktop.handle(key("pagedown"));
    expect(app.desktop.draw().lines().join("\n")).toContain("Selecting chat text copies it automatically.");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("bun run dev en PTY emite OSC 52 con texto LLM seleccionado, sin ANSI/margen, y restaura terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-clipboard-pty-")), path = join(root, "config.json"), config = defaultConfig(); let output = "";
  const text = "áé文🙂", decoder = new TextDecoder();
  const server = Bun.serve({ port: 0, async fetch(req) {
    await req.json(); return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
  } });
  config.projects = [{ id: "project", name: "Clipboard", path: root, selection: { providerId: "fixture", modelId: "fixture" } }]; config.lastProjectId = "project";
  config.providers = [{ id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 10000, capabilities: { tools: false, images: false } }] }]; config.defaults = { providerId: "fixture", modelId: "fixture" };
  await Bun.write(path, JSON.stringify(config));
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, bytes) => { output += decoder.decode(bytes, { stream: true }); } });
  const child = Bun.spawn([process.execPath, "run", "dev", "--config", path, "--no-color"], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, TERM: "xterm-256color" }, terminal });
  const until = async (check: () => boolean) => { for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); } throw new Error("No apareció la copia en PTY"); };
  const payloads = () => Array.from(output.matchAll(/\x1b\]52;c;([^\x07]*)\x07/g), match => Buffer.from(match[1]!, "base64").toString("utf8"));
  try {
    await until(() => output.includes("Fixture · fixture")); terminal.write("\x1b[200~Hola\x1b[201~\r"); await until(() => output.includes(text));
    terminal.write("\x1b[<0;8;9M\x1b[<32;14;9M"); await Bun.sleep(50); expect(payloads()).toEqual([]);
    terminal.write("\x1b[<0;14;9m"); await until(() => payloads().length === 1); expect(payloads()[0]).toBe(text);
    terminal.write("\x1b[<0;14;9m"); await Bun.sleep(50); expect(payloads()).toHaveLength(1);
    terminal.write("\x01"); await until(() => payloads().length === 2); expect(payloads()[1]).toBe(`Vos:\nHola\n\nAgente:\n${text}`);
    terminal.write("\x0e\x1b[200~borrador conservado\x1b[201~\x01"); await until(() => output.includes("borrador conservado")); expect(payloads()).toHaveLength(2);
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?1049l"); expect(output).toContain("\x1b[?1006l"); expect(output).toContain("\x1b[?25h");
  } finally { child.kill(); terminal.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
