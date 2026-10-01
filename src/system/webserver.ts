import { $ } from "bun";
import { readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface ProjectServer {
  projectId: string;
  root: string;
  server: Bun.Server<undefined>;
  url: string;
}

const inside = (root: string, path: string) => {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(".." + sep) && !isAbsolute(part);
};
const headers = { "Cache-Control": "no-store" };

async function serveFile(request: Request, root: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  const url = new URL(request.url);
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return new Response("Bad Request", { status: 400 }); }
  if (pathname.includes("\0")) return new Response("Bad Request", { status: 400 });
  let path = resolve(root, "." + pathname);
  if (!inside(root, path)) return new Response("Not Found", { status: 404 });
  try {
    path = await realpath(path);
    if (!inside(root, path)) return new Response("Not Found", { status: 404 });
    const entry = await stat(path);
    if (entry.isFile()) return new Response(Bun.file(path), { headers });
    if (!entry.isDirectory()) return new Response("Not Found", { status: 404 });
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
      return Response.redirect(url.href, 308);
    }
    const index = resolve(path, "index.html");
    try {
      const target = await realpath(index);
      if (inside(root, target) && (await stat(target)).isFile())
        return new Response(Bun.file(target), { headers });
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
    const entries = (await readdir(path, { withFileTypes: true })).sort((a, b) =>
      Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    const links = entries.map(entry => {
      const name = entry.name + (entry.isDirectory() ? "/" : "");
      return `<li><a href="${Bun.escapeHTML(url.pathname + encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""))}">${Bun.escapeHTML(name)}</a></li>`;
    });
    if (path !== root) links.unshift('<li><a href="../">../</a></li>');
    const label = Bun.escapeHTML(pathname);
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>S42 Agent · ${label}</title><h1>${label}</h1><ul>${links.join("")}</ul><footer>S42 Agent · WebServer</footer></html>`,
      { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return new Response(code === "EACCES" || code === "EPERM" ? "Forbidden" : "Not Found",
      { status: code === "EACCES" || code === "EPERM" ? 403 : 404 });
  }
}

export async function openBrowser(url: string): Promise<void> {
  const result = await (process.platform === "darwin" ? $`open ${url}`
    : process.platform === "win32" ? $`cmd.exe /c start "" ${url}`
    : $`xdg-open ${url}`).quiet().nothrow();
  if (result.exitCode !== 0) throw new Error(`No se pudo abrir el navegador (${result.exitCode}). ${result.stderr.toString().trim()}`);
}

export class ProjectWebServers {
  private readonly servers = new Map<string, ProjectServer>();
  get(projectId: string): ProjectServer | undefined { return this.servers.get(projectId); }

  async start(projectId: string, folder: string, port: number): Promise<ProjectServer> {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Puerto inválido: usá un entero entre 1 y 65535");
    const root = await realpath(folder);
    if (!(await stat(root)).isDirectory()) throw new Error("El document root debe ser una carpeta");
    const current = this.get(projectId);
    if (current?.root === root && current.server.port === port) return current;
    if (current?.server.port === port) throw new Error("Detené el servidor antes de cambiar su document root");
    let server: Bun.Server<undefined>;
    try { server = Bun.serve({ hostname: "127.0.0.1", port, development: false, fetch: request => serveFile(request, root) }); }
    catch (error) {
      throw new Error(`No se pudo iniciar WebServer en el puerto ${port}: ${(error as Error).message}`);
    }
    const next = { projectId, root, server, url: `http://127.0.0.1:${server.port}/` };
    this.servers.set(projectId, next);
    await current?.server.stop(true);
    return next;
  }

  url(projectId: string, file?: string): string {
    const current = this.get(projectId);
    if (!current) throw new Error("WebServer no está iniciado");
    if (!file || !inside(current.root, resolve(file))) return current.url;
    const path = relative(current.root, resolve(file)).split(sep).map(encodeURIComponent).join("/");
    return new URL(path, current.url).href;
  }
  async open(projectId: string, file?: string): Promise<void> { await openBrowser(this.url(projectId, file)); }
  async stop(projectId: string): Promise<void> {
    const current = this.get(projectId);
    this.servers.delete(projectId);
    await current?.server.stop(true);
  }
  async close(): Promise<void> { await Promise.all([...this.servers.keys()].map(id => this.stop(id))); }
}
