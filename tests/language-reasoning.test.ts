import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { ConfigStore, defaultConfig } from "../src/storage/config.ts";
import type { Message } from "../src/agent/messages.ts";
import { Button } from "../src/ui/components/button.ts";
import { Input } from "../src/ui/components/input.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { TextArea } from "../src/ui/components/text-area.ts";
import { FileExplorer } from "../src/ui/components/file-explorer.ts";
import { metricDetails } from "../src/system/metrics.ts";

async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout waiting for UI/stream");
}
const screen = (app: App) => app.desktop.draw().lines().join("\n");
const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
const event = (delta: unknown, finish_reason?: string) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;
const encoder = new TextEncoder();
async function message(app: App, message: Message) {
  await app.session!.append({ type: "message", message }); app.session!.state.messages.push(message);
}

test("config v1: defaults/migration preserve disk; invalid language/reasoning never overwrite data", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-config-")), path = join(root, "config.json");
  try {
    const old = defaultConfig(); delete (old.ui as Partial<typeof old.ui>).language; delete (old.ui as Partial<typeof old.ui>).showReasoning;
    const original = JSON.stringify(old); await Bun.write(path, original);
    const store = await ConfigStore.load(path);
    expect(store.value.ui.language).toBe("es"); expect(store.value.ui.showReasoning).toBe(true);
    expect(await Bun.file(path).text()).toBe(original);
    for (const patch of [{ language: "fr" }, { language: null }, { language: ["en"] }, { showReasoning: "off" }, { showReasoning: null }, { showReasoning: 0 }]) {
      const invalid = JSON.stringify({ ...old, ui: { ...old.ui, ...patch } }); await Bun.write(path, invalid);
      await expect(ConfigStore.load(path)).rejects.toThrow(); expect(await Bun.file(path).text()).toBe(invalid);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("View keyboard/mouse: switch language, translate surfaces, persist and preserve draft/focus/user content", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-ui-")), config = join(root, "config.json");
  const app = await App.open({ config, cwd: root });
  try {
    const other = await App.open({ config: join(root, "other.json"), cwd: root });
    try {
      app.desktop.resize(100, 30); app.project!.name = "Vista"; app.view.editorWindow.title = "Vista";
      app.view.prompt.setValue("Guardar\nmi prompt á文🙂");
      await message(app, { role: "user", content: "Ayuda" });
      await message(app, { role: "assistant", content: "Respuesta sin traducir: Enviar", reasoning: "pensamiento íntegro" }); app.showHistory();
      key(app, "alt+v"); for (let i = 0; i < 4; i++) key(app, "down"); key(app, "enter");
      expect(app.desktop.modal!.title).toBe("Language");
      expect((app.desktop.modal!.controls[0] as SelectList).items[0]).toContain("(actual)");
      key(app, "down"); key(app, "enter"); await until(() => app.desktop.language === "en");
      expect((await Bun.file(config).json()).ui.language).toBe("en");
      expect(screen(app)).toContain("File"); expect(screen(app)).toContain("View"); expect(screen(app)).toContain("Help");
      expect(screen(app)).toContain("< Send >"); expect(screen(app)).toContain("Shift+Enter: newline");
      expect(screen(app)).toContain("Disk"); expect(screen(app)).toContain("Tokens I/O");
      expect(app.view.response.value).toContain("You:\nAyuda"); expect(app.view.response.value).toContain("Agent:");
      expect(app.view.response.value).toContain("Reasoning:\npensamiento íntegro");
      expect(app.view.response.value).toContain("Respuesta sin traducir: Enviar");
      expect(app.view.editorWindow.title).toBe("Vista"); expect(app.view.prompt.value).toBe("Guardar\nmi prompt á文🙂");
      expect(app.desktop.active).toBe(app.view.promptWindow); expect(other.desktop.language).toBe("es");
      // Mouse hit boxes use translated header widths, not the original Spanish widths.
      const x = app.desktop.draw().lines()[0]!.indexOf("View") + 1;
      const mouse = (action: "press" | "release", y: number) => app.desktop.handle({ type: "mouse", action, button: 0, delta: 0, x, y });
      mouse("press", 0); mouse("release", 0); expect(app.desktop.menu.opened).toBe(5);
      expect(screen(app)).toContain("Show reasoning: on"); mouse("press", 7); mouse("release", 7);
      await until(() => !app.store.value.ui.showReasoning);
      expect(app.view.response.value).not.toContain("pensamiento íntegro"); expect(app.view.response.value).toContain("Respuesta sin traducir");
      app.projectForm(); expect(screen(app)).toContain("Projects · new"); expect(screen(app)).toContain("Folder"); expect(screen(app)).toContain("< Browse >"); expect(screen(app)).toContain("< Save >"); key(app, "escape");
      app.modelForm(true); expect(screen(app)).toContain("Models · host, port and model"); expect(screen(app)).toContain("Model ID"); key(app, "escape");
      app.providers(); expect(screen(app)).toContain("Providers"); key(app, "escape");
      app.extensions.serverForm("stdio"); expect(screen(app)).toContain("MCP · new stdio"); expect(screen(app)).toContain("Command"); expect(screen(app)).toContain("Args (JSON)"); key(app, "escape");
      app.extensions.skillForm(); expect(screen(app)).toContain("Skills · register"); expect(screen(app)).toContain("Scope global/"); key(app, "escape");
      app.extensions.search(); expect(screen(app)).toContain("Search · https://skills.sh"); key(app, "escape");
      app.promptings.editor(); expect(screen(app)).toContain("New prompting"); expect(screen(app)).toContain("Write the prompt"); expect(screen(app)).toContain("< Cancel >"); key(app, "escape");
      app.desktop.onHelp(); expect(app.desktop.modal!.title).toContain("Help"); expect((app.desktop.modal!.controls[0] as TextArea).value).toContain("Shift+Enter newline"); key(app, "escape");
      app.colorPalette(); expect((app.desktop.modal!.controls[0] as SelectList).items[1]).toContain("Graphite"); key(app, "escape");
      await Bun.write(join(root, "Ayuda"), "Guardar\nArchivo\ntexto del usuario");
      const explorer = new FileExplorer(app.desktop, root); await explorer.show(); expect(screen(app)).toContain("File explorer"); expect(screen(app)).toContain("< Search >"); expect(screen(app)).toContain("< Root >");
      explorer.list.selected = explorer.entries.findIndex(entry => entry.name === "Ayuda"); await explorer.openSelected();
      expect(app.desktop.modal!.title).toBe("Ayuda"); expect((app.desktop.modal!.controls[0] as TextArea).value).toContain("Guardar\nArchivo\ntexto del usuario"); expect((app.desktop.modal!.controls[0] as TextArea).value).toContain("read-only"); key(app, "escape"); key(app, "escape");
      expect(metricDetails(app.metrics.snapshot, undefined, app.desktop.t).join("\n")).not.toContain("entrada");
      app.desktop.resize(60, 16); expect(screen(app).split("\n")[0]).toContain("Help"); expect(screen(app)).toContain("< Send >");
      app.language(); key(app, "home"); key(app, "escape"); expect(app.desktop.language).toBe("en"); // Cancel leaves preference intact.
      app.language(); key(app, "home"); key(app, "enter"); await until(() => app.desktop.language === "es");
      expect(screen(app)).toContain("Ayuda"); expect(screen(app)).toContain("< Enviar >"); expect(app.view.response.value).toContain("Agente:");
      await app.setLanguage("en");
    } finally { await other.desktop.onBeforeExit!(); }
  } finally { await app.desktop.onBeforeExit!(); }
  const reopened = await App.open({ config });
  try {
    expect(reopened.desktop.language).toBe("en"); expect(reopened.store.value.ui.showReasoning).toBe(false);
    expect(reopened.view.response.value).not.toContain("pensamiento íntegro");
    expect(reopened.session!.state.messages.at(-1)!.reasoning).toBe("pensamiento íntegro");
    expect(reopened.view.prompt.value).toBe("Guardar\nmi prompt á文🙂");
  } finally { await reopened.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("preferences repaint all tabs, keep history/model bytes, and failed save leaves UI unchanged", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-tabs-")), app = await App.open({ config: join(root, "config.json"), cwd: root });
  try {
    const a = app.project!; await mkdir(join(root, "B")); const b = await app.store.project("B", "B", root);
    await message(app, { role: "assistant", content: "answer A", reasoning_content: "secret A" }); app.showHistory();
    await app.switchProject(b); await message(app, { role: "assistant", content: "answer B", reasoning: "secret B" }); app.showHistory();
    const saved = app.tabs.map(tab => JSON.stringify(tab.session!.state.messages));
    await app.toggleReasoning(); await app.setLanguage("en");
    for (const tab of app.tabs) { expect(tab.response.value).not.toContain("secret"); expect(tab.response.value).toContain("Agent:"); }
    expect(app.tabs.map(tab => JSON.stringify(tab.session!.state.messages))).toEqual(saved);
    await app.switchProject(a); expect(app.view.response.value).toContain("answer A");
    await app.toggleReasoning(); expect(app.tabs[0]!.response.value).toContain("secret A"); expect(app.tabs[1]!.response.value).toContain("secret B");
    const save = app.store.save.bind(app.store); app.store.save = async () => { throw new Error("fixture save failed"); };
    const before = app.view.response.value;
    await expect(app.setLanguage("es")).rejects.toThrow("fixture save failed"); await expect(app.toggleReasoning()).rejects.toThrow("fixture save failed");
    expect(app.desktop.language).toBe("en"); expect(app.store.value.ui.showReasoning).toBe(true); expect(app.view.response.value).toBe(before);
    app.store.save = save;
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("live reasoning can hide/show mid-stream without duplicated headers; tools/results/cancellation remain and persist", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-stream-")); let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const bodies: any[] = []; let closed = false;
  const server = Bun.serve({ port: 0, async fetch(request) {
    bodies.push(await request.json()); return new Response(new ReadableStream({ start(c) { controller = c; } }));
  } });
  const app = await App.open({ config: join(root, "config.json"), cwd: root });
  try {
    const next = structuredClone(app.store.value); next.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
    next.providers[0]!.models = [{ id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }];
    await app.store.save(next); await app.selectModel({ providerId: "llama.cpp", modelId: "fixture" });
    app.view.prompt.setValue("ask"); await app.submit(); await until(() => Boolean(controller));
    controller!.enqueue(encoder.encode(event({ reasoning_content: "thought α" }))); await until(() => app.view.response.value.includes("thought α"));
    await app.toggleReasoning(); expect(app.view.response.value).not.toContain("thought α");
    controller!.enqueue(encoder.encode(event({ reasoning_content: " + β", tool_calls: [{ index: 0, id: "list-1", function: { name: "list", arguments: '{"path":' } }] })));
    await until(() => app.view.response.value.includes('{"path":')); expect(app.view.response.value).not.toContain("β");
    await app.setLanguage("en"); expect(app.view.response.value).toContain("Tool call · list"); expect(app.busy).toBe(true);
    await app.toggleReasoning(); expect(app.view.response.value).toContain("Reasoning:\nthought α + β");
    controller!.enqueue(encoder.encode(event({ reasoning_content: " + γ" }))); await until(() => app.view.response.value.includes("γ"));
    expect(app.view.response.value.match(/Reasoning:/g)?.length).toBe(2); // Tool call separates reasoning chunks.
    await app.toggleReasoning(); await app.toggleReasoning();
    controller!.enqueue(encoder.encode(event({ reasoning_content: " + δ" }))); await until(() => app.view.response.value.includes(" + γ + δ"));
    expect(app.view.response.value.match(/Reasoning:/g)?.length).toBe(2); // Resuming the same live section adds no header.
    await app.toggleReasoning(); controller!.enqueue(encoder.encode(event({ tool_calls: [{ index: 0, function: { arguments: '"."}' } }] }, "tool_calls") + "data: [DONE]\n\n")); controller!.close();
    await until(() => bodies.length === 2);
    expect(bodies[1].messages.find((m: any) => m.role === "assistant").reasoning_content).toBe("thought α + β + γ + δ");
    expect(app.view.response.value).toContain("Tool · list:"); expect(app.view.response.value).toContain("OK");
    controller!.enqueue(encoder.encode(event({ reasoning: "cancelled thought", content: "answer preserved" })));
    await until(() => app.view.response.value.includes("answer preserved")); expect(app.view.response.value).not.toContain("cancelled thought");
    await app.toggleReasoning(); expect(app.view.response.value).toContain("cancelled thought");
    controller!.enqueue(encoder.encode(event({ reasoning: " next" }))); await until(() => app.view.response.value.includes(" next"));
    await app.toggleReasoning(); app.cancel(); await until(() => !app.busy);
    expect(app.view.response.value).toContain("answer preserved"); expect(app.view.response.value).not.toContain("cancelled thought"); expect(app.view.response.value).toContain("Turn cancelled");
    expect(app.session!.state.messages.at(-1)!.reasoning).toBe("cancelled thought next");
    await app.desktop.onBeforeExit!(); closed = true; const resumed = await App.open({ config: app.store.path });
    try { expect(resumed.view.response.value).not.toContain("cancelled thought"); await resumed.toggleReasoning(); expect(resumed.view.response.value).toContain("cancelled thought next"); expect(resumed.view.response.value).toContain("thought α + β + γ + δ"); }
    finally { await resumed.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});


test("English forms keep CRUD action IDs and accept yes/project without changing saved user text", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-crud-")), app = await App.open({ config: join(root, "config.json"), cwd: root });
  try {
    const next = structuredClone(app.store.value);
    next.providers[0]!.models = [{ id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }];
    next.mcpServers = [{ id: "server", name: "Editar", enabled: false, transport: "stdio", command: "bun", args: [] }];
    next.promptings = [{ id: "template", name: "Guardar", text: "hola {{name}}" }];
    await app.store.save(next); await app.selectModel({ providerId: "llama.cpp", modelId: "fixture" }); await app.setLanguage("en");
    app.modelForm(); const modelWindow = app.desktop.modal!;
    (modelWindow.controls.find(control => control.id === "next") as Button).onClick();
    (modelWindow.controls.find(control => control.id === "next") as Button).onClick();
    const caps = modelWindow.controls.find(control => control.id === "field-8") as Input;
    expect(caps.value).toBe("yes/no"); caps.setValue("yes/yes");
    (modelWindow.controls.find(control => control.id === "save") as Button).onClick();
    await until(() => !app.desktop.modal);
    expect(app.store.value.providers[0]!.models[0]!.capabilities).toEqual({ tools: true, images: true });
    app.extensions.servers(); expect((app.desktop.modal!.controls[0] as SelectList).items[0]).toContain("Editar"); key(app, "enter");
    expect((app.desktop.modal!.controls[0] as SelectList).items).toEqual(["Edit", "Enable", "Test connection", "Delete"]);
    key(app, "down"); key(app, "enter"); await until(() => app.store.value.mcpServers[0]!.enabled);
    const skillPath = join(root, "demo-skill"); await mkdir(skillPath);
    await Bun.write(join(skillPath, "SKILL.md"), "---\nname: demo-skill\ndescription: Descripción intacta\n---\nInstrucciones originales.");
    app.extensions.skillForm(); const skillWindow = app.desktop.modal!;
    (skillWindow.controls.find(control => control.id === "field-0") as Input).setValue(skillPath);
    (skillWindow.controls.find(control => control.id === "field-1") as Input).setValue("project");
    (skillWindow.controls.find(control => control.id === "save") as Button).onClick();
    await until(() => !app.desktop.modal); expect(app.store.value.skills[0]!.projectId).toBe(app.project!.id);
    app.promptings.library(); expect((app.desktop.modal!.controls[0] as SelectList).items[0]).toBe("Guardar · 1 variable"); key(app, "enter");
    expect(app.desktop.modal!.title).toBe("Guardar"); key(app, "enter");
    expect(app.desktop.modal!.title).toBe("Variables · Guardar");
    const value = app.desktop.modal!.controls[0] as TextArea; value.setValue("Enviar"); key(app, "enter");
    await until(() => !app.desktop.modal); expect(app.view.prompt.value).toBe("hola Enviar");
    expect(app.store.value.promptings[0]!.text).toBe("hola {{name}}");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});


test("configured startup metadata stays literal across languages while no-tools labels translate", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-language-context-")), path = join(root, "config.json");
  const config = defaultConfig(); config.providers[0]!.name = "Vista";
  config.providers[0]!.models = [{ id: "configurar", name: "Configurar", contextWindow: 8192, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
  config.defaults.modelId = "configurar"; await Bun.write(path, JSON.stringify(config));
  const app = await App.open({ config: path, cwd: root });
  try {
    app.desktop.resize(100, 30); expect(screen(app)).toContain("Vista · configurar · sin tools");
    await app.setLanguage("en"); expect(screen(app)).toContain("Vista · configurar · no tools");
    expect(app.view.response.placeholder).toContain("Vista · configurar · no tools");
    await app.setLanguage("es"); expect(screen(app)).toContain("Vista · configurar · sin tools");
    expect(app.view.response.placeholder).toContain("Vista · configurar · sin tools");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});
