import { expect, test } from "bun:test";
import { Canvas, Renderer } from "../src/ui/canvas.ts";
import { Input } from "../src/ui/components/input.ts";
import { TextArea } from "../src/ui/components/text-area.ts";
import { theme } from "../src/ui/theme.ts";
import { createWorkspace } from "../src/ui/workspace.ts";
import type { InputEvent } from "../src/ui/types.ts";

const key = (key: string, text?: string): InputEvent => ({ type: "key", key, ...(text ? { text } : {}) });
const mouse = (x: number, y: number, action: "press" | "move" | "release" = "press"): InputEvent => ({ type: "mouse", x, y, action, button: 0, delta: 0 });
const project = { name: "Mi proyecto", path: "/proyectos/mi-proyecto" };
function panels() {
  const desktop = createWorkspace(project);
  const prompt = desktop.windows.find(window => window.id === "prompt")!;
  const editor = desktop.windows.find(window => window.id === "editor")!;
  return { desktop, prompt, editor, draft: prompt.controls[0] as TextArea, response: editor.controls[0] as TextArea };
}

test("input sin adornos permite borrar todo e ingresar corchetes como texto", () => {
  const input = new Input("input", { x: 0, y: 0, width: 12, height: 1 }, "nombre");
  input.handle(key("ctrl+a")); input.handle(key("backspace"));
  const canvas = new Canvas(12, 1); input.draw(canvas, input.bounds, true);
  expect(canvas.lines()[0]).toBe(" ".repeat(12)); expect(canvas.cells[0]![0]!.style).toBe(theme.focused);
  input.handle(key("[", "[")); expect(input.value).toBe("[");
  input.handle(key("backspace")); expect(input.value).toBe("");
});

test("paneles fijos conservan proyecto y prompt visibles al cerrar o arrastrar", () => {
  const { desktop, prompt, editor } = panels();
  desktop.handle(key("ctrl+w")); desktop.close(editor);
  expect(desktop.windows).toEqual([editor, prompt]); expect(editor.title).toBe(project.name);
  const before = { ...prompt.bounds };
  desktop.handle(mouse(20, prompt.bounds.y)); desktop.handle(mouse(35, 4, "move")); desktop.handle(mouse(35, 4, "release"));
  expect(prompt.bounds).toEqual(before);
  const canvas = desktop.draw(); const heading = canvas.lines()[editor.bounds.y]!;
  expect(heading.indexOf(` ${project.name} `)).toBe(Math.floor((desktop.width - project.name.length - 2) / 2));
  expect(canvas.lines().join("\n")).not.toContain("[X]");
  expect(canvas.cells[editor.bounds.y]![0]!.text).toBe("┌");
  expect(canvas.cells[prompt.bounds.y]![0]!.text).toBe("╔");
  desktop.focus(editor); expect(desktop.draw().lines().join("\n")).toContain("La respuesta aparecerá en este editor.");
});

test("Enter y clic en Enviar publican la respuesta demo en el editor y devuelven el foco", () => {
  const { desktop, prompt, draft, response } = panels();
  desktop.handle({ type: "paste", text: "  Hola á 文 🙂\nSegunda línea\n" });
  expect(response.value).toBe(""); desktop.handle(key("enter"));
  expect(response.value).toContain("Respuesta de demostración · Mi proyecto");
  expect(response.value).toContain("  Hola á 文 🙂\nSegunda línea\n"); expect(draft.value).toBe("");
  desktop.handle({ type: "paste", text: "Segundo prompt" });
  const send = prompt.controlRect(prompt.controls[1]!);
  desktop.handle(mouse(send.x + 2, send.y)); expect(response.value).not.toContain("Segundo prompt");
  desktop.handle(mouse(send.x + 2, send.y, "release"));
  expect(response.value).toContain("Segundo prompt"); expect(desktop.active).toBe(prompt); expect(prompt.focusedId).toBe("draft");
});

test("auxiliares y modales quedan arriba del prompt incluso después de resize", () => {
  const { desktop, prompt, editor, draft } = panels();
  desktop.handle({ type: "paste", text: "Borrador sin enviar" });
  desktop.handle(key("alt+d")); desktop.handle(key("enter"));
  const laboratory = desktop.active!;
  for (const [width, height] of [[120, 40], [60, 16], [80, 24]] as const) {
    desktop.resize(width, height); const canvas = desktop.draw();
    expect(editor.bounds.y + editor.bounds.height).toBe(prompt.bounds.y);
    expect(prompt.bounds.y + prompt.bounds.height).toBe(height - 1);
    expect(laboratory.bounds.y + laboratory.bounds.height).toBeLessThanOrEqual(prompt.bounds.y);
    expect(laboratory.focusable().map(control => control.id)).toContain("dialog");
    expect(canvas.lines().join("\n")).toContain("Prompt");
    for (const line of canvas.lines()) expect(Bun.stringWidth(line)).toBe(width);
  }
  desktop.handle(mouse(laboratory.bounds.x + 2, laboratory.bounds.y));
  desktop.handle(mouse(40, 23, "move")); desktop.handle(mouse(40, 23, "release"));
  expect(laboratory.bounds.y + laboratory.bounds.height).toBeLessThanOrEqual(prompt.bounds.y);
  desktop.handle(key("alt+y")); expect(desktop.modal!.bounds.y + desktop.modal!.bounds.height).toBeLessThanOrEqual(prompt.bounds.y);
  expect(draft.value).toBe("Borrador sin enviar");
});

test("editor conserva edición y borrador tras resize y cambio de foco", () => {
  const { desktop, editor, prompt, draft, response } = panels();
  desktop.handle({ type: "paste", text: "pedido" }); desktop.handle(key("enter"));
  desktop.handle({ type: "paste", text: "siguiente pedido" });
  desktop.focus(editor); desktop.handle(key("ctrl+a")); desktop.handle({ type: "paste", text: "const suma = (a: number, b: number) => a + b;" });
  desktop.resize(60, 16); desktop.draw(); desktop.resize(120, 40); desktop.draw(); desktop.focus(prompt);
  expect(draft.value).toBe("siguiente pedido"); expect(response.value).toContain("const suma =");
  draft.setValue("á文🙂".repeat(30)); desktop.draw(); desktop.resize(60, 16);
  const compact = desktop.draw(); const bounds = prompt.controlRect(draft);
  expect(compact.cells.slice(bounds.y, bounds.y + bounds.height).some(row => row.slice(bounds.x, bounds.x + bounds.width).some(cell => cell.style === theme.focused))).toBe(true);
  expect(draft.value).toBe("á文🙂".repeat(30));
});

test("textarea conserva Unicode y saltos pegados sin enviar; Ctrl+J inserta línea", () => {
  const area = new TextArea("area", { x: 0, y: 0, width: 8, height: 3 }); let calls = 0;
  area.onSubmit = () => { calls++; };
  area.handle({ type: "paste", text: "áé文🙂\r\nsegunda" }); expect(calls).toBe(0);
  area.handle(key("ctrl+j")); area.handle(key("X", "X")); expect(area.value).toBe("áé文🙂\nsegunda\nX");
  area.handle(key("ctrl+a")); area.handle({ type: "paste", text: "文🙂" });
  area.handle(key("backspace")); expect(area.value).toBe("文"); area.handle(key("enter")); expect(calls).toBe(1);
});

test("scroll del editor no salta al cursor y wrap mantiene ancho con grafemas", () => {
  const area = new TextArea("area", { x: 0, y: 0, width: 8, height: 2 });
  area.setValue("uno\ndos\ntres\ncuatro\ncinco", "start");
  area.draw(new Canvas(8, 2), area.bounds, true);
  area.handle({ type: "mouse", action: "wheel", x: 1, y: 1, button: 0, delta: 1 });
  const scrolled = new Canvas(8, 2); area.draw(scrolled, area.bounds, true); expect(scrolled.lines()[0]).toContain("cuatro");
  area.bounds.width = 12; const resized = new Canvas(12, 2); area.draw(resized, area.bounds, true); expect(resized.lines()[0]).toContain("cuatro");
  area.handle(key("ctrl+home")); const start = new Canvas(12, 2); area.draw(start, area.bounds, true); expect(start.lines()[0]).toContain("uno");
  area.bounds.width = 8;
  area.setValue("á文🙂abcdef", "start"); const wrapped = new Canvas(8, 2); area.draw(wrapped, area.bounds, true);
  for (const line of wrapped.lines()) expect(Bun.stringWidth(line)).toBe(8);
  area.handle(mouse(0, 0)); area.handle(mouse(5, 0, "move")); area.handle(mouse(5, 0, "release")); area.handle(key("X", "X"));
  expect(area.value).toBe("Xabcdef");
});

test("botones centrados, marco unido y estados legibles en monocromo", () => {
  const { desktop } = panels(); desktop.handle(key("alt+d")); desktop.handle(key("enter"));
  const window = desktop.active!; const button = window.controlRect(window.controls[2]!);
  const canvas = desktop.draw(); const text = "< Aceptar >";
  expect(canvas.lines()[button.y]!.indexOf(text)).toBe(button.x + Math.floor((button.width - Bun.stringWidth(text)) / 2));
  expect(canvas.cells[window.bounds.y]![window.bounds.x]!.text).toBe("╔");
  expect(canvas.cells[window.bounds.y]![window.bounds.x + window.bounds.width - 1]!.text).toBe("╗");
  const disabled = window.controlRect(window.controls[5]!); expect(canvas.cells[disabled.y]![disabled.x]!.style).toBe(theme.disabled);
  expect(new Renderer().frame(canvas, false)).toContain("\x1b[2m");
});
