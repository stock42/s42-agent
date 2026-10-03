import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitCommand, gitRepository, gitHistory, gitBranches, gitDiff, gitCommitDetail } from "../src/system/git.ts";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";

async function git(root: string, ...args: string[]) {
  const result = await gitCommand(root, args); if (result.failed) throw new Error(result.stderr); return result.stdout;
}
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "s42-git-"));
  try {
    await git(root, "init", "-b", "main");
    await git(root, "config", "user.name", "Test"); await git(root, "config", "user.email", "test@example.test");
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test("Git local: sin commits, staged/unstaged, Unicode/NUL, renombre y binario", async () => fixture(async root => {
  const unborn = await gitRepository(root); expect(unborn.state).toBe("ready");
  if (unborn.state !== "ready") throw new Error("Missing repository");
  expect(unborn.status.head).toBeUndefined(); expect(unborn.status.branch).toBe("main");
  const path = "文 space\tline\n'$(touch should-not-exist).txt";
  await Bun.write(join(root, path), "antes\n"); await Bun.write(join(root, "binary"), new Uint8Array([0, 1, 2]));
  await git(root, "add", "--", path, "binary"); await git(root, "commit", "-m", "Initial");
  await Bun.write(join(root, path), "índice\n"); await git(root, "add", "--", path);
  await Bun.write(join(root, path), "después\n"); await Bun.write(join(root, "binary"), new Uint8Array([0, 1, 3]));
  await Bun.write(join(root, "new 文\n.txt"), "nuevo\n");
  const repo = await gitRepository(root); if (repo.state !== "ready") throw new Error("Missing repository");
  const change = repo.status.changes.find(c => c.path === path)!;
  expect(change.index).toBe("M"); expect(change.worktree).toBe("M");
  expect(await gitDiff(root, change, true)).toContain("+índice");
  expect(await gitDiff(root, change, false)).toContain("+después");
  expect(await gitDiff(root, repo.status.changes.find(c => c.path === "binary")!, false)).toContain("Binary files");
  expect(await gitDiff(root, repo.status.changes.find(c => c.kind === "untracked")!, false)).toContain("+nuevo");
  expect(await Bun.file(join(root, "should-not-exist")).exists()).toBe(false);
  await Bun.write(join(root, path), "antes\n"); await git(root, "add", "--", path);
  await git(root, "mv", "--", path, "renamed 文\n.txt");
  const renamed = await gitRepository(root); if (renamed.state !== "ready") throw new Error("Missing repository");
  expect(renamed.status.changes.find(c => c.kind === "renamed")?.originalPath).toBe(path);
}), 15000);

test("Git detecta padres, worktrees y HEAD separado; historial paginado y refs locales", async () => fixture(async root => {
  await Bun.write(join(root, "file"), "base"); await git(root, "add", "file"); await git(root, "commit", "-m", "Uno");
  const first = (await gitHistory(root, 0, 1))[0]!; expect(first.subject).toBe("Uno");
  await git(root, "commit", "--allow-empty", "-m", "Dos"); await git(root, "commit", "--allow-empty", "-m", "Tres");
  expect((await gitHistory(root, 1, 1))[0]?.subject).toBe("Dos"); expect((await gitHistory(root, 3, 1)).length).toBe(0);
  expect(await gitCommitDetail(root, first.sha)).toContain("+base");
  await mkdir(join(root, "child")); const child = await gitRepository(join(root, "child"));
  expect(child.state === "ready" && child.root).toBe(root);
  const worktree = root + "-worktree";
  try {
    await git(root, "worktree", "add", "--detach", worktree, "HEAD");
    const detached = await gitRepository(worktree); expect(detached.state === "ready" && detached.status.branch).toBe("(detached)");
  } finally { await git(root, "worktree", "remove", "--force", worktree); }
  await git(root, "update-ref", "refs/remotes/origin/main", first.sha);
  await git(root, "config", "branch.main.remote", "origin"); await git(root, "config", "branch.main.merge", "refs/heads/main");
  await git(root, "config", "remote.origin.url", "https://offline.invalid/repository");
  await git(root, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*");
  const repo = await gitRepository(root); expect(repo.state === "ready" && repo.status.ahead).toBe(2);
  const branches = await gitBranches(root); expect(branches.find(b => b.current)?.upstream).toBe("origin/main");
  expect(branches.find(b => b.name === "origin/main")?.sha).toBe(first.sha);
}), 20000);

test("Git ausente: error explícito sin instalar ni confundir con una carpeta sin Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-git-missing-"));
  try {
    const source = `import {gitRepository} from ${JSON.stringify(join(import.meta.dir, "../src/system/git.ts"))}; console.log(JSON.stringify(await gitRepository(${JSON.stringify(root)})));`;
    const child = Bun.spawn([process.execPath, "-e", source], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" });
    const output = await new Response(child.stdout).text(); expect(await child.exited).toBe(0);
    expect(JSON.parse(output).state).toBe("unavailable");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("bun run dev en PTY: menú Git, pegado Unicode, resize, sin color y restauración", async () => fixture(async root => {
  await Bun.write(join(root, "file.txt"), "antes\n"); await git(root, "add", "file.txt"); await git(root, "commit", "-m", "Inicio");
  await Bun.write(join(root, "file.txt"), "después á文🙂\n");
  const configRoot = await mkdtemp(join(tmpdir(), "s42-git-terminal-")), config = join(configRoot, "config.json");
  await Bun.write(config, JSON.stringify(defaultConfig()));
  let output = "";
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => { output += new TextDecoder().decode(data); } });
  const child = Bun.spawn([process.execPath, "run", "dev", "--config", config, "--cwd", root, "--no-color"], {
    cwd: join(import.meta.dir, ".."), env: { ...process.env, TERM: "xterm-256color" }, terminal,
  });
  try {
    await settled(() => output.includes("No hay modelo configurado"));
    terminal.write("\x1b[200~borrador á文🙂\x1b[201~");
    terminal.write("\x1bv\x1b[B\r");
    await settled(() => output.includes("+después á文🙂"));
    expect(output).toContain("borrador á文🙂");
    terminal.resize(60, 16); child.kill("SIGWINCH");
    await Bun.sleep(100); expect(output).toContain("Prompt");
    terminal.write("\x11"); expect(await child.exited).toBe(0);
    expect(output).toContain("\x1b[?25h"); expect(output).toContain("\x1b[?1006l"); expect(output).toContain("\x1b[?1049l");
  } finally { child.kill(); terminal.close(); await rm(configRoot, { recursive: true, force: true }); }
}), 20000);

test("Git: conflictos reales y carpeta sin repositorio se distinguen", async () => fixture(async root => {
  await Bun.write(join(root, "file"), "base\n"); await git(root, "add", "file"); await git(root, "commit", "-m", "base");
  await git(root, "checkout", "-b", "other"); await Bun.write(join(root, "file"), "other\n"); await git(root, "commit", "-am", "other");
  await git(root, "checkout", "main"); await Bun.write(join(root, "file"), "main\n"); await git(root, "commit", "-am", "main");
  expect((await gitCommand(root, ["merge", "other"])).failed).toBe(true);
  const conflict = await gitRepository(root); expect(conflict.state === "ready" && conflict.status.changes[0]?.kind).toBe("conflict");
  const plain = await mkdtemp(join(tmpdir(), "s42-no-git-"));
  try { expect((await gitRepository(plain)).state).toBe("missing"); } finally { await rm(plain, { recursive: true, force: true }); }
}), 15000);

async function settled(check: () => boolean) { for (let i = 0; i < 500 && !check(); i++) await Bun.sleep(5); expect(check()).toBe(true); }
test("panel Git conserva prompt, diff de solo lectura y estado del proyecto; descarta consultas anteriores", async () => fixture(async root => {
  await Bun.write(join(root, "file"), "á文🙂\n"); await git(root, "add", "file"); await git(root, "commit", "-m", "Inicial");
  await Bun.write(join(root, "file"), "después\n");
  const configRoot = await mkdtemp(join(tmpdir(), "s42-git-app-")), plain = join(configRoot, "plain"); await mkdir(plain);
  const app = await App.open({ config: join(configRoot, "config.json"), cwd: root });
  try {
    const a = app.project!; app.view.prompt.setValue("borrador á🙂"); app.gitPanel();
    const panel = app.tabs.find(t => t.project?.id === a.id)!.git!;
    await settled(() => panel.text.value.includes("+después"));
    expect(panel.text.readOnly).toBe(true); expect(app.view.prompt.value).toBe("borrador á🙂");
    app.desktop.draw();
    for (const [width, height] of [[120, 40], [60, 16], [80, 24]]) {
      app.desktop.resize(width!, height!); const canvas = app.desktop.draw();
      expect(canvas.lines().join("\n")).toContain("Prompt");
      expect(canvas.lines().every(line => Bun.stringWidth(line) === width)).toBe(true);
    }
    panel.view = "history"; await panel.refresh(); expect(panel.text.value).toContain("Inicial");
    const old = panel.refresh(); const b = await app.store.project("plain", plain, root); await app.switchProject(b); app.gitPanel(); await old;
    const other = app.tabs.find(t => t.project?.id === b.id)!.git!;
    await settled(() => other.repository?.state === "missing"); expect(other.text.value).toContain("Sin repositorio");
    await app.switchProject(a); expect(app.tabs.find(t => t.project?.id === a.id)!.contentView).toBe("git");
    expect(panel.view).toBe("history"); expect(app.view.prompt.value).toBe("borrador á🙂");
    panel.view = "changelog"; await panel.refresh(); expect(panel.text.value).toBe("No existe CHANGELOG.md");
  } finally { await app.desktop.onBeforeExit!(); await rm(configRoot, { recursive: true, force: true }); }
}), 20000);
