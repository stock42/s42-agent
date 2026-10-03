import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BrowserSession } from "../src/mcp/browser.ts";
import { preserveMcpContent, artifactDirectory } from "../src/mcp/artifacts.ts";
import { providerMessages } from "../src/llm/client.ts";
import { Session } from "../src/storage/sessions.ts";
import { TurnTasks } from "../src/agent/tasks.ts";
import { App } from "../src/app.ts";
const signal = () => new AbortController().signal;
const schema = { type: "object", properties: {}, additionalProperties: true };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII=";
function fixtureServer() { let requests = 0, cancelled = 0; const server = Bun.serve({ port: 0, async fetch(req) {
  const p = await req.json() as any; requests++;
  if (p.id === undefined) { if (p.method === "notifications/cancelled") cancelled++; return new Response(null, { status: 202 }); }
  const result = p.method === "server/discover" ? { supportedVersions: ["2026-07-28"] } : p.method === "tools/list" ? { tools: ["new_page", "take_snapshot", "take_screenshot", "list_pages", "evaluate_script"].map(name => ({ name, inputSchema: schema })) }
    : p.params.name === "evaluate_script" ? undefined : { content: p.params.name === "take_screenshot" ? [{ type: "image", data: png, mimeType: "image/png" }] : [{ type: "text", text: `## Pages\n1: ${p.params.arguments.url ?? "http://test.invalid"} [selected]` }] };
  if (!result) return new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "text/event-stream" } });
  return Response.json({ jsonrpc: "2.0", id: p.id, result });
} }); return { server, requests: () => requests, cancelled: () => cancelled }; }
test("browser opcional conserva conexión entre turnos, cancela y separa proyectos", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-browser-")), fixture = fixtureServer(), record = { id: "chrome", name: "Chrome", enabled: true, transport: "http" as const, purpose: "browser" as const, url: `http://127.0.0.1:${fixture.server.port}` };
  const a = new BrowserSession(record, root, join(root, "A-artifacts"), "existing"), b = new BrowserSession(record, root, join(root, "B-artifacts"), "existing");
  try {
    expect(fixture.requests()).toBe(0); await a.open(signal()); const initial = fixture.requests(); await a.open(signal()); expect(fixture.requests()).toBe(initial);
    await b.open(signal()); const result = await a.action("take_screenshot", {}, signal()); expect(result.artifacts).toHaveLength(1); expect(result.output).not.toContain(png); expect(result.artifacts![0]!.path).toStartWith(join(root, "A-artifacts")); expect(b.pages).toBe("");
    const controller = new AbortController(), pending = a.action("evaluate_script", {}, controller.signal); await Bun.sleep(15); controller.abort(new Error("test cancel")); expect((await pending).failed).toBe(true); expect(a.activity).toBe("");
    await a.close(); expect(b.state).toBe("connected"); expect((await b.action("list_pages", {}, signal())).failed).toBe(false);
    const isolated = new BrowserSession(record, root, root); await expect(isolated.open(signal())).rejects.toThrow("selección explícita");
  } finally { await a.close(); await b.close(); fixture.server.stop(true); await rm(root, { recursive: true, force: true }); }
});
test("MCP imagen/blob/link conservados; proveedor con/sin visión y archivos ausentes", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-media-"));
  try {
    const saved = await preserveMcpContent([{ type: "image", mimeType: "image/png", data: png }, { type: "resource", resource: { uri: "artifact://data", mimeType: "text/plain", blob: Buffer.from("texto á文🙂").toString("base64") } }, { type: "resource_link", uri: "https://example.invalid/report", name: "Report", mimeType: "text/plain" }], root);
    expect(saved.artifacts).toHaveLength(3); expect(saved.output).not.toContain(png); expect(await Bun.file(saved.artifacts[1]!.path!).text()).toBe("texto á文🙂");
    const messages = [{ role: "tool" as const, tool_call_id: "capture-call", content: saved.output, artifacts: saved.artifacts }];
    const grouped = await providerMessages([...messages, { role: "tool", content: "second response", tool_call_id: "second" }], true); expect(grouped.map(m => m.role)).toEqual(["tool", "tool", "user"]);
    const vision = await providerMessages(messages, true); expect((vision[1]!.content as any[]).find(p => p.type === "image_url").image_url.url).toBe(`data:image/png;base64,${png}`);
    const text = await providerMessages(messages, false); expect(JSON.stringify(text)).not.toContain(png); expect(JSON.stringify(text)).toContain("Pixels were not provided"); expect(messages[0]!.artifacts).toHaveLength(3);
    await rm(saved.artifacts[0]!.path!); expect(JSON.stringify(await providerMessages(messages, true))).toContain("Artifact file missing");
  } finally { await rm(root, { recursive: true, force: true }); }
});
for (const backend of ["sessions", "agent.sqlite"]) test(`evidencia web ${backend}: fallo/corrección, origen, vigencia y reapertura`, async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-web-evidence-")), path = join(root, backend); let session = await Session.open(path, "project");
  try {
    const tasks = await TurnTasks.open(root, session, signal(), ""), [card] = await tasks.plan("formulario", [{ title: "Guardar", criterion: "persistencia y consola sin error", verification: [{ kind: "browser", description: "flujo real", required: true, paths: ["index.html"] }] }]);
    const saved = await preserveMcpContent([{ type: "image", data: png, mimeType: "image/png" }], artifactDirectory(session));
    await session.append({ type: "browser-observation", requestId: tasks.request!.requestId, callId: "error-observed", serverId: "chrome", tool: "console", arguments: "{}", output: "HTTP 500", failed: false, artifacts: saved.artifacts });
    const scenario = { url: "http://test.invalid", steps: ["llenar", "guardar", "recargar", "console/network"], expected: "persistido", observed: "HTTP 500, no guardado" };
    expect((await tasks.browserReview(card!.id, card!.verification[0]!.id, ["error-observed"], scenario, false)).state).toBe("failed"); await expect(tasks.update(card!.id, { status: "done", acceptanceEvidence: [] })).rejects.toThrow();
    await session.append({ type: "browser-observation", requestId: tasks.request!.requestId, callId: "fixed-observed", serverId: "chrome", tool: "DOM", arguments: "{}", output: "persistido", failed: false });
    await session.append({ type: "tool-result", callId: "source-read", output: "fuente observada", failed: false });
    const passed = await tasks.browserReview(card!.id, card!.verification[0]!.id, ["fixed-observed", "error-observed", "source-read"], { ...scenario, observed: "persistido después de corregir" }, true); expect(passed.origin).toBe("browser");
    await tasks.update(card!.id, { status: "done", acceptanceEvidence: [passed.id] }); await Bun.write(join(root, "index.html"), "nuevo código"); expect((await tasks.cardPending((await tasks.store.read()).tasks[0]!)).join()).toContain("revalidación");
    await session.append({ type: "message", message: { role: "tool", content: saved.output, tool_call_id: "error-observed", artifacts: saved.artifacts } });
    const id = session.state.id; await session.close(); session = await Session.open(path, "project", id); expect(session.state.events.filter(e => e.type === "task-verification")).toHaveLength(2); expect(await Bun.file(session.state.messages.at(-1)!.artifacts![0]!.path!).exists()).toBe(true);
  } finally { await session.close(); await rm(root, { recursive: true, force: true }); }
});
test("TUI configura Chrome sin conexión al abrir; cerrar/folder libera su propietario", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-browser-ui-")), app = await App.open({ config: join(root, "config.json"), cwd: root }), fixture = fixtureServer();
  try {
    const next = structuredClone(app.store.value); next.mcpServers = [{ id: "chrome", name: "Chrome", enabled: true, purpose: "browser", transport: "http", url: `http://127.0.0.1:${fixture.server.port}` }]; next.projects[0]!.browserServerId = "chrome"; next.projects[0]!.browserMode = "existing"; await app.store.save(next); app.project!.browserServerId = "chrome"; app.project!.browserMode = "existing";
    app.browserPanel(); app.desktop.draw(); expect(fixture.requests()).toBe(0); expect(app.tabs[0]!.browser?.state).toBe("disconnected"); expect(app.desktop.draw().lines().join("\n")).toContain("Prompt"); app.desktop.close();
    await app.tabs[0]!.browser!.open(signal()); await app.tabs[0]!.browser!.action("new_page", { url: "http://owner-A.invalid" }, signal()); await app.desktop.onBeforeExit!(); expect(app.tabs[0]!.browser!.state).toBe("disconnected");
  } finally { fixture.server.stop(true); await rm(root, { recursive: true, force: true }); }
});
