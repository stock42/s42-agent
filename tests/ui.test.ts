import { describe, expect, test } from "bun:test";
import { Canvas, Renderer } from "../src/ui/canvas.ts";
import { Button } from "../src/ui/components/button.ts";
import { Input } from "../src/ui/components/input.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { MenuBar } from "../src/ui/components/menu.ts";
import { Window } from "../src/ui/components/window.ts";
import { Desktop } from "../src/ui/desktop.ts";
import { createDemo } from "../src/ui/demo.ts";
import { theme } from "../src/ui/theme.ts";
import type { InputEvent } from "../src/ui/types.ts";

function mouse(desktop: Desktop, x: number, y: number, action: "press" | "release" | "move" | "wheel" = "press", delta = 0): void {
  desktop.handle({ type: "mouse", action, x, y, button: 0, delta });
}
function click(desktop: Desktop, x: number, y: number): void { mouse(desktop, x, y); mouse(desktop, x, y, "release"); }
function key(desktop: Desktop, key: string): void { desktop.handle({ type: "key", key }); }
function fixture(): { desktop: Desktop; window: Window; calls: string[] } {
  const desktop = new Desktop(new MenuBar([]));
  const window = new Window("base", "Base", { x: 3, y: 2, width: 32, height: 12 });
  const calls: string[] = [];
  const button = new Button("button", { x: 1, y: 2, width: 12, height: 1 }, "Click", () => calls.push("click"));
  const input = new Input("input", { x: 1, y: 4, width: 16, height: 1 });
  const disabled = new Button("disabled", { x: 1, y: 6, width: 12, height: 1 }, "No", () => calls.push("disabled"));
  disabled.disabled = true;
  window.controls.push(button, input, disabled); desktop.add(window);
  return { desktop, window, calls };
}

describe("interacciones de escritorio", () => {
  test("botón activa una vez al soltar dentro, cancela fuera y omite deshabilitados", () => {
    const { desktop, window, calls } = fixture();
    mouse(desktop, 6, 5); expect(calls).toEqual([]);
    expect(desktop.draw().lines().join("\n")).toContain("[+Click+]");
    expect(desktop.draw().lines().join("\n")).toContain("[-No-]");
    mouse(desktop, 6, 5, "release"); mouse(desktop, 6, 5, "release"); expect(calls).toEqual(["click"]);
    mouse(desktop, 6, 5); mouse(desktop, 70, 20, "release"); expect(calls).toEqual(["click"]);
    click(desktop, 6, 9); expect(calls).toEqual(["click"]);
    key(desktop, "tab"); expect(window.focusedId).toBe("input");
    key(desktop, "tab"); expect(window.focusedId).toBe("button");
    key(desktop, "shift+tab"); expect(window.focusedId).toBe("input");
  });

  test("capas bloquean controles tapados; arrastre y cierre conservan captura", () => {
    const { desktop, window, calls } = fixture();
    const overlay = new Window("overlay", "Encima", { x: 4, y: 4, width: 22, height: 8 }); desktop.add(overlay);
    click(desktop, 6, 5); expect(calls).toEqual([]); expect(desktop.active).toBe(overlay);
    mouse(desktop, 7, 4); mouse(desktop, 17, 8, "move"); mouse(desktop, 17, 8, "release");
    expect(overlay.bounds.x).toBe(14); expect(overlay.bounds.y).toBe(8);
    click(desktop, 6, 5); expect(desktop.active).toBe(window); expect(calls).toEqual(["click"]);
    mouse(desktop, window.closeRect.x, window.closeRect.y);
    mouse(desktop, 79, 23, "release"); expect(desktop.windows).toContain(window);
    click(desktop, window.closeRect.x, window.closeRect.y); expect(desktop.windows).not.toContain(window);
  });

  test("modal bloquea ventanas y menú y restaura foco previo al cerrar", () => {
    const { desktop, window, calls } = fixture();
    mouse(desktop, 6, 5);
    key(desktop, "tab");
    const modal = new Window("modal", "Modal", { x: 40, y: 6, width: 24, height: 8 }); modal.modal = true;
    modal.controls.push(new Button("ok", { x: 1, y: 1, width: 10, height: 1 }, "OK", () => desktop.close(modal)));
    desktop.add(modal);
    mouse(desktop, 6, 5, "release");
    click(desktop, 6, 5); key(desktop, "f10"); expect(calls).toEqual([]); expect(desktop.active).toBe(modal);
    expect(desktop.menu.opened).toBe(-1);
    key(desktop, "enter"); expect(desktop.active).toBe(window); expect(window.focusedId).toBe("input");
  });

  test("menú por mouse y teclado, Escape, clic fuera y opción deshabilitada", () => {
    const calls: string[] = [];
    const menu = new MenuBar([{ label: "Archivo", items: [
      { label: "Abrir", run: () => calls.push("open") }, { label: "No", disabled: true, run: () => calls.push("no") },
      { label: "Cerrar", run: () => calls.push("close") },
    ] }]);
    const desktop = new Desktop(menu);
    click(desktop, 3, 0); click(desktop, 4, 3); expect(calls).toEqual([]);
    click(desktop, 4, 2); expect(calls).toEqual(["open"]); expect(menu.opened).toBe(-1);
    key(desktop, "f10"); key(desktop, "down"); key(desktop, "enter"); expect(calls).toEqual(["open", "close"]);
    key(desktop, "f10"); key(desktop, "escape"); expect(menu.opened).toBe(-1);
    key(desktop, "alt+a"); click(desktop, 60, 10); expect(menu.opened).toBe(-1);
  });

  test("input edita por grafemas y paste conserva texto sin ejecutar comandos", () => {
    const { desktop, window } = fixture(); key(desktop, "tab");
    desktop.handle({ type: "paste", text: "áé文🙂\n\x03" });
    const input = window.controls[1] as Input;
    expect(input.value).toBe("áé文🙂  ");
    key(desktop, "backspace"); key(desktop, "backspace"); key(desktop, "backspace");
    expect(input.value).toBe("áé文"); key(desktop, "left"); key(desktop, "backspace"); expect(input.value).toBe("á文");
    key(desktop, "home"); key(desktop, "delete"); expect(input.value).toBe("文");
  });

  test("rueda desplaza la lista bajo el mouse sin cambiar el foco", () => {
    const { desktop, window } = fixture();
    const list = new SelectList("list", { x: 18, y: 2, width: 10, height: 5 }, ["uno", "dos", "tres", "cuatro", "cinco"]);
    window.controls.push(list);
    mouse(desktop, 24, 7, "wheel", 1); mouse(desktop, 24, 7, "wheel", 1);
    expect(window.focusedId).toBe("button");
    expect(desktop.draw().lines().join("\n")).toContain("cuatro");
    click(desktop, 24, 6); expect(list.selected).toBe(2);
    key(desktop, "down"); expect(list.selected).toBe(3);
  });
});

describe("render y composición", () => {
  test("Unicode ancho, capas parciales y clipping mantienen el ancho de cada fila", () => {
    const canvas = new Canvas(12, 4); canvas.text(0, 0, "á文🙂", theme.window);
    canvas.clipped({ x: 3, y: 0, width: 1, height: 1 }, () => canvas.text(3, 0, "X", theme.title));
    canvas.clipped({ x: 10, y: 1, width: 1, height: 1 }, () => canvas.text(10, 1, "文", theme.window));
    expect(canvas.lines()[1]!.trim()).toBe("");
    for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(12);
    expect(canvas.lines()[0]).toContain("X");
  });

  test("idle no emite bytes; un cambio solo repinta la fila afectada", () => {
    const renderer = new Renderer(); const canvas = new Canvas(12, 4);
    expect(renderer.frame(canvas)).toContain("\x1b[2J"); expect(renderer.frame(canvas)).toBe("");
    canvas.text(2, 2, "X", theme.title);
    const update = renderer.frame(canvas);
    expect(update).toContain("\x1b[3;1H"); expect(update).not.toContain("\x1b[1;1H"); expect(update).not.toContain("\x1b[2J");
    expect(new Renderer().frame(canvas, false)).not.toMatch(/\x1b\[(?:3\d|4\d|9\d|10\d)[;\dm]/);
    canvas.text(4, 1, "x", theme.focused);
    expect(new Renderer().frame(canvas, false)).toContain("\x1b[7m");
  });

  test("cursor sobre un carácter ancho al borde sigue visible", () => {
    const input = new Input("unicode", { x: 0, y: 0, width: 8, height: 1 }, "abcde文");
    input.handle({ type: "key", key: "left" });
    const canvas = new Canvas(8, 1); input.draw(canvas, input.bounds, true);
    expect(canvas.cells[0]!.find((cell) => cell.text === "文")?.style).toBe(theme.focused);
    expect(Bun.stringWidth(canvas.lines()[0]!)).toBe(8);
  });

  test("demo soporta resize, conserva controles y presenta foco sin color", () => {
    const desktop = createDemo();
    for (const [width, height] of [[80, 24], [120, 40], [60, 16]] as const) {
      desktop.resize(width, height);
      const canvas = desktop.draw();
      expect(canvas.lines()).toHaveLength(height);
      for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(width);
      const window = desktop.active!;
      expect(window.closeRect.x + 3).toBeLessThanOrEqual(width);
      expect(window.bounds.y + window.bounds.height).toBeLessThan(height);
      key(desktop, "tab"); key(desktop, "tab");
      expect(desktop.draw().lines().join("\n")).toContain("[>Aceptar<]");
      window.focusedId = "name";
    }
    desktop.resize(20, 6); expect(desktop.draw().lines().join("\n")).toContain("Ctrl+Q");
  });
});
