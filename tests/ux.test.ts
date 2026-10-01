import { expect, test } from "bun:test";
import { Canvas } from "../src/ui/canvas.ts";
import { Input } from "../src/ui/components/input.ts";
import { MenuBar } from "../src/ui/components/menu.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { createDemo } from "../src/ui/demo.ts";
import { theme } from "../src/ui/theme.ts";
import type { Desktop } from "../src/ui/desktop.ts";
import type { InputEvent } from "../src/ui/types.ts";

const key = (key: string, text?: string): InputEvent => ({ type: "key", key, ...(text ? { text } : {}) });
const mouse = (x: number, y: number, action: "press" | "release" | "move" = "press", button = 0): InputEvent =>
  ({ type: "mouse", x, y, action, button, delta: 0 });
const screen = (desktop: Desktop) => desktop.draw().lines().join("\n");

test("volver a Componentes conserva texto, selección y foco", () => {
  const desktop = createDemo(); const window = desktop.active!;
  desktop.handle({ type: "paste", text: " · proyecto" });
  desktop.handle(key("tab")); desktop.handle(key("down"));
  const input = window.controls[0] as Input;
  const value = input.value;
  desktop.handle(key("escape")); desktop.handle(key("right")); desktop.handle(key("enter"));
  expect(desktop.active).toBe(window); expect(input.value).toBe(value);
  expect(window.focusedId).toBe("list"); expect((window.controls[1] as SelectList).selected).toBe(1);
});

test("layout 60×16 muestra tres filas de lista y estado separado de botones", () => {
  const desktop = createDemo(); desktop.resize(60, 16); desktop.draw();
  const window = desktop.active!; const list = window.controls[1] as SelectList;
  expect(list.bounds.height - 2).toBeGreaterThanOrEqual(3);
  for (const button of window.controls.slice(2)) expect(button.bounds.y).toBeLessThan(window.client.height - 2);
  expect(screen(desktop)).toContain("Botones y estados");
  expect(screen(desktop)).toContain("Inputs con Unicode");
});

test("Ctrl+A y Shift+flechas permiten reemplazar selección sin romper Unicode", () => {
  const input = new Input("edit", { x: 0, y: 0, width: 20, height: 1 }, "original");
  input.handle(key("ctrl+a")); input.handle({ type: "paste", text: "á文🙂" }); expect(input.value).toBe("á文🙂");
  input.handle(key("shift+left")); input.handle(key("backspace")); expect(input.value).toBe("á文");
  input.handle(key("home")); input.handle(key("shift+end")); input.handle(key("delete")); expect(input.value).toBe("");
});

test("selección arrastrando el mouse reemplaza grafemas completos", () => {
  const input = new Input("edit", { x: 0, y: 0, width: 12, height: 1 }, "á文🙂z");
  input.handle(mouse(0, 0)); input.handle(mouse(3, 0, "move"));
  const canvas = new Canvas(12, 1); input.draw(canvas, input.bounds, true);
  expect(canvas.cells[0]![1]!.style).toBe(theme.selected);
  input.handle(mouse(3, 0, "release")); input.handle(key("X", "X")); expect(input.value).toBe("X🙂z");
});

test("al ensanchar un input vuelve a mostrar el contexto que cabe", () => {
  const input = new Input("edit", { x: 0, y: 0, width: 8, height: 1 }, "abcdefghi");
  input.draw(new Canvas(8, 1), input.bounds, true); input.bounds.width = 14;
  const canvas = new Canvas(14, 1); input.draw(canvas, input.bounds, true);
  expect(canvas.lines()[0]).toContain("abcdefghi");
});

test("menú permite mantener, arrastrar y soltar; hover cambia la opción", () => {
  const calls: string[] = [];
  const menu = new MenuBar([{ label: "Archivo", items: [
    { label: "Abrir", run: () => calls.push("open") }, { label: "No", disabled: true, run: () => calls.push("no") },
    { label: "Cerrar", run: () => calls.push("close") },
  ] }]);
  menu.handle(mouse(3, 0)); menu.handle(mouse(4, 4, "move")); menu.handle(mouse(4, 4, "release"));
  expect(calls).toEqual(["close"]);
  menu.handle(key("escape")); menu.handle(mouse(4, 4, "move", 3)); menu.handle(key("enter")); expect(calls).toEqual(["close", "close"]);
  menu.handle(key("escape")); menu.handle(mouse(4, 3)); menu.handle(mouse(4, 3, "release")); expect(calls).toEqual(["close", "close"]);
});

test("botón y cierre muestran cancelación al arrastrar afuera", () => {
  const desktop = createDemo(); const window = desktop.active!;
  const button = window.controlRect(window.controls[2]!);
  desktop.handle(mouse(button.x + 2, button.y)); expect(desktop.draw().cells[button.y]![button.x]!.style).toBe(theme.selected);
  desktop.handle(mouse(0, 22, "move")); expect(desktop.draw().cells[button.y]![button.x]!.style).toBe(theme.focused);
  desktop.handle(mouse(button.x + 2, button.y, "move")); expect(desktop.draw().cells[button.y]![button.x]!.style).toBe(theme.selected);
  desktop.handle(mouse(button.x + 2, button.y, "release")); expect(desktop.status).toContain("Aceptar (1)");
  const close = window.closeRect;
  desktop.handle(mouse(close.x, close.y)); desktop.handle(mouse(0, 22, "move")); expect(window.closePressed).toBe(false);
  desktop.handle(mouse(close.x, close.y, "move")); desktop.handle(mouse(close.x, close.y, "release")); expect(desktop.windows).toHaveLength(0);
});

test("diálogo abre centrado y la ayuda funciona con un menú abierto", () => {
  const desktop = createDemo(); desktop.resize(120, 40);
  desktop.handle(key("escape")); desktop.handle(key("alt+y"));
  expect(desktop.modal).toBeDefined();
  expect(desktop.modal!.bounds.x).toBe(36); expect(desktop.modal!.bounds.y).toBe(15);
  expect(screen(desktop)).toContain("Esc Cerrar");
});

test("PageUp/Down recorren la lista sin seleccionar su marco", () => {
  const list = new SelectList("list", { x: 0, y: 0, width: 12, height: 5 }, ["uno", "dos", "tres", "cuatro", "cinco", "seis"]);
  list.handle(key("pagedown")); expect(list.selected).toBe(3);
  const canvas = new Canvas(12, 5); list.draw(canvas, list.bounds, true);
  expect(canvas.lines()[1]).toContain("cuatro"); expect(canvas.lines()[0]).toContain("↑");
  list.handle(mouse(0, 1)); expect(list.selected).toBe(3);
  list.handle(key("pageup")); expect(list.selected).toBe(0);
});

test("escritorio vacío queda detrás del desplegable y permite recuperar Componentes", () => {
  const desktop = createDemo(); desktop.close(); desktop.handle(key("alt+d"));
  const canvas = desktop.draw(); const line = canvas.lines()[3]!;
  const label = "Agente LLM (próxima fase)"; const start = line.indexOf(label);
  expect(start).toBeGreaterThanOrEqual(0);
  for (let x = start; x < start + Bun.stringWidth(label); x++) expect(canvas.cells[3]![x]!.style).toBe(theme.disabled);
  desktop.handle(key("left")); desktop.handle(key("enter"));
  expect(desktop.active?.id).toBe("components"); expect(screen(desktop)).toContain("Laboratorio TUI");
});

test("Escape, Ctrl+N y Alt+Y funcionan sin asignar acciones a teclas F", () => {
  const desktop = createDemo(); const first = desktop.active!;
  desktop.handle(key("escape")); expect(desktop.menu.opened).toBe(0);
  desktop.handle(key("escape")); expect(desktop.menu.opened).toBe(-1);
  desktop.handle(key("alt+v")); desktop.handle(key("down")); desktop.handle(key("enter"));
  const second = desktop.active!; expect(second).not.toBe(first);
  for (let number = 1; number <= 12; number++) desktop.handle(key(`f${number}`));
  expect(desktop.active).toBe(second); expect(desktop.menu.opened).toBe(-1); expect(desktop.modal).toBeUndefined();
  desktop.handle(key("escape")); desktop.handle(key("ctrl+n"));
  expect(desktop.active).toBe(first); expect(desktop.menu.opened).toBe(-1);
  desktop.handle(key("alt+y")); expect(desktop.modal?.title).toBe("Ayuda");
  desktop.handle(key("escape")); expect(desktop.active).toBe(first);
});
