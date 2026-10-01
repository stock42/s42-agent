import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { definition, string, type NativeTool } from "./shared.ts";

export const write: NativeTool = {
  definition: definition("write", "Create or replace a UTF-8 file.", { path: string, content: string }, ["path", "content"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path));
    await mkdir(dirname(path), { recursive: true }); signal.throwIfAborted();
    await Bun.write(path, String(args.content)); return { output: `Escrito: ${path}`, failed: false };
  },
};
