import { basename } from "node:path";
import { Button } from "./components/button.ts";
import { MenuBar } from "./components/menu.ts";
import { TextArea } from "./components/text-area.ts";
import { Window } from "./components/window.ts";
import { createDemoPanels } from "./demo.ts";
import { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";

export interface ProjectContext { name: string; path: string }

export function createWorkspace(project: ProjectContext = { name: basename(process.cwd()) || process.cwd(), path: process.cwd() }): Desktop {
  const desktop = new Desktop(new MenuBar([]));
  const editorWindow = new Window("editor", project.name, { x: 0, y: 1, width: 80, height: 15 });
  const promptWindow = new Window("prompt", "Prompt", { x: 0, y: 16, width: 80, height: 7 });
  editorWindow.fixed = promptWindow.fixed = true;
  const editor = new TextArea("response", { x: 1, y: 0, width: 76, height: 13 });
  editor.placeholder = `La respuesta aparecerá en este editor.\n\n${project.path}\n\nEscribí tu prompt en el panel inferior.`;
  const prompt = new TextArea("draft", { x: 1, y: 0, width: 60, height: 4 });
  let submitted = false;

  const submit = () => {
    const text = prompt.value;
    if (!text.trim()) return;
    editor.setValue(`Respuesta de demostración · ${project.name}\n\nPrompt recibido:\n${text}\n\nLa respuesta del agente aparecerá en este editor.`, "start");
    prompt.setValue(""); submitted = true;
    desktop.focus(promptWindow); promptWindow.focusedId = prompt.id;
  };
  prompt.onSubmit = submit;
  const send = new Button("send", { x: 63, y: 0, width: 14, height: 1 }, "Enviar", submit);
  editorWindow.controls.push(editor); promptWindow.controls.push(prompt, send);
  editorWindow.onLayout = (client) => { editor.bounds.width = Math.max(1, client.width - 2); editor.bounds.height = Math.max(1, client.height); };
  promptWindow.onLayout = (client) => {
    prompt.bounds.width = Math.max(1, client.width - 18); prompt.bounds.height = Math.max(1, client.height - 1);
    send.bounds.x = Math.max(1, client.width - 15);
  };
  promptWindow.onDraw = (canvas, client) => canvas.text(client.x + 1, client.y + client.height - 1,
    `${submitted ? "Respuesta demo" : "Demo sin LLM"} · Enter enviar · Shift+Enter nueva línea`, theme.window, client.width - 2);

  desktop.onResize = (width, height) => {
    const available = Math.max(4, height - 2); const promptHeight = height >= 20 ? 7 : 4;
    const editorHeight = Math.max(2, available - promptHeight);
    Object.assign(editorWindow.bounds, { x: 0, y: 1, width, height: editorHeight });
    Object.assign(promptWindow.bounds, { x: 0, y: 1 + editorHeight, width, height: Math.max(2, available - editorHeight) });
    desktop.floatingArea = { ...editorWindow.bounds };
  };
  desktop.resize(desktop.width, desktop.height);
  desktop.add(editorWindow); desktop.add(promptWindow);
  const demo = createDemoPanels(desktop);
  const help = () => demo.dialog("Ayuda", [
    "Enter: enviar · Shift+Enter: nueva línea.", "Ctrl+N: cambiar entre paneles.", "Tab / Shift+Tab: foco · Esc: menú.",
    "Ctrl+A / Shift+flechas: seleccionar.", "Mouse: foco, scroll y selección.",
  ]);
  desktop.onHelp = help;
  desktop.menu.menus.push(
    { label: "Archivo", items: [{ label: "Salir", shortcut: "Ctrl+Q", run: () => desktop.onExit() }] },
    { label: "Ventanas", items: [
      { label: "Editor del proyecto", run: () => desktop.focus(editorWindow) },
      { label: "Prompt", run: () => desktop.focus(promptWindow) },
      { label: "Siguiente", shortcut: "Ctrl+N", run: () => desktop.cycle() },
      { label: "Cerrar auxiliar", shortcut: "Ctrl+W", run: () => desktop.close() },
    ] },
    { label: "Demo", items: [
      { label: "Componentes", run: demo.components }, { label: "Nueva ventana", run: demo.secondary },
      { label: "Diálogo modal", run: () => demo.dialog() },
    ] },
    { label: "Ayuda", hotkey: "y", align: "right", items: [{ label: "Atajos y mouse", shortcut: "Alt+Y", run: help }] },
  );
  return desktop;
}
