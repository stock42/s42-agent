import { basename, resolve, join } from "node:path";
import { homedir } from "node:os";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ContentPart } from "./messages.ts";

export interface Attachment { path: string; name: string; size: number; hash: string; kind: "text" | "image"; content: string }
export function parsePaths(text: string): string[] | undefined {
  const tokens: string[] = []; let current = "", quote = "", started = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) { if (c === quote) quote = ""; else current += c; started = true; continue; }
    if (c === "'" || c === '"') { quote = c; started = true; continue; }
    if (c === "\\" && text[i+1] && /[\s'"\\]/.test(text[i+1]!) && !/^[A-Za-z]:/.test(current) && !(current === "" && text[i+1] === "\\") && !current.startsWith("\\\\")) { current += text[++i]; started = true; continue; }
    if (/\s/.test(c)) { if (started) { tokens.push(current); current = ""; started = false; } }
    else { current += c; started = true; }
  }
  if (quote) return; if (started) tokens.push(current); if (!tokens.length) return;
  try { return tokens.map(token => {
    if (!token.startsWith("file://")) return token;
    const url = new URL(token); if (url.protocol !== "file:" || url.search || url.hash) throw new Error();
    const path = decodeURIComponent(url.pathname);
    if (url.hostname && url.hostname !== "localhost") return `\\\\${url.hostname}${path.replaceAll("/", "\\")}`;
    return /^\/[A-Za-z]:\//.test(path) ? path.slice(1).replaceAll("/", "\\") : path;
  }); } catch { return; }
}
export const localPath = (path: string, cwd: string) => resolve(cwd, path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);
export async function pastedPaths(text: string, cwd: string): Promise<string[] | undefined> {
  const paths = parsePaths(text); if (!paths) return;
  const exists = async (paths: string[]) => { try { for (const path of paths) await stat(localPath(path,cwd)); return true; } catch { return false; } };
  if (await exists(paths)) return paths;
  // Some emulators paste one unquoted path containing spaces.
  if (!text.includes("\n") && await exists([text.trim()])) return [text.trim()];
}
export async function snapshot(path: string, cwd: string): Promise<Attachment> {
  path = localPath(path,cwd); const info = await stat(path);
  if (!info.isFile()) throw new Error("El adjunto debe ser un archivo; no se incluyen carpetas");
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  let mime: string | undefined;
  if (bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]) && bytes.length >= 8) mime="image/png";
  else if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) mime="image/jpeg";
  else if (new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP') mime="image/webp";
  let content: string;
  if (mime) content=`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  else {
    if (/\.(pdf|zip|gz|mp3|mp4|wav|gif|exe|dll|bin)$/i.test(path)) throw new Error("Formato no admitido: texto UTF-8 o PNG/JPEG/WebP");
    try { content = new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { throw new Error("El archivo no es texto UTF-8 ni una imagen admitida"); }
    if (content.includes('\0')) throw new Error("Archivo binario no admitido");
  }
  return {path,name:basename(path),size:bytes.length,hash:createHash('sha256').update(bytes).digest('hex'),kind:mime?'image':'text',content};
}
export function validateAttachments(items: Attachment[], images: boolean): void {
  if (items.some(a=>a.kind==='image') && !images) throw new Error("Este modelo no admite imágenes. Elegí otro en Models o quitá el adjunto.");
}
export function contentWithAttachments(text: string, items: Attachment[]): string | ContentPart[] {
  if (!items.length) return text;
  return [{type:'text',text},...items.flatMap((a):ContentPart[]=>a.kind==='image' ? [{type:'text',text:`Imagen adjunta: ${a.path}`},{type:'image_url',image_url:{url:a.content}}] : [{type:'text',text:`Archivo adjunto: ${a.path}\n<attachment>\n${a.content}\n</attachment>`}])];
}
export function hasImages(messages: {content: unknown}[]): boolean { return messages.some(m=>Array.isArray(m.content) && m.content.some(p=>p?.type==='image_url')); }
