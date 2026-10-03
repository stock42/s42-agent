import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject, instructionsDraft, applyInstructions, previewInstructions, generateInstructions } from "../src/ui/project-instructions.ts";
import { MenuBar } from "../src/ui/components/menu.ts";
import { Desktop } from "../src/ui/desktop.ts";
import { gitInitialize, gitRepository } from "../src/system/git.ts";
const signal = () => new AbortController().signal;
test("AGENTS inspecciona sin ejecutar scripts; conserva alcance/conflictos y repetir no duplica", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-agents-"));
  try {
    await mkdir(join(root, "src")); await Bun.write(join(root, "package.json"), JSON.stringify({ scripts: { test: "echo real", dev: "touch NEVER" } }));
    await Bun.write(join(root, "AGENTS.md"), "# Original\nNo hacer commit automáticamente.\nSiempre hacer push en main.\n"); await Bun.write(join(root, "src/AGENTS.md"), "regla anidada");
    const inspected = await inspectProject(root, signal()); expect(inspected.context).toContain("echo real"); expect(inspected.context).toContain("regla anidada"); expect(inspected.conflicts).toHaveLength(1); expect(await Bun.file(join(root, "NEVER")).exists()).toBe(false);
    const draft = instructionsDraft(inspected.previous, "Stack comprobado"); const desktop = new Desktop(new MenuBar([]), 80, 24); previewInstructions(desktop, inspected, draft); desktop.close(); expect(await Bun.file(join(root, "AGENTS.md")).text()).toBe(inspected.previous);
    await applyInstructions(inspected, draft); const next = await inspectProject(root, signal()); const repeated = instructionsDraft(next.previous, "Stack comprobado"); expect(repeated).toBe(draft); expect(repeated.match(/Siempre hacer commit/g)).toHaveLength(1); expect(repeated).toContain("Siempre hacer push en main.");
    await Bun.write(join(root, "AGENTS.md"), draft + "edición externa"); await expect(applyInstructions(next, repeated)).rejects.toThrow("cambió");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("Git init solo explícito; detecta padre sin crear repositorio anidado", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-init-"));
  try {
    expect((await gitRepository(root)).state).toBe("missing"); expect(await Bun.file(join(root, ".git/HEAD")).exists()).toBe(false);
    expect((await gitInitialize(root, signal())).state).toBe("ready"); await mkdir(join(root, "child")); const child = await gitInitialize(join(root, "child"), signal()); expect(child.state === "ready" && child.root).toBe(root); expect(await Bun.file(join(root, "child/.git/HEAD")).exists()).toBe(false);
    const repo = await gitRepository(root); expect(repo.state === "ready" && repo.status.head).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("generación recibe contexto sin tools y conserva los deltas del proveedor", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-generation-")); let partial = "";
  const server = Bun.serve({ port: 0, async fetch(req) { const body = await req.json() as any; expect(body.tools).toBeUndefined(); expect(body.messages[1].content).toContain("package.json"); return new Response('data: {"choices":[{"delta":{"content":"Proyecto Bun"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'); } });
  try { await Bun.write(join(root, "package.json"), '{"scripts":{"test":"bun test"}}'); const inspected = await inspectProject(root, signal()); expect(await generateInstructions(inspected, { id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: [] }, { id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, capabilities: { tools: false, images: false } }, undefined, signal(), text => { partial += text; })).toBe("Proyecto Bun"); expect(partial).toBe("Proyecto Bun"); expect(await Bun.file(join(root, "AGENTS.md")).exists()).toBe(false); }
  finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});
