import { expect, test } from "bun:test";
import { mkdtemp, rm, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TurnTasks } from "../src/agent/tasks.ts";
import { closeout } from "../src/agent/closeout.ts";
import { Session } from "../src/storage/sessions.ts";
import { gitCommand } from "../src/system/git.ts";
const signal = () => new AbortController().signal;
async function fixture(work: (root: string, tasks: TurnTasks, git: (args: string[]) => Promise<string>) => Promise<void>, policy = "Siempre mantener actualizado CHANGELOG.md luego de cada tarea.\nSiempre hacer commit al terminar la tarea.", prior = true) {
  const root = await mkdtemp(join(tmpdir(), "s42-closeout-qa-"));
  const git = async (args: string[]) => { const r = await gitCommand(root, args); if (r.failed) throw new Error(r.stderr); return r.stdout.trimEnd(); };
  let session: Session | undefined;
  try {
    await git(["init"]); await git(["config", "user.email", "fixture@example.invalid"]); await git(["config", "user.name", "Fixture"]);
    for (const path of ["own.txt", "alien.txt", "other.txt"]) await Bun.write(join(root, path), "initial\n"); await git(["add", "--", "own.txt", "alien.txt", "other.txt"]); await git(["commit", "-m", "initial"]);
    if (prior) { await Bun.write(join(root, "alien.txt"), "staged\n"); await git(["add", "--", "alien.txt"]); await Bun.write(join(root, "alien.txt"), "working\n"); await Bun.write(join(root, "other.txt"), "unstaged\n"); }
    session = await Session.open(join(root, "sessions"), "project"); const tasks = await TurnTasks.open(root, session, signal(), policy);
    const [card] = await tasks.plan("Cambiar own", [{ title: "Cambio", criterion: "contenido propio", verification: [{ kind: "command", description: "test real", command: "bun -e 'process.exit((await Bun.file(\"own.txt\").text()) === \"owned\\n\" ? 0 : 1)'", required: true, paths: ["own.txt"] }] }]);
    await tasks.fileEffect("own-write", join(root, "own.txt"), () => Bun.write(join(root, "own.txt"), "owned\n")); const run = await tasks.verify(card!.id, card!.verification[0]!.id); await tasks.update(card!.id, { status: "done", result: "contenido propio verificado", acceptanceEvidence: [run.id] });
    await work(root, tasks, git);
  } finally { await session?.close(); await rm(root, { recursive: true, force: true }); }
}
const options = { files: ["own.txt"], message: "own change", summary: "Cambio verificado" };
test("cierre real preserva staged/unstaged ajenos, registra SHA y reintento no duplica", async () => fixture(async (root, tasks, git) => {
  const index = await git(["ls-files", "--stage", "--", "alien.txt"]), result = await closeout(tasks, options);
  expect(result.state).toBe("committed"); expect(result.sha).toMatch(/^[a-f0-9]{40}$/); expect(await git(["ls-files", "--stage", "--", "alien.txt"])).toBe(index);
  expect(await git(["show", "HEAD:alien.txt"])).toBe("initial"); expect(await Bun.file(join(root, "alien.txt")).text()).toBe("working\n"); expect(await Bun.file(join(root, "other.txt")).text()).toBe("unstaged\n");
  expect((await git(["show", "--format=", "--name-only", "HEAD"])).split("\n").sort()).toEqual(["CHANGELOG.md", "TODO.md", "own.txt"]);
  expect((await tasks.finalization()).state).toBe("completed"); const again = await closeout(tasks, options); expect(again.sha).toBe(result.sha); expect(await git(["rev-list", "--count", "HEAD"])).toBe("2");
}));
test("hook fallido conserva índice/trabajo y permite corregir sin duplicar changelog", async () => fixture(async (root, tasks, git) => {
  const path = join(root, ".git/hooks/pre-commit"); await Bun.write(path, "#!/bin/sh\necho real-hook-error >&2\nexit 7\n"); await chmod(path, 0o700);
  const index = await git(["ls-files", "--stage"]); const failed = await closeout(tasks, options); expect(failed.state).toBe("failed"); expect(failed.detail).toContain("real-hook-error"); expect(await git(["rev-list", "--count", "HEAD"])).toBe("1"); expect(await git(["ls-files", "--stage"])).toBe(index);
  await rm(path); expect((await closeout(tasks, options)).state).toBe("committed"); expect((await Bun.file(join(root, "CHANGELOG.md")).text()).match(/s42-task:/g)).toHaveLength(1);
}));
test("interrupción después de commit se recupera por árbol/padre sin repetir", async () => fixture(async (root, tasks, git) => {
  const append = tasks.session.append.bind(tasks.session); let interrupted = false;
  tasks.session.append = data => { if (!interrupted && data.type === "task-closeout" && data.state === "committed") { interrupted = true; return Promise.reject(new Error("interrupción de confirmación")); } return append(data); };
  expect((await closeout(tasks, options)).state).toBe("failed");
  // Simulate losing all terminal closeout events; intent is durable before Git.
  tasks.session.state.events.splice(0, tasks.session.state.events.length, ...tasks.session.state.events.filter(e => e.type !== "task-closeout"));
  expect((await closeout(tasks, options)).state).toBe("committed"); expect(await git(["rev-list", "--count", "HEAD"])).toBe("2"); expect(await git(["diff", "--cached", "--", "own.txt"])).toBe("");
}));
test("archivo previo mezclado o edición externa posterior bloquean sin incluirlos", async () => fixture(async (root, tasks, git) => {
  const before = await git(["rev-parse", "HEAD"]); const mixed = await closeout(tasks, { ...options, files: ["own.txt", "alien.txt"] }); expect(mixed.detail).toContain("previos mezclados");
  await Bun.write(join(root, "own.txt"), "edición ajena\n"); expect((await closeout(tasks, options)).detail).toContain("pendiente"); expect(await git(["rev-parse", "HEAD"])).toBe(before);
}));
test("push requiere política; remoto local confirma SHA y falta upstream queda visible", async () => fixture(async (root, tasks, git) => {
  const failed = await closeout(tasks, options); expect(failed.state).toBe("failed"); expect(failed.sha).toBeDefined(); expect(failed.detail).toContain("upstream");
  const remote = root + "-remote"; try { const init = await gitCommand(root, ["init", "--bare", remote]); expect(init.failed).toBe(false); await git(["remote", "add", "origin", remote]); await git(["push", "-u", "origin", "HEAD"]); const result = await closeout(tasks, options); expect(result.state).toBe("pushed"); expect(result.sha).toBe(failed.sha); } finally { await rm(remote, { recursive: true, force: true }); }
}, "Siempre mantener actualizado CHANGELOG.md luego de cada tarea.\nSiempre hacer commit al terminar la tarea.\nSiempre hacer push al terminar.", false));
test("push no autorizado conserva commit local y no consulta remoto", async () => fixture(async (_root, tasks, git) => {
  const result = await closeout(tasks, { ...options, push: true }); expect(result.detail).toContain("no autorizado"); expect(result.sha).toBeDefined(); expect(await git(["rev-list", "--count", "HEAD"])).toBe("2");
}));
