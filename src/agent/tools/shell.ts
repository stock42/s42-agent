import { runCommand } from "../../system/command.ts";
import { definition, string, type NativeTool } from "./shared.ts";

export const shell: NativeTool = {
  definition: definition("shell", "Run a non-interactive command with Bun Shell in the project directory. For HTTP use fetch; for rendered websites and summaries use scrape, not curl/wget. Supports pipes, redirects and builtins; not all Bash/cmd syntax. Streams stdout/stderr to the UI and returns their complete contents, exit code and duration when the process exits. Runs until completion or cancellation; verification scripts must close timers and other open resources to exit.", { command: string }, ["command"]),
  async run(args, { cwd, signal, onOutput }) {
    const result = await runCommand(String(args.command), { cwd, signal, onOutput });
    return { output: JSON.stringify(result), failed: result.failed, exitCode: result.exitCode, truncated: false };
  },
};
