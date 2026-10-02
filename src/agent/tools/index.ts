import { resolve } from "node:path";
import { read } from "./read.ts";
import { write } from "./write.ts";
import { edit } from "./edit.ts";
import { list } from "./list.ts";
import { find } from "./find.ts";
import { search } from "./search.ts";
import { httpFetch } from "./fetch.ts";
import { shell } from "./shell.ts";
import { internalSkill } from "./internal_skill.ts";
import { markdownHtml } from "./markdown_html.ts";
import { websocket } from "./websocket.ts";
import { scrape } from "./scrape.ts";
import { instructions, validate, type ToolContext, type ToolResult } from "./shared.ts";

export { instructions } from "./shared.ts";
export type { ToolResult } from "./shared.ts";
export const nativeTools = [read, write, edit, list, find, search, httpFetch, shell, internalSkill, markdownHtml, websocket, scrape];
export const toolDefinitions = nativeTools.map(tool => tool.definition);

export async function execute(name: string, raw: string, cwd: string, signal: AbortSignal, onOutput?: ToolContext["onOutput"]): Promise<ToolResult> {
  const started = performance.now();
  try {
    signal.throwIfAborted();
    const tool = nativeTools.find(t => t.definition.function.name === name);
    if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
    const args = validate(tool, raw);
    const guidance = tool.fileInstructions ? await instructions(cwd, resolve(cwd, String(args.path ?? "."))) : "";
    signal.throwIfAborted(); const result = await tool.run(args, { cwd, signal, onOutput });
    if (name !== "shell" && name !== "websocket") signal.throwIfAborted();
    const output = (guidance ? `Instrucciones aplicables:\n${guidance}\n\n` : "") + result.output;
    return { ...result, output, durationMs: Math.round(performance.now() - started) };
  } catch (e) { return { output: (e as Error).message, failed: true, durationMs: Math.round(performance.now() - started) }; }
}
