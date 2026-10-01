import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execute } from "../src/agent/tools.ts";
import { internalSkills } from "../src/agent/skills/index.ts";
import { agentPrompt } from "../src/agent/prompt.ts";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";

const signal = () => new AbortController().signal;
const run = (name: string, args: object, cwd = process.cwd(), abort = signal()) => execute(name, JSON.stringify(args), cwd, abort);
async function until(check: () => boolean) {
  for (let i = 0; i < 500; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout esperando evento");
}

test("skills internas se descubren sin inyectar cuerpos y se cargan sin ejecutar scripts", async () => {
  const prompt = agentPrompt({ cwd: "/tmp/proyecto", tools: true, projectInstructions: "PROJECT_RULE" });
  const list = JSON.parse((await run("internal_skill", {})).output);
  expect(list.skills).toHaveLength(3); expect(prompt).toContain("S42 Agent"); expect(prompt).toContain("PROJECT_RULE");
  for (const skill of internalSkills) {
    expect(prompt).toContain(skill.name); expect(prompt).toContain(skill.description); expect(prompt).not.toContain(skill.body);
    const result = await run("internal_skill", { name: skill.name });
    expect(result.failed).toBe(false); expect(result.output).toContain(skill.body);
    expect(result.output).toContain(`Internal skill: ${skill.name}`);
  }
  expect((await run("internal_skill", { name: "create-pdf" })).output).toContain("does not provide an HTML-to-PDF");
  expect((await run("internal_skill", { name: "../../otra" })).failed).toBe(true);
  expect((await run("internal_skill", { name: 123 })).failed).toBe(true);
  const chatOnly = agentPrompt({ cwd: "/tmp", tools: false, projectInstructions: "PROJECT_RULE" });
  expect(chatOnly).toContain("Tool execution is disabled"); expect(chatOnly).not.toContain("internal_skill");
});

test("markdown_html convierte texto/archivo con Bun y escribe HTML completo en rutas Unicode", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-markdown-"));
  try {
    const markdown = "# Título á文🙂\n\n**Negrita** & texto\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconsole.log('<test>');\n```";
    const fragment = await run("markdown_html", { markdown }, root);
    expect(fragment.failed).toBe(false); expect(JSON.parse(fragment.output).html).toBe(Bun.markdown.html(markdown, { headings: { ids: true } }));
    await Bun.write(join(root, "nota.md"), markdown); await mkdir(join(root, "salida")); await Bun.write(join(root, "salida/AGENTS.md"), "DESTINATION_RULE");
    const result = await run("markdown_html", { path: "nota.md", outputPath: "salida/á carpeta/informe.html", standalone: true, title: '<Informe & "ejemplo">' }, root);
    expect(result.failed).toBe(false);
    const output = JSON.parse(result.output), html = await Bun.file(output.path).text();
    expect(html).toContain('<meta charset="UTF-8">'); expect(html).toContain("<table>"); expect(html).toContain("&lt;Informe &amp; &quot;ejemplo&quot;&gt;");
    expect(html).toContain("Título á文🙂"); expect(output.bytes).toBe(Buffer.byteLength(html)); expect(output.instructions).toContain("DESTINATION_RULE");
    expect(output.html).toBeUndefined();
    for (const args of [{}, { markdown, path: "nota.md" }, { path: "ausente" }, { markdown, outputPath: "" }, { markdown, standalone: "yes" }, { markdown, unexpected: true }]) {
      expect((await run("markdown_html", args, root)).failed).toBe(true);
    }
    await Bun.write(join(root, "bin.md"), new Uint8Array([255, 254]));
    expect((await run("markdown_html", { path: "bin.md" }, root)).failed).toBe(true);
    expect((await run("markdown_html", { markdown: "a".repeat(1048577) }, root)).failed).toBe(true);
    const abort = new AbortController(); abort.abort();
    expect((await run("markdown_html", { markdown, outputPath: "cancelado.html" }, root, abort.signal)).failed).toBe(true);
    expect(await Bun.file(join(root, "cancelado.html")).exists()).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Markdown grande conserva JSON parseable, UTF-8 y guarda HTML sin recortar", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-markdown-limit-"));
  try {
    const markdown = "á文🙂".repeat(14000);
    const result = await run("markdown_html", { markdown }, root), output = JSON.parse(result.output);
    expect(result.truncated).toBe(true); expect(output.truncated).toBe(true); expect(output.html).not.toContain("�");
    expect(Buffer.byteLength(output.html)).toBeLessThanOrEqual(65536);
    const saved = JSON.parse((await run("markdown_html", { markdown, outputPath: "full.html" }, root)).output);
    expect(await Bun.file(saved.path).text()).toBe(Bun.markdown.html(markdown, { headings: { ids: true } }));
    expect(saved.bytes).toBeGreaterThan(65536);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("WebSocket real con Bun: headers, subprotocolo, texto Unicode y binario; cierra la conexión", async () => {
  let header = "", protocol = "", closed = 0;
  const server = Bun.serve<boolean>({
    port: 0,
    fetch(req, server) {
      header = req.headers.get("x-fixture") ?? ""; protocol = req.headers.get("sec-websocket-protocol") ?? "";
      if (server.upgrade(req, { data: false, headers: { "sec-websocket-protocol": "fixture-v1" } })) return;
      return new Response("upgrade failed", { status: 400 });
    },
    websocket: { message(ws, message) { ws.send(String(message)); ws.send(new Uint8Array([0, 255, 42])); }, close() { closed++; } },
  });
  try {
    const result = await run("websocket", { url: `ws://127.0.0.1:${server.port}/test`, headers: { "x-fixture": "auth-test" }, protocols: ["fixture-v1"], messages: ['{"text":"á文🙂"}'], receiveCount: 2 });
    expect(result.failed).toBe(false); const output = JSON.parse(result.output);
    expect(header).toBe("auth-test"); expect(protocol).toBe("fixture-v1"); expect(output.protocol).toBe("fixture-v1");
    expect(output.opened).toBe(true); expect(output.sent).toBe(1); expect(output.reason).toBe("received");
    expect(output.received[0]).toMatchObject({ type: "text", data: '{"text":"á文🙂"}', truncated: false });
    expect(output.received[1]).toMatchObject({ type: "binary", data: "AP8q", bytes: 3 });
    await until(() => closed === 1); expect(server.pendingWebSockets).toBe(0);
    for (const args of [{ url: "https://example.com" }, { url: "invalid" }, { url: server.url.href, messages: [1] }, { url: server.url.href, headers: { invalid: 5 } }, { url: server.url.href, protocols: "x" }, { url: `ws://127.0.0.1:${server.port}`, receiveCount: 101 }]) {
      expect((await run("websocket", args)).failed).toBe(true);
    }
  } finally { server.stop(true); }
});

test("WebSocket conserva parciales en timeout/cancelación, close temprano y handshake fallido", async () => {
  let messages = 0, closed = 0;
  const server = Bun.serve<boolean>({
    port: 0,
    fetch(req, server) {
      if (req.url.endsWith("/reject")) return new Response("no", { status: 403 });
      if (server.upgrade(req, { data: req.url.endsWith("/close") })) return;
      return new Response("upgrade failed", { status: 400 });
    },
    websocket: { message(ws) { messages++; ws.send("partial"); if (ws.data) ws.close(1000, "done"); }, close() { closed++; } },
  });
  const url = `ws://127.0.0.1:${server.port}`;
  try {
    const timed = await run("websocket", { url, messages: ["ping"], receiveCount: 2, timeoutMs: 50 });
    expect(timed.failed).toBe(true); expect(JSON.parse(timed.output)).toMatchObject({ reason: "timeout", sent: 1, received: [{ data: "partial" }] });
    await until(() => closed === 1);
    const abort = new AbortController(), pending = run("websocket", { url, messages: ["ping"], receiveCount: 2 }, process.cwd(), abort.signal);
    await until(() => messages === 2); await Bun.sleep(10); abort.abort(new Error("cancelled"));
    const cancelled = await pending; expect(cancelled.failed).toBe(true);
    expect(JSON.parse(cancelled.output)).toMatchObject({ reason: "cancelled", received: [{ data: "partial" }] });
    const early = JSON.parse((await run("websocket", { url: url + "/close", messages: ["ping"], receiveCount: 2 })).output);
    expect(early.reason).toBe("closed"); expect(early.closeCode).toBe(1000); expect(early.closeReason).toBe("done");
    const rejected = await run("websocket", { url: url + "/reject" }); expect(rejected.failed).toBe(true); expect(JSON.parse(rejected.output).reason).toBe("error");
    await until(() => closed === 3); expect(server.pendingWebSockets).toBe(0);
  } finally { server.stop(true); }
});

test("WebSocket limita payload recibido sin cortar JSON ni caracteres UTF-8", async () => {
  const server = Bun.serve({ port: 0, fetch(req, server) { if (server.upgrade(req)) return; return new Response("no", { status: 400 }); }, websocket: { open(ws) { ws.send("á文🙂".repeat(20000)); }, message() {} } });
  try {
    const result = await run("websocket", { url: `ws://127.0.0.1:${server.port}` });
    expect(result.failed).toBe(true); expect(result.truncated).toBe(true);
    const output = JSON.parse(result.output); expect(output.reason).toBe("limit"); expect(output.received[0].data).not.toContain("�");
    expect(Buffer.byteLength(output.received[0].data)).toBeLessThanOrEqual(65536); expect(output.received[0].truncated).toBe(true);
  } finally { server.stop(true); }
});

test("App integra skills internas, Markdown y WebSocket en chat persistente; catálogo bilingüe y prompt fijo", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-internal-loop-"));
  const ws = Bun.serve({ port: 0, fetch(req, server) { if (server.upgrade(req)) return; return new Response("no", { status: 400 }); }, websocket: { message(ws, message) { ws.send(String(message)); } } });
  const calls = [
    { name: "internal_skill", args: { name: "software-project" } },
    { name: "markdown_html", args: { markdown: "# Proyecto verificado\n", outputPath: "plan.html", standalone: true } },
    { name: "websocket", args: { url: `ws://127.0.0.1:${ws.port}`, messages: ["WS_VERIFIED"] } },
  ];
  let requests = 0;
  const llm = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any;
    expect(body.messages[0].content).toContain("software-project:");
    expect(body.messages[0].content).not.toContain(internalSkills[0]!.body);
    expect(body.tools.some((tool: any) => tool.function.name === "websocket")).toBe(true);
    if (requests > 0) expect(body.messages.some((message: any) => message.role === "tool" && message.content.includes("Software project foundation"))).toBe(true);
    const call = calls[requests++];
    const delta = call ? { tool_calls: [{ index: 0, id: `builtin-${requests}`, function: { name: call.name, arguments: JSON.stringify(call.args) } }] } : { content: "HTML y WebSocket verificados" };
    return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: call ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
  } });
  const config = defaultConfig(), model = { id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } };
  config.providers[0]!.baseUrl = `http://127.0.0.1:${llm.port}/v1`; config.providers[0]!.models = [model]; config.defaults.modelId = model.id;
  const path = join(root, "config.json"); await Bun.write(path, JSON.stringify(config));
  const app = await App.open({ config: path, cwd: root }); let appClosed = false;
  try {
    app.view.prompt.setValue("Planificar y verificar proyecto"); await app.submit(); await until(() => !app.busy);
    expect(requests).toBe(4); expect(await Bun.file(join(root, "plan.html")).text()).toContain("Proyecto verificado");
    for (const call of calls) expect(app.view.response.value).toContain(call.name);
    expect(app.view.response.value).toContain("WS_VERIFIED"); expect(app.view.response.readOnly).toBe(true);
    const id = app.session!.state.id; await app.desktop.onBeforeExit!(); appClosed = true;
    const reopened = await App.open({ config: path, session: id });
    try {
      expect(reopened.view.response.value).toContain("WS_VERIFIED"); expect(requests).toBe(4);
      reopened.desktop.resize(60, 16); reopened.view.prompt.setValue("BORRADOR");
      const toolsMenu = reopened.desktop.menu.menus.find(menu => menu.label === "Tools")!;
      toolsMenu.items[0]!.run();
      for (let i = 0; i < 10; i++) reopened.desktop.handle({ type: "key", key: "down" });
      expect(reopened.desktop.draw().lines().join("\n")).toContain("websocket");
      reopened.desktop.handle({ type: "key", key: "enter" });
      expect(reopened.desktop.draw().lines().join("\n")).toContain("Probar cualquier servidor");
      reopened.desktop.handle({ type: "key", key: "escape" });
      reopened.desktop.language = "en";
      toolsMenu.items[0]!.run();
      for (let i = 0; i < 10; i++) reopened.desktop.handle({ type: "key", key: "down" });
      reopened.desktop.handle({ type: "key", key: "enter" });
      expect(reopened.desktop.draw().lines().join("\n")).toContain("Test any ws/wss server");
      expect(reopened.view.prompt.value).toBe("BORRADOR"); expect(reopened.desktop.draw().lines().join("\n")).toContain("BORRADOR");
    } finally { await reopened.desktop.onBeforeExit!(); }
  } finally {
    if (!appClosed) await app.desktop.onBeforeExit!(); llm.stop(true); ws.stop(true); await rm(root, { recursive: true, force: true });
  }
});
