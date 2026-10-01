import { killTree } from "./process.ts";
import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { ToolDefinition } from "../llm/client.ts";

const string = { type: "string" }, number = { type: "integer", minimum: 1 };
const schemas: Record<string, { description: string; properties: Record<string, unknown>; required: string[] }> = {
  read: { description: "Read UTF-8 text. offset is a 1-based line. Limited output.", properties: { path: string, offset: number, limit: number }, required: ["path"] },
  list: { description: "List directory entries or files matching a glob.", properties: { path: string, glob: string }, required: [] },
  search: { description: "Search literal text in project files. Returns paths and line numbers.", properties: { pattern: string, path: string, glob: string }, required: ["pattern"] },
  write: { description: "Create or replace a UTF-8 file.", properties: { path: string, content: string }, required: ["path", "content"] },
  edit: { description: "Replace one exact unique oldText occurrence with newText. Fails without changes if not unique.", properties: { path: string, oldText: string, newText: string }, required: ["path", "oldText", "newText"] },
  shell: { description: "Run a non-interactive command in the project directory. Return stdout/stderr, exit code and duration.", properties: { command: string, timeoutMs: number }, required: ["command"] },
};
export const toolDefinitions: ToolDefinition[] = Object.entries(schemas).map(([name, s]) => ({ type: "function", function: { name, description: s.description, parameters: { type: "object", properties: s.properties, required: s.required, additionalProperties: false } } }));
export interface ToolResult { output: string; failed: boolean; durationMs: number; exitCode?: number; truncated?: boolean }
const ignored = new Set([".git", "node_modules", "dist", "out"]);
async function* files(folder: string, signal: AbortSignal): AsyncGenerator<string> {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    signal.throwIfAborted(); if (ignored.has(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* files(path, signal); else if (entry.isFile()) yield path;
  }
}
export async function instructions(root: string, path = root): Promise<string> {
  const target = relative(root, resolve(path));
  const folders = [root]; if (target && !target.startsWith(`..${sep}`) && target !== "..") {
    let current = root; for (const part of relative(root, dirname(resolve(path))).split(sep).filter(Boolean)) { current = join(current, part); folders.push(current); }
  }
  const found: string[] = [];
  for (const folder of folders) { const file = Bun.file(join(folder, "AGENTS.md")); if (await file.exists()) found.push(`${folder}/AGENTS.md:\n${await file.text()}`); }
  return found.join("\n\n");
}
function validate(name: string, raw: string): Record<string, string | number> {
  const schema = schemas[name]; if (!schema) throw new Error(`Herramienta desconocida: ${name}`);
  const args = JSON.parse(raw);
  if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("Argumentos deben ser un objeto JSON");
  for (const field of schema.required) if (!(field in args)) throw new Error(`Falta ${field}`);
  for (const [field, value] of Object.entries(args)) {
    const property = schema.properties[field] as { type: string } | undefined;
    if (!property || property.type === "string" && typeof value !== "string" || property.type === "integer" && (!Number.isSafeInteger(value) || Number(value) < 1)) throw new Error(`Argumento inválido: ${field}`);
  }
  return args;
}
const clip = (text: string, bytes = 65536) => { const data = Buffer.from(text); return data.length > bytes ? data.subarray(0, bytes).toString() + "\n[Salida recortada a 64 KiB]" : text; };
async function capture(stream: ReadableStream<Uint8Array>): Promise<{ text: string; truncated: boolean }> {
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let retained = 0, total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (retained < 65536) { const part = value.subarray(0, 65536 - retained); chunks.push(part); retained += part.length; } } }
  finally { reader.releaseLock(); }
  return { text: Buffer.concat(chunks).toString(), truncated: total > retained };
}
async function shell(command: string, cwd: string, timeoutMs: number, signal: AbortSignal): Promise<ToolResult> {
  signal.throwIfAborted(); const started = performance.now();
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
    return { output: JSON.stringify({ stdout: clip(out.text, 30000), stderr: clip(err.text, 30000), exitCode, timedOut, cancelled: signal.aborted, truncated }), failed: exitCode !== 0 || timedOut || signal.aborted, exitCode, durationMs: Math.round(performance.now() - started), truncated };
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); await kill(); }
}
export async function execute(name: string, raw: string, cwd: string, signal: AbortSignal, shellTimeoutMs = 120000): Promise<ToolResult> {
  const started = performance.now();
  try {
    signal.throwIfAborted(); const args = validate(name, raw), path = resolve(cwd, String(args.path ?? ".")); let output: string;
    if (name === "shell") return await shell(String(args.command), cwd, Number(args.timeoutMs ?? shellTimeoutMs), signal);
    const guidance = await instructions(cwd, path);
    if (name === "read") {
      const file = Bun.file(path); if (!(await stat(path)).isFile()) throw new Error("read requiere un archivo");
      const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.slice(0, 1048576).arrayBuffer());
      const lines = content.split("\n"), offset = Number(args.offset ?? 1), limit = Number(args.limit ?? 200);
      output = lines.slice(offset - 1, offset - 1 + limit).map((line, i) => `${offset + i}: ${line}`).join("\n");
      if (file.size > 1048576 || offset - 1 + limit < lines.length) output += "\n[Lectura recortada; usar offset/limit]";
    } else if (name === "write") { await mkdir(dirname(path), { recursive: true }); signal.throwIfAborted(); await Bun.write(path, String(args.content)); output = `Escrito: ${path}`; }
    else if (name === "edit") {
      const file = Bun.file(path); if (file.size > 1048576) throw new Error("edit admite archivos de hasta 1 MiB");
      const content = await file.text(), old = String(args.oldText); if (!old) throw new Error("oldText no puede estar vacío");
      const index = content.indexOf(old); if (index < 0 || content.indexOf(old, index + 1) >= 0) throw new Error("edit exige exactamente una coincidencia; archivo sin cambios");
      signal.throwIfAborted(); await Bun.write(path, content.slice(0, index) + String(args.newText) + content.slice(index + old.length)); output = `Editado: ${path}`;
    } else if (name === "list") {
      const entries: string[] = []; if (args.glob) { const glob = new Bun.Glob(String(args.glob)); for await (const file of files(path, signal)) { if (glob.match(relative(path, file))) entries.push(relative(path, file)); if (entries.length >= 200) break; } }
      else for (const entry of await readdir(path, { withFileTypes: true })) { if (!ignored.has(entry.name)) entries.push(entry.name + (entry.isDirectory() ? "/" : "")); if (entries.length >= 200) break; }
      output = entries.join("\n") + (entries.length >= 200 ? "\n[Listado recortado a 200 entradas]" : "");
    } else {
      const pattern = String(args.pattern); if (!pattern) throw new Error("pattern no puede estar vacío");
      const glob = new Bun.Glob(String(args.glob ?? "**/*")), matches: string[] = [];
      for await (const file of files(path, signal)) {
        if (!glob.match(relative(path, file))) continue;
        let text: string; try { text = new TextDecoder("utf-8", { fatal: true }).decode(await Bun.file(file).slice(0, 1048576).arrayBuffer()); if (text.includes("\0")) continue; } catch { continue; }
        for (const [index, line] of text.split("\n").entries()) { if (line.includes(pattern)) matches.push(`${relative(cwd, file)}:${index + 1}: ${line}`); if (matches.length >= 100) break; }
        if (matches.length >= 100) break;
      }
      output = matches.join("\n") + (matches.length >= 100 ? "\n[Búsqueda recortada a 100 coincidencias]" : "\n[Hasta 1 MiB por archivo; binarios/exclusiones omitidos]");
    }
    signal.throwIfAborted(); return { output: clip((guidance ? `Instrucciones aplicables:\n${guidance}\n\n` : "") + output), failed: false, durationMs: Math.round(performance.now() - started) };
  } catch (e) { return { output: (e as Error).message, failed: true, durationMs: Math.round(performance.now() - started) }; }
}
