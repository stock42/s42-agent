import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

const publicDirectory = resolve(import.meta.dir, "public");

export function configuredPort(): number {
  const value = Bun.env.WEBSERVER_PORT ?? "4317";
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error("WEBSERVER_PORT debe ser un entero entre 1 y 65535.");
  }
  return Number(value);
}

export function startWebsite(options: { port?: number; hostname?: string } = {}) {
  return Bun.serve({
    port: options.port ?? configuredPort(),
    hostname: options.hostname ?? "0.0.0.0",
    async fetch(request) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
      }

      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response("Ruta inválida", { status: 400 });
      }

      // Only public files belong to the website; .env and source stay outside it.
      const target = resolve(publicDirectory, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!target.startsWith(publicDirectory + sep)) {
        return new Response("No encontrado", { status: 404 });
      }

      try {
        const actualPath = await realpath(target);
        if (!actualPath.startsWith(publicDirectory + sep)) {
          return new Response("No encontrado", { status: 404 });
        }
        const file = Bun.file(actualPath);
        if (!(await file.exists())) return new Response("No encontrado", { status: 404 });
        const headers = new Headers({
          "Content-Type": actualPath.endsWith(".xml") ? "application/xml; charset=utf-8" : file.type,
          "Content-Length": String(file.size),
          "Cache-Control": actualPath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
        });
        return new Response(request.method === "HEAD" ? null : file, { headers });
      } catch {
        return new Response("No encontrado", { status: 404 });
      }
    },
  });
}

if (import.meta.main) {
  const server = startWebsite();
  console.log(`S42 Agent website · http://localhost:${server.port}`);
  const stop = () => { server.stop(true); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
