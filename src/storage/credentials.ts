import { resolve } from "node:path";
import type { Provider } from "./config.ts";

const service = "s42-agent";
export async function saveCredential(provider: Provider, value: string, configPath: string): Promise<void> {
  const name = "provider-" + new Bun.CryptoHasher("sha256").update(JSON.stringify([
    resolve(configPath), provider.id, provider.baseUrl.replace(/\/+$/, ""),
  ])).digest("hex");
  const options = { service, name, value, persist: "local" as const };
  try { await Bun.secrets.set(options); }
  catch { throw new Error("No se pudo guardar la API key en el llavero del SO. Desbloquealo o usá Variable API key."); }
  provider.apiKeySecret = name;
}

export async function deleteCredential(provider: Provider): Promise<void> {
  if (provider.apiKeySecret) await Bun.secrets.delete({ service, name: provider.apiKeySecret });
}

export async function credential(provider: Provider, sessionKey?: string): Promise<string | undefined> {
  if (sessionKey) return sessionKey;
  const envKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;
  if (provider.apiKeySecret) {
    let value: string | null;
    try { value = await Bun.secrets.get({ service, name: provider.apiKeySecret }); }
    catch { if (envKey) return envKey; throw new Error("No se pudo leer la API key del llavero del SO. Desbloquealo o usá Variable API key."); }
    if (value) return value;
    if (!provider.apiKeyEnv) throw new Error("API key ausente en el llavero del SO. Configurá el proveedor en Models.");
  }
  if (provider.apiKeyEnv) {
    const value = process.env[provider.apiKeyEnv];
    if (!value) throw new Error(`Falta la variable ${provider.apiKeyEnv} para ${provider.name}`);
    return value;
  }
  return undefined;
}
