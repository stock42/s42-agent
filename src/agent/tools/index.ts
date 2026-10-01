import { resolve } from "node:path";
import { read } from "./read.ts";
import { write } from "./write.ts";
import { edit } from "./edit.ts";
import { list } from "./list.ts";
import { find } from "./find.ts";
import { search } from "./search.ts";
import { httpFetch } from "./fetch.ts";
import { shell } from "./shell.ts";
import { clip, instructions, validate, type ToolResult } from "./shared.ts";

export { instructions } from "./shared.ts";
export type { ToolResult } from "./shared.ts";
export const nativeTools = [read, write, edit, list, find, search, httpFetch, shell];
export const toolDefinitions = nativeTools.map(tool => tool.definition);

export async function execute(name: string, raw: string, cwd: string, signal: AbortSignal, shellTimeoutMs = 120000): Promise<ToolResult> {
  const started = performance.now();
  try {
    signal.throwIfAborted();
    const tool = nativeTools.find(t => t.definition.function.name === name);
    if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
    const args = validate(tool, raw);
    const guidance = tool.fileInstructions ? await instructions(cwd, resolve(cwd, String(args.path ?? "."))) : "";
    signal.throwIfAborted(); const result = await tool.run(args, { cwd, signal, shellTimeoutMs });
    if (name !== "shell") signal.throwIfAborted();
    const output = (guidance ? `Instrucciones aplicables:\n${guidance}\n\n` : "") + result.output;
    // Structured HTTP/shell output stays parseable; their bodies are bounded by the tool.
    return { ...result, output: name === "fetch" || name === "shell" ? output : clip(output), durationMs: Math.round(performance.now() - started) };
  } catch (e) { return { output: (e as Error).message, failed: true, durationMs: Math.round(performance.now() - started) }; }
}
