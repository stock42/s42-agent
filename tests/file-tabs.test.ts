import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { theme } from "../src/ui/theme.ts";

async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("No cambió la pestaña de archivo");
}
const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-file-tabs-")), config = join(root, "config.json"), initial = defaultConfig();
  for (const id of ["alpha", "beta"]) { const path = join(root, id); await mkdir(path); initial.projects.push({ id, name: id, path }); }
  initial.lastProjectId = "alpha"; await Bun.write(config, JSON.stringify(initial));
  return { root, config, initial };
}

test("explorador abre pestañas con título y sintaxis; conserva chat/draft/cwd, scroll, selección y cierre", async () => {
  const { root, config, initial } = await fixture(), file = join(initial.projects[0]!.path, "index.html"), outside = join(root, "style.css");
  const source = '<!DOCTYPE html>\n<style>body { color: #ff0055; }</style>\n<script>const saludo = "hola";</script>\n' + "<!-- á文🙂 -->\n".repeat(5000) + "ULTIMA_LINEA";
  await Bun.write(file, source); await Bun.write(outside, "body { margin: 12px; }");
  const app = await App.open({ config });
  try {
    app.desktop.resize(100, 32); const alpha = app.tabs[0]!, chat = alpha.response;
    chat.setValue("Conversación conservada"); app.view.prompt.setValue("BORRADOR á文🙂");
    await app.attach([outside]); app.explore(); await until(() => Boolean(app.desktop.modal?.controls.find(c => c.id === "files")));
    const explorer = app.desktop.modal!, files = explorer.controls.find(c => c.id === "files") as SelectList;
    await until(() => files.items.some(item => item.includes("index.html")));
    files.selected = files.items.findIndex(item => item.includes("index.html")); key(app, "enter");
    await until(() => app.fileTabs.length === 1 && !app.desktop.modal);
    const first = app.fileTabs[0]!;
    expect(app.view.editorWindow.title).toBe("index.html"); expect(app.view.response).toBe(first.content);
    expect(app.desktop.draw().lines()[1]).toContain("2:index.html");
    expect(app.view.response.value).toBe(source); expect(app.view.response.readOnly).toBe(true);
    expect(app.desktop.draw().lines().join("\n")).toContain("<!DOCTYPE html>");
    expect(app.desktop.draw().cells.flat().some(c => c.style === theme.syntaxKeyword)).toBe(true);
    expect(app.project!.path).toBe(initial.projects[0]!.path); expect(app.view.prompt.value).toBe("BORRADOR á文🙂"); expect(app.attachments[0]!.path).toBe(outside);
    key(app, "ctrl+end"); expect(app.desktop.draw().lines().join("\n")).toContain("ULTIMA_LINEA");
    await app.openFile(outside); expect(app.fileTabs).toHaveLength(2); expect(app.view.editorWindow.title).toBe("style.css");
    await app.openFile(file); expect(app.fileTabs).toHaveLength(2); expect(app.desktop.draw().lines().join("\n")).toContain("ULTIMA_LINEA");
    key(app, "ctrl+a"); expect(app.desktop.draw().cells.flat().some(c => c.style === theme.selected && c.text === "U")).toBe(true);
    app.desktop.handle({ type: "paste", text: "no editar" }); key(app, "delete"); expect(first.content.value).toBe(source);
    key(app, "alt+1"); await until(() => app.view.response === chat);
    expect(chat.value).toBe("Conversación conservada"); expect(app.view.prompt.value).toBe("BORRADOR á文🙂");
    const x = app.desktop.draw().lines()[1]!.indexOf("2:index.html") + 2;
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, x, y: 1, button: 0, delta: 0 });
    await until(() => app.view.response === first.content); expect(app.view.editorWindow.title).toBe("index.html");
    key(app, "alt+left"); await until(() => app.view.response === chat);
    key(app, "alt+right"); await until(() => app.view.response === first.content);
    await app.setLanguage("en"); expect(app.desktop.draw().lines().join("\n")).toContain("read-only");
    for (const [width, height] of [[60, 16], [100, 32]] as const) {
      app.desktop.resize(width, height); const canvas = app.desktop.draw();
      expect(canvas.lines().join("\n")).toContain("Prompt"); expect(canvas.lines().join("\n")).toContain("Tokens I/O");
      expect(app.view.response.bounds.height).toBe(app.view.editorWindow.client.height - 1);
      for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(width);
    }
    await app.switchProject(app.store.value.projects[1]!); const beta = app.tabs[1]!; app.view.prompt.setValue("BORRADOR beta");
    await app.activateTab(first.id); expect(app.project!.id).toBe("alpha"); expect(app.view.prompt.value).toBe("BORRADOR á文🙂");
    app.busy = true; await expect(app.closeTab(alpha.id)).rejects.toThrow("cancelá");
    key(app, "ctrl+w"); await until(() => app.fileTabs.length === 1); expect(app.view.response).toBe(chat); expect(app.busy).toBe(true); app.busy = false;
    await app.closeTab(alpha.id); expect(app.fileTabs).toHaveLength(0); expect(app.project!.id).toBe("beta"); expect(app.view.prompt.value).toBe("BORRADOR beta");
    await expect(app.openFile(join(root, "missing.ts"))).rejects.toThrow(); expect(app.view.editorWindow.title).toBe("beta");
    await expect(app.openFile(root)).rejects.toThrow("archivo regular");
    await Bun.write(join(root, "binary"), new Uint8Array([0, 255])); await app.openFile(join(root, "binary"));
    expect(app.view.response.placeholder).toContain("Binary file"); expect(app.tabs).toHaveLength(1); expect(app.tabs[0]).toBe(beta);
    expect(await Bun.file(file).text()).toBe(source); expect((await Bun.file(config).json()).workspace.openProjectIds).toEqual(["beta"]);
  } finally { app.busy = false; await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("LLM responde en el chat del proyecto aunque se abrió un archivo; stream en background conserva el archivo", async () => {
  const { root, config, initial } = await fixture(), file = join(initial.projects[0]!.path, "file.ts");
  await Bun.write(file, "export const value = 42;"); let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const server = Bun.serve({ port: 0, fetch() { return new Response(new ReadableStream({ start(c) { controller = c; } })); } });
  initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
  initial.providers[0]!.models = [{ id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
  initial.defaults.modelId = "fixture"; await Bun.write(config, JSON.stringify(initial)); const app = await App.open({ config });
  try {
    const chat = app.tabs[0]!.response; await app.openFile(file); app.view.prompt.setValue("Hola"); await app.submit();
    await until(() => Boolean(controller)); expect(app.view.response).toBe(chat); expect(app.view.editorWindow.title).toBe("alpha");
    await app.openFile(file); const value = app.view.response.value;
    controller!.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Respuesta del agente"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')); controller!.close();
    await app.tabs[0]!.turn; expect(app.view.editorWindow.title).toBe("file.ts"); expect(app.view.response.value).toBe(value);
    await app.activateTab(app.tabs[0]!.id); expect(app.view.response.value).toContain("Respuesta del agente");
  } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("index.ts real abre un HTML desde el explorador en pestaña, colorea, resize y vuelve al chat", async () => {
  const { root, config, initial } = await fixture(); await Bun.write(join(initial.projects[0]!.path, "index.html"), '<style>body { color: red; }</style>\n<script>const numero = 42;</script>');
  let output = "";
  const terminal = new Bun.Terminal({ cols: 100, rows: 32, data: (_, bytes) => output += new TextDecoder().decode(bytes) });
  const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config], { cwd: root, terminal,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", NO_COLOR: undefined } });
  try {
    await until(() => output.includes("1:alpha")); terminal.write("borrador PTY\x05"); await until(() => output.includes("Explorador de archivos"));
    terminal.write("\x1b[B\r"); await until(() => output.includes("2:index.html"));
    expect(output).toContain("\x1b[38;2;255;85;255;48;2;0;0;170m\x1b[22mconst");
    expect(Bun.stripANSI(output)).toContain("solo lectura");
    output = ""; terminal.resize(60, 16); child.kill("SIGWINCH"); await until(() => output.includes("2:index.html"));
    expect(Bun.stripANSI(output)).toContain("Tokens E/S"); expect(Bun.stripANSI(output)).toContain("Prompt");
    expect(Bun.stripANSI(output)).toContain("borrador PTY");
    output = ""; terminal.write("\x1b1"); await until(() => output.includes("No hay modelo configurado"));
    output = ""; terminal.write("\x1b2"); await until(() => output.includes("<style"));
    output = ""; terminal.write("\x17"); await until(() => output.includes("No hay modelo configurado"));
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?25h\x1b[?1049l");
  } catch (error) { throw new Error(`${(error as Error).message} · ${Bun.stripANSI(output.slice(-7000))}`); }
  finally { child.kill(); await child.exited; terminal.close(); await rm(root, { recursive: true, force: true }); }
}, 15000);
