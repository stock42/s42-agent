import type { Project } from "../storage/config.ts";
import type { ProjectWebServers } from "../system/webserver.ts";
import { Button } from "./components/button.ts";
import { Input } from "./components/input.ts";
import { Window } from "./components/window.ts";
import type { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";

export function showWebServer(desktop: Desktop, project: Project, servers: ProjectWebServers,
  change: (work: () => Promise<void>) => Promise<void>, file?: string): void {
  if (desktop.modal) return;
  const area = desktop.floatingArea ?? { y: 1, height: desktop.height - 2 };
  const height = Math.min(11, area.height), width = Math.min(72, desktop.width);
  const window = new Window("webserver", "WebServer", { x: Math.max(0, (desktop.width - width) >> 1),
    y: area.y + Math.max(0, (area.height - height) >> 1), width, height });
  window.modal = true;
  const port = new Input("port", { x: 10, y: 2, width: 7, height: 1 }, String(servers.get(project.id)?.server.port ?? 3000));
  let message = "", pending = false;
  const act = (work: () => Promise<void>) => {
    if (pending) return;
    const focus = window.focusedId;
    pending = true; message = ""; refresh();
    void change(work).catch(error => { message = (error as Error).message; }).finally(() => {
      pending = false; refresh(); window.focusedId = focus;
    });
  };
  const start = new Button("start", { x: 1, y: 0, width: 13, height: 1 }, "Iniciar", () => act(async () => {
    const value = port.value.trim();
    if (!/^\d+$/.test(value)) throw new Error("Puerto inválido: usá un entero entre 1 y 65535");
    const server = await servers.start(project.id, project.path, Number(value));
    port.setValue(String(server.server.port));
    await servers.open(project.id, file);
  }));
  const stop = new Button("stop", { x: 14, y: 0, width: 13, height: 1 }, "Detener", () => act(() => servers.stop(project.id)));
  const open = new Button("open-browser", { x: 27, y: 0, width: 20, height: 1 }, "Abrir navegador", () => act(() => servers.open(project.id, file)));
  const close = new Button("close", { x: 48, y: 0, width: 10, height: 1 }, "Cerrar", () => desktop.close(window));
  const refresh = () => {
    const running = Boolean(servers.get(project.id));
    port.disabled = pending; start.disabled = pending; stop.disabled = pending || !running; open.disabled = pending || !running;
    start.label = running ? "Aplicar" : "Iniciar";
    desktop.invalidate();
  };
  const handle = port.handle.bind(port);
  port.handle = event => event.type === "key" && event.key === "enter" ? (start.onClick(), true) : handle(event);
  window.controls.push(port, start, stop, open, close);
  for (const button of [start, stop, open, close]) button.translate = desktop.t;
  window.onLayout = client => {
    start.bounds.width = stop.bounds.width = client.width < 64 ? 11 : 13;
    stop.bounds.x = start.bounds.x + start.bounds.width + 1;
    open.bounds.x = stop.bounds.x + stop.bounds.width + 1;
    open.bounds.width = 19;
    for (const button of [start, stop, open, close]) button.bounds.y = client.height - 1;
    close.bounds.x = client.width - close.bounds.width - 1;
  };
  window.onDraw = (canvas, client) => {
    const current = servers.get(project.id);
    canvas.text(client.x + 1, client.y, project.name, theme.dialog, client.width - 2);
    canvas.text(client.x + 1, client.y + 1, project.path, theme.dialog, client.width - 2);
    canvas.text(client.x + 1, client.y + 2, desktop.t("Puerto"), theme.dialog, 8);
    canvas.text(client.x + 20, client.y + 2, desktop.t(current ? "WebServer iniciado" : "WebServer detenido"), theme.dialog, client.width - 21);
    const notice = pending ? "Abriendo…" : message;
    if (current && (client.height > 5 || !notice)) canvas.text(client.x + 1, client.y + 3, servers.url(project.id, file), theme.dialog, client.width - 2);
    if (notice) canvas.text(client.x + 1, client.y + client.height - 2, desktop.t(notice), theme.dialog, client.width - 2);
  };
  refresh(); desktop.add(window);
}
