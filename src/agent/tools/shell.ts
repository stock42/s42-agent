import { killTree } from "../process.ts";
import { clip, definition, positiveInteger, string, type NativeTool } from "./shared.ts";

async function capture(stream: ReadableStream<Uint8Array>): Promise<{ text: string; truncated: boolean }> {
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let retained = 0, total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (retained < 65536) { const part = value.subarray(0, 65536 - retained); chunks.push(part); retained += part.length; } } }
  finally { reader.releaseLock(); }
  return { text: Buffer.concat(chunks).toString(), truncated: total > retained };
}
export const shell: NativeTool = {
  definition: definition("shell", "Run a non-interactive system command in the project directory. Return stdout/stderr, exit code and duration.", { command: string, timeoutMs: positiveInteger }, ["command"]),
  async run(args, { cwd, signal, shellTimeoutMs }) {
    return runShell(String(args.command), cwd, Number(args.timeoutMs ?? shellTimeoutMs), signal);
  },
};
async function runShell(command: string, cwd: string, timeoutMs: number, signal: AbortSignal): Promise<Omit<import("./shared.ts").ToolResult, "durationMs">> {
  signal.throwIfAborted();
  const cmd = process.platform === "win32" ? [process.env.ComSpec ?? "cmd.exe", "/d", "/s", "/c", command] : [process.env.SHELL ?? "/bin/sh", "-c", command];
  const child = Bun.spawn(cmd, { cwd, detached: true, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  let killing:Promise<void>|undefined;
  const kill = () => killing ??= killTree(child);
  // Kill the group, including descendants holding stdout/stderr open.
  const abort = () => { void kill().catch(()=>{}); }; signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const [out, err, exitCode] = await Promise.all([capture(child.stdout), capture(child.stderr), child.exited]);
    const truncated = out.truncated || err.truncated || Buffer.byteLength(out.text + err.text) > 65536;
    return { output: JSON.stringify({ stdout: clip(out.text, 30000), stderr: clip(err.text, 30000), exitCode, timedOut, cancelled: signal.aborted, truncated }), failed: exitCode !== 0 || timedOut || signal.aborted, exitCode, truncated };
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); await kill(); }
}
