import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credential, credentialPath, deleteCredential, saveCredential } from "../src/storage/credentials.ts";
import { ConfigStore, defaultProviders } from "../src/storage/config.ts";

const roots: string[] = [];
const originalEnv = process.env.S42_KEY_TEST;
async function fixture() { const root = await mkdtemp(join(tmpdir(), "s42-credentials-")); roots.push(root); return root; }
afterEach(async () => {
  if (originalEnv === undefined) delete process.env.S42_KEY_TEST; else process.env.S42_KEY_TEST = originalEnv;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("SQLite separa config/proveedor/endpoint, reemplaza claves y borra todas las del proveedor", async () => {
  const root = await fixture(), path = join(root, "profile-a/config.json"), otherPath = join(root, "profile-b/config.json");
  const provider = defaultProviders()[0]!;
  await saveCredential(provider, "fixture-only", path);
  expect(await credential(provider, path)).toBe("fixture-only"); expect(JSON.stringify(provider)).not.toContain("fixture-only");
  const name = provider.apiKeySecret;
  await saveCredential(provider, "replacement", path); expect(provider.apiKeySecret).toBe(name);
  expect(await credential({ ...provider, baseUrl: provider.baseUrl + "/" }, path)).toBe("replacement");
  const other = { ...provider, id: "other" }; await saveCredential(other, "other-value", path); expect(other.apiKeySecret).not.toBe(name);
  const changedEndpoint = { ...provider, baseUrl: "http://127.0.0.1:9999/v1" };
  await expect(credential(changedEndpoint, path)).rejects.toThrow("ausente en SQLite");
  await expect(credential({ ...provider, id: "changed-id" }, path)).rejects.toThrow("ausente en SQLite");
  await expect(credential(provider, otherPath)).rejects.toThrow("ausente en SQLite");
  await saveCredential(changedEndpoint, "endpoint-value", path); expect(changedEndpoint.apiKeySecret).not.toBe(name);
  const profile = { ...provider }; await saveCredential(profile, "profile-value", otherPath); expect(profile.apiKeySecret).not.toBe(name);
  const db = new Database(credentialPath(path), { readonly: true });
  try { expect(db.query("SELECT value FROM credentials ORDER BY value").all()).toEqual([{ value: "endpoint-value" }, { value: "other-value" }, { value: "replacement" }]); }
  finally { db.close(true); }
  await deleteCredential(provider, path);
  await expect(credential(provider, path)).rejects.toThrow("ausente en SQLite");
  await expect(credential(changedEndpoint, path)).rejects.toThrow("ausente en SQLite");
  expect(await credential({ ...provider, apiKeySecret: undefined }, path)).toBeUndefined();
  expect(await credential(other, path)).toBe("other-value"); expect(await credential(profile, otherPath)).toBe("profile-value");
});

test("override CLI > SQLite > entorno; fallback con referencia antigua o base inaccesible", async () => {
  const root = await fixture(), path = join(root, "agent.sqlite"), invalid = join(root, "directory.sqlite");
  process.env.S42_KEY_TEST = "env-value";
  const provider = defaultProviders()[0]!; provider.apiKeyEnv = "S42_KEY_TEST";
  expect(await credential(provider, path)).toBe("env-value"); await saveCredential(provider, "stored-value", path);
  expect(await credential(provider, path)).toBe("stored-value"); expect(await credential(provider, path, "cli-value")).toBe("cli-value");
  const old = { ...provider, apiKeySecret: "old-keychain-reference" };
  expect(await credential(old, path)).toBe("env-value");
  await mkdir(invalid); expect(await credential(provider, invalid)).toBe("env-value");
  delete process.env.S42_KEY_TEST;
  await expect(credential(old, path)).rejects.toThrow("ausente en SQLite");
  await expect(credential(provider, invalid)).rejects.toThrow("No se pudo leer");
  expect(await credential(provider, invalid, "cli-value")).toBe("cli-value");
  await expect(credential({ ...provider, apiKeySecret: undefined }, path)).rejects.toThrow("Falta la variable");
});

test("fallo de escritura SQLite no anuncia persistencia ni reemplaza la referencia anterior", async () => {
  const root = await fixture(), path = join(root, "directory.sqlite"); await mkdir(path);
  const provider = defaultProviders()[0]!;
  await expect(saveCredential(provider, "fixture-only", path)).rejects.toThrow("No se pudo guardar");
  expect(provider.apiKeySecret).toBeUndefined(); provider.apiKeySecret = "previous-reference";
  await expect(saveCredential(provider, "replacement", path)).rejects.toThrow("No se pudo guardar");
  expect(provider.apiKeySecret).toBe("previous-reference");
});

test("servidor sin D-Bus: SQLite/JSON reabren y autentican llama.cpp, DeepSeek y proveedor manual desde CLI", async () => {
  const root = await fixture(), headers: string[] = [];
  const server = Bun.serve({ port: 0, async fetch(req) {
    if (req.method === "GET") return new Response("", { status: 404 });
    headers.push(req.headers.get("authorization") ?? "");
    await req.json();
    return new Response('data: {"choices":[{"delta":{"content":"Autenticado"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  } });
  try {
    for (const filename of ["agent.sqlite", "config.json"]) {
      const path = join(root, filename), store = await ConfigStore.load(path);
      store.value.providers.push({ id: "manual", name: "Manual", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}/v1`, models: [] });
      for (const provider of store.value.providers) {
        provider.baseUrl = `http://127.0.0.1:${server.port}/v1`;
        provider.models = [{ id: "fixture", name: "Fixture", manual: true, capabilities: { tools: false, images: false } }];
        await saveCredential(provider, `fixture-${provider.id}`, path);
      }
      await store.save(store.value);
      const reopened = await ConfigStore.load(path);
      for (const provider of reopened.value.providers) {
        expect(await credential(provider, path)).toBe(`fixture-${provider.id}`);
        const child = Bun.spawn([process.execPath, new URL("../index.ts", import.meta.url).pathname, "--config", path, "--cwd", root, "--provider", provider.id, "--model", "fixture", "--prompting", "Hola"], {
          stdout: "pipe", stderr: "pipe", env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: "unix:path=/nonexistent-s42-keyring", GNOME_KEYRING_CONTROL: "", DEEPSEEK_API_KEY: "" },
        });
        const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
        expect({ code, out }).toEqual({ code: 0, out: "Autenticado\n" }); expect(err).not.toContain(`fixture-${provider.id}`);
        expect(headers.at(-1)).toBe(`Bearer fixture-${provider.id}`);
      }
      const db = new Database(credentialPath(path), { readonly: true });
      try {
        expect(db.query("SELECT name FROM credentials").all()).toHaveLength(3);
        expect(db.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
        expect(JSON.stringify(db.query("SELECT data FROM events").all())).not.toMatch(/fixture-(llama\.cpp|deepseek|manual)/);
        expect(JSON.stringify(db.query("SELECT value FROM settings").all())).not.toMatch(/fixture-(llama\.cpp|deepseek|manual)/);
      } finally { db.close(true); }
      if (filename.endsWith("json")) expect(await Bun.file(path).text()).not.toMatch(/fixture-(llama\.cpp|deepseek|manual)/);
    }
    expect(headers).toHaveLength(6);
  } finally { server.stop(true); }
}, 15000);
