import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { TextArea } from "./ui/components/text-area.ts";
import { highlight, syntaxLanguage, type SyntaxLanguage } from "./ui/syntax.ts";

export interface FileTab {
  id: string; ownerId: string; path: string; name: string; size: number;
  language?: SyntaxLanguage; binary: boolean; content: TextArea;
}

export async function openFileTab(path: string, ownerId: string): Promise<FileTab> {
  if (!(await stat(path)).isFile()) throw new Error("Esta entrada no es un archivo regular");
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  let text = "", binary = false;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); binary = text.includes("\0"); }
  catch { binary = true; }
  const content = new TextArea("file", { x: 1, y: 1, width: 76, height: 12 });
  content.readOnly = true;
  const language = syntaxLanguage(path);
  content.setValue(binary ? "" : highlight(text, language), "start");
  return { id: crypto.randomUUID(), ownerId, path, name: basename(path), size: bytes.length, language, binary, content };
}
