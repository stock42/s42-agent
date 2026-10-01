import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { ConfigStore, defaultConfig, modelSelection, normalizeFolder, storagePaths } from "../src/storage/config.ts";
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
test("config global por SO, XDG/AppData, variables vacías y --config explícito", () => {
  const home = homedir();
  const linux = storagePaths(undefined, { XDG_CONFIG_HOME: "/tmp/xdg-config", XDG_STATE_HOME: "/tmp/xdg-state" }, "linux");
  expect(linux.config).toBe("/tmp/xdg-config/s42-agent/agent.sqlite"); expect(linux.sessions).toBe(linux.config);
  expect(linux.legacy).toEqual({ config: "/tmp/xdg-config/s42-agent/config.json", sessions: "/tmp/xdg-state/s42-agent/sessions" });
  expect(storagePaths(undefined, { XDG_CONFIG_HOME: "", XDG_STATE_HOME: "" }, "linux").config).toBe(join(home, ".config/s42-agent/agent.sqlite"));
  expect(storagePaths(undefined, {}, "darwin").config).toBe(join(home, "Library/Application Support/s42-agent/agent.sqlite"));
  expect(storagePaths(undefined, { APPDATA: "/tmp/roaming", LOCALAPPDATA: "/tmp/local" }, "win32").config).toBe("/tmp/roaming/s42-agent/agent.sqlite");
  expect(storagePaths(undefined, {}, "win32").config).toBe(join(home, "AppData/Roaming/s42-agent/agent.sqlite"));
  expect(storagePaths("/tmp/override/config.json", {}, "darwin").sessions).toBe("/tmp/override/sessions");
  expect(storagePaths("/tmp/override/store.db").sessions).toBe("/tmp/override/store.db");
});
test("config anterior recupera modelo único; selección persiste en sesiones y proyectos nuevos", async () => {
  const root = await fixture(), config = join(root, "config.json"), value = defaultConfig();
  const model = { id: "local-model", name: "Local", contextWindow: 32000, maxOutputTokens: 2048, capabilities: { tools: true, images: false } };
  value.providers[0]!.models.push(model); await Bun.write(config, JSON.stringify(value));
  const app = await App.open({ config, cwd: root });
  try {
    expect(app.current().model.id).toBe(model.id); expect(app.store.value.defaults.modelId).toBe(model.id);
    const second = { ...model, id: "second", name: "Second" };
    const next = structuredClone(app.store.value); next.providers[0]!.models.push(second); await app.store.save(next);
    await app.selectModel({ providerId: "llama.cpp", modelId: "second" }); await app.newSession();
    expect(app.current().model.id).toBe("second");
    await mkdir(join(root, "B")); const project = await app.store.project("B", "B", root); await app.switchProject(project);
    expect(app.current().model.id).toBe("second");
  } finally { await app.desktop.onBeforeExit!(); }
  const reopened = await App.open({ config });
  try { expect(reopened.current().model.id).toBe("second"); } finally { await reopened.desktop.onBeforeExit!(); }
  value.providers[0]!.models.push({ ...model, id: "another" });
  expect(modelSelection(value).modelId).toBeUndefined();
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
test("reinicio repara pares call/result y recupera un lock de proceso muerto", async () => {
  const root=await fixture(), one=await Session.open(root,'A','crash');
  await one.append({type:'message',message:{role:'assistant',content:null,tool_calls:[{id:'c1',type:'function',function:{name:'write',arguments:'{}'}}]}});
  await one.append({type:'tool-start',callId:'c1',name:'write',arguments:'{}'}); await one.close();
  const source=`import {Session} from ${JSON.stringify(new URL('../src/storage/sessions.ts',import.meta.url).pathname)};await Session.open(${JSON.stringify(root)},'A','crash');console.log('locked');setInterval(()=>{},1000)`;
  const child=Bun.spawn([process.execPath,'-e',source],{stdout:'pipe',stderr:'pipe'}),reader=child.stdout.getReader();expect(new TextDecoder().decode((await reader.read()).value)).toContain('locked');
  await expect(Session.open(root,'A','crash')).rejects.toThrow('otra instancia');child.kill();await child.exited;await reader.cancel();
  let recovered=await Session.open(root,'A','crash'); expect(recovered.state.messages.map(m=>m.role)).toEqual(['assistant','tool']); expect(recovered.state.messages[1]?.content).toContain('No reejecutar'); await recovered.close();
  recovered=await Session.open(root,'A','crash'); expect(recovered.state.messages.map(m=>m.role)).toEqual(['assistant','tool']); await recovered.close();
});
