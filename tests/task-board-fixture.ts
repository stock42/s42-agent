import { expect } from "bun:test";
import type { TaskCard } from "../src/storage/tasks.ts";
export const makeCard = (title: string): TaskCard => ({ id: `T-${crypto.randomUUID()}`, requestId: `R-${crypto.randomUUID()}`, title, description: "Objetivo", criterion: "resultado observable", dependencies: [], status: "pending",
  verification: [{ id: `V-${crypto.randomUUID()}`, kind: "review", description: "revisar", required: true, paths: [] }], result: "pendiente", origin: "user", acceptanceEvidence: [] });
export async function until(check: () => boolean) { for (let i = 0; i < 500 && !check(); i++) await Bun.sleep(5); expect(check()).toBe(true); }
