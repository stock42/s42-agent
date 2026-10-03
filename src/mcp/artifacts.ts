import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Session } from "../storage/sessions.ts";
import type { Artifact } from "../agent/messages.ts";
export function artifactDirectory(session: Session): string { return /\.(sqlite|sqlite3|db)$/.test(session.path) ? join(`${session.path}.artifacts`, session.state.projectId, session.state.id) : join(dirname(session.path), `${session.state.id}.artifacts`); }
export async function preserveMcpContent(content: any[], directory: string): Promise<{ output: string; artifacts: Artifact[] }> {
  const artifacts: Artifact[] = [], output: string[] = [];
  const save = async (data: Uint8Array, mimeType: string, name?: string, uri?: string) => {
    await mkdir(directory, { recursive: true });
    const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "text/plain": "txt" } as Record<string, string>)[mimeType] ?? "bin";
    const path = join(directory, `${crypto.randomUUID()}.${extension}`); await Bun.write(path, data); artifacts.push({ path, mimeType, name, uri }); output.push(`[${mimeType}] ${path}${uri ? ` · ${uri}` : ""}`);
  };
  for (const part of content) {
    if (part.type === "text") output.push(String(part.text));
    else if (part.type === "image" || part.type === "audio") await save(Buffer.from(part.data, "base64"), part.mimeType ?? "application/octet-stream");
    else if (part.type === "resource") {
      const r = part.resource; if (typeof r?.text === "string") output.push(r.text);
      if (typeof r?.blob === "string") await save(Buffer.from(r.blob, "base64"), r.mimeType ?? "application/octet-stream", undefined, r.uri);
      else if (r?.uri) { artifacts.push({ uri: r.uri, mimeType: r.mimeType }); output.push(`[resource] ${r.uri}`); }
    } else if (part.type === "resource_link") {
      const uri = String(part.uri), mimeType = part.mimeType ?? "application/octet-stream";
      if (uri.startsWith("file:")) { try { const path = fileURLToPath(uri); await save(await Bun.file(path).bytes(), mimeType, part.name, uri); } catch (e) { artifacts.push({ uri, mimeType, name: part.name }); output.push(`[resource_link] ${uri} · ${(e as Error).message}`); } }
      else { artifacts.push({ uri, mimeType, name: part.name }); output.push(`[resource_link] ${part.name ?? ""} ${uri}`); }
    } else output.push(`[${part.type ?? "contenido"} MCP]`);
  }
  return { output: output.join("\n"), artifacts };
}
