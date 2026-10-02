import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { definition, positiveInteger, string, type NativeTool } from "./shared.ts";

export const read: NativeTool = {
  definition: definition("read", "Read complete UTF-8 text. offset is a 1-based line; optional limit selects a requested line range.", { path: string, offset: positiveInteger, limit: positiveInteger }, ["path"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path)), file = Bun.file(path);
    if (!(await stat(path)).isFile()) throw new Error("read requiere un archivo");
    signal.throwIfAborted();
    const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    const lines = content.split("\n"), offset = Number(args.offset ?? 1);
    const output = lines.slice(offset - 1, args.limit === undefined ? undefined : offset - 1 + Number(args.limit)).map((line, i) => `${offset + i}: ${line}`).join("\n");
    return { output, failed: false };
  },
};
