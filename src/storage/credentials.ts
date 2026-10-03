import { resolve } from "node:path";
import type { Provider } from "./config.ts";
import { isDatabase, openDatabase } from "./database.ts";

export const credentialPath = (configPath: string): string => isDatabase(configPath) ? resolve(configPath) : resolve(configPath) + ".credentials.sqlite";
const endpoint = (provider: Provider): string => provider.baseUrl.replace(/\/+$/, "");
export async function saveCredential(provider: Provider, value: string, configPath: string): Promise<void> {
  const name = "provider-" + new Bun.CryptoHasher("sha256").update(JSON.stringify([
    resolve(configPath), provider.id, endpoint(provider),
  ])).digest("hex");
  try {
    const db = await openDatabase(credentialPath(configPath));
    try {
      db.query(`INSERT INTO credentials(name,provider_id,base_url,value) VALUES(?,?,?,?)
        ON CONFLICT(name) DO UPDATE SET value=excluded.value`).run(name, provider.id, endpoint(provider), value);
    } finally { db.close(true); }
  } catch { throw new Error("No se pudo guardar la API key en SQLite. Revisá permisos de la configuración."); }
  provider.apiKeySecret = name;
}

export async function deleteCredential(provider: Provider, configPath: string): Promise<void> {
  const db = await openDatabase(credentialPath(configPath));
  try { db.query("DELETE FROM credentials WHERE provider_id=?").run(provider.id); }
  finally { db.close(true); }
}

export async function credential(provider: Provider, configPath: string, sessionKey?: string): Promise<string | undefined> {
  if (sessionKey) return sessionKey;
  const envKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;
  if (provider.apiKeySecret) {
    let value: string | undefined;
    try {
      const db = await openDatabase(credentialPath(configPath));
      try {
        value = db.query<{ value: string }, [string, string, string]>(
          "SELECT value FROM credentials WHERE name=? AND provider_id=? AND base_url=?",
        ).get(provider.apiKeySecret, provider.id, endpoint(provider))?.value;
      } finally { db.close(true); }
    } catch {
      if (envKey) return envKey;
      throw new Error("No se pudo leer la API key de SQLite. Revisá permisos de la configuración.");
    }
    if (value) return value;
    if (envKey) return envKey;
    throw new Error("API key ausente en SQLite. Configurá el proveedor en Models.");
  }
  if (provider.apiKeyEnv) {
    if (!envKey) throw new Error(`Falta la variable ${provider.apiKeyEnv} para ${provider.name}`);
    return envKey;
  }
  return undefined;
}
