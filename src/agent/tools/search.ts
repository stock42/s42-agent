import { stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { definition, files, string, type NativeTool } from "./shared.ts";

export const search: NativeTool = {
  definition: definition("search", "Search case-sensitive literal text in a file or recursively in a directory. pattern is not a regular expression; use separate calls for alternatives. path accepts a file or directory; glob filters file names. Returns paths and line numbers; directory traversal omits .git, node_modules, dist and out.", { pattern: string, path: string, glob: string }, ["pattern"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path ?? ".")), pattern = String(args.pattern);
    if (!pattern) throw new Error("pattern no puede estar vacío");
    const glob = new Bun.Glob(String(args.glob ?? "**/*")), matches: string[] = [];
    const single = (await stat(path)).isFile();
    for await (const file of single ? [path] : files(path, signal)) {
      signal.throwIfAborted();
      if (!glob.match(single ? basename(file) : relative(path, file))) continue;
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await Bun.file(file).arrayBuffer()); if (text.includes("\0")) continue; } catch { continue; }
      for (const [index, line] of text.split("\n").entries()) { signal.throwIfAborted(); if (line.includes(pattern)) matches.push(`${relative(cwd, file)}:${index + 1}: ${line}`); }
    }
    return { output: matches.length ? matches.join("\n") : "Sin coincidencias literales. pattern no admite expresiones regulares; binarios y directorios excluidos se omiten.", failed: false };
  },
};
