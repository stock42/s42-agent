import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { credentialPath } from "../src/storage/credentials.ts";
import { App } from "../src/app.ts";
import { credential, discoverModels, runtimeModel } from "../src/llm/client.ts";
import { defaultConfig, defaultProviders } from "../src/storage/config.ts";
import { Button } from "../src/ui/components/button.ts";
import { Input } from "../src/ui/components/input.ts";
import { SelectList } from "../src/ui/components/select-list.ts";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() { const root = await mkdtemp(join(tmpdir(), "s42-provider-")); roots.push(root); return root; }
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout en configuración de proveedor");
}
const key = (app: App, key: string) => app.desktop.handle({ type: "key", key });
const button = (app: App, id: string) => (app.desktop.modal!.controls.find(c => c.id === id) as Button).onClick();
const inputs = (app: App) => app.desktop.modal!.controls.filter(c => c instanceof Input) as Input[];
const catalog = { data: [
  { id: "remote-alpha", name: "Alpha disponible", context_window: 1048576, max_output_tokens: 393216, input_modalities: ["text", "image"] },
  { id: "remote-beta", name: "Beta disponible", context_window: 65536, max_output_tokens: 1024, input_modalities: ["text"] },
] };

test("dos proveedores preconfigurados y templates disponibles para JSON anterior sin sobrescribirlo", async () => {
  const config = defaultConfig(); expect(config.defaults.providerId).toBe("llama.cpp");
  expect(config.providers.map(p => p.id)).toEqual(["llama.cpp", "deepseek"]);
  expect(config.providers[0]!.baseUrl).toBe("http://127.0.0.1:8080/v1");
  expect(config.providers[1]!.baseUrl).toBe("https://api.deepseek.com"); expect(config.providers[1]!.apiKeyEnv).toBe("DEEPSEEK_API_KEY");
  expect(config.providers.every(p => p.models.length === 0)).toBe(true);
  const root = await fixture(), path = join(root, "config.json"); config.providers.pop(); config.providers[0]!.baseUrl = "http://127.0.0.1:9000/v1";
  await Bun.write(path, JSON.stringify(config)); const app = await App.open({ config: path, cwd: root });
  try {
    expect(app.desktop.draw().lines().join("\n")).toContain("Models → Proveedores");
    const before = await Bun.file(path).text(); app.providers();
    const list = app.desktop.modal!.controls[0] as SelectList;
    expect(list.items).toHaveLength(2); expect(list.items[0]).toContain(":9000/v1"); expect(list.items[1]).toContain("DeepSeek");
    key(app, "down"); key(app, "enter"); await until(() => !!app.desktop.modal?.title.includes("DeepSeek"));
    expect(inputs(app)[1]!.value).toBe("DEEPSEEK_API_KEY"); expect(inputs(app)[2]!.value).toBe("https://api.deepseek.com");
    key(app, "escape"); expect(await Bun.file(path).text()).toBe(before); expect(app.store.value.providers).toHaveLength(1);
    app.providers(true); expect((app.desktop.modal!.controls[0] as SelectList).items.at(-1)).toContain("Otro proveedor"); key(app, "escape");
  } finally { await app.desktop.onBeforeExit!(); }
});

test("catálogo usa Bearer, metadata y modelos únicos; IDs simples siguen siendo compatibles", async () => {
  const requests: string[] = [];
  const server = Bun.serve({ port: 0, fetch(req) {
    requests.push(`${new URL(req.url).pathname}:${req.headers.get("authorization")}`);
    return Response.json({ data: [...catalog.data, catalog.data[0], null, { id: "" }, { id: "legacy" }] });
  } });
  const provider = defaultProviders()[1]!; provider.baseUrl = `http://127.0.0.1:${server.port}`;
  try {
    const discovered = await discoverModels(provider, "fixture-secret");
    expect(requests).toEqual(["/models:Bearer fixture-secret"]); expect(discovered.map(m => m.id)).toEqual(["remote-alpha", "remote-beta", "legacy"]);
    expect(discovered[0]).toMatchObject({ name: "Alpha disponible", contextWindow: 1048576, maxOutputTokens: 393216, capabilities: { tools: true, images: true } });
    expect(discovered[1]).toMatchObject({ maxOutputTokens: 1024, capabilities: { tools: true, images: false } });
    provider.id = "llama.cpp"; provider.kind = "llama.cpp"; provider.apiKeyEnv = undefined; provider.baseUrl += "/v1/";
    expect((await discoverModels(provider))[2]).toMatchObject({ contextWindow: undefined, maxOutputTokens: undefined, capabilities: { tools: true, images: false } });
    expect(requests[1]).toBe("/v1/models:null");
    provider.apiKeyEnv = `S42_MISSING_${crypto.randomUUID().replaceAll("-", "")}`;
    expect(await credential(provider, "/unused/config.json", "explicit-session-key")).toBe("explicit-session-key"); await expect(credential(provider, "/unused/config.json")).rejects.toThrow("Falta la variable");
  } finally { server.stop(true); }
});

test("proveedor remoto actualiza el catálogo antiguo; sin metadata no reutiliza techos inventados", async () => {
  let requests = 0, unavailable = false;
  const server = Bun.serve({ port: 0, fetch() {
    requests++; return unavailable ? new Response("", { status: 503 }) : Response.json(catalog);
  } });
  const provider = defaultProviders()[1]!; provider.baseUrl = `http://127.0.0.1:${server.port}`;
  const old = { id: "remote-alpha", name: "Alpha anterior", contextWindow: 1048576, maxOutputTokens: 2048, capabilities: { tools: true, images: false } };
  try {
    expect(await runtimeModel(provider, old)).toMatchObject({ maxOutputTokens: 393216, capabilities: { images: true } });
    expect(requests).toBe(1);
    expect(await runtimeModel(provider, { ...old, manual: true })).toEqual({ ...old, manual: true, maxOutputTokens: undefined }); expect(requests).toBe(1);
    expect(await runtimeModel(provider, { ...old, id: "missing" })).toEqual({ ...old, id: "missing", maxOutputTokens: undefined });
    provider.id = "custom-remote";
    expect((await runtimeModel(provider, old)).maxOutputTokens).toBe(393216);
    unavailable = true; expect(await runtimeModel(provider, old)).toEqual({ ...old, maxOutputTokens: undefined });
    const controller = new AbortController(); controller.abort(new Error("Cancelado"));
    await expect(runtimeModel(provider, old, undefined, controller.signal)).rejects.toThrow("Cancelado");
  } finally { server.stop(true); }
});

test("metadata de salida se conserva íntegra sin reservar una fracción del contexto ni inventarlo", async () => {
  const server = Bun.serve({ port: 0, fetch: () => Response.json({ data: [
    { id: "small", context_window: 8192, max_output_tokens: 393216 }, { id: "unknown-context", max_output_tokens: 393216 },
  ] }) });
  const provider = defaultProviders()[1]!; provider.baseUrl = `http://127.0.0.1:${server.port}`;
  try {
    const models = await discoverModels(provider);
    expect(models.map(m => m.maxOutputTokens)).toEqual([393216, 393216]);
    expect(models.map(m => m.contextWindow)).toEqual([8192, undefined]);
  }
  finally { server.stop(true); }
});

test("formulario Models no ofrece límites y persiste sin introducirlos ES/EN", async () => {
  const root = await fixture(), path = join(root, "config.json"), app = await App.open({ config: path, cwd: root });
  try {
    for (const language of ["es", "en"] as const) {
      await app.setLanguage(language); app.modelForm(true);
      inputs(app)[0]!.setValue(`automatic-${language}`);
      button(app, "next"); button(app, "next");
      expect(inputs(app)).toHaveLength(1); expect(inputs(app)[0]!.id).toBe("field-6");
      button(app, "save"); await until(() => !app.desktop.modal);
      expect(app.current().model.maxOutputTokens).toBeUndefined(); expect(app.current().model.contextWindow).toBeUndefined();
    }
    const saved = JSON.parse(await Bun.file(path).text());
    expect(saved.providers[0].models.every((m: any) => !("maxOutputTokens" in m) && !("contextWindow" in m))).toBe(true);
  } finally { await app.desktop.onBeforeExit!(); }
});

test("DeepSeek corrige 401, guarda key en SQLite y recupera modelo/clave tras reinicio", async () => {
  const root = await fixture(), path = join(root, "config.json"); let requests = 0;
  const server = Bun.serve({ port: 0, fetch(req) { requests++; return req.headers.get("authorization") === "Bearer accepted-fixture" ? Response.json(catalog) : new Response("", { status: 401 }); } });
  const app = await App.open({ config: path, cwd: root }); let closed = false;
  try {
    app.desktop.resize(60, 16); app.view.prompt.setValue("borrador intacto"); const previous = { ...app.selection }, before = await Bun.file(path).text();
    app.providers(); key(app, "down"); key(app, "enter"); await until(() => !!app.desktop.modal?.title.includes("DeepSeek"));
    const fields = inputs(app); fields[0]!.setValue("rejected-fixture"); fields[2]!.setValue("http://127.0.0.1");
    button(app, "next"); inputs(app)[0]!.setValue(String(server.port)); button(app, "save");
    await until(() => app.desktop.draw().lines().join("\n").includes("HTTP 401"));
    expect(requests).toBe(1); expect(app.busy).toBe(false); expect(await Bun.file(path).text()).toBe(before); expect(app.selection).toEqual(previous);
    button(app, "previous"); inputs(app)[0]!.setValue("accepted-fixture"); button(app, "save");
    await until(() => app.desktop.modal?.title === "Models · DeepSeek");
    expect(app.selection).toEqual(previous); expect(app.view.prompt.value).toBe("borrador intacto");
    expect(app.desktop.modal!.bounds.y + app.desktop.modal!.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);
    const list = app.desktop.modal!.controls[0] as SelectList; expect(list.items).toHaveLength(2); expect(list.items[1]).toContain("Beta disponible");
    key(app, "down"); key(app, "enter"); await until(() => app.status === "Modelo elegido");
    expect(app.view.response.placeholder).not.toContain("No hay modelo configurado");
    expect(app.selection.providerId).toBe("deepseek"); expect(app.keys.get("deepseek")).toBe("accepted-fixture");
    expect(app.current().model.maxOutputTokens).toBe(1024); expect(await Bun.file(path).text()).not.toContain("accepted-fixture");
    expect(app.store.value.defaults).toMatchObject(app.selection); expect(app.project!.selection).toEqual(app.selection);
    const db = new Database(credentialPath(path), { readonly: true });
    try { expect(db.query("SELECT provider_id FROM credentials").all()).toEqual([{ provider_id: "deepseek" }]); } finally { db.close(true); }
    expect(await Bun.file(app.session!.path).text()).not.toContain("accepted-fixture");
    await app.desktop.onBeforeExit!(); closed = true;
    const reopened = await App.open({ config: path });
    try {
      expect(reopened.selection).toEqual(app.selection); expect(reopened.keys.size).toBe(0); expect(await credential(reopened.current().provider, reopened.store.path)).toBe("accepted-fixture"); expect(reopened.view.prompt.value).toBe("borrador intacto"); expect(requests).toBe(2); await reopened.discover(); expect(requests).toBe(3); key(reopened, "escape");
      reopened.providerForm(reopened.current().provider); expect(inputs(reopened)[0]!.placeholder).toBe("Guardada · vacío conserva"); expect(inputs(reopened)[0]!.secret).toBe(true); key(reopened, "escape");
      await reopened.newSession(); expect(reopened.selection).toEqual(app.selection);
    }
    finally { await reopened.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); }
});

test("descubrimiento vacío/inválido y cancelación no guardan modelos ni reabren un formulario cerrado", async () => {
  const root = await fixture(), config = join(root, "config.json"); let mode = "empty", release = () => {};
  const server = Bun.serve({ port: 0, async fetch(req) {
    if (new URL(req.url).pathname.endsWith("/props")) return new Response("",{status:404});
    if (mode === "empty") return Response.json({ data: [] }); if (mode === "invalid") return Response.json(null);
    await new Promise<void>(resolve => { release = resolve; }); return Response.json(catalog);
  } });
  const initial = defaultConfig(); initial.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`; await Bun.write(config, JSON.stringify(initial));
  const app = await App.open({ config, cwd: root });
  try {
    await expect(app.discover()).rejects.toThrow("no hay modelos"); mode = "invalid"; await expect(app.discover()).rejects.toThrow("lista válida");
    expect(app.store.value.providers[0]!.models).toEqual([]);
    mode = "slow"; app.providerForm(app.store.value.providers[0]!); button(app, "save"); await until(() => app.busy);
    key(app, "ctrl+c"); await until(() => !app.busy); expect(app.desktop.modal).toBeDefined(); expect(app.store.value.providers[0]!.models).toEqual([]); release();
    key(app, "escape"); app.providerForm(app.store.value.providers[0]!); button(app, "save"); await until(() => app.busy); await Bun.sleep(10);
    key(app, "escape"); release(); await until(() => !app.busy); await Bun.sleep(20); expect(app.desktop.modal).toBeUndefined();
  } finally { release(); await app.desktop.onBeforeExit!(); server.stop(true); }
});

test("index.ts en PTY muestra presets, configura DeepSeek y elige el modelo del catálogo sin escribir su ID", async () => {
  const root = await fixture(), config = join(root, "config.json"), initial = defaultConfig(); let auth: string | null = null;
  const server = Bun.serve({ port: 0, fetch(req) { auth = req.headers.get("authorization"); return Response.json(catalog); } });
  initial.providers[1]!.baseUrl = `http://127.0.0.1:${server.port}`; await Bun.write(config, JSON.stringify(initial));
  let text = "";
  const terminal = new Bun.Terminal({ cols: 60, rows: 16, data: (_, data) => { text += new TextDecoder().decode(data); } });
  const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config, "--cwd", root, "--no-color"], { cwd: root, env: { ...process.env, TERM: "xterm-256color", DBUS_SESSION_BUS_ADDRESS: "unix:path=/nonexistent-s42-keyring" }, terminal });
  try {
    await until(() => text.includes("No hay modelo configurado")); terminal.write("borrador PTY\x02");
    await until(() => text.includes("llama.cpp") && text.includes("DeepSeek")); expect(text).toContain("Proveedores");
    terminal.write("\x1b[B\r"); await until(() => text.includes("API key · SQLite"));
    terminal.write("pty-fixture-key\t\x01\x7f\t\t\r"); await until(() => text.includes("Puerto"));
    terminal.write("\t\t\t\r"); await until(() => text.includes("Beta disponible"));
    expect(auth as string | null).toBe("Bearer pty-fixture-key"); expect(text).toContain("Prompt");
    terminal.write("\x1b[B\r"); await until(() => text.includes("Modelo elegido")); expect(text).toContain("DeepSeek · remote-beta");
    expect(await Bun.file(config).text()).not.toContain("pty-fixture-key"); expect(text).not.toContain("pty-fixture-key"); expect(text).toContain("borrador PTY");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(text).toContain("\x1b[?25h\x1b[?1049l");
  } catch (error) { throw new Error(`${(error as Error).message} · ${Bun.stripANSI(text.slice(-3000))}`); }
  finally { child.kill(); await child.exited; terminal.close(); server.stop(true); }
}, 15000);
