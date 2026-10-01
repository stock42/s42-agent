import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SessionEvent } from "./sessions.ts";

export const isDatabase = (path: string) => /\.(sqlite|sqlite3|db)$/i.test(path);
export async function openDatabase(path: string): Promise<Database> {
  await mkdir(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  try {
    db.run("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (project_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, id));
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, project_id TEXT NOT NULL, session_id TEXT NOT NULL, data TEXT NOT NULL,
        FOREIGN KEY(project_id, session_id) REFERENCES sessions(project_id, id));
      CREATE INDEX IF NOT EXISTS events_session ON events(project_id, session_id, seq);`);
    return db;
  } catch (error) { db.close(true); throw error; }
}
export function setting(db: Database, key: string): string | undefined {
  return (db.query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?").get(key))?.value;
}
export function setSetting(db: Database, key: string, value: string): void {
  db.query("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
export function insertEvent(db: Database, sessionId: string, event: SessionEvent): void {
  db.query(`INSERT INTO sessions(project_id,id,title,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(project_id,id) DO UPDATE SET updated_at=excluded.updated_at`).run(event.projectId, sessionId, "Nueva sesión", event.at);
  if (event.type === "session") db.query("UPDATE sessions SET title=? WHERE project_id=? AND id=?").run(event.title, event.projectId, sessionId);
  db.query("INSERT INTO events(event_id,project_id,session_id,data) VALUES(?,?,?,?)").run(event.id, event.projectId, sessionId, JSON.stringify(event));
}
