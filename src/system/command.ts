import { resolve } from "node:path";
import { killTree } from "../agent/process.ts";

async function capture(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let retained = 0, total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (retained < 65536) { const part = value.subarray(0, 65536 - retained); chunks.push(part); retained += part.length; }
    }
  } finally { reader.releaseLock(); }
  return { text: Buffer.concat(chunks).toString(), truncated: total > retained };
}

// ShellPromise has no cancellation API. Run Bun Shell in our own subprocess so
// timeout/Ctrl+C can terminate the interpreter and its descendants, also in a binary.
export async function runCommand(command: string | string[], options: {
  cwd?: string; timeoutMs: number; signal: AbortSignal; env?: NodeJS.ProcessEnv;
}) {
  options.signal.throwIfAborted();
  const entry = Bun.isStandaloneExecutable ? [] : [resolve(import.meta.dir, "../../index.ts")];
  const child = Bun.spawn([process.execPath, ...entry, "--internal-shell"], {
    cwd: options.cwd, env: options.env, detached: true, stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  child.stdin.write(JSON.stringify(command)); child.stdin.end();
  let timedOut = false, killing: Promise<void> | undefined;
  const kill = () => killing ??= killTree(child);
  const abort = () => { void kill().catch(() => {}); };
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const timer = setTimeout(() => { timedOut = true; abort(); }, options.timeoutMs);
  try {
    const [out, err, exitCode] = await Promise.all([capture(child.stdout), capture(child.stderr), child.exited]);
    return { stdout: out.text, stderr: err.text, exitCode, timedOut, cancelled: options.signal.aborted,
      truncated: out.truncated || err.truncated, failed: exitCode !== 0 || timedOut || options.signal.aborted };
  } finally { clearTimeout(timer); options.signal.removeEventListener("abort", abort); await kill(); }
}
