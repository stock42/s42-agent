import { version } from "../../package.json";
import { Button } from "./components/button.ts";
import { TextArea } from "./components/text-area.ts";
import { Window } from "./components/window.ts";
import type { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";

export function showAbout(desktop: Desktop): void {
  if (desktop.modal) return;
  const area = desktop.floatingArea ?? { x: 0, y: 1, width: desktop.width, height: desktop.height - 2 };
  const width = 86, height = 28;
  const window = new Window("about", "About", {
    x: area.x + Math.max(0, (area.width - Math.min(width, area.width - 2)) >> 1),
    y: area.y + Math.max(0, (area.height - Math.min(height, area.height)) >> 1), width, height,
  });
  window.modal = true;
  const text = new TextArea("about-content", { x: 1, y: 1, width: width - 4, height: height - 4 });
  text.readOnly = true;
  text.setValue([
    "Powered by César Casas. · MIT.",
    "",
    desktop.t("La potencia de un agente de coding. El espíritu del viejo QBasic."),
    desktop.t("Un escritorio de texto con ventanas, menús, mouse y atajos Vim. Tu prompt siempre a mano."),
    "",
    desktop.t("Qué puede hacer por vos"),
    desktop.t("• Leer, crear y editar archivos; buscar nombres y contenido por todo el disco."),
    desktop.t("• Ejecutar comandos y hacer requests HTTP con JSON, formularios o texto."),
    desktop.t("• Separar proyectos en pestañas y guardar promptings con {{metavariables}}."),
    desktop.t("• Sumar tools con MCP y skills desde SKILL.md o el catálogo skills.sh."),
    "",
    desktop.t("Tu modelo, tu espacio de trabajo"),
    desktop.t("llama.cpp en local; DeepSeek y APIs compatibles. Vos elegís el modelo."),
    desktop.t("Streaming, tools a la vista y razonamiento opcional si tu proveedor lo ofrece."),
    "",
    desktop.t("100% Bun · Portable"),
    desktop.t("Binarios independientes para Windows, Linux y macOS."),
    desktop.t("Se ejecutan sin instalar Bun ni Node.js."),
    desktop.t("Simple, rápido y open source. Nostalgia QBasic para el coding de hoy."),
    "",
    "LinkedIn: https://www.linkedin.com/in/cesarcasas/",
  ].join("\n"), "start");
  const close = new Button("close", { x: 1, y: 0, width: 12, height: 1 }, "Cerrar", () => desktop.close(window));
  const handle = text.handle.bind(text);
  text.handle = event => event.type === "key" && event.key === "enter" ? (desktop.close(window), true) : handle(event);
  window.controls.push(text, close);
  window.onLayout = client => {
    text.bounds.y = client.height >= 9 ? 2 : 1;
    text.bounds.width = client.width - 2;
    text.bounds.height = Math.max(1, client.height - text.bounds.y - 2);
    close.bounds.x = client.width - close.bounds.width - 1;
    close.bounds.y = client.height - 1;
  };
  window.onDraw = (canvas, client) => {
    const versionLabel = `Version: ${version}`;
    canvas.fill({ x: client.x + 1, y: client.y, width: client.width - 2, height: 1 }, theme.selected);
    canvas.text(client.x + 2, client.y, "S42 Agent.", theme.selected, client.width - Bun.stringWidth(versionLabel) - 5);
    canvas.text(client.x + client.width - Bun.stringWidth(versionLabel) - 2, client.y, versionLabel, theme.selected);
    canvas.text(client.x + 1, client.y + client.height - 1, desktop.t("↑/↓ · PgUp/PgDn · Esc cerrar"), theme.dialog, close.bounds.x - 2);
  };
  desktop.add(window);
}
