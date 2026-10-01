import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigStore, normalizeFolder } from "../src/storage/config.ts";
import { Session } from "../src/storage/sessions.ts";
import { App } from "../src/app.ts";
const folders: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), "s42-store-")); folders.push(root); return root; }
afterEach(async () => { for (const root of folders.splice(0)) await rm(root, { recursive: true, force: true }); });

test("config local por defecto, proyectos normalizados y JSON inválido conservado", async () => {
  const root = await fixture(), store = await ConfigStore.load(join(root, "config.json"));
  expect(store.value.defaults.providerId).toBe("llama.cpp"); expect(store.value.providers[0]!.models).toEqual([]);
  await mkdir(join(root, "A con espacio")); const a = await store.project("A", "./A con espacio", root);
  await expect(store.project("duplicado", a.path, root)).rejects.toThrow("registrada");
  await Bun.write(join(root, "file.txt"), "archivo"); await expect(normalizeFolder("file.txt", root)).rejects.toThrow("carpeta");
  expect((await ConfigStore.load(store.path)).resolveProject("A").path).toBe(a.path);
  await Bun.write(store.path, "{mal"); await expect(ConfigStore.load(store.path)).rejects.toThrow(); expect(await Bun.file(store.path).text()).toBe("{mal");
});
test("sesión append serializado, borrador, selección y lock de único escritor", async () => {
  const root = await fixture(), session = await Session.open(root, "A", "one");
  await Promise.all([session.append({ type: "session", title: "Ejemplo" }), session.append({ type: "draft", text: "dos\nlíneas", attachments: [] }), session.append({ type: "selection", selection: { providerId: "llama.cpp", modelId: "real-id" } })]);
  await expect(Session.open(root, "A", "one")).rejects.toThrow("otra instancia"); await session.close();
  const restored = await Session.open(root, "A", "one"); expect(restored.state.draft).toBe("dos\nlíneas"); expect(restored.state.selection?.modelId).toBe("real-id"); expect(restored.state.events.length).toBe(3); await restored.close();
});
test("última línea incompleta recuperada; corrupción completa explícita; tool no reejecutada", async () => {
  const root = await fixture(), session = await Session.open(root, "A", "one");
  await session.append({ type: "session", title: "Recuperación" }); await session.append({ type: "tool-start", callId: "read-1", name: "read", arguments: "{}" }); await session.close();
  const path = join(root, "A/one.jsonl"), valid = await Bun.file(path).text(); await Bun.write(path, valid + '{"incompleto');
  const recovered = await Session.open(root, "A", "one"); expect(recovered.state.notices.length).toBe(2); expect(await Bun.file(path).text()).toBe(valid); await recovered.close();
  await Bun.write(path, valid + "{mal}\n"); await expect(Session.open(root, "A", "one")).rejects.toThrow("línea 3");
});
test("proyectos y sesiones mantienen borradores; Models y aviso sin modelo visibles", async () => {
  const root = await fixture(), config = join(root, "config.json"), app = await App.open({ config, cwd: root });
  expect(app.desktop.draw().lines().join("\n")).toContain("No hay modelo configurado"); expect(app.desktop.draw().lines()[0]).toContain("Models");
  const a = app.project!; await mkdir(join(root, "B")); const b = await app.store.project("B", "B", root);
  app.view.prompt.setValue("borrador A"); await app.switchProject(b); app.view.prompt.setValue("borrador B"); await app.switchProject(a); expect(app.view.prompt.value).toBe("borrador A");
  await app.desktop.onBeforeExit!();
  const resumed = await App.open({ config }); expect(resumed.view.prompt.value).toBe("borrador A"); await resumed.desktop.onBeforeExit!();
});
