import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { definition, files, ignored, string, type NativeTool } from "./shared.ts";

export const list: NativeTool = {
  definition: definition("list", "List directory entries or files matching a recursive glob. Omits .git, node_modules, dist and out.", { path: string, glob: string }, []),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path ?? ".")), entries: string[] = [];
    if (args.glob) {
      const glob = new Bun.Glob(String(args.glob));
      for await (const file of files(path, signal)) { if (glob.match(relative(path, file))) entries.push(relative(path, file)); }
    } else for (const entry of await readdir(path, { withFileTypes: true })) {
      signal.throwIfAborted(); if (!ignored.has(entry.name)) entries.push(entry.name + (entry.isDirectory() ? "/" : ""));
    }
    return { output: entries.join("\n"), failed: false };
  },
};
