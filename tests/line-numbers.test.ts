import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openFileTab } from "../src/file-tab.ts";
import { createProjectTab } from "../src/project-tab.ts";
import { Canvas, Renderer } from "../src/ui/canvas.ts";
import { TextArea } from "../src/ui/components/text-area.ts";
import { palettes, theme, type PaletteId } from "../src/ui/theme.ts";
import { createWorkspaceView } from "../src/ui/workspace.ts";

function draw(area: TextArea, focused = false, palette: PaletteId = "qbasic") {
  const canvas = new Canvas(area.bounds.width, area.bounds.height, palette);
  area.draw(canvas, area.bounds, focused); return canvas;
}
const key = (key: string) => ({ type: "key" as const, key });
const mouse = (x: number, y: number, action: "press" | "move" | "release") => ({ type: "mouse" as const, x, y, action, button: 0, delta: 0 });

test("logical line numbers survive Unicode wrapping without becoming document text", () => {
  const area = new TextArea("file", { x: 0, y: 0, width: 12, height: 8 });
  area.lineNumbers = true; area.readOnly = true;
  area.setValue([{ text: "abc文🙂xy\n" }, { text: "const x = 1;\n", style: theme.syntaxKeyword }], "start");
  const canvas = draw(area), rows = canvas.lines();
  expect(rows[0]).toBe(" 1 │ abc文🙂"); expect(rows[1]).toBe("   │ xy     ");
  expect(rows[2]).toBe(" 2 │ const x"); expect(rows[3]).toBe("   │  = 1;  ");
  expect(rows[4]!.startsWith(" 3 │ ")).toBe(true);
  expect(canvas.cells[2]![5]!.style).toBe(theme.syntaxKeyword);
  expect(area.value).toBe("abc文🙂xy\nconst x = 1;\n");
});

test("mouse selection uses body coordinates and excludes the gutter", () => {
  const area = new TextArea("file", { x: 0, y: 0, width: 16, height: 3 }, "á文🙂z");
  area.lineNumbers = true; area.readOnly = true; area.setValue(area.value, "start");
  area.handle(mouse(5, 0, "press")); area.handle(mouse(8, 0, "move"));
  const canvas = draw(area, true);
  expect(canvas.cells[0]![5]!.style).toBe(theme.selected);
  expect(canvas.cells[0]![6]!.style).toBe(theme.selected);
  expect(canvas.cells[0]![8]!.style).toBe(theme.window);
  expect(canvas.cells[0]![1]!.style).toBe(theme.lineNumber);
  area.handle(mouse(8, 0, "release"));
  area.handle({ type: "paste", text: "overwrite" }); expect(area.value).toBe("á文🙂z");
  area.handle(mouse(0, 0, "press")); area.handle(mouse(6, 0, "move"));
  expect(draw(area, true).cells[0]![5]!.style).toBe(theme.selected);
});

test("scroll, digit growth and narrow resize preserve source numbering", () => {
  const area = new TextArea("file", { x: 0, y: 0, width: 14, height: 3 });
  area.lineNumbers = true; area.readOnly = true;
  area.setValue(Array.from({ length: 99 }, () => "x").join("\n"), "start");
  expect(draw(area).lines()[0]!.startsWith(" 1 │ x")).toBe(true);
  area.append("\nx"); area.vim("gg");
  expect(draw(area).lines()[0]!.startsWith("  1 │ x")).toBe(true);
  area.handle({ type: "mouse", x: 6, y: 0, action: "wheel", button: 0, delta: 1 });
  expect(draw(area).lines()[0]!.startsWith("  4 │ x")).toBe(true);
  area.vim("G"); expect(draw(area).lines()[2]!.startsWith("100 │ x")).toBe(true);
  area.bounds.width = 4; expect(draw(area).lines().join("\n")).not.toContain("│");
  expect(area.value.split("\n")).toHaveLength(100);
});

test("number margin survives editing and undo without altering text operations", () => {
  const area = new TextArea("edit", { x: 0, y: 0, width: 12, height: 4 }, "first\nsecond");
  area.lineNumbers = true;
  area.handle(key("ctrl+home")); area.vim("dd"); expect(area.value).toBe("second");
  area.vim("u"); area.handle(key("ctrl+home"));
  expect(draw(area).lines()[1]!.startsWith(" 2 │ second")).toBe(true);
  area.handle(key("ctrl+a")); area.handle({ type: "paste", text: "only" });
  expect(area.value).toBe("only"); expect(draw(area).lines()[1]!.slice(0, 5)).toBe("   │ ");
});

test("chat and file tabs number their content while prompting stays unnumbered", async () => {
  const view = createWorkspaceView({ name: "Project", path: "/project" }, false), tab = createProjectTab();
  expect(view.response.lineNumbers).toBe(true); expect(tab.response.lineNumbers).toBe(true);
  expect(view.prompt.lineNumbers).toBe(false); expect(tab.prompt.lineNumbers).toBe(false);
  const root = await mkdtemp(join(tmpdir(), "s42-numbered-file-"));
  try {
    const path = join(root, "index.ts"), source = "const value = 1;\nexport { value };\n";
    await Bun.write(path, source); const file = await openFileTab(path, tab.id);
    expect(file.content.lineNumbers).toBe(true); expect(file.content.readOnly).toBe(true);
    expect(file.content.value).toBe(source);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("number styles follow all palettes and remain dim in monochrome output", () => {
  const area = new TextArea("file", { x: 0, y: 0, width: 12, height: 2 }, "value");
  area.lineNumbers = true; area.readOnly = true; area.setValue(area.value, "start");
  for (const palette of Object.keys(palettes) as PaletteId[]) {
    const canvas = draw(area, false, palette), renderer = new Renderer();
    expect(Bun.stripANSI(renderer.frame(canvas, true, true))).toContain(" 1 │ value");
    expect(renderer.frame(canvas, true, true)).toBe("");
    expect(new Renderer().frame(canvas, false)).toContain("\x1b[2m 1 │ ");
  }
});
