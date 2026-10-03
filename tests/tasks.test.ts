import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaskStore, TaskConflict, parseTasks, type TaskCard } from "../src/storage/tasks.ts";
import { TurnTasks, taskPolicy, verificationRuns } from "../src/agent/tasks.ts";
import { Session } from "../src/storage/sessions.ts";
import { execute } from "../src/agent/tools.ts";
import { runTurn } from "../src/agent/loop.ts";
import type { Model, Provider } from "../src/storage/config.ts";

const card = (title = "Tarjeta á文🙂"): TaskCard => ({ id: `T-${crypto.randomUUID()}`, requestId: `R-${crypto.randomUUID()}`, title, description: "primera\nsegunda", criterion: "resultado observable",
  dependencies: [], status: "pending", verification: [{ id: `V-${crypto.randomUUID()}`, kind: "review", description: "leer el resultado", required: true, paths: ["file.txt"] }], result: "pendiente", origin: "user", acceptanceEvidence: [] });
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "s42-tasks-")); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
test("TODO no se crea al leer; conserva contenido ajeno y una edición externa no colisionante", async () => fixture(async root => {
  const store = await TaskStore.open(root), empty = await store.read(); expect(await Bun.file(store.path).exists()).toBe(false);
  const a = card("A"), b = card("B"); const base = await store.save([a, b], empty);
  const source = base.source.replace("# TODO", "# TODO\n\nTexto propio del usuario.\n").replace(`### [${a.id}] A`, `### [${a.id}] A\nNota libre de A.`).replace(`### [${b.id}] B`, `### [${b.id}] B externo`);
  await Bun.write(store.path, source);
  const changed = await store.save([{ ...a, status: "doing", result: "en curso" }], base);
  expect(changed.source).toContain("Texto propio del usuario."); expect(changed.source).toContain("Nota libre de A.");
  expect(changed.tasks.find(t => t.id === b.id)?.title).toBe("B externo");
  expect(changed.tasks.find(t => t.id === a.id)).toMatchObject({ status: "doing", description: "primera\nsegunda" });
  await expect(store.save([{ ...b, status: "done" }], base)).rejects.toBeInstanceOf(TaskConflict);
  expect((await store.read()).source).toBe(changed.source);
}));
test("TODO conserva formato ajeno y tarjetas malformadas; adaptación requiere elección explícita", async () => fixture(async root => {
  const store = await TaskStore.open(root); await Bun.write(store.path, "# Mis notas\n\n- tarea libre\n");
  const original = await store.read(); expect(original.compatible).toBe(false);
  await expect(store.save([card()], original)).rejects.toThrow("preview"); expect((await store.read()).source).toBe(original.source);
  const adapted = await store.save([card()], original, { adapt: true }); expect(adapted.source).toContain("- tarea libre");
  await Bun.write(store.path, adapted.source + "### [T-broken] dato importante\nTexto no descartable.\n");
  const malformed = await store.read(); expect(malformed.problems).toHaveLength(1);
  await expect(store.save([card()], malformed)).rejects.toThrow("ID o sección"); expect((await store.read()).source).toContain("Texto no descartable.");
}));
test("TODO coordina procesos y alias de carpeta; no pierde tarjetas", async () => fixture(async root => {
  const alias = root + "-alias"; await symlink(root, alias);
  try {
    const tasks = Array.from({ length: 5 }, (_, i) => card(`Proceso ${i}`));
    const children = tasks.map((task, index) => {
      const script = `import {TaskStore} from ${JSON.stringify(join(import.meta.dir, "../src/storage/tasks.ts"))}; const s=await TaskStore.open(${JSON.stringify(index % 2 ? alias : root)}); const b=await s.read();await Bun.sleep(30);await s.save([${JSON.stringify(task)}],b);`;
      return Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
    });
    const results = await Promise.all(children.map(async child => ({ code: await child.exited, error: await new Response(child.stderr).text() })));
    expect(results).toEqual(tasks.map(() => ({ code: 0, error: "" })));
    const saved = await (await TaskStore.open(root)).read(); expect(saved.tasks.map(t => t.id).sort()).toEqual(tasks.map(t => t.id).sort());
  } finally { await rm(alias); }
}));
test("TODO intención/confirmación: cierre entre filesystem e historial no repite efectos", async () => fixture(async root => {
  const store = await TaskStore.open(root), events: string[] = [], task = card();
  await expect(store.save([task], await store.read(), { record: async phase => { events.push(phase); if (phase === "confirmed") throw new Error("interrupción al confirmar"); } })).rejects.toThrow("interrupción");
  expect(events).toEqual(["intent", "confirmed"]); const current = await store.read(); expect(current.tasks[0]?.id).toBe(task.id);
  expect(parseTasks(current.source).problems).toHaveLength(0);
  await store.save([task], current); expect((await store.read()).tasks).toHaveLength(1);
}));

test("tareas y verificaciones: plan obligatorio, proceso real, fallo conservado, vigencia y cierre", async () => fixture(async root => {
  const session = await Session.open(join(root, "sessions"), "project"), signal = new AbortController().signal;
  try {
    const tasks = await TurnTasks.open(root, session, signal, ""), run = (name: string, args: object) => execute(name, JSON.stringify(args), root, signal, undefined, undefined, { tasks, callId: name });
    expect((await run("write", { path: "file.txt", content: "antes" })).failed).toBe(true); expect(await Bun.file(join(root, "file.txt")).exists()).toBe(false);
    const planned = await tasks.plan("modificar archivo", [{ title: "Modificar", criterion: "texto esperado", verification: [{ kind: "command", description: "comprobar texto", command: "bun -e 'process.exit((await Bun.file(\"file.txt\").text()) === \"después\" ? 0 : 7)'", required: true, paths: ["file.txt"] }] }]);
    const task = planned[0]!, spec = task.verification[0]!;
    await tasks.update(task.id, { status: "doing" }); expect((await run("write", { path: "file.txt", content: "antes" })).failed).toBe(false);
    const failed = await tasks.verify(task.id, spec.id); expect(failed.state).toBe("failed"); expect(failed.exitCode).toBe(7);
    await expect(tasks.update(task.id, { status: "done", acceptanceEvidence: [failed.id] })).rejects.toThrow("Referencia");
    await run("write", { path: "file.txt", content: "después" }); const passed = await tasks.verify(task.id, spec.id); expect(passed.state).toBe("passed");
    await tasks.update(task.id, { status: "done", acceptanceEvidence: [passed.id] }); expect((await tasks.finalization()).state).toBe("completed");
    await Bun.write(join(root, "file.txt"), "edición externa"); expect((await tasks.finalization()).pending.join("\n")).toContain("revalidación");
    expect(verificationRuns(session.state.events).map(v => v.state)).toEqual(["failed", "passed"]);
    const snapshots = session.state.events.filter(e => e.type === "task-file"); expect(snapshots).toHaveLength(4);
    expect(snapshots[0]?.type === "task-file" && snapshots[0].before).toBeNull();
    expect(snapshots[2]?.type === "task-file" && Buffer.from(snapshots[2].before!, "base64").toString()).toBe("antes");
  } finally { await session.close(); }
}), 10000);

for (const sqlite of [false, true]) test(`sesión ${sqlite ? "SQLite" : "JSONL"}: tarea, eventos nuevos, recuperación y cancelación`, async () => fixture(async root => {
  const path = join(root, sqlite ? "agent.sqlite" : "sessions"), session = await Session.open(path, "project"), controller = new AbortController();
  const tasks = await TurnTasks.open(root, session, controller.signal, "");
  const [card] = await tasks.plan("prueba cancelable", [{ title: "Esperar", criterion: "proceso finalizado", verification: [{ kind: "command", description: "esperar salida real", command: "bun -e 'console.log(\"OK\");setInterval(()=>{},1000)'", required: true, paths: [] }] }]);
  let printed = false;
  const verifying = tasks.verify(card!.id, card!.verification[0]!.id, (_, text) => { if (text.includes("OK")) printed = true; });
  for (let i = 0; i < 300 && !printed; i++) await Bun.sleep(5);
  expect(printed).toBe(true); expect(session.state.events.filter(e => e.type === "task-verification")).toHaveLength(1);
  controller.abort(new Error("cancelación explícita")); const result = await verifying; expect(result.state).toBe("cancelled");
  await session.append({ type: "task-focus", requestId: tasks.request!.requestId }); await session.close();
  const resumed = await Session.open(path, "project", session.state.id);
  try {
    const continued = await TurnTasks.open(root, resumed, new AbortController().signal, "");
    expect(continued.request?.requestId).toBe(tasks.request!.requestId); expect((await continued.store.read()).tasks[0]?.status).toBe("pending");
    expect(verificationRuns(resumed.state.events)[0]?.state).toBe("cancelled");
    await resumed.append({ type: "task-verification", run: { ...result, id: "interrupted", state: "running" } });
    expect(verificationRuns(resumed.state.events).at(-1)?.state).toBe("interrupted");
  } finally { await resumed.close(); }
}), 10000);

test("loop rechaza mutación sin plan y finalización con pendientes; luego completa con evidencia", async () => fixture(async root => {
  const session = await Session.open(join(root, "sessions"), "project"); let request = 0, task: TaskCard | undefined, verificationId = "";
  const packet = (message: object) => new Response(`data: ${JSON.stringify({ choices: [{ delta: message, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
  const call = (name: string, args: object) => packet({ tool_calls: [{ index: 0, id: `call-${request}`, function: { name, arguments: JSON.stringify(args) } }] });
  const server = Bun.serve({ port: 0, async fetch(req) {
    if (req.method !== "POST") return new Response("", { status: 404 });
    const body = await req.json() as any; request++;
    if (request === 1) return call("write", { path: "file.txt", content: "resultado" });
    if (request === 2) { expect(await Bun.file(join(root, "file.txt")).exists()).toBe(false); expect(body.messages.at(-1).content).toContain("Plan requerido"); return call("task_plan", { objective: "crear", steps: [{ title: "Archivo", criterion: "resultado", verification: [{ kind: "command", description: "leer", command: "cat file.txt", required: true, paths: ["file.txt"] }] }] }); }
    if (request === 3) { task = JSON.parse(JSON.parse(body.messages.at(-1).content).output)[0]; return call("write", { path: "file.txt", content: "resultado" }); }
    if (request === 4) return packet({ content: "Terminé" });
    if (request === 5) { expect(body.messages.at(-1).content).toContain("work remains"); return call("task_verify", { taskId: task!.id, verificationId: task!.verification[0]!.id }); }
    if (request === 6) { verificationId = JSON.parse(JSON.parse(body.messages.at(-1).content).output).id; return call("task_update", { id: task!.id, status: "done", acceptanceEvidence: [verificationId], result: "Archivo creado y comando leído" }); }
    return packet({ content: "Creado y verificado" });
  } });
  const model: Model = { id: "fixture", name: "fixture", manual: true, contextWindow: 32000, capabilities: { tools: true, images: false } };
  const provider: Provider = { id: "fixture", name: "fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}/v1`, models: [model] };
  try {
    session.state.messages.push({ role: "user", content: "creá el archivo" });
    const result = await runTurn({ project: { id: "project", name: "fixture", path: root }, session, model, provider, signal: new AbortController().signal, onDelta: () => {}, onState: () => {}, onMessage: () => {} });
    expect(result.taskState).toBe("completed"); expect(request).toBe(7); expect((await (await TaskStore.open(root)).read()).tasks[0]?.status).toBe("done");
    expect(session.state.events.some(e => e.type === "tool-result" && e.callId === "call-1" && e.failed)).toBe(true);
    expect(session.state.messages.some(m => typeof m.content === "string" && m.content.includes("Harness task check"))).toBe(true);
  } finally { server.stop(true); await session.close(); }
}), 15000);

test("consulta y planificación no ejecutan trabajo ni fuerzan commit vacío", async () => fixture(async root => {
  const session = await Session.open(join(root, "sessions"), "project");
  try {
    const tasks = await TurnTasks.open(root, session, new AbortController().signal, "Siempre hacer commit al terminar la tarea.");
    expect((await tasks.finalization()).state).toBe("guidance"); expect(await Bun.file(join(root, "TODO.md")).exists()).toBe(false);
    await tasks.plan("solo plan", [{ title: "Futuro", criterion: "entrega", verification: [{ kind: "review", description: "leer", required: true, paths: [] }] }], "planning");
    await expect(tasks.requirePlan()).rejects.toThrow("no autorizada"); expect((await tasks.finalization()).state).toBe("guidance");
  } finally { await session.close(); }
}));

test("bloqueo conserva tarjeta abierta; políticas Git pertenecen al proyecto y no inventan push", async () => fixture(async root => {
  expect(taskPolicy("Siempre mantener actualizado CHANGELOG.md luego de cada tarea.\nSiempre hacer commit al terminar la tarea.\nNo hacer push sin pedido explícito.")).toEqual({ changelog: true, commit: true, push: false });
  expect(taskPolicy("Proyecto sin política Git.")).toEqual({ changelog: false, commit: false, push: false });
  const session = await Session.open(join(root, "sessions"), "project");
  try {
    const tasks = await TurnTasks.open(root, session, new AbortController().signal, "");
    const [card] = await tasks.plan("verificar proveedor", [{ title: "Verificar", criterion: "respuesta real", verification: [{ kind: "review", description: "leer respuesta", required: true, paths: [] }] }]);
    await tasks.update(card!.id, { status: "doing", blocked: "Proveedor fixture desconectado" });
    expect((await tasks.finalization()).state).toBe("blocked");
    expect((await tasks.store.read()).tasks[0]).toMatchObject({ status: "doing", blocked: "Proveedor fixture desconectado" });
    await expect(tasks.update(card!.id, { status: "done", acceptanceEvidence: ["aprobación humana inventada"] })).rejects.toThrow("no se puede simular");
  } finally { await session.close(); }
}));
