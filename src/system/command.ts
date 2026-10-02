import { resolve } from "node:path";
import { killTree } from "../agent/process.ts";

async function capture(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString();
}

// ShellPromise has no cancellation API. Run Bun Shell in our own subprocess so
// Ctrl+C can terminate the interpreter and its descendants, also in a binary.
export async function runCommand(command: string | string[], options: {
  cwd?: string; signal: AbortSignal; env?: NodeJS.ProcessEnv;
}) {
  options.signal.throwIfAborted();
  const entry = Bun.isStandaloneExecutable ? [] : [resolve(import.meta.dir, "../../index.ts")];
  const child = Bun.spawn([process.execPath, ...entry, "--internal-shell"], {
    cwd: options.cwd, env: options.env, detached: true, stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  child.stdin.write(JSON.stringify(command)); child.stdin.end();
  let killing: Promise<void> | undefined;
  const kill = () => killing ??= killTree(child);
  const abort = () => { void kill().catch(() => {}); };
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  try {
    const [out, err, exitCode] = await Promise.all([capture(child.stdout), capture(child.stderr), child.exited]);
    return { stdout: out, stderr: err, exitCode, timedOut: false, cancelled: options.signal.aborted,
      truncated: false, failed: exitCode !== 0 || options.signal.aborted };
  } finally { options.signal.removeEventListener("abort", abort); await kill(); }
}
