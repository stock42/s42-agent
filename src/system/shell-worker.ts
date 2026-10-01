import { $ } from "bun";

export async function shellWorker(): Promise<void> {
  const command: unknown = JSON.parse(await Bun.stdin.text());
  if (typeof command !== "string" && (!Array.isArray(command) || !command.length || command.some(arg => typeof arg !== "string")))
    throw new Error("Invalid internal shell command");
  // Tool commands are intentionally shell programs. Internal argv calls escape
  // each argument, including paths/names with spaces or shell metacharacters.
  const script = typeof command === "string" ? command : command.map(arg => $.escape(arg)).join(" ");
  const result = await $`${{ raw: script }}`.nothrow();
  process.exitCode = result.exitCode;
}
