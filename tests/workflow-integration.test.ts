import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { gitCommand } from "../src/system/git.ts";
import { listSessions, readSessionEvents } from "../src/storage/sessions.ts";
async function until(check: () => boolean | Promise<boolean>) { for (let i = 0; i < 1000; i++) { if (await check()) return; await Bun.sleep(5); } throw new Error("Escenario no alcanzó el estado esperado"); }

test("circuito TUI/CLI: sin Git → AGENTS explícito → plan → prueba → commit y recuperación aislada", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-workflow-")), cwd = join(root, "project"), other = join(root, "other"), config = join(root, "config.json");
  await mkdir(cwd); await mkdir(other);
  await Bun.write(join(cwd, "package.json"), '{"type":"module","scripts":{"test":"bun test"}}\n');
  await Bun.write(join(other, "preexisting.txt"), "Trabajo ajeno á文\n");
  const states = new Map<string, { stage: number; card?: any; run?: any }>();
  let generated = 0;
  const reply = (delta: object, finish = "stop") => new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`);
  const server = Bun.serve({ port: 0, async fetch(req) {
    if (req.method === "GET") return new Response("", { status: 404 });
    const body = await req.json() as any;
    if (!body.tools) { generated++; expect(body.messages[1].content).toContain('"test":"bun test"'); return reply({ content: "Proyecto Bun/TypeScript. Ejecutar bun test para verificar los cambios." }); }
    const contains = (text: string) => body.messages.some((m: any) => m.role === "user" && typeof m.content === "string" && m.content.includes(text));
    const kind = contains("Ciclo documental") ? "doc" : contains("Ciclo CLI") ? "cli" : "tui";
    const state = states.get(kind) ?? { stage: 0 }; states.set(kind, state);
    const previous = body.messages.filter((m: any) => m.role === "tool").at(-1);
    if (previous) {
      const result = JSON.parse(previous.content); if (result.failed) throw new Error(JSON.stringify(result)); expect(result.failed).toBe(false);
      if (state.stage === 1) state.card = JSON.parse(result.output)[0];
      if (state.stage === (kind === "doc" ? 3 : 4)) state.run = JSON.parse(result.output);
    }
    const file = `${kind}.ts`, check = `${kind}.test.ts`;
    const actions = kind === "doc" ? [
      ["task_plan", { objective: "Documentar saludo", steps: [{ title: "Uso documentado", criterion: "Describe el saludo existente sin cambiar código", verification: [{ kind: "review", description: "Revisar la escritura registrada", required: true, paths: ["notes.md"] }] }] }],
      ["write", { path: "notes.md", content: "# Uso\nImportar greeting de tui.ts. Devuelve Hola á文.\n" }],
      ["task_verify", { taskId: state.card?.id, verificationId: state.card?.verification[0].id, evidence: ["doc-2"] }],
      ["task_update", { id: state.card?.id, status: "done", result: "Uso documentado y revisado", acceptanceEvidence: [state.run?.id] }],
      ["task_closeout", { files: ["notes.md"], message: "Document greeting", summary: "Uso del saludo existente" }],
    ] : [
      ["task_plan", { objective: `Ciclo ${kind}`, steps: [{ title: `Función ${kind} á文`, criterion: "Devuelve el saludo Unicode y tiene una prueba ejecutada", verification: [{ kind: "command", description: "Prueba real Bun", command: `bun test ${check}`, required: true, paths: [file, check] }] }] }],
      ["write", { path: file, content: "export const greeting = () => 'Hola á文';\n" }],
      ["write", { path: check, content: `import {expect,test} from 'bun:test';\nimport {greeting} from './${file}';\ntest('saludo',()=>expect(greeting()).toBe('Hola á文'));\n` }],
      ["task_verify", { taskId: state.card?.id, verificationId: state.card?.verification[0].id }],
      ["task_update", { id: state.card?.id, status: "done", result: "Saludo probado", acceptanceEvidence: [state.run?.id] }],
      ["task_closeout", { files: [file, check], message: `Add ${kind} greeting`, summary: "Saludo Unicode con prueba real" }],
    ];
    const action = actions[state.stage++];
    return action ? reply({ tool_calls: [{ index: 0, id: `${kind}-${state.stage}`, function: { name: action[0], arguments: JSON.stringify(action[1]) } }] }, "tool_calls") : reply({ content: `Ciclo ${kind} terminado con commit registrado` });
  } });
  let child: ReturnType<typeof Bun.spawn> | undefined, terminal: Bun.Terminal | undefined;
  const git = async (args: string[]) => { const result = await gitCommand(cwd, args); expect(result.failed).toBe(false); return result.stdout.trim(); };
  try {
    const seed = await App.open({ config, cwd });
    const next = structuredClone(seed.store.value); next.providers = [{ id: "fixture", name: "Protocol fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}/v1`, models: [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, capabilities: { tools: true, images: false } }] }];
    await seed.store.save(next); const owner = seed.project!;
    await seed.selectModel({ providerId: "fixture", modelId: "fixture" });
    const alien = await seed.store.project("Other", other, root); await seed.switchProject(alien); seed.view.prompt.setValue("Borrador ajeno conservado");
    await seed.switchProject(owner); seed.view.prompt.setValue("Ciclo TUI: crear saludo con prueba y commit"); await seed.desktop.onBeforeExit!();
    let output = "";
    terminal = new Bun.Terminal({ cols: 120, rows: 32, data: (_, bytes) => { output += new TextDecoder().decode(bytes); } });
    child = Bun.spawn([process.execPath, join(import.meta.dir, "../index.ts"), "--config", config, "--no-color"], { cwd, terminal, env: { ...process.env, TERM: "xterm-256color" } });
    await until(() => output.includes("Ciclo TUI")); expect(await Bun.file(join(cwd, ".git/HEAD")).exists()).toBe(false);
    terminal.write("\x1bp\x1b[B\x1b[B\x1b[B\r"); await until(() => output.includes("AGENTS.md · preview"));
    expect(await Bun.file(join(cwd, "AGENTS.md")).exists()).toBe(false);
    terminal.write("\t\t\t\r"); await until(async () => Bun.file(join(cwd, "AGENTS.md")).exists());
    expect(await Bun.file(join(cwd, "AGENTS.md")).text()).toContain("Siempre hacer commit al terminar la tarea.");
    output = ""; terminal.write("\x1bp\x1b[B\x1b[B\x1b[B\x1b[B\r"); await until(() => output.includes("Inicializar repositorio Git")); terminal.write("\r");
    await until(async () => Bun.file(join(cwd, ".git/HEAD")).exists());
    await git(["config", "user.name", "Workflow fixture"]); await git(["config", "user.email", "fixture@example.invalid"]);
    output = ""; terminal.write("\r"); await until(() => output.includes("Ciclo tui terminado"));
    output = ""; terminal.write("\x1bv\x1b[B\x1b[B\r"); await until(() => output.includes("Terminadas")); expect(output).toContain("Función tui");
    terminal.write("\x11"); expect(await child.exited).toBe(0); expect(output).toContain("\x1b[?25h");
    const original = await git(["rev-parse", "HEAD"]); expect(await git(["show", "--format=", "--name-only", "HEAD"])).toContain("CHANGELOG.md");
    expect(await git(["show", "--format=", "--name-only", "HEAD"])).not.toContain("AGENTS.md");
    const savedConfig = await Bun.file(config).text();
    const cli = Bun.spawn([process.execPath, join(import.meta.dir, "../index.ts"), "--config", config, "--project", owner.name, "--prompting", "Ciclo CLI: crear saludo con prueba y commit"], { cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(cli.stdout).text(), new Response(cli.stderr).text(), cli.exited]);
    expect(code).toBe(0); expect(stdout).toContain("Ciclo cli terminado"); expect(stderr).not.toContain("Turno incompleto"); expect(await Bun.file(config).text()).toBe(savedConfig);
    expect(await git(["rev-list", "--count", "HEAD"])).toBe("2"); expect(await git(["rev-parse", "HEAD"])).not.toBe(original);
    const documented = Bun.spawn([process.execPath, join(import.meta.dir, "../index.ts"), "--config", config, "--project", owner.name, "--prompting", "Ciclo documental: documentar el saludo existente"], { cwd, stdout: "pipe", stderr: "pipe" });
    const [docOutput, docError, docCode] = await Promise.all([new Response(documented.stdout).text(), new Response(documented.stderr).text(), documented.exited]);
    expect(docCode).toBe(0); expect(docOutput).toContain("Ciclo doc terminado"); expect(docError).not.toContain("Turno incompleto");
    expect(await git(["show", "--format=", "--name-only", "HEAD"])).toBe("CHANGELOG.md\nTODO.md\nnotes.md");
    const events = (await Promise.all((await listSessions(join(root, "sessions"), owner.id)).map(s => readSessionEvents(join(root, "sessions"), owner.id, s.id)))).flat();
    expect(events.filter(e => e.type === "task-verification" && e.run.state === "passed")).toHaveLength(3);
    expect(events.filter(e => e.type === "task-closeout" && e.state === "committed")).toHaveLength(3);
    expect(events.filter(e => e.type === "task-verification" && e.run.state === "passed" && e.run.command)).toHaveLength(2);
    const reopened = await App.open({ config }); expect(reopened.view.response.value).toContain("Ciclo tui terminado"); await reopened.switchProject(alien);
    expect(reopened.view.prompt.value).toBe("Borrador ajeno conservado"); expect(await Bun.file(join(other, "preexisting.txt")).text()).toBe("Trabajo ajeno á文\n"); await reopened.desktop.onBeforeExit!();
    expect(generated).toBe(1);
  } finally { child?.kill(); terminal?.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 20000);
