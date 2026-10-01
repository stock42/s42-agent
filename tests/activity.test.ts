import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import type { ProjectTab } from "../src/project-tab.ts";

const encoder = new TextEncoder();
const packet = (delta: unknown, finish_reason?: string) => encoder.encode(`data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`);
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("No cambió la actividad visible");
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-activity-")), config = join(root, "config.json"), initial = defaultConfig();
  for (const id of ["alpha", "beta"]) { const path = join(root, id); await mkdir(path); initial.projects.push({ id, name: id === "alpha" ? "Alpha" : "Beta", path }); }
  initial.lastProjectId = "alpha";
  const controllers = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as { model: string };
    return new Response(new ReadableStream({ start(controller) { controllers.set(body.model, controller); } }), { headers: { "Content-Type": "text/event-stream" } });
  } });
  initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
  initial.providers[0]!.models = ["alpha", "beta"].map(id => ({ id, name: id, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }));
  initial.projects.forEach(project => project.selection = { providerId: "llama.cpp", modelId: project.id });
  await Bun.write(config, JSON.stringify(initial));
  const app = await App.open({ config });
  return { root, app, controllers, server };
}
function panel(app: App, name: "editorWindow" | "promptWindow"): string {
  const lines = app.desktop.draw().lines(), window = app.view[name];
  return lines.slice(window.bounds.y, window.bounds.y + window.bounds.height).join("\n");
}
function title(app: App): string { return app.desktop.draw().lines()[app.view.editorWindow.bounds.y]!; }
async function send(app: App, controllers: Map<string, ReadableStreamDefaultController<Uint8Array>>): Promise<ProjectTab> {
  app.view.prompt.setValue("Pedido"); await app.submit(); await until(() => controllers.has(app.project!.id));
  return app.tabs.find(tab => tab.project?.id === app.project!.id)!;
}
function finish(controller: ReadableStreamDefaultController<Uint8Array>, content = "Respuesta final") {
  controller.enqueue(packet({ content }, "stop")); controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close();
}

test("el título anima sin deltas; estado solo en chat, conserva borrador/scroll y termina en idle", async () => {
  const { root, app, controllers, server } = await fixture();
  try {
    const tab = await send(app, controllers);
    app.view.prompt.setValue("BORRADOR á文🙂");
    expect(panel(app, "editorWindow")).toContain("Agente: Razonando…");
    expect(panel(app, "promptWindow")).not.toContain("Razonando"); expect(panel(app, "promptWindow")).not.toContain("Conectando");
    expect(panel(app, "promptWindow")).toContain("Tokens E/S"); expect(tab.response.value).not.toContain("Razonando");
    const first = title(app); await until(() => title(app) !== first);
    expect(app.view.editorWindow.title).toBe("Alpha"); expect(title(app)).toMatch(/Alpha · [|/\\-]/);
    expect(tab.prompt.value).toBe("BORRADOR á文🙂"); expect(app.desktop.active).toBe(app.view.promptWindow);
    await app.toggleReasoning(); controllers.get("alpha")!.enqueue(packet({ reasoning_content: "contenido de razonamiento oculto" }));
    await until(() => tab.live.length > 0); expect(tab.response.value).not.toContain("contenido de razonamiento oculto"); expect(panel(app, "editorWindow")).toContain("Agente: Razonando…");
    await app.setLanguage("en"); expect(panel(app, "editorWindow")).toContain("Agent: Reasoning…"); expect(panel(app, "promptWindow")).not.toContain("Reasoning");
    controllers.get("alpha")!.enqueue(packet({ content: Array.from({ length: 50 }, (_, i) => `línea ${i}`).join("\n") }));
    await until(() => tab.response.value.includes("línea 49")); expect(panel(app, "editorWindow")).toContain("Agent: Responding…");
    app.desktop.focus(app.view.editorWindow); app.desktop.handle({ type: "key", key: "ctrl+home" });
    const before = app.desktop.draw().lines().slice(app.view.response.bounds.y + app.view.editorWindow.client.y, app.view.editorWindow.client.y + app.view.response.bounds.y + app.view.response.bounds.height);
    const frame = title(app); await until(() => title(app) !== frame);
    expect(app.desktop.draw().lines().slice(app.view.response.bounds.y + app.view.editorWindow.client.y, app.view.editorWindow.client.y + app.view.response.bounds.y + app.view.response.bounds.height)).toEqual(before);
    finish(controllers.get("alpha")!, " fin"); await tab.turn;
    expect(title(app)).not.toMatch(/Alpha · [|/\\-]/); expect(panel(app, "editorWindow")).not.toContain("Agent: Responding…");
    const value = tab.response.value; let paints = 0; app.desktop.invalidate = () => paints++; await Bun.sleep(450);
    expect(paints).toBe(0); expect(tab.response.value).toBe(value); expect(tab.prompt.value).toBe("BORRADOR á文🙂");
    expect(tab.session!.state.events.some(event => JSON.stringify(event).includes("Alpha ·"))).toBe(false);
  } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("actividad aislada por pestaña, títulos largos, resize, cancelación, fallo y cierre", async () => {
  const { root, app, controllers, server } = await fixture(); let closed = false;
  try {
    const alpha = await send(app, controllers); await app.switchProject(app.store.value.projects[1]!);
    const beta = app.tabs[1]!; beta.prompt.setValue("BORRADOR B");
    expect(title(app)).not.toMatch(/Beta · [|/\\-]/); expect(panel(app, "editorWindow")).not.toContain("Razonando…");
    await send(app, controllers); await app.activateTab(alpha.id);
    const projectName = "Proyecto 文".repeat(15); alpha.project!.name = projectName; app.view.editorWindow.title = projectName;
    for (const [width, height] of [[60, 16], [80, 24], [120, 40]] as const) {
      app.desktop.resize(width, height); const canvas = app.desktop.draw(), editor = app.view.editorWindow, response = editor.controlRect(app.view.response);
      expect(canvas.lines()[editor.bounds.y]).toMatch(/ · [|/\\-] /); expect(panel(app, "editorWindow")).toContain("Agente: Razonando…");
      expect(response.y + response.height).toBe(editor.client.y + editor.client.height - 1);
      expect(panel(app, "promptWindow")).toContain("Tokens E/S"); expect(panel(app, "promptWindow")).not.toContain("Razonando…");
      for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(width);
    }
    app.cancel(); await alpha.turn; expect(alpha.agentState).toBeUndefined(); expect(beta.busy).toBe(true); expect(title(app)).not.toMatch(/ · [|/\\-] /);
    await app.activateTab(beta.id); expect(title(app)).toMatch(/Beta · [|/\\-]/); expect(panel(app, "editorWindow")).toContain("Agente: Razonando…");
    controllers.get("beta")!.close(); await beta.turn;
    expect(beta.busy).toBe(false); expect(title(app)).not.toMatch(/Beta · [|/\\-]/); expect(beta.status).toContain("sin completar la respuesta");
    controllers.delete("beta"); await send(app, controllers); await app.desktop.onBeforeExit!(); closed = true;
    expect(beta.busy).toBe(false); expect(beta.agentState).toBeUndefined(); let paints = 0; app.desktop.invalidate = () => paints++; await Bun.sleep(450); expect(paints).toBe(0);
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});
