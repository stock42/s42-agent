import { relative, resolve } from "node:path";
import { definition, files, string, type NativeTool } from "./shared.ts";

export const search: NativeTool = {
  definition: definition("search", "Search literal text in files recursively. Returns paths and line numbers; omits .git, node_modules, dist and out.", { pattern: string, path: string, glob: string }, ["pattern"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path ?? ".")), pattern = String(args.pattern);
    if (!pattern) throw new Error("pattern no puede estar vacío");
    const glob = new Bun.Glob(String(args.glob ?? "**/*")), matches: string[] = [];
    for await (const file of files(path, signal)) {
      if (!glob.match(relative(path, file))) continue;
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await Bun.file(file).arrayBuffer()); if (text.includes("\0")) continue; } catch { continue; }
      for (const [index, line] of text.split("\n").entries()) { signal.throwIfAborted(); if (line.includes(pattern)) matches.push(`${relative(cwd, file)}:${index + 1}: ${line}`); }
    }
    return { output: matches.join("\n") + "\n[Binarios/exclusiones omitidos]", failed: false };
  },
};
