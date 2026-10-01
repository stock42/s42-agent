import { resolve } from "node:path";
import { definition, string, type NativeTool } from "./shared.ts";

export const edit: NativeTool = {
  definition: definition("edit", "Replace one exact unique oldText occurrence with newText. Fails without changes if not unique.", { path: string, oldText: string, newText: string }, ["path", "oldText", "newText"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const path = resolve(cwd, String(args.path)), file = Bun.file(path);
    if (file.size > 1048576) throw new Error("edit admite archivos de hasta 1 MiB");
    const content = await file.text(), old = String(args.oldText);
    if (!old) throw new Error("oldText no puede estar vacío");
    const index = content.indexOf(old);
    if (index < 0 || content.indexOf(old, index + 1) >= 0) throw new Error("edit exige exactamente una coincidencia; archivo sin cambios");
    signal.throwIfAborted(); await Bun.write(path, content.slice(0, index) + String(args.newText) + content.slice(index + old.length));
    return { output: `Editado: ${path}`, failed: false };
  },
};
