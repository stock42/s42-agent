import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { definition, instructions, string, type NativeTool } from "./shared.ts";

export const markdownHtml: NativeTool = {
  definition: definition("markdown_html", "Convert Markdown to HTML with Bun. Supply exactly one of markdown or path. Optionally save to outputPath; standalone adds a UTF-8 HTML document. Without outputPath, return complete HTML. Does not create PDFs or sanitize HTML.", {
    markdown: string, path: string, outputPath: string, standalone: { type: "boolean" }, title: string,
  }, []),
  async run(args, { cwd, signal }) {
    if ((args.markdown === undefined) === (args.path === undefined)) throw new Error("Indicá markdown o path, exactamente uno");
    let source: string;
    if (args.path !== undefined) {
      const file = Bun.file(resolve(cwd, String(args.path)));
      if (!(await file.exists())) throw new Error(`Archivo no encontrado: ${String(args.path)}`);
      source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } else source = String(args.markdown);
    signal.throwIfAborted();
    let html = Bun.markdown.html(source, { headings: { ids: true } });
    if (args.standalone) html = `<!doctype html>\n<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${Bun.escapeHTML(String(args.title ?? "S42 Agent"))}</title></head><body>\n${html}</body></html>\n`;
    const data = Buffer.from(html);
    if (args.outputPath !== undefined) {
      if (!String(args.outputPath).trim()) throw new Error("outputPath no puede estar vacío");
      const path = resolve(cwd, String(args.outputPath)), guidance = await instructions(cwd, path);
      await mkdir(dirname(path), { recursive: true }); signal.throwIfAborted();
      await Bun.write(path, html);
      return { output: JSON.stringify({ path, bytes: data.length, ...(guidance ? { instructions: guidance } : {}) }), failed: false };
    }
    return { output: JSON.stringify({ html, bytes: data.length, truncated: false }), truncated: false, failed: false };
  },
};
