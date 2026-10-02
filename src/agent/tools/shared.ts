import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { ToolDefinition } from "../../llm/client.ts";
import type { CommandOutput } from "../../system/command.ts";

export interface ToolResult { output: string; failed: boolean; durationMs: number; exitCode?: number; truncated?: boolean }
export interface ToolContext { cwd: string; signal: AbortSignal; onOutput?: CommandOutput }
export interface NativeTool {
  definition: ToolDefinition;
  run(args: Record<string, unknown>, context: ToolContext): Promise<Omit<ToolResult, "durationMs">>;
  fileInstructions?: boolean;
}
export const string = { type: "string" }, positiveInteger = { type: "integer", minimum: 1 };
export function definition(name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolDefinition {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } };
}
export function validate(tool: NativeTool, raw: string): Record<string, unknown> {
  const args = JSON.parse(raw), schema = tool.definition.function.parameters;
  if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("Argumentos deben ser un objeto JSON");
  for (const field of schema.required as string[]) if (!(field in args)) throw new Error(`Falta ${field}`);
  for (const [field, value] of Object.entries(args)) {
    const properties = schema.properties as Record<string, { type?: string; enum?: unknown[]; items?: { type: string }; additionalProperties?: { type: string } }>;
    const property = Object.hasOwn(properties, field) ? properties[field] : undefined;
    if (!property || property.type === "string" && typeof value !== "string"
      || property.type === "integer" && (!Number.isSafeInteger(value) || Number(value) < 1)
      || property.type === "boolean" && typeof value !== "boolean"
      || property.type === "object" && (!value || typeof value !== "object" || Array.isArray(value))
      || property.type === "array" && (!Array.isArray(value) || property.items?.type === "string" && value.some(v => typeof v !== "string"))
      || property.enum && !property.enum.includes(value)) throw new Error(`Argumento inválido: ${field}`);
    if (property.additionalProperties?.type === "string" && Object.values(value as object).some(v => typeof v !== "string")) throw new Error(`Argumento inválido: ${field}`);
  }
  return args;
}
export const ignored = new Set([".git", "node_modules", "dist", "out"]);
// Incremental traversal permits cancellation and prunes directories before reading them.
// Do not follow symlinks: disk searches must not loop through ancestor links.
export async function* files(folder: string, signal: AbortSignal, options: { includeIgnored?: boolean; onSkip?: (path: string) => void } = {}, nested = false): AsyncGenerator<string> {
  signal.throwIfAborted();
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) {
    if (nested && ["EACCES", "EPERM", "ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) { options.onSkip?.(folder); return; }
    throw error;
  }
  for (const entry of entries) {
    signal.throwIfAborted(); if (!options.includeIgnored && ignored.has(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* files(path, signal, options, true); else if (entry.isFile()) yield path;
  }
}
export async function instructions(root: string, path = root): Promise<string> {
  const target = relative(root, resolve(path)), folders = [root];
  if (target && !target.startsWith(`..${sep}`) && target !== "..") {
    let current = root;
    for (const part of relative(root, dirname(resolve(path))).split(sep).filter(Boolean)) { current = join(current, part); folders.push(current); }
  }
  const found: string[] = [];
  for (const folder of folders) { const file = Bun.file(join(folder, "AGENTS.md")); if (await file.exists()) found.push(`${folder}/AGENTS.md:\n${await file.text()}`); }
  return found.join("\n\n");
}
