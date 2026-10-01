import { runCommand } from "../../system/command.ts";
import { clip, definition, positiveInteger, string, type NativeTool } from "./shared.ts";

export const shell: NativeTool = {
  definition: definition("shell", "Run a non-interactive command with Bun Shell in the project directory. Supports pipes, redirects and builtins; not all Bash/cmd syntax. Return stdout/stderr, exit code and duration.", { command: string, timeoutMs: positiveInteger }, ["command"]),
  async run(args, { cwd, signal, shellTimeoutMs }) {
    const result = await runCommand(String(args.command), { cwd, timeoutMs: Number(args.timeoutMs ?? shellTimeoutMs), signal });
    const truncated = result.truncated || Buffer.byteLength(result.stdout + result.stderr) > 65536;
    return { output: JSON.stringify({ stdout: clip(result.stdout, 30000), stderr: clip(result.stderr, 30000), exitCode: result.exitCode,
      timedOut: result.timedOut, cancelled: result.cancelled, truncated }), failed: result.failed, exitCode: result.exitCode, truncated };
  },
};
