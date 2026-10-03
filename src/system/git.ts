import { join } from "node:path";
import { runCommand } from "./command.ts";

export interface GitChange {
  path: string; originalPath?: string; index: string; worktree: string;
  kind: "tracked" | "renamed" | "untracked" | "conflict";
}
export interface GitStatus {
  changes: GitChange[]; head?: string; branch?: string; upstream?: string; ahead?: number; behind?: number;
}
export type GitRepository = { state: "ready"; root: string; status: GitStatus }
  | { state: "missing" | "unavailable" | "error"; message: string };
export interface GitCommit { sha: string; author: string; date: string; subject: string; refs: string }
export interface GitBranch { name: string; sha: string; current: boolean; upstream: string; tracking: string }

// argv stays an array through the shared Bun Shell worker. Local queries never
// refresh remote refs or run configured diff/colour helpers.
export function gitCommand(cwd: string, args: string[], signal = new AbortController().signal, env?: NodeJS.ProcessEnv) {
  return runCommand(["git", "--no-pager", "--literal-pathspecs", "-c", "color.ui=false", ...args], {
    cwd, signal, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", ...env },
  });
}
async function query(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  const result = await gitCommand(cwd, args, signal);
  if (result.failed) throw new Error(result.stderr || result.stdout || `Git: ${result.exitCode}`);
  return result.stdout;
}

export function parseGitStatus(output: string): GitStatus {
  const status: GitStatus = { changes: [] }, records = output.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    if (record.startsWith("# branch.")) {
      const match = /^# branch\.(\S+) ([\s\S]*)$/.exec(record);
      if (!match) continue;
      const [, key, value] = match;
      if (key === "oid" && value !== "(initial)") status.head = value;
      if (key === "head") status.branch = value;
      if (key === "upstream") status.upstream = value;
      if (key === "ab") { const ab = /^\+(\d+) -(\d+)$/.exec(value!); if (ab) { status.ahead = Number(ab[1]); status.behind = Number(ab[2]); } }
      continue;
    }
    if (record.startsWith("? ")) { status.changes.push({ path: record.slice(2), index: "?", worktree: "?", kind: "untracked" }); continue; }
    const type = record[0];
    if (type !== "1" && type !== "2" && type !== "u") continue;
    const fields = type === "1" ? 8 : type === "2" ? 9 : 10;
    let offset = 0;
    for (let f = 0; f < fields; f++) { offset = record.indexOf(" ", offset) + 1; if (!offset) throw new Error("Invalid Git porcelain record"); }
    const xy = record.split(" ", 3)[1]!;
    status.changes.push({ path: record.slice(offset), index: xy[0]!, worktree: xy[1]!,
      kind: type === "u" ? "conflict" : type === "2" ? "renamed" : "tracked",
      ...(type === "2" ? { originalPath: records[++i] } : {}) });
  }
  return status;
}

export async function gitRepository(cwd: string, signal?: AbortSignal): Promise<GitRepository> {
  const root = await gitCommand(cwd, ["rev-parse", "--show-toplevel"], signal);
  if (root.cancelled) throw signal?.reason ?? new Error("Git cancelled");
  if (root.failed) return { state: root.exitCode === 127 || /command not found.*git|git.*command not found/i.test(root.stderr) ? "unavailable" : /not a git repository/i.test(root.stderr) ? "missing" : "error",
    message: root.stderr || root.stdout || `Git: ${root.exitCode}` };
  // rev-parse adds exactly one line terminator; trim() would damage a root
  // whose legitimate name ends in spaces or newlines.
  const path = root.stdout.replace(/\r?\n$/, "");
  return { state: "ready", root: path, status: parseGitStatus(await query(path, ["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"], signal)) };
}

export async function gitHistory(root: string, skip = 0, count = 40, signal?: AbortSignal, head = "HEAD"): Promise<GitCommit[]> {
  const output = await query(root, ["log", "-z", `--skip=${skip}`, `--max-count=${count}`, "--format=%H%x00%an%x00%aI%x00%s%x00%D", head, "--"], signal);
  const fields = output.split("\0"), commits: GitCommit[] = [];
  for (let i = 0; i + 4 < fields.length; i += 5) commits.push({ sha: fields[i]!, author: fields[i+1]!, date: fields[i+2]!, subject: fields[i+3]!, refs: fields[i+4]! });
  return commits;
}

export async function gitBranches(root: string, signal?: AbortSignal): Promise<GitBranch[]> {
  const output = await query(root, ["for-each-ref", "--format=%(refname:short)%00%(objectname)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00", "refs/heads", "refs/remotes"], signal);
  return output.split("\0\n").filter(Boolean).map(row => {
    const [name, sha, current, upstream, tracking] = row.split("\0");
    return { name: name!, sha: sha!, current: current === "*", upstream: upstream!, tracking: tracking! };
  });
}

export async function gitDiff(root: string, change: GitChange, staged: boolean, signal?: AbortSignal): Promise<string> {
  const args = change.kind === "untracked" ? ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--", "/dev/null", join(root, change.path)]
    : ["diff", ...(staged ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--", change.path, ...(change.originalPath ? [change.originalPath] : [])];
  const result = await gitCommand(root, args, signal);
  if (result.cancelled || (result.exitCode !== 0 && !(change.kind === "untracked" && result.exitCode === 1))) throw new Error(result.stderr || "Git diff cancelled");
  return result.stdout;
}
export function gitCommitDetail(root: string, sha: string, signal?: AbortSignal): Promise<string> {
  if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error("Invalid commit SHA");
  return query(root, ["show", "--format=fuller", "--stat", "--patch", "--no-ext-diff", "--no-textconv", sha, "--"], signal);
}
export async function gitChangelog(root: string): Promise<string | undefined> {
  const file = Bun.file(join(root, "CHANGELOG.md"));
  return await file.exists() ? await file.text() : undefined;
}

export async function gitInitialize(cwd: string, signal: AbortSignal): Promise<GitRepository> {
  const existing = await gitRepository(cwd, signal); if (existing.state !== "missing") return existing;
  await query(cwd, ["init", "--", cwd], signal); return gitRepository(cwd, signal);
}
