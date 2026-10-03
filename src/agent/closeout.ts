import { mkdtemp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { gitCommand, gitRepository } from "../system/git.ts";
import type { TurnTasks } from "./tasks.ts";

const redacted = (value: string) => value.replace(/https?:\/\/[^\s/@]+(?::[^\s/@]*)?@/g, "https://[redacted]@");
export async function closeout(tasks: TurnTasks, options: { files: string[]; message: string; summary: string; push?: boolean }): Promise<{ state: string; sha?: string; detail: string }> {
  const request = tasks.request; if (!request || request.mode === "planning") throw new Error("Cierre requiere un pedido de ejecución registrado");
  const record = async (state: "failed" | "committed" | "pushed" | "unavailable", detail: string, sha?: string) => { await tasks.session.append({ type: "task-closeout", requestId: request.requestId, state, detail, ...(sha ? { sha } : {}) }); return { state, detail, sha }; };
  const repo = await gitRepository(tasks.store.root, tasks.signal); if (repo.state !== "ready") return record("unavailable", repo.message);
  const git = async (args: string[], env?: NodeJS.ProcessEnv, signal = tasks.signal) => { const result = await gitCommand(repo.root, args, signal, env); if (result.failed) throw new Error(redacted(result.stderr || result.stdout || `Git: ${result.exitCode}`)); return result.stdout.replace(/\n$/, ""); };
  const normalize = (path: string) => { const name = relative(repo.root, resolve(tasks.store.root, path)); if (!name || name === ".." || name.startsWith(`..${sep}`)) throw new Error(`Archivo fuera del repositorio: ${path}`); return name; };
  const syncIndex = async (sha: string, paths: string[]) => {
    for (const path of paths) {
      const original = intent?.type === "task-closeout-intent" ? intent.indexEntries?.[path] : undefined;
      const current = await git(["ls-files", "--stage", "-z", "--", path], undefined, new AbortController().signal);
      const entry = await git(["ls-tree", "-z", sha, "--", path], undefined, new AbortController().signal);
      const match = /^(\d+) blob ([a-f0-9]+)\t/.exec(entry);
      const expected = match ? `${match[1]} ${match[2]} 0\t${path}\0` : "";
      if (current === expected) continue;
      if (original !== undefined && current !== original) throw new Error(`Índice editado después del cierre: ${path}; se preservó`);
      if (!entry) await git(["update-index", "--force-remove", "--", path], undefined, new AbortController().signal);
      else { if (!match) throw new Error(`Entrada Git no regular: ${path}`); await git(["update-index", "--add", "--cacheinfo", match[1]!, match[2]!, path], undefined, new AbortController().signal); }
    }
  };
  let intent = tasks.session.state.events.findLast(e => e.type === "task-closeout-intent" && e.requestId === request.requestId);
  let sha = tasks.session.state.events.findLast(e => e.type === "task-closeout" && e.requestId === request.requestId && e.sha);
  let committed = sha?.type === "task-closeout" ? sha.sha : undefined;
  if (!committed && intent?.type === "task-closeout-intent") {
    const head = await git(["show", "-s", "--format=%H%x00%T%x00%P", "HEAD"], undefined, new AbortController().signal).catch(() => "");
    const [found, tree, parents] = head.split("\0"); if (tree === intent.tree && parents === (intent.parent ?? "")) committed = found;
  }
  try {
    if (committed) {
      if (!/^[a-f0-9]{40,64}$/.test(committed)) throw new Error("SHA guardado inválido");
      await git(["cat-file", "-e", `${committed}^{commit}`]);
      if (intent?.type === "task-closeout-intent" && await git(["rev-parse", `${committed}^{tree}`]) !== intent.tree) throw new Error("El hook creó un árbol distinto del verificado; revisar el commit existente, no se duplicó");
      if (intent?.type === "task-closeout-intent") await syncIndex(committed, intent.paths);
      await record("committed", "Commit recuperado y comprobado; no se repitieron efectos", committed);
    } else {
      const document = await tasks.store.read(), cards = document.tasks.filter(c => c.requestId === request.requestId);
      for (const card of cards) if (card.status !== "done" || (await tasks.cardPending(card)).length) throw new Error(`Implementación/aceptación/verificación pendiente: ${card.id}`);
      if (!cards.length || !options.message.trim() || !options.summary.trim()) throw new Error("Faltan tareas, mensaje o resultado real");
      const work = [...new Set(options.files.map(normalize))];
      if (!work.length) throw new Error("Seleccioná los archivos del trabajo; no se genera commit vacío");
      const prior = request.baseline.state === "ready" ? request.baseline.status : undefined;
      if (prior && prior.head !== repo.status.head) throw new Error("HEAD cambió desde el inicio del pedido; revisar atribución antes del cierre");
      const docs = [normalize("TODO.md"), ...(request.policy.changelog ? [normalize("CHANGELOG.md")] : [])];
      const paths = [...new Set([...work, ...docs])];
      for (const path of paths) {
        if (prior?.changes.some(c => c.path === path || c.originalPath === path)) throw new Error(`Cambios previos mezclados en ${path}; separá los hunks antes del cierre`);
        if (repo.status.changes.some(c => c.path === path && c.kind === "conflict")) throw new Error(`Conflicto Git en ${path}`);
        const effects = tasks.session.state.events.filter(e => e.type === "task-file" && e.requestId === request.requestId && e.phase === "confirmed" && normalize(e.path) === path);
        const last = effects.at(-1);
        if (last?.type === "task-file") {
          const file = Bun.file(join(repo.root, path)), current = await file.exists() ? Buffer.from(await file.bytes()).toString("base64") : null;
          if (current !== last.after) throw new Error(`Edición posterior ajena o no atribuida en ${path}; revisar diff`);
        }
        const stat = await lstat(join(repo.root, path)).catch(() => undefined); if (stat && !stat.isFile()) throw new Error(`Cierre de entrada no regular requiere revisión: ${path}`);
      }
      if (request.policy.changelog) {
        const path = join(tasks.store.root, "CHANGELOG.md"), marker = `<!-- s42-task:${request.requestId} -->`;
        const source = await Bun.file(path).exists() ? await Bun.file(path).text() : "# Changelog\n";
        if (!source.includes(marker)) await Bun.write(path, `${source.trimEnd()}\n\n${marker}\n## ${new Date().toISOString().slice(0, 10)} · ${options.summary.trim()}\n\n${cards.map(c => `- ${c.id}: ${c.result}`).join("\n")}\n`);
      }
      const folder = await mkdtemp(join(tmpdir(), "s42-closeout-")), env = { GIT_INDEX_FILE: join(folder, "index") };
      try {
        await git(["read-tree", ...(repo.status.head ? [repo.status.head] : ["--empty"])], env);
        const beforeAdd = await Promise.all(paths.map(async path => { const file = Bun.file(join(repo.root, path)); return await file.exists() ? Buffer.from(await file.bytes()).toString("base64") : null; }));
        await git(["add", "--", ...paths], env);
        const afterAdd = await Promise.all(paths.map(async path => { const file = Bun.file(join(repo.root, path)); return await file.exists() ? Buffer.from(await file.bytes()).toString("base64") : null; }));
        if (JSON.stringify(beforeAdd) !== JSON.stringify(afterAdd)) throw new Error("Archivos cambiaron mientras se preparaba el índice; revisar atribución");
        const tree = await git(["write-tree"], env);
        if (repo.status.head && tree === await git(["rev-parse", `${repo.status.head}^{tree}`])) throw new Error("Sin cambios para el commit");
        const patch = await git(["diff", "--cached", "--no-ext-diff", "--no-textconv", ...(repo.status.head ? [repo.status.head] : []), "--"], env);
        await tasks.session.append({ type: "notice", text: `Diff seleccionado para ${request.requestId}:\n${patch}` });
        const indexEntries = Object.fromEntries(await Promise.all(paths.map(async path => [path, await git(["ls-files", "--stage", "-z", "--", path])])));
        await tasks.session.append({ type: "task-closeout-intent", requestId: request.requestId, parent: repo.status.head, tree, paths, message: options.message, indexEntries });
        intent = tasks.session.state.events.findLast(e => e.type === "task-closeout-intent" && e.requestId === request.requestId);
        const fresh = await gitRepository(repo.root, tasks.signal); if (fresh.state !== "ready" || fresh.status.head !== repo.status.head) throw new Error("HEAD cambió al preparar el commit");
        const result = await gitCommand(repo.root, ["commit", "-m", options.message, "--"], tasks.signal, env);
        const head = await git(["show", "-s", "--format=%H%x00%T%x00%P", "HEAD"], undefined, new AbortController().signal).catch(() => "");
        const [found, actualTree, parents] = head.split("\0");
        if (found && found !== repo.status.head) committed = found;
        if (actualTree !== tree || parents !== (repo.status.head ?? "")) throw new Error(redacted(result.stderr || result.stdout || "Git no confirmó el commit previsto"));
        committed = found;
        await record("committed", redacted(result.stdout + result.stderr), committed); await syncIndex(committed!, paths);
      } finally { await rm(folder, { recursive: true, force: true }); }
    }
    if (options.push || request.policy.push) {
      if (!request.policy.push) throw new Error("Push no autorizado por las instrucciones de este pedido");
      const current = await gitRepository(repo.root, tasks.signal); if (current.state !== "ready" || !current.status.upstream || current.status.branch === "(detached)") throw new Error("Commit local; falta upstream/rama para push");
      await git(["push"]);
      const remote = await git(["rev-parse", "--symbolic-full-name", "@{upstream}"]), mapping = /^refs\/remotes\/([^/]+)\/(.+)$/.exec(remote);
      if (!mapping) throw new Error("Push ejecutado; upstream no permite confirmar publicación");
      const received = await git(["ls-remote", "--exit-code", mapping[1]!, `refs/heads/${mapping[2]}`]);
      if (received.split(/\s/)[0] !== committed) throw new Error("Push ejecutado; remoto no coincide con el commit de tarea");
      return record("pushed", "Remoto recibió el commit", committed);
    }
    return { state: "committed", sha: committed, detail: "Commit local comprobado" };
  } catch (error) { return record("failed", (error as Error).message, committed); }
}
