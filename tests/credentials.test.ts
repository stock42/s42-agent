import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { credential, deleteCredential, saveCredential } from "../src/storage/credentials.ts";
import { defaultProviders } from "../src/storage/config.ts";

const values = new Map<string, string>();
let get: ReturnType<typeof spyOn>, set: ReturnType<typeof spyOn>, remove: ReturnType<typeof spyOn>;
beforeEach(() => {
  values.clear();
  get = spyOn(Bun.secrets, "get").mockImplementation(async (args: any) => values.get(args.name) ?? null);
  set = spyOn(Bun.secrets, "set").mockImplementation(async (args: any) => { values.set(args.name, args.value); });
  remove = spyOn(Bun.secrets, "delete").mockImplementation(async (args: any) => values.delete(args.name));
});
afterEach(() => { get.mockRestore(); set.mockRestore(); remove.mockRestore(); delete process.env.S42_KEY_TEST; });

test("keychain referencia separada por config/proveedor/endpoint, update y delete", async () => {
  const provider = defaultProviders()[0]!;
  await saveCredential(provider, "fixture-only", "/tmp/profile-a/config.json");
  expect(await credential(provider)).toBe("fixture-only"); expect(JSON.stringify(provider)).not.toContain("fixture-only");
  expect(set.mock.calls[0]![0]).toMatchObject({ service: "s42-agent", persist: "local" });
  const name = provider.apiKeySecret;
  await saveCredential(provider, "replacement", "/tmp/profile-a/config.json"); expect(provider.apiKeySecret).toBe(name);
  expect(await credential(provider)).toBe("replacement");
  const other = { ...provider, id: "other" }; await saveCredential(other, "other-value", "/tmp/profile-a/config.json"); expect(other.apiKeySecret).not.toBe(name);
  const endpoint = { ...provider, baseUrl: "http://127.0.0.1:9999/v1" }; await saveCredential(endpoint, "endpoint-value", "/tmp/profile-a/config.json"); expect(endpoint.apiKeySecret).not.toBe(name);
  const profile = { ...provider }; await saveCredential(profile, "profile-value", "/tmp/profile-b/config.json"); expect(profile.apiKeySecret).not.toBe(name);
  await deleteCredential(provider); expect(await credential({ ...provider, apiKeySecret: undefined })).toBeUndefined();
  await expect(credential(provider)).rejects.toThrow("ausente en el llavero");
});
test("override CLI, llavero y variable; fallback a variable cuando el llavero no está disponible", async () => {
  process.env.S42_KEY_TEST = "env-value";
  const provider = defaultProviders()[0]!; provider.apiKeyEnv = "S42_KEY_TEST";
  expect(await credential(provider)).toBe("env-value"); await saveCredential(provider, "stored-value", "/tmp/profile/config.json");
  expect(await credential(provider)).toBe("stored-value"); expect(await credential(provider, "cli-value")).toBe("cli-value");
  get.mockImplementation(async () => { throw new Error("keyring unavailable"); });
  expect(await credential(provider)).toBe("env-value"); delete process.env.S42_KEY_TEST;
  await expect(credential(provider)).rejects.toThrow("No se pudo leer");
});
test("fallo del llavero no anuncia persistencia ni guarda una referencia falsa", async () => {
  const provider = defaultProviders()[0]!;
  set.mockImplementation(async () => { throw new Error("keyring locked"); });
  await expect(saveCredential(provider, "fixture-only", "/tmp/profile/config.json")).rejects.toThrow("No se pudo guardar");
  expect(provider.apiKeySecret).toBeUndefined();
});
