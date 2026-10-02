import { runCommand } from "../../system/command.ts";
import { definition, string, type NativeTool } from "./shared.ts";

export const shell: NativeTool = {
  definition: definition("shell", "Run a non-interactive command with Bun Shell in the project directory. Supports pipes, redirects and builtins; not all Bash/cmd syntax. Return complete stdout/stderr, exit code and duration. Runs until completion or cancellation.", { command: string }, ["command"]),
  async run(args, { cwd, signal }) {
    const result = await runCommand(String(args.command), { cwd, signal });
    return { output: JSON.stringify(result), failed: result.failed, exitCode: result.exitCode, truncated: false };
  },
};
