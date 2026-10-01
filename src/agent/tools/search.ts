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
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await Bun.file(file).slice(0, 1048576).arrayBuffer(), { stream: true }); if (text.includes("\0")) continue; } catch { continue; }
      for (const [index, line] of text.split("\n").entries()) { if (line.includes(pattern)) matches.push(`${relative(cwd, file)}:${index + 1}: ${line}`); if (matches.length >= 100) break; }
      if (matches.length >= 100) break;
    }
    return { output: matches.join("\n") + (matches.length >= 100 ? "\n[Búsqueda recortada a 100 coincidencias]" : "\n[Hasta 1 MiB por archivo; binarios/exclusiones omitidos]"), failed: false };
  },
};
