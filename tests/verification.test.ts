import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { App } from "../src/app.ts";
import { verificationRuns } from "../src/agent/tasks.ts";
import { Session, readSessionEvents } from "../src/storage/sessions.ts";
import { makeCard, until } from "./task-board-fixture.ts";

test("ficha: proceso, salida en vivo, cancelación, reapertura y evidencia vencida", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-verify-")), config = join(root, "config.json"); let app = await App.open({ config, cwd: root });
  try {
    app.taskBoard(); const board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document));
    await Bun.write(join(root, "code.txt"), "antes");
    const card = makeCard("Prueba cancelable"); card.verification[0] = { ...card.verification[0]!, kind: "command", command: "bun -e 'console.log(\"OK á文🙂\");setInterval(()=>{},1000)'", paths: ["code.txt"] };
    await board.save([card]); app.verificationPanel(card.id); let panel = app.tabs[0]!.verification!; await until(() => panel.card?.id === card.id);
    const running = panel.run(); await until(() => app.busy && (verificationRuns(app.session!.state.events)[0]?.stdout.includes("OK á文🙂") ?? false));
    expect(verificationRuns(app.session!.state.events)[0]?.state).toBe("running");
    panel.ctx.cancel(); await running; expect(verificationRuns(app.session!.state.events)[0]).toMatchObject({ state: "cancelled", stdout: "OK á文🙂\n" });
    await app.desktop.onBeforeExit!(); app = await App.open({ config }); app.verificationPanel(card.id); panel = app.tabs[0]!.verification!;
    await until(() => panel.text.value.includes("Cancelada")); expect(panel.text.value).toContain("OK á文🙂");
    await Bun.write(join(root, "code.txt"), "código nuevo"); await panel.refresh(); expect(panel.text.value).toContain("Requiere revalidación");
    expect(panel.text.readOnly).toBe(true); expect(app.view.prompt.value).toBe("");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
}, 10000);

test("confirmación manual atribuida al usuario; ficha separa estado, prueba y Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-manual-review-")), app = await App.open({ config: join(root, "config.json"), cwd: root });
  try {
    app.taskBoard(); const board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document)); const card = makeCard("Revisar documento");
    await board.save([card]); await board.move(card, "done"); app.verificationPanel(card.id); const panel = app.tabs[0]!.verification!; await until(() => panel.card?.id === card.id);
    expect(panel.text.value).toContain("Aceptación: Pendiente"); expect(panel.text.value).toContain("Cierre Git: Pendiente");
    await panel.confirm(); expect(verificationRuns(app.session!.state.events)[0]?.origin).toBe("user");
    expect(panel.text.value).toContain("Aprobada"); expect(panel.card!.acceptanceEvidence).toHaveLength(0);
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

for (const storage of ["sessions", "agent.sqlite"]) test(`historial de tareas ${storage}: lectura sin lock ni reparación implícita`, async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-task-history-")), path = join(root, storage), session = await Session.open(path, "project");
  try {
    await session.append({ type: "notice", text: "evento existente" });
    const events = await readSessionEvents(path, "project", session.state.id); expect(events).toEqual(session.state.events);
    expect(await Bun.file(session.lock).exists()).toBe(true); expect(session.state.events).toHaveLength(1);
  } finally { await session.close(); await rm(root, { recursive: true, force: true }); }
});

test("verificación en A conserva propietario al cambiar a B y el cierre espera cancelación", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-owner-verify-")), app = await App.open({ config: join(root, "config.json"), cwd: root }); let closed = false;
  try {
    app.taskBoard(); const board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document)); const card = makeCard("Proceso A");
    card.verification[0] = { ...card.verification[0]!, kind: "command", command: "bun -e 'console.log(42);setInterval(()=>{},1000)'" };
    await board.save([card]); app.verificationPanel(card.id); const owner = app.tabs[0]!, panel = owner.verification!; await until(() => panel.card?.id === card.id);
    const pending = panel.run(); await until(() => verificationRuns(owner.session!.state.events)[0]?.stdout === "42\n");
    const { mkdir } = await import("node:fs/promises"); const folder = join(root, "B"); await mkdir(folder); await app.switchProject(await app.store.project("B", folder, root));
    expect(app.busy).toBe(false); expect(app.session!.state.events.some(e => e.type === "task-verification")).toBe(false);
    await app.desktop.onBeforeExit!(); closed = true; await pending;
    expect(verificationRuns(owner.session!.state.events)[0]).toMatchObject({ state: "cancelled", stdout: "42\n" });
  } finally { if (!closed) await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("Continuar tarea recupera sesión original y efectos sin reejecutarlos", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-task-resume-")), config = join(root, "config.json"); let app = await App.open({ config, cwd: root });
  const card = makeCard("Continuidad"); let step = 0;
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any; expect(String(body.messages[0].content)).toContain(card.requestId);
    expect(body.messages.some((m: any) => m.role === "tool" && m.tool_call_id === "prior-effect")).toBe(true);
    const name = step++ === 0 ? "task_verify" : step === 2 ? "task_update" : undefined;
    const prior = body.messages.findLast((m: any) => m.role === "tool" && m.tool_call_id === "resume-check");
    const args = name === "task_verify" ? { taskId: card.id, verificationId: card.verification[0]!.id, evidence: ["prior-effect"] }
      : { id: card.id, status: "done", acceptanceEvidence: [JSON.parse(JSON.parse(prior.content).output).id], result: "Recuperado" };
    const delta = name ? { tool_calls: [{ index: 0, id: name === "task_verify" ? "resume-check" : "resume-done", function: { name, arguments: JSON.stringify(args) } }] } : { content: "Tarea continuada" };
    return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: name ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
  } });
  try {
    const next = structuredClone(app.store.value); next.providers = [{ id: "fixture", name: "Fixture", kind: "llama.cpp", baseUrl: `http://127.0.0.1:${server.port}/v1`, models: [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }] }]; await app.store.save(next); await app.selectModel({ providerId: "fixture", modelId: "fixture" });
    app.taskBoard(); const board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document)); await board.save([card]);
    const original = app.session!.state.id;
    await app.session!.append({ type: "message", message: { role: "user", content: "Pedido original" } });
    await app.session!.append({ type: "message", message: { role: "assistant", content: null, tool_calls: [{ id: "prior-effect", type: "function", function: { name: "write", arguments: '{"path":"effect.txt","content":"único"}' } }] } });
    await Bun.write(join(root, "effect.txt"), "único");
    await app.session!.append({ type: "tool-result", callId: "prior-effect", output: "efecto único", failed: false });
    await app.session!.append({ type: "message", message: { role: "tool", tool_call_id: "prior-effect", content: '{"output":"efecto único","failed":false}' } });
    await app.newSession(); expect(app.session!.state.id).not.toBe(original);
    await app.desktop.onBeforeExit!(); app = await App.open({ config });
    await app.continueTask(card); await until(() => !app.busy);
    expect(app.session!.state.id).toBe(original); expect(await Bun.file(join(root, "effect.txt")).text()).toBe("único");
    expect(app.session!.state.events.filter(e => e.type === "tool-start").map(e => e.type === "tool-start" && e.name)).toEqual(["task_verify", "task_update"]);
    expect(app.view.response.value).toContain("Tarea continuada");
  } finally { server.stop(true); await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});
