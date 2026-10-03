import { taskWorkflow } from "./task-provider-fixture.ts";
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig, validateConfig } from "../src/storage/config.ts";
import { Session } from "../src/storage/sessions.ts";

const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout en pestañas");
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-tabs-")), config = join(root, "config.json"), initial = defaultConfig();
  for (const id of ["alpha", "beta"]) { const path = join(root, id); await mkdir(path); initial.projects.push({ id, name: id === "alpha" ? "Alpha" : "Beta", path }); }
  initial.lastProjectId = "alpha"; initial.workspace = { openProjectIds: ["alpha"] };
  await Bun.write(config, JSON.stringify(initial)); return { root, config, initial };
}

test("menús de producto, pestañas con estado propio, mouse/teclado, locks y reapertura durable", async () => {
  const { root, config, initial } = await fixture(), app = await App.open({ config }); let closed = false;
  try {
    app.desktop.resize(60, 16);
    const labels = ["Archivo", "Projects", "Models", "Promptings", "Tools", "Vista", "Ayuda"];
    expect(app.desktop.menu.menus.map(menu => menu.label)).toEqual(labels);
    for (const label of labels) expect(app.desktop.draw().lines()[0]).toContain(label);
    expect(app.desktop.menu.menus.flatMap(menu => menu.items.map(item => item.label))).not.toContain("Componentes");
    app.view.prompt.setValue("borrador á 文\nAlpha"); await Bun.write(join(initial.projects[0]!.path, "note.ts"), "alpha-only");
    await app.attach([join(initial.projects[0]!.path, "note.ts")]); key(app, "escape"); expect(app.mode).toBe("NORMAL");
    const alpha = app.tabs[0]!, response = alpha.response;
    response.setValue(Array.from({ length: 50 }, (_, i) => `Alpha ${i}`).join("\n"));
    app.desktop.focus(app.view.editorWindow); key(app, "pagedown");
    await app.switchProject(app.store.value.projects[1]!); expect(app.tabs).toHaveLength(2); expect(app.project!.name).toBe("Beta");
    expect(app.view.prompt.value).toBe(""); expect(app.attachments).toHaveLength(0); expect(app.mode).toBe("INSERT");
    const beta = app.tabs[1]!; app.view.prompt.setValue("borrador Beta");
    await expect(Session.open(app.sessionsPath, "alpha", alpha.session!.state.id)).rejects.toThrow("abierta");
    key(app, "alt+1"); await until(() => app.project?.id === "alpha");
    expect(app.view.prompt.value).toBe("borrador á 文\nAlpha"); expect(app.view.response).toBe(response); expect(app.mode).toBe("NORMAL");
    expect(app.attachments[0]!.name).toBe("note.ts"); expect(app.desktop.active).toBe(app.view.editorWindow);
    const row = app.desktop.draw().lines()[1]!, x = row.indexOf("2:P:Beta"); expect(x).toBeGreaterThan(0);
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, x: x + 2, y: 1, button: 0, delta: 0 });
    await until(() => app.project?.id === "beta"); expect(app.view.prompt.value).toBe("borrador Beta"); expect(app.view.editorWindow.title).toBe("Beta");
    key(app, "alt+left"); await until(() => app.project?.id === "alpha");
    app.promptings.library(); key(app, "alt+2"); expect(app.project!.id).toBe("alpha");
    expect(app.desktop.modal!.bounds.y + app.desktop.modal!.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y); key(app, "escape");
    await app.desktop.onBeforeExit!(); closed = true;
    const reopened = await App.open({ config });
    try {
      expect(reopened.tabs.map(tab => tab.project!.id)).toEqual(["alpha", "beta"]); expect(reopened.project!.id).toBe("alpha");
      expect(reopened.tabs[0]!.prompt.value).toBe("borrador á 文\nAlpha"); expect(reopened.tabs[1]!.prompt.value).toBe("borrador Beta");
      await reopened.closeTab(reopened.tabs[1]!.id); expect(reopened.tabs).toHaveLength(1);
      const released = await Session.open(reopened.sessionsPath, "beta", beta.session!.state.id); await released.close();
      await reopened.closeTab(); expect(reopened.project).toBeUndefined(); expect(reopened.view.prompt.value).toBe("");
      expect((await Bun.file(config).json()).workspace.openProjectIds).toEqual([]);
    } finally { await reopened.desktop.onBeforeExit!(); }
    const empty = await App.open({ config }); try { expect(empty.project).toBeUndefined(); expect(empty.desktop.modal).toBeUndefined(); } finally { await empty.desktop.onBeforeExit!(); }
    expect(() => validateConfig({ ...initial, workspace: { openProjectIds: ["unknown"] } })).toThrow("Pestañas");
    expect(() => validateConfig({ ...initial, workspace: { openProjectIds: ["alpha", "alpha"] } })).toThrow("Pestañas");
  } finally { if (!closed) await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("dos turnos concurrentes aíslan modelos, reasoning, tools/cwd, borradores y cancelación", async () => {
  const { root, config, initial } = await fixture();
  const workflows = new Map<string, ReturnType<typeof taskWorkflow>>();
  const gates = new Map<string, () => void>(), requests = new Map<string, number>(), payloads: any[] = [];
  const packet = (delta: unknown, finish_reason?: string) => new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`);
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any; const model = body.model as string;
    const user = body.messages.findLast((m: any) => m.role === "user").content;
    const id = `${model}:${user}`; if (!workflows.has(id)) workflows.set(id, taskWorkflow(1));
    const flow = workflows.get(id)!(body); if (flow) return flow;
    payloads.push(body);
    requests.set(model, (requests.get(model) ?? 0) + 1);
    const slow = body.messages.findLast((m: any) => m.role === "user").content === "slow";
    const tool = body.messages.at(-1).role === "tool";
    if (tool) return new Response(packet({ content: `${model} completado` }, "stop"));
    return new Response(new ReadableStream({ async start(controller) {
      controller.enqueue(packet({ reasoning_content: `Razonamiento ${model}`, ...(slow ? { content: `Parcial ${model}` } : {}) }));
      await new Promise<void>(resolve => gates.set(model, resolve));
      try {
        controller.enqueue(packet({ tool_calls: [{ index: 0, id: `${model}-write`, function: { name: "write", arguments: JSON.stringify({ path: "result.txt", content: model }) } }] }, "tool_calls"));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); controller.close();
      } catch { /* The client can cancel while this fixture awaits its gate. */ }
    } }));
  } });
  initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
  initial.providers[0]!.models = ["alpha", "beta"].map(id => ({ id, name: id, manual: true, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }));
  initial.projects.forEach(project => project.selection = { providerId: "llama.cpp", modelId: project.id }); await Bun.write(config, JSON.stringify(initial));
  const app = await App.open({ config }); let closed = false;
  try {
    app.view.prompt.setValue("Pedido alpha"); await app.submit(); const alpha = app.tabs[0]!;
    await until(() => alpha.response.value.includes("Razonamiento alpha"));
    app.projectForm(); expect(app.desktop.modal?.title).toContain("nuevo"); key(app, "escape");
    await app.switchProject(app.store.value.projects[1]!); app.view.prompt.setValue("Pedido beta"); await app.submit(); const beta = app.tabs[1]!;
    await until(() => beta.response.value.includes("Razonamiento beta")); expect(alpha.busy && beta.busy).toBe(true);
    expect(alpha.response.value).not.toContain("Pedido beta"); expect(beta.response.value).not.toContain("Pedido alpha");
    await expect(app.closeTab(alpha.id)).rejects.toThrow("cancelá");
    gates.get("beta")!(); await until(() => !beta.busy); expect(alpha.busy).toBe(true);
    app.view.prompt.setValue("Nuevo borrador beta"); const betaView = beta.response.value, betaStatus = beta.status;
    gates.get("alpha")!(); await until(() => !alpha.busy);
    expect(app.project!.id).toBe("beta"); expect(beta.response.value).toBe(betaView); expect(beta.status).toBe(betaStatus);
    expect(app.view.prompt.value).toBe("Nuevo borrador beta");
    expect(await Bun.file(join(initial.projects[0]!.path, "result.txt")).text()).toBe("alpha");
    expect(await Bun.file(join(initial.projects[1]!.path, "result.txt")).text()).toBe("beta");
    expect(alpha.response.value).toContain("alpha completado"); expect(beta.response.value).toContain("beta completado");
    for (const body of payloads) expect(body.messages[0].content).toContain(join(root, body.model));
    await app.activateTab(alpha.id); app.view.prompt.setValue("slow"); await app.submit(); await until(() => alpha.response.value.includes("Parcial alpha"));
    await app.activateTab(beta.id); app.view.prompt.setValue("slow"); await app.submit(); await until(() => beta.response.value.includes("Parcial beta"));
    key(app, "ctrl+c"); await until(() => !beta.busy); expect(alpha.busy).toBe(true); expect(beta.status).toContain("cancelado");
    await app.desktop.onBeforeExit!(); closed = true; expect(alpha.busy).toBe(false);
    expect(alpha.session!.state.events.some(e => e.type === "turn" && e.state === "cancelled")).toBe(true);
    expect(beta.session!.state.events.some(e => e.type === "turn" && e.state === "cancelled")).toBe(true);
    for (const tab of [alpha, beta]) { const released = await Session.open(app.sessionsPath, tab.project!.id, tab.session!.state.id); await released.close(); }
    expect(requests.get("alpha")).toBe(3); expect(requests.get("beta")).toBe(3);
  } finally { if (!closed) await app.desktop.onBeforeExit!(); for (const release of gates.values()) release(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("restauración con una sesión bloqueada libera las abiertas y conserva la lista de pestañas", async () => {
  const { root, config, initial } = await fixture(), sessions = join(root, "sessions");
  const alpha = await Session.open(sessions, "alpha"), beta = await Session.open(sessions, "beta");
  initial.projects[0]!.lastSessionId = alpha.state.id; initial.projects[1]!.lastSessionId = beta.state.id;
  initial.workspace = { openProjectIds: ["alpha", "beta"] }; await alpha.close(); await Bun.write(config, JSON.stringify(initial));
  const before = await Bun.file(config).text();
  try {
    await expect(App.open({ config })).rejects.toThrow("abierta");
    expect((await readdir(join(sessions, "alpha"))).filter(name => name.endsWith(".lock"))).toEqual([]);
    expect(await Bun.file(config).text()).toBe(before);
    await beta.close(); const app = await App.open({ config });
    try { expect(app.tabs.map(tab => tab.project!.id)).toEqual(["alpha", "beta"]); } finally { await app.desktop.onBeforeExit!(); }
  } finally { await beta.close(); await rm(root, { recursive: true, force: true }); }
});

test("overflow de pestañas en 60 columnas permite llegar al proyecto, cancelar clic y bloquear mouse bajo modal", async () => {
  const { root, config, initial } = await fixture();
  for (let i = 0; i < 6; i++) { const id = `extra-${i}`, path = join(root, id); await mkdir(path); initial.projects.push({ id, name: `Proyecto Unicode 文 ${i}`, path }); }
  await Bun.write(config, JSON.stringify(initial)); const app = await App.open({ config });
  const mouse = (action: "press" | "release" | "wheel", x: number, delta = 0) => app.desktop.handle({ type: "mouse", action, x, y: 1, button: 0, delta });
  try {
    app.desktop.resize(60, 16); for (const project of app.store.value.projects.slice(1)) await app.switchProject(project);
    expect(app.desktop.draw().lines()[1]).toContain("8:P:Proyecto");
    mouse("wheel", 10, -1); mouse("wheel", 10, -1); const before = app.project!.id;
    mouse("press", 6); mouse("release", 59); await Bun.sleep(5); expect(app.project!.id).toBe(before);
    for (let i = 0; i < 8; i++) mouse("wheel", 10, -1);
    expect(app.desktop.draw().lines()[1]).toContain("1:P:Alpha"); mouse("press", 6); mouse("release", 6); await until(() => app.project?.id === "alpha");
    app.promptings.library(); mouse("press", 59); mouse("release", 59); expect(app.desktop.modal?.title).toBe("Promptings"); key(app, "escape");
    mouse("press", 59); mouse("release", 59); expect(app.desktop.modal?.title).toContain("Projects"); key(app, "escape");
    key(app, "alt+8"); await until(() => app.project?.id === "extra-5"); expect(app.desktop.draw().lines()[1]).toContain("8:P:Proyecto");
    expect(app.desktop.draw().lines().join("\n")).toContain("Prompt");
    key(app, "alt+6"); await until(() => app.project?.id === "extra-3"); app.desktop.draw();
    await app.closeTab(app.tabs.find(tab => tab.project?.id === "alpha")!.id);
    expect(app.project!.id).toBe("extra-3"); expect(app.desktop.draw().lines()[1]).toContain("5:P:Proyecto");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("index.ts PTY: abrir segunda pestaña, cambiar mientras responde y restaurar ambas al reiniciar", async () => {
  const { root, config, initial } = await fixture(); let output = "", release = () => {};
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any, content = body.messages.at(-1).content as string;
    return new Response(new ReadableStream({ async start(controller) {
      const packet = (delta: unknown) => new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
      controller.enqueue(packet({ reasoning_content: `Razonamiento ${content}` }));
      if (content === "Alpha trabajo") await new Promise<void>(resolve => release = resolve);
      controller.enqueue(packet({ content: `Respuesta ${content}` })); controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); controller.close();
    } }));
  } });
  initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`; initial.providers[0]!.models = [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
  initial.defaults.modelId = "fixture"; await Bun.write(config, JSON.stringify(initial));
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => output += new TextDecoder().decode(data) });
  let child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], { cwd: root, env: { ...process.env, TERM: "xterm-256color" }, terminal });
  try {
    await until(() => output.includes("1:P:Alpha")); terminal.write("Alpha trabajo\r"); await until(() => output.includes("Razonamiento Alpha trabajo"));
    terminal.write("\x10"); await until(() => output.includes("Projects · abrir")); terminal.write("\x1b[B\r"); await until(() => output.includes("2:P:Beta"));
    terminal.write("Beta trabajo\r"); await until(() => output.includes("Respuesta Beta trabajo"));
    terminal.write("borrador Beta"); await until(() => output.includes("borrador Beta"));
    output = ""; terminal.write("\x1b1"); await until(() => Bun.stripANSI(output).includes("Razonando…"));
    release(); await until(() => output.includes("Respuesta Alpha trabajo"));
    output = ""; terminal.resize(60, 16); child.kill("SIGWINCH"); await until(() => output.includes("1:P:Alpha"));
    output = ""; terminal.write("\x1b2"); await until(() => output.includes("borrador Beta"));
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?25h\x1b[?1049l");
    expect((await Bun.file(config).json()).workspace.openProjectIds).toEqual(["alpha", "beta"]);
    output = ""; child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], { cwd: root, env: { ...process.env, TERM: "xterm-256color" }, terminal });
    await until(() => output.includes("borrador Beta")); expect(output).toContain("1:P:Alpha"); expect(output).toContain("2:P:Beta");
    terminal.write("\x1b1"); await until(() => output.includes("Respuesta Alpha trabajo")); terminal.write("\x11"); expect(await child.exited).toBe(0);
  } catch (e) { throw new Error(`${(e as Error).message} · ${Bun.stripANSI(output.slice(-2500))}`); }
  finally { release(); child.kill(); await child.exited; terminal.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
