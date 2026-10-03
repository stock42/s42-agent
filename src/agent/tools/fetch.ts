import { definition, string, type NativeTool } from "./shared.ts";

const stringMap = { type: "object", additionalProperties: { type: "string" } };
export const httpFetch: NativeTool = {
  definition: definition("fetch", "Native Bun HTTP request to any http/https URL with method, headers and optional JSON, URL-encoded form, multipart form or text body. Returns status, headers and complete text body; HTTP errors fail the tool. Does not render JavaScript: use scrape for rendered website content and summaries. Use this instead of curl/wget for HTTP requests.",
    { url: string, method: string, headers: stringMap, body: {}, bodyType: { type: "string", enum: ["json", "form", "multipart", "text"] } }, ["url"]),
  async run(args, { signal }) {
    const url = new URL(String(args.url));
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("fetch requiere una URL http/https");
    const method = String(args.method ?? "GET").toUpperCase(), headers = new Headers(args.headers as Record<string, string> | undefined);
    let body: string | URLSearchParams | FormData | undefined;
    if ("body" in args) {
      if (method === "GET" || method === "HEAD") throw new Error(`${method} no admite body`);
      const type = args.bodyType ?? "json";
      if (type === "json") { body = JSON.stringify(args.body); if (!headers.has("content-type")) headers.set("content-type", "application/json"); }
      else if (type === "text") { if (typeof args.body !== "string") throw new Error("body text debe ser string"); body = args.body; }
      else {
        if (!args.body || typeof args.body !== "object" || Array.isArray(args.body) || Object.values(args.body).some(v => typeof v !== "string")) throw new Error("body form/multipart debe ser un objeto de campos string");
        const fields = args.body as Record<string, string>;
        if (type === "form") body = new URLSearchParams(fields);
        else { const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.append(key, value); body = form; headers.delete("content-type"); }
      }
    }
    const controller = new AbortController(), relay = () => controller.abort(signal.reason);
    signal.addEventListener("abort", relay, { once: true }); if (signal.aborted) relay();
    let reader: { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> } | undefined;
    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });
      reader = response.body?.getReader(); const decoder = new TextDecoder(); let text = "";
      while (reader) {
        const chunk = await reader.read(); if (chunk.done || !chunk.value) { text += decoder.decode(); break; }
        text += decoder.decode(chunk.value, { stream: true });
      }
      controller.signal.throwIfAborted();
      return { output: JSON.stringify({ url: response.url, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers), body: text, truncated: false }), failed: !response.ok, truncated: false };
    } catch (error) { if (controller.signal.aborted) throw controller.signal.reason; throw error; }
    finally { signal.removeEventListener("abort", relay); await reader?.cancel().catch(() => {}); }
  },
};
