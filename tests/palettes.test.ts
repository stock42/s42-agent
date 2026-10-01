import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { ConfigStore, defaultConfig } from "../src/storage/config.ts";
import { Canvas, Renderer } from "../src/ui/canvas.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { theme } from "../src/ui/theme.ts";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() { const root = await mkdtemp(join(tmpdir(), "s42-palette-")); roots.push(root); return root; }
async function until(check: () => boolean) {
  for (let i = 0; i < 200; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("No se aplicó la paleta");
}
function contrast(a: number[], b: number[]) {
  const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("paletas grises/verdes cubren los controles con contraste y fallback ANSI16 de su gama", () => {
  for (const palette of ["grayscale", "green"] as const) {
    const styles = Object.values(theme).filter(style => style !== theme.shadow);
    const canvas = new Canvas(styles.length, 1, palette);
    styles.forEach((style, x) => canvas.text(x, 0, "X", style));
    const rgb = new Renderer().frame(canvas, true, true);
    const codes = [...rgb.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+);48;2;(\d+);(\d+);(\d+)m/g)];
    expect(codes.length).toBeGreaterThan(5);
    for (const code of codes) {
      const fg = code.slice(1, 4).map(Number), bg = code.slice(4, 7).map(Number);
      for (const [r, g, b] of [fg, bg]) {
        if (palette === "grayscale") { expect(r).toBe(g!); expect(g).toBe(b!); }
        else { expect(g!).toBeGreaterThanOrEqual(r!); expect(g!).toBeGreaterThanOrEqual(b!); }
      }
      // Includes inactive titles and disabled buttons, not just body text.
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
    }
    const fallback = new Renderer().frame(canvas);
    expect(fallback).not.toContain("38;2;");
    for (const code of fallback.matchAll(/\x1b\[(\d+);(\d+)m/g)) {
      const allowed = palette === "grayscale" ? [30, 37, 90, 97] : [30, 32, 92];
      expect(allowed).toContain(Number(code[1])); expect(allowed.map(value => value + 10)).toContain(Number(code[2]));
    }
  }
});

test("cambiar paleta repinta sin resize, conserva contenido y vuelve a idle; sin color mantiene foco", () => {
  const renderer = new Renderer();
  for (const palette of ["qbasic", "grayscale", "green", "qbasic"] as const) {
    const canvas = new Canvas(12, 2, palette); canvas.text(0, 0, "Prompt: á文", theme.window); canvas.text(0, 1, "Cursor", theme.focused);
    const output = renderer.frame(canvas, true, true);
    expect(output).toContain("\x1b[2J"); expect(Bun.stripANSI(output)).toContain("Prompt: á文");
    expect(renderer.frame(canvas, true, true)).toBe("");
    const mono = new Renderer().frame(canvas, false, true);
    expect(mono).not.toMatch(/\x1b\[(?:38|48|3\d|4\d|9\d|10\d)[;\dm]/); expect(mono).toContain("\x1b[7m");
  }
});

test("config antigua conserva QBasic; paleta inválida no modifica el archivo", async () => {
  const root = await fixture(), path = join(root, "config.json"), old = defaultConfig();
  delete (old.ui as Partial<typeof old.ui>).palette;
  const original = JSON.stringify(old); await Bun.write(path, original);
  expect((await ConfigStore.load(path)).value.ui.palette).toBe("qbasic"); expect(await Bun.file(path).text()).toBe(original);
  for (const palette of ["unknown", "toString", null, ["green"]]) {
    const invalid = JSON.stringify({ ...old, ui: { ...old.ui, palette } }); await Bun.write(path, invalid);
    await expect(ConfigStore.load(path)).rejects.toThrow("Paleta inválida"); expect(await Bun.file(path).text()).toBe(invalid);
  }
});

test("selector por menú/teclado/mouse persiste, marca actual y conserva prompt/foco entre instancias", async () => {
  const root = await fixture(), config = join(root, "config.json"), otherConfig = join(root, "other.json");
  const app = await App.open({ config, cwd: root }), other = await App.open({ config: otherConfig, cwd: root });
  const key = (key: string) => app.desktop.handle({ type: "key", key });
  try {
    app.desktop.resize(60, 16); app.view.prompt.setValue("borrador\ncon á文");
    const menu = app.desktop.menu.menus.find(menu => menu.label === "Vista")!;
    menu.items.find(item => item.label === "Paleta de colores")!.run!();
    let list = app.desktop.modal!.controls[0] as SelectList;
    expect(list.selected).toBe(0); expect(list.items[0]).toContain("(actual)");
    expect(app.desktop.modal!.bounds.y + app.desktop.modal!.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);
    key("down"); key("enter"); await until(() => app.desktop.palette === "grayscale");
    expect((await Bun.file(config).json()).ui.palette).toBe("grayscale");
    expect(app.desktop.active).toBe(app.view.promptWindow); expect(app.view.prompt.value).toBe("borrador\ncon á文");
    expect(other.desktop.draw().palette).toBe("qbasic");
    app.busy = true; // Appearance may change while the provider is streaming.
    app.colorPalette(); const modal = app.desktop.modal!; list = modal.controls[0] as SelectList;
    expect(list.selected).toBe(1); expect(list.items[1]).toContain("(actual)");
    const bounds = modal.controlRect(list);
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, button: 0, delta: 0, x: bounds.x + 2, y: bounds.y + 3 });
    expect(list.selected).toBe(2); key("tab"); key("enter"); await until(() => app.desktop.palette === "green");
    app.busy = false;
    expect(app.view.prompt.value).toBe("borrador\ncon á文");
    app.colorPalette(); key("home"); key("escape"); expect(app.desktop.palette).toBe("green");
    expect((await Bun.file(config).json()).ui.palette).toBe("green");
  } finally { app.busy = false; await app.desktop.onBeforeExit!(); await other.desktop.onBeforeExit!(); }
  const reopened = await App.open({ config });
  try { expect(reopened.desktop.draw().palette).toBe("green"); expect(reopened.view.prompt.value).toBe("borrador\ncon á文"); }
  finally { await reopened.desktop.onBeforeExit!(); }
});

test("index.ts en PTY cambia paletas en vivo, reabre en ANSI16 y respeta NO_COLOR", async () => {
  const root = await fixture(), config = join(root, "config.json"), index = resolve(import.meta.dir, "../index.ts");
  let text = "";
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => { text += new TextDecoder().decode(data); } });
  const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", NO_COLOR: undefined };
  let child = Bun.spawn([process.execPath, index, "--config", config, "--cwd", root], { cwd: root, env, terminal });
  const openPalette = async () => {
    text = ""; terminal.write("\x1bv" + "\x1b[B".repeat(2) + "\r");
    await until(() => text.includes("Blanco y negro"));
  };
  try {
    await until(() => text.includes("No hay modelo configurado"));
    expect(text).toContain("\x1b[38;2;170;170;170;48;2;0;0;170m");
    terminal.write("borrador PTY\x1b[13;2usegunda línea"); await until(() => text.includes("segunda línea"));
    await openPalette(); text = ""; terminal.write("\x1b[B\r");
    await until(() => text.includes("\x1b[38;2;208;208;208;48;2;36;36;36m"));
    expect(Bun.stripANSI(text)).toContain("Prompt"); expect(Bun.stripANSI(text)).toContain("borrador PTY");
    expect((await Bun.file(config).json()).ui.palette).toBe("grayscale");
    terminal.resize(60, 16); text = ""; child.kill("SIGWINCH"); await until(() => text.includes("Prompt"));
    await openPalette(); expect(text).toContain("(actual)"); text = ""; terminal.write("\x1b[B\r");
    await until(() => text.includes("\x1b[38;2;195;219;195;48;2;18;48;30m"));
    expect(Bun.stripANSI(text)).toContain("Prompt"); expect((await Bun.file(config).json()).ui.palette).toBe("green");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(text).toContain("\x1b[?1049l");
    text = "";
    child = Bun.spawn([process.execPath, index, "--config", config], { cwd: root, env: { ...env, COLORTERM: "" }, terminal });
    await until(() => text.includes("Prompt")); expect(text).toContain("\x1b[92;40m"); expect(text).not.toContain("38;2;");
    expect(Bun.stripANSI(text)).toContain("segunda línea"); // Compact prompt follows the cursor on its last line.
    terminal.write("\x11"); expect(await child.exited).toBe(0);
    text = "";
    child = Bun.spawn([process.execPath, index, "--config", config], { cwd: root, env: { ...env, NO_COLOR: "1" }, terminal });
    await until(() => text.includes("Prompt"));
    expect(text).not.toMatch(/\x1b\[(?:38|48|3\d|4\d|9\d|10\d)[;\dm]/); expect(text).toContain("\x1b[7m");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(text).toContain("\x1b[?25h\x1b[?1049l");
  } catch (error) { throw new Error(`${(error as Error).message} · ${Bun.stripANSI(text.slice(-3500))}`); }
  finally { child.kill(); await child.exited; terminal.close(); }
}, 15000);
