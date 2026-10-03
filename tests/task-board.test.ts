import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { App } from "../src/app.ts";
import { palettes } from "../src/ui/theme.ts";
import type { InputEvent } from "../src/ui/types.ts";

import { makeCard, until } from "./task-board-fixture.ts";
const key = (key: string): InputEvent => ({ type: "key", key });
const mouse = (x: number, y: number, action: "press" | "move" | "release" = "press"): InputEvent => ({ type: "mouse", x, y, action, button: 0, delta: 0 });
async function fixture(work: (app: App, root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "s42-board-")), app = await App.open({ config: join(root, "config.json"), cwd: root });
  try { await work(app, root); } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
}
test("tablero vacío no escribe; edición externa, movimiento manual y orden conservan texto", async () => fixture(async (app, root) => {
  app.view.prompt.setValue("borrador á文🙂"); app.taskBoard(); const board = app.tabs[0]!.taskBoard!;
  await until(() => Boolean(board.document)); expect(await Bun.file(join(root, "TODO.md")).exists()).toBe(false);
  const a = makeCard("A"), b = makeCard("B"); await board.save([a, b]);
  await Bun.write(join(root, "TODO.md"), board.document!.source.replace("# TODO", "# TODO\n\nNOTA AJENA").replace(`### [${b.id}] B`, `### [${b.id}] B externo`));
  await until(() => board.document?.tasks.some(t => t.title === "B externo") ?? false);
  board.select("pending", 0); await board.move(board.selected!, "doing");
  expect(board.selected?.origin).toBe("user"); expect(board.selected?.acceptanceEvidence).toEqual([]);
  expect(board.document!.source).toContain("NOTA AJENA"); expect(board.document!.tasks.find(t => t.id === b.id)?.title).toBe("B externo");
  await board.move(board.selected!, "pending"); board.selectedId = a.id; await board.reorder(1);
  expect(board.document!.tasks.filter(t => t.status === "pending").map(t => t.id)).toEqual([b.id, a.id]);
  expect(app.view.prompt.value).toBe("borrador á文🙂"); expect(app.session!.state.events.some(e => e.type === "task-record" && e.phase === "confirmed")).toBe(true);
}));
test("tablero: teclado/drag, foco, narrow, paletas e idioma con prompt visible", async () => fixture(async app => {
  app.taskBoard(); const board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document));
  const a = makeCard("Unicode á文🙂"); await board.save([a]);
  app.desktop.resize(120, 32); app.desktop.draw(); board.column("pending");
  const from = app.view.editorWindow.controlRect(board.columns[0]!), to = app.view.editorWindow.controlRect(board.columns[1]!);
  app.desktop.handle(mouse(from.x + 3, from.y + 2)); app.desktop.handle(mouse(to.x + 3, to.y + 2, "move"));
  expect(board.destination).toBe("doing"); app.desktop.handle(mouse(to.x + 3, to.y + 2, "release"));
  await until(() => board.document?.tasks[0]?.status === "doing");
  board.column("doing"); app.desktop.handle(key("shift+right")); await until(() => board.state === "done" && board.selected?.status === "done");
  expect(board.document!.tasks[0]?.acceptanceEvidence).toEqual([]);
  for (const palette of Object.keys(palettes) as (keyof typeof palettes)[]) {
    app.desktop.palette = palette;
    for (const [width, height] of [[60, 16], [120, 32]]) {
      app.desktop.resize(width!, height!); const lines = app.desktop.draw().lines();
      expect(lines.join("\n")).toContain("Prompt"); expect(lines.every(line => Bun.stringWidth(line) === width)).toBe(true);
      if (width === 60) expect(board.columns.filter(c => !c.disabled)).toHaveLength(1); else expect(board.columns.filter(c => !c.disabled)).toHaveLength(3);
    }
  }
  app.desktop.language = "en"; expect(app.desktop.draw().lines().join("\n")).toContain("Done");
  expect(board.document!.source).toContain("## Terminadas");
  app.desktop.handle(key("enter")); expect(app.desktop.modal).toBeDefined(); app.desktop.handle(key("escape"));
}));
test("paneles por proyecto no mezclan tarjetas; ocultar tablero libera watchers", async () => fixture(async (app, root) => {
  app.taskBoard(); const a = app.project!, board = app.tabs[0]!.taskBoard!; await until(() => Boolean(board.document)); await board.save([makeCard("Propietario A")]);
  const { mkdir } = await import("node:fs/promises"); const second = join(root, "second"); await mkdir(second); const b = await app.store.project("B", second, root);
  await app.switchProject(b); app.taskBoard(); const other = app.tabs.find(t => t.project?.id === b.id)!.taskBoard!; await until(() => Boolean(other.document));
  expect(other.document!.tasks).toHaveLength(0); await other.save([makeCard("Propietario B")]);
  await app.switchProject(a); expect(app.tabs.find(t => t.project?.id === a.id)!.taskBoard).toBe(board); expect(board.document!.tasks[0]?.title).toBe("Propietario A");
  app.desktop.menu.menus.find(m => m.label === "Vista")!.items.find(i => i.label === "Respuestas")!.run();
  const old = board.document!.revision; await Bun.write(join(root, "TODO.md"), board.document!.source + "nota oculta\n"); await Bun.sleep(50);
  expect(board.document!.revision).toBe(old); app.taskBoard(); await until(() => board.document!.revision !== old);
}));

test("TUI desde fuente: tablero, ficha, Unicode, modal, resize sin color y salida", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-task-pty-")), config = join(root, "config.json"), seed = await App.open({ config, cwd: root });
  seed.taskBoard(); const board = seed.tabs[0]!.taskBoard!; await until(() => Boolean(board.document)); const card = makeCard("Unicode á文🙂"); await board.save([card]);
  seed.view.prompt.setValue("borrador conservado"); await seed.desktop.onBeforeExit!();
  let output = ""; const terminal = new Bun.Terminal({ cols: 120, rows: 32, data: (_, bytes) => { output += new TextDecoder().decode(bytes); } });
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], { cwd: root, terminal, env: { ...process.env, TERM: "xterm-256color" } });
  try {
    await until(() => output.includes("borrador conservado")); terminal.write("\x1bv\x1b[B\x1b[B\r"); await until(() => output.includes("Unicode á文🙂"));
    terminal.write("\r"); await until(() => output.includes("Continuar tarea")); output = ""; terminal.write("\x1b"); await until(() => output.includes("Pendientes"));
    output = ""; terminal.resize(60, 16); child.kill("SIGWINCH"); await until(() => output.includes("Prompt")); expect(output).toContain("Pendientes");
    output = ""; terminal.resize(120, 32); child.kill("SIGWINCH"); await until(() => output.includes("Prompt"));
    terminal.write("\x1bv\x1b[H\x1b[B\x1b[B\x1b[B\r"); await until(() => output.includes("Criterio")); expect(output).toContain("Prompt");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?1049l"); expect(output).toContain("\x1b[?25h");
  } finally { child.kill(); terminal.close(); await rm(root, { recursive: true, force: true }); }
}, 10000);
