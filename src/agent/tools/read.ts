import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { definition, positiveInteger, string, type NativeTool } from "./shared.ts";

export const read: NativeTool = {
  definition: definition("read", "Read UTF-8 text. offset is a 1-based line. Limited output.", { path: string, offset: positiveInteger, limit: positiveInteger }, ["path"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path)), file = Bun.file(path);
    if (!(await stat(path)).isFile()) throw new Error("read requiere un archivo");
    signal.throwIfAborted();
    const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.slice(0, 1048576).arrayBuffer(), { stream: file.size > 1048576 });
    const lines = content.split("\n"), offset = Number(args.offset ?? 1), limit = Number(args.limit ?? 200);
    let output = lines.slice(offset - 1, offset - 1 + limit).map((line, i) => `${offset + i}: ${line}`).join("\n");
    if (file.size > 1048576 || offset - 1 + limit < lines.length) output += "\n[Lectura recortada; usar offset/limit]";
    return { output, failed: false };
  },
};
