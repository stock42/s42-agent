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
import { sessionHistory } from "./session_history.ts";
import { taskPlan } from "./task_plan.ts";
import { taskUpdate } from "./task_update.ts";
import { taskVerify } from "./task_verify.ts";
import { instructions, validate, type ToolContext, type ToolResult } from "./shared.ts";

export { instructions } from "./shared.ts";
export type { ToolResult } from "./shared.ts";
export const nativeTools = [read, write, edit, list, find, search, httpFetch, shell, internalSkill, markdownHtml, websocket, scrape, sessionHistory, taskPlan, taskUpdate, taskVerify];
export const toolDefinitions = nativeTools.map(tool => tool.definition);

export async function execute(name: string, raw: string, cwd: string, signal: AbortSignal, onOutput?: ToolContext["onOutput"], history?: ToolContext["history"], taskContext?: Pick<ToolContext, "tasks" | "callId">): Promise<ToolResult> {
  const started = performance.now();
  try {
    signal.throwIfAborted();
    const tool = nativeTools.find(t => t.definition.function.name === name);
    if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
    const args = validate(tool, raw);
    const tasks = taskContext?.tasks;
    const mutation = ["write", "edit", "shell", "task_verify"].includes(name) || name === "markdown_html" && args.outputPath !== undefined
      || name === "fetch" && args.method !== undefined && !["GET", "HEAD", "OPTIONS"].includes(String(args.method).toUpperCase())
      || name === "websocket" && Array.isArray(args.messages) && args.messages.length > 0;
    if (tasks && mutation) await tasks.requirePlan();
    const guidance = tool.fileInstructions ? await instructions(cwd, resolve(cwd, String(args.path ?? "."))) : "";
    signal.throwIfAborted();
    const run = () => tool.run(args, { cwd, signal, onOutput, history, ...taskContext });
    const outputPath = ["write", "edit"].includes(name) ? args.path : name === "markdown_html" ? args.outputPath : undefined;
    const result = tasks && outputPath !== undefined
      ? await tasks.fileEffect(taskContext!.callId ?? crypto.randomUUID(), resolve(cwd, String(outputPath)), run) as Awaited<ReturnType<typeof run>> : await run();
    if (name !== "shell" && name !== "websocket") signal.throwIfAborted();
    const output = (guidance ? `Instrucciones aplicables:\n${guidance}\n\n` : "") + result.output;
    return { ...result, output, durationMs: Math.round(performance.now() - started) };
  } catch (e) { return { output: (e as Error).message, failed: true, durationMs: Math.round(performance.now() - started) }; }
}
