import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import { ProjectWebServers } from "../src/system/webserver.ts";
import { Input } from "../src/ui/components/input.ts";
import { Button } from "../src/ui/components/button.ts";

async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout en WebServer");
}
async function freePort() {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = server.port!; await server.stop(true); return port;
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-webserver-")), config = join(root, "config.json"), value = defaultConfig();
  for (const id of ["alpha", "beta"]) {
    const path = join(root, id); await mkdir(path); value.projects.push({ id, name: id, path });
    await Bun.write(join(path, "index.html"), `<h1>${id}</h1><link rel="stylesheet" href="style.css"><script src="app.js"></script>`);
  }
  value.lastProjectId = "alpha"; await Bun.write(config, JSON.stringify(value));
  return { root, config, value };
}
const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
const screen = (app: App) => app.desktop.draw().lines().join("\n");

test("Bun WebServer sirve HTML/assets/HEAD/range, carpetas y cambios sin salir del document root", async () => {
  const { root, value } = await fixture(), folder = value.projects[0]!.path, servers = new ProjectWebServers();
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  await Bun.write(join(folder, "style.css"), "body { color: green; }"); await Bun.write(join(folder, "app.js"), "window.loaded = true;");
  await Bun.write(join(folder, "image.png"), bytes); await mkdir(join(folder, "list &"));
  await Bun.write(join(folder, "list &", "á & #.html"), "special file"); await mkdir(join(folder, "nested"));
  await Bun.write(join(folder, "nested", "index.html"), "nested index"); await Bun.write(join(root, "outside.txt"), "outside root");
  await symlink(join(root, "outside.txt"), join(folder, "outside-link.txt"));
  try {
    const server = await servers.start("alpha", folder, await freePort()), url = server.url;
    const html = await fetch(url); expect(html.status).toBe(200); expect(html.headers.get("content-type")).toContain("text/html");
    expect(html.headers.get("cache-control")).toBe("no-store"); expect(await html.text()).toContain("<h1>alpha</h1>");
    for (const [name, mime, text] of [["style.css", "text/css", "color: green"], ["app.js", "javascript", "window.loaded"]]) {
      const response = await fetch(url + name); expect(response.headers.get("content-type")).toContain(mime!); expect(await response.text()).toContain(text!);
    }
    const image = await fetch(url + "image.png"); expect(image.headers.get("content-type")).toContain("image/png"); expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    const head = await fetch(url, { method: "HEAD" }); expect(head.status).toBe(200); expect(head.headers.get("content-type")).toContain("text/html"); expect(await head.text()).toBe("");
    const range = await fetch(url + "image.png", { headers: { Range: "bytes=1-3" } }); expect(range.status).toBe(206); expect(new Uint8Array(await range.arrayBuffer())).toEqual(bytes.slice(1, 4));
    const redirect = await fetch(url + "nested?test=1", { redirect: "manual" }); expect(redirect.status).toBe(308); expect(redirect.headers.get("location")).toBe(url + "nested/?test=1");
    expect(await (await fetch(url + "nested/")).text()).toBe("nested index");
    const listing = await (await fetch(url + "list%20%26/")).text(); expect(listing).toContain("á &amp; #.html"); expect(listing).toContain('href="../"');
    const href = listing.match(/href="([^"]*%C3%A1[^"]*)"/)![1]!; expect(await (await fetch(new URL(href, url))).text()).toBe("special file");
    await Bun.write(join(folder, "style.css"), "body { color: red; }"); expect(await (await fetch(url + "style.css")).text()).toContain("color: red");
    for (const path of ["missing", "outside-link.txt", "%2e%2e%2foutside.txt", "%", "%00"]) expect((await fetch(url + path)).status).toBe(path === "%" || path === "%00" ? 400 : 404);
    const post = await fetch(url, { method: "POST", body: "x" }); expect(post.status).toBe(405); expect(post.headers.get("allow")).toBe("GET, HEAD");
    const encoded = servers.url("alpha", join(folder, "list &", "á & #.html")); expect(await (await fetch(encoded)).text()).toBe("special file");
    expect(servers.url("alpha", join(root, "outside.txt"))).toBe(url);
    await servers.close(); await expect(fetch(url)).rejects.toThrow();
  } finally { await servers.close(); await rm(root, { recursive: true, force: true }); }
});

test("servidores por proyecto: colisión no pierde el anterior, cambio de puerto y cierre liberan recursos", async () => {
  const { root, value } = await fixture(), servers = new ProjectWebServers();
  const occupied = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("occupied") });
  try {
    for (const port of [0, -1, 65536, 1.5, NaN]) await expect(servers.start("alpha", value.projects[0]!.path, port)).rejects.toThrow("Puerto inválido");
    const alpha = await servers.start("alpha", value.projects[0]!.path, await freePort());
    const beta = await servers.start("beta", value.projects[1]!.path, await freePort());
    expect(await (await fetch(alpha.url)).text()).toContain("alpha"); expect(await (await fetch(beta.url)).text()).toContain("beta");
    expect(await servers.start("alpha", value.projects[0]!.path, alpha.server.port!)).toBe(alpha);
    await expect(servers.start("alpha", value.projects[0]!.path, occupied.port!)).rejects.toThrow("No se pudo iniciar WebServer");
    expect(servers.get("alpha")).toBe(alpha); expect(await (await fetch(alpha.url)).text()).toContain("alpha");
    const moved = await servers.start("alpha", value.projects[0]!.path, await freePort());
    await expect(fetch(alpha.url)).rejects.toThrow(); expect(await (await fetch(moved.url)).text()).toContain("alpha");
    await servers.stop("alpha"); expect(servers.get("alpha")).toBeUndefined(); await expect(fetch(moved.url)).rejects.toThrow();
    expect(await (await fetch(beta.url)).text()).toContain("beta"); await servers.close(); await expect(fetch(beta.url)).rejects.toThrow();
  } finally { await servers.close(); await occupied.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("Tools → WebServer: puerto, preview del archivo, errores, ES/EN, resize y ciclo de proyectos", async () => {
  const { root, config, value } = await fixture(), app = await App.open({ config }); const opened: string[] = []; let closed = false;
  app.webservers.open = async (id, file) => { opened.push(app.webservers.url(id, file)); };
  const press = (id: string) => (app.desktop.modal!.controls.find(control => control.id === id) as Button).onClick();
  const input = () => app.desktop.modal!.controls.find(control => control.id === "port") as Input;
  try {
    app.desktop.resize(100, 32); app.view.prompt.setValue("borrador á文🙂");
    const file = join(value.projects[0]!.path, "preview &.html"); await Bun.write(file, "preview alpha"); await app.openFile(file);
    key(app, "alt+o"); key(app, "enter"); expect(app.desktop.modal!.title).toBe("WebServer"); expect(input().value).toBe("3000");
    expect(screen(app)).toContain("< Iniciar >"); expect(screen(app)).toContain("alpha");
    input().setValue("abc"); key(app, "enter"); await until(() => screen(app).includes("Puerto inválido") && !input().disabled); expect(app.webservers.get("alpha")).toBeUndefined();
    const port = await freePort(); input().setValue(String(port)); key(app, "enter"); await until(() => opened.length === 1 && screen(app).includes("WebServer iniciado"));
    expect(opened[0]).toBe(`http://127.0.0.1:${port}/preview%20%26.html`); expect(await (await fetch(opened[0]!)).text()).toBe("preview alpha");
    const conflict = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    try { input().setValue(String(conflict.port)); press("start"); await until(() => screen(app).includes("No se pudo iniciar") && !input().disabled); expect(app.webservers.get("alpha")!.server.port).toBe(port); }
    finally { await conflict.stop(true); }
    input().setValue(String(port)); await app.setLanguage("en");
    for (const [width, height] of [[100, 32], [60, 16]] as const) {
      app.desktop.resize(width, height); const modal = app.desktop.modal!, canvas = app.desktop.draw();
      expect(modal.bounds.y + modal.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);
      expect(canvas.lines().join("\n")).toContain("Port"); expect(canvas.lines().join("\n")).toContain("Open browser"); expect(canvas.lines().join("\n")).toContain("< Close >");
      expect(canvas.lines().join("\n")).toContain("Prompt"); expect(canvas.lines().join("\n")).toContain("borrador");
      const buttons = modal.controls.filter(control => control instanceof Button);
      for (let i = 1; i < buttons.length; i++) expect(buttons[i - 1]!.bounds.x + buttons[i - 1]!.bounds.width).toBeLessThan(buttons[i]!.bounds.x);
      for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(width);
    }
    press("open-browser"); await until(() => opened.length === 2); expect(opened[1]).toBe(opened[0]);
    key(app, "escape"); expect(app.view.editorWindow.title).toBe("preview &.html"); expect(app.view.prompt.value).toBe("borrador á文🙂");
    await app.closeTab(); expect(app.webservers.get("alpha")).toBeDefined();
    const alpha = app.tabs[0]!; await app.switchProject(app.store.value.projects[1]!); app.webServer(); input().setValue(String(await freePort())); press("start");
    await until(() => opened.length === 3); expect(opened[2]).toBe(app.webservers.get("beta")!.url);
    key(app, "escape"); await app.activateTab(alpha.id); app.webServer(); expect(input().value).toBe(String(port));
    press("stop"); await until(() => !app.webservers.get("alpha") && screen(app).includes("WebServer stopped"));
    expect(app.webservers.get("beta")).toBeDefined(); key(app, "escape");
    await app.webservers.start("alpha", value.projects[0]!.path, await freePort());
    const changed = join(root, "changed"); await mkdir(changed); await app.switchProject({ ...app.project!, path: changed });
    expect(app.webservers.get("alpha")).toBeUndefined();
    await app.webservers.start("alpha", changed, await freePort()); await app.closeTab(alpha.id); expect(app.webservers.get("alpha")).toBeUndefined();
    const betaUrl = app.webservers.get("beta")!.url; await app.desktop.onBeforeExit!(); closed = true; await expect(fetch(betaUrl)).rejects.toThrow();
  } finally { if (!closed) await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("fallo al abrir navegador queda visible y permite detener el servidor iniciado", async () => {
  const { root, config } = await fixture(), app = await App.open({ config });
  app.webservers.open = async () => { throw new Error("No se pudo abrir el navegador (1). fixture"); };
  try {
    app.desktop.resize(100, 32); app.webServer();
    (app.desktop.modal!.controls[0] as Input).setValue(String(await freePort())); key(app, "enter");
    await until(() => screen(app).includes("No se pudo abrir el navegador")); expect(app.webservers.get("alpha")).toBeDefined();
    expect((app.desktop.modal!.controls.find(control => control.id === "stop") as Button).disabled).toBe(false);
    expect(await (await fetch(app.webservers.get("alpha")!.url)).text()).toContain("alpha");
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});

test("index.ts PTY inicia WebServer desde Tools, abre URL por Bun Shell y lo cierra al salir", async () => {
  const { root, config, value } = await fixture(), bin = join(root, "bin"), outputFile = join(root, "opened.txt");
  await mkdir(bin); const opener = join(bin, "xdg-open");
  await Bun.write(opener, `#!${process.execPath}\nawait Bun.write(${JSON.stringify(outputFile)}, JSON.stringify(Bun.argv.slice(2)));\n`); await chmod(opener, 0o755);
  const port = await freePort(); let output = "";
  const terminal = new Bun.Terminal({ cols: 100, rows: 32, data: (_, bytes) => output += new TextDecoder().decode(bytes) });
  const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], {
    cwd: root, terminal, env: { ...process.env, TERM: "xterm-256color", PATH: bin + delimiter + process.env.PATH },
  });
  try {
    await until(() => output.includes("1:P:alpha")); terminal.write("borrador PTY\x1bo\r"); await until(() => output.includes("WebServer detenido"));
    terminal.write("\x01" + String(port) + "\r"); await until(() => output.includes("WebServer iniciado"));
    await until(() => output.includes(`http://127.0.0.1:${port}/`));
    const args = await Bun.file(outputFile).json(); expect(args).toEqual([`http://127.0.0.1:${port}/`]);
    expect(await (await fetch(args[0])).text()).toContain("<h1>alpha</h1>");
    output = ""; terminal.resize(60, 16); child.kill("SIGWINCH"); await until(() => output.includes("WebServer iniciado"));
    expect(Bun.stripANSI(output)).toContain("Prompt"); expect(Bun.stripANSI(output)).toContain("borrador PTY");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?25h\x1b[?1049l");
    await expect(fetch(args[0])).rejects.toThrow(); expect((await Bun.file(config).json()).projects[0].path).toBe(value.projects[0]!.path);
  } catch (error) { throw new Error(`${(error as Error).message} · ${Bun.stripANSI(output.slice(-5000))}`); }
  finally { child.kill(); await child.exited; terminal.close(); await rm(root, { recursive: true, force: true }); }
}, 15000);
