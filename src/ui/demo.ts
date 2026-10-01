import { Button } from "./components/button.ts";
import { Input } from "./components/input.ts";
import { MenuBar } from "./components/menu.ts";
import { SelectList } from "./components/select-list.ts";
import { Window } from "./components/window.ts";
import { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";

export function createDemo(): Desktop {
  let serial = 0;
  let clicks = 0;
  const desktop = new Desktop(new MenuBar([
    { label: "Archivo", items: [{ label: "Salir", shortcut: "Ctrl+Q", run: () => desktop.onExit() }] },
    { label: "Ventanas", items: [
      { label: "Componentes", run: () => components() },
      { label: "Nueva ventana", run: () => secondary() },
      { label: "Siguiente", shortcut: "Ctrl+N", run: () => desktop.cycle() },
      { label: "Cerrar", shortcut: "Ctrl+W", run: () => desktop.close() },
    ] },
    { label: "Demo", items: [
      { label: "Diálogo modal", run: () => dialog() },
      { label: "Agente LLM (próxima fase)", disabled: true, run: () => {} },
    ] },
    { label: "Ayuda", hotkey: "y", items: [{ label: "Atajos y mouse", shortcut: "Alt+Y", run: () => help() }] },
  ]));

  function dialog(title = "Diálogo modal", lines = ["Este diálogo captura el foco.", "Puedes moverlo por su título.", "Enter, Escape o [X] para cerrar."]): void {
    if (desktop.modal) return;
    const window = new Window(`dialog-${++serial}`, title, {
      x: Math.floor((desktop.width - 48) / 2), y: Math.floor((desktop.height - 10) / 2), width: 48, height: 10,
    });
    window.modal = true;
    const close = new Button("ok", { x: 0, y: 0, width: 14, height: 1 }, "Aceptar", () => desktop.close(window));
    window.controls.push(close);
    window.onLayout = (client) => { close.bounds.x = Math.max(0, Math.floor((client.width - 14) / 2)); close.bounds.y = client.height - 2; };
    window.onDraw = (canvas, client) => {
      lines.forEach((line, index) => canvas.text(client.x + 2, client.y + index + 1, line, theme.dialog, client.width - 4));
    };
    desktop.add(window);
  }

  function help(): void {
    dialog("Ayuda", ["Mouse: clic, rueda y arrastre de título.", "Tab / Shift+Tab: cambiar foco.", "Esc o Alt+A/V/D: abrir menús.", "Ctrl+A / Shift+flechas: seleccionar.", "Ctrl+N: ventana · Ctrl+W: cerrar."]);
  }

  function secondary(): void {
    const window = new Window(`window-${++serial}`, `Ventana ${serial}`, { x: 24 + (serial % 3) * 2, y: 5 + serial % 3, width: 42, height: 10 });
    const close = new Button("close", { x: 2, y: 5, width: 14, height: 1 }, "Cerrar", () => desktop.close(window));
    window.controls.push(close);
    window.onLayout = (client) => { close.bounds.y = Math.max(0, client.height - 2); };
    window.onDraw = (canvas, client) => {
      ["Ventanas superpuestas, foco y cierre.", "Arrástrame desde la barra de título.", "Ctrl+N vuelve a la otra ventana."].forEach((line, index) =>
        canvas.text(client.x + 2, client.y + index + 1, line, theme.window, client.width - 4));
    };
    desktop.add(window);
  }

  function components(): void {
    const existing = desktop.windows.find((window) => window.id === "components");
    if (existing) { desktop.focus(existing); return; }
    const window = new Window("components", "s42-agent · Laboratorio TUI", { x: 5, y: 2, width: 70, height: 19 });
    const input = new Input("name", { x: 2, y: 4, width: 40, height: 1 }, "s42-agent", (value) => { desktop.status = `Nombre: ${value}`; });
    const list = new SelectList("list", { x: 2, y: 7, width: 34, height: 6 },
      ["Ventanas con título y cierre", "Botones y estados", "Inputs con Unicode: á 文 🙂", "Listas y rueda de mouse", "Menús desplegables", "Diálogos modales", "Foco por mouse y teclado", "Render por filas modificadas"],
      (item) => { desktop.status = `Selección: ${item}`; });
    const accept = new Button("accept", { x: 0, y: 0, width: 14, height: 1 }, "Aceptar", () => {
      desktop.status = `Aceptar (${++clicks}): ${input.value}`;
    });
    const open = new Button("window", { x: 0, y: 0, width: 14, height: 1 }, "Ventana", secondary);
    const modal = new Button("dialog", { x: 0, y: 0, width: 14, height: 1 }, "Diálogo", () => dialog());
    const disabled = new Button("disabled", { x: 0, y: 0, width: 14, height: 1 }, "Inactivo", () => {});
    disabled.disabled = true;
    window.controls.push(input, list, accept, open, modal, disabled);
    window.onLayout = (client) => {
      const compact = client.height < 14;
      input.bounds.y = compact ? 3 : 4;
      input.bounds.width = Math.min(40, client.width - 4);
      list.bounds.width = Math.max(16, client.width - 23);
      list.bounds.y = compact ? 5 : 7;
      list.bounds.height = Math.max(3, Math.min(6, client.height - list.bounds.y - 2));
      const buttonX = Math.max(2, client.width - 17);
      [accept, open, modal, disabled].forEach((button, index) => { button.bounds.x = buttonX; button.bounds.y = list.bounds.y + index; });
    };
    window.onDraw = (canvas, client) => {
      const label = (x: number, y: number, text: string) => canvas.text(client.x + x, client.y + y, text, theme.window, client.width - x - 1);
      label(2, client.height < 14 ? 0 : 1, "Un escritorio clásico, hecho con celdas de terminal.");
      label(2, input.bounds.y - 1, "Nombre");
      label(2, list.bounds.y - 1, "Componentes · ↑/↓ o rueda");
      label(2, client.height - 2, desktop.status);
    };
    desktop.add(window);
  }

  desktop.onHelp = help;
  components();
  return desktop;
}
