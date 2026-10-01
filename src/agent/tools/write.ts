import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { definition, string, type NativeTool } from "./shared.ts";

export const write: NativeTool = {
  definition: definition("write", "Create or replace a UTF-8 file; append=true adds a chunk to the end, useful for large files.", { path: string, content: string, append: { type: "boolean" } }, ["path", "content"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path));
    await mkdir(dirname(path), { recursive: true }); signal.throwIfAborted();
    if (args.append === true) {
      const fd = await open(path, "a"); try { await fd.writeFile(String(args.content)); } finally { await fd.close(); }
    } else await Bun.write(path, String(args.content)); return { output: `Escrito: ${path}`, failed: false };
  },
};
