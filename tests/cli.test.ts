import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { parseArgs } from "../index.ts";
import { defaultConfig } from "../src/storage/config.ts";

const index = resolve(import.meta.dir, "../index.ts");
const event = (delta: unknown, finish_reason = "stop") => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } })}\n\ndata: [DONE]\n\n`;
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout esperando CLI");
}
function launch(args: string[], cwd: string, env: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, index, ...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...process.env, TERM: "dumb", ...env } });
  let stdout = "", stderr = "";
  const drain = async (stream: ReadableStream<Uint8Array>, append: (text: string) => void) => {
    const reader = stream.getReader(), decoder = new TextDecoder();
    try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; append(decoder.decode(chunk.value, { stream: true })); } append(decoder.decode()); }
    finally { reader.releaseLock(); }
  };
  const out = drain(child.stdout, text => stdout += text), err = drain(child.stderr, text => stderr += text);
  const timer = setTimeout(() => child.kill(), 8000);
  const done = Promise.all([child.exited, out, err]).then(([code]) => ({ code, stdout, stderr })).finally(() => clearTimeout(timer));
  return { child, done, get stdout() { return stdout; }, get stderr() { return stderr; } };
}
async function sessionFiles(root: string) {
  return Array.fromAsync(new Bun.Glob("sessions/**/*.jsonl").scan({ cwd: root, absolute: true }));
}

test("CLI acepta flags, prompting literal multilínea y =; rechaza argumentos ambiguos", () => {
  const parsed = parseArgs(["--llm_server", "http://localhost/v1", "--llm_port=8080", "--llm_apikey", "test-key", "--prompting", " pedido á文🙂\nsegunda línea ", "--reasoning", "off"]);
  expect(parsed).toMatchObject({ llmServer: "http://localhost/v1", llmPort: 8080, llmApiKey: "test-key", prompting: " pedido á文🙂\nsegunda línea ", reasoning: "off" });
  expect(parseArgs(["--prompting=--help"]).help).toBe(false);
  for (const args of [["--llm_port", "0"], ["--llm_port", "65536"], ["--llm_port", "1.5"], ["--llm_port", "oops"], ["--reasoning", "yes"], ["--prompting", " "], ["--llm_server", "--prompting"], ["--llm_server", "localhost"], ["--demo", "--prompting", "hola"], ["--cwd", ".", "--project", "x"]])
    expect(() => parseArgs(args)).toThrow();
});

test("index.ts sin TTY descubre modelo, autentica, lee/escribe/ejecuta y reabre sin alterar config", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-cli-coding-")), cwd = join(root, "proyecto á文"), config = join(root, "config.json");
  await mkdir(cwd); await Bun.write(join(cwd, "AGENTS.md"), "CLI_GUIDANCE: revisar antes de escribir."); await Bun.write(join(cwd, "game.ts"), "console.log('antes');");
  const bodies: any[] = [], auth: (string | null)[] = []; let discoveries = 0;
  const calls = [{ name: "read", args: { path: "game.ts" } }, { name: "write", args: { path: "game.ts", content: "console.log('tetris fixture');\n" } }, { name: "shell", args: { command: "bun game.ts" } }];
  const server = Bun.serve({ port: 0, async fetch(req) {
    auth.push(req.headers.get("authorization"));
    if (req.url.endsWith("/models")) { discoveries++; return Response.json({ data: [{ id: "fixture", context_window: 32000, max_output_tokens: 1000 }] }); }
    bodies.push(await req.json()); const call = calls[bodies.length - 1];
    return new Response(event(call ? { reasoning_content: "pensamiento oculto", tool_calls: [{ index: 0, id: `call-${bodies.length}`, function: { name: call.name, arguments: JSON.stringify(call.args) } }] }
      : { reasoning_content: "pensamiento visible", content: bodies.length === 4 ? "Juego escrito y ejecutado á文🙂." : "Continuación." }, call ? "tool_calls" : "stop"));
  } });
  const base = ["--config", config, "--llm_server", "http://127.0.0.1/v1", "--llm_port", String(server.port), "--llm_apikey", "cli-test-key"];
  try {
    const result = await launch([...base, "--prompting", "Desarrollá tetris\nsegunda línea", "--reasoning", "off"], cwd).done;
    expect(result.code).toBe(0); expect(result.stdout).toBe("Juego escrito y ejecutado á文🙂.\n");
    expect(result.stderr).toContain("Tool read:"); expect(result.stderr).toContain("Tool write:"); expect(result.stderr).toContain("Tool shell:"); expect(result.stderr).toContain("tetris fixture");
    expect(result.stderr).toMatch(/Tokens E\/S 400\/40 · Prom\. \d+\.\d tok\/s/);
    expect(result.stderr).not.toContain("pensamiento"); expect(result.stderr + result.stdout).not.toContain("\x1b");
    expect(result.stderr).not.toContain("cli-test-key"); expect(discoveries).toBe(1); expect(auth.every(value => value === "Bearer cli-test-key")).toBe(true);
    expect(bodies[0].model).toBe("fixture"); expect(bodies[0].messages[0].content).toContain("CLI_GUIDANCE");
    expect(bodies[0].messages.at(-1).content).toBe("Desarrollá tetris\nsegunda línea"); expect(bodies[0].tools.map((tool: any) => tool.function.name)).toContain("internal_skill");
    expect(await Bun.file(join(cwd, "game.ts")).text()).toBe("console.log('tetris fixture');\n"); expect(await Bun.file(config).exists()).toBe(false);
    const files = await sessionFiles(root); expect(files).toHaveLength(1);
    const saved = await Bun.file(files[0]!).text(); expect(saved).toContain("pensamiento oculto"); expect(saved).not.toContain("cli-test-key"); expect(saved).toContain('"state":"completed"');
    const id = basename(files[0]!, ".jsonl");
    const resumed = await launch([...base, "--model", "fixture", "--session", id, "--prompting", "continuar", "--reasoning", "on"], cwd).done;
    expect(resumed.code).toBe(0); expect(resumed.stdout).toBe("Continuación.\n"); expect(resumed.stderr).toContain("Razonamiento: pensamiento visible");
    expect(discoveries).toBe(1); expect(bodies[4].messages.filter((message: any) => message.role === "tool")).toHaveLength(3);
    expect((await Bun.file(files[0]!).text()).match(/"type":"tool-start"/g)).toHaveLength(3);
    expect(await Bun.file(files[0]! + ".lock").exists()).toBe(false);
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("CLI respeta proyecto/modelo/capacidades/key de config y URL base con path", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-cli-config-")), cwd = join(root, "work"), config = join(root, "config.json"); await mkdir(cwd);
  let body: any, url = "", authorization: string | null = null;
  const server = Bun.serve({ port: 0, async fetch(req) { url = new URL(req.url).pathname; authorization = req.headers.get("authorization"); body = await req.json(); return new Response(event({ content: "Modelo configurado." })); } });
  const value = defaultConfig(); value.projects = [{ id: "registered", name: "Elegido", path: cwd, selection: { providerId: "llama.cpp", modelId: "configured" } }];
  value.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/api`; value.providers[0]!.apiKeyEnv = "S42_CLI_TEST_KEY";
  value.providers[0]!.models = [{ id: "configured", name: "Configured", contextWindow: 16000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
  await mkdir(join(cwd, "cli-guide"));
  const skillPath = join(cwd, "cli-guide", "SKILL.md"); await Bun.write(skillPath, "---\nname: cli-guide\ndescription: CLI guide\n---\nCLI_SKILL_GUIDANCE: responder brevemente.");
  value.skills = [{ id: "cli-guide", name: "cli-guide", path: skillPath, enabled: true, projectId: "registered" }];
  const source = JSON.stringify(value); await Bun.write(config, source);
  try {
    const result = await launch(["--config", config, "--project", "Elegido", "--prompting", "/skill cli-guide Hola"], root, { S42_CLI_TEST_KEY: "env-test-key" }).done;
    expect(result.code).toBe(0); expect(result.stdout).toBe("Modelo configurado.\n"); expect(result.stderr).toContain("Proyecto: Elegido");
    expect(url).toBe("/api/chat/completions"); expect(String(authorization)).toBe("Bearer env-test-key"); expect(body.model).toBe("configured"); expect(body.tools).toBeUndefined();
    expect(body.messages[0].content).toContain(cwd); expect(await Bun.file(config).text()).toBe(source);
    expect(body.messages[0].content).toContain("CLI_SKILL_GUIDANCE"); expect(result.stderr).toContain("Skill cli-guide: instrucciones cargadas por pedido");
    expect((await sessionFiles(root))[0]).toContain("/sessions/registered/");
    // Changing server uses its catalog and does not inherit the old server's key/model.
    const headers: (string | null)[] = []; let switched: any;
    const other = Bun.serve({ port: 0, async fetch(req) {
      headers.push(req.headers.get("authorization"));
      if (req.url.endsWith("/models")) return Response.json({ data: [{ id: "other-model", context_window: 32000 }] });
      switched = await req.json(); return new Response(event({ content: "Otro servidor." }));
    } });
    try {
      const saved = JSON.parse(source); saved.providers[0].apiKeySecret = "fixture-unread-keychain-reference";
      const withSecret = JSON.stringify(saved); await Bun.write(config, withSecret);
      const override = await launch(["--config", config, "--project", "Elegido", "--llm_server", `http://127.0.0.1:${other.port}`, "--prompting", "Hola"], root).done;
      expect(override.code).toBe(0); expect(override.stdout).toBe("Otro servidor.\n"); expect(switched.model).toBe("other-model");
      expect(headers).toEqual([null, null]); expect(switched.tools.length).toBeGreaterThan(0); expect(await Bun.file(config).text()).toBe(withSecret);
    } finally { other.stop(true); }
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("CLI informa errores HTTP y de argumentos, devuelve exit code sin arrancar TUI", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-cli-errors-")), config = join(root, "config.json");
  const server = Bun.serve({ port: 0, fetch: () => new Response("denied", { status: 401 }) });
  try {
    for (const args of [["--reasoning", "invalid"], ["--llm_port", "abc"], ["--llm_server", "ftp://host", "--prompting", "hola"], ["--unknown"], []]) {
      const result = await launch(["--config", config, ...args], root).done;
      expect(result.code).toBe(1); expect(result.stdout).toBe(""); expect(result.stderr).toBeTruthy(); expect(result.stderr).not.toContain("\x1b");
    }
    const result = await launch(["--config", config, "--llm_server", `http://127.0.0.1:${server.port}`, "--model", "fixture", "--prompting", "hola"], root).done;
    expect(result.code).toBe(1); expect(result.stderr).toContain("HTTP 401"); expect(result.stdout).toBe("");
    const files = await sessionFiles(root); expect(files).toHaveLength(1); expect(await Bun.file(files[0]!).text()).toContain('"state":"failed"'); expect(await Bun.file(files[0]! + ".lock").exists()).toBe(false);
    expect(await Bun.file(config).exists()).toBe(false);
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("SIGINT/SIGTERM cancelan stream CLI, conservan parciales y liberan locks", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-cli-cancel-")), config = join(root, "config.json"), encoder = new TextEncoder();
  const server = Bun.serve({ port: 0, fetch: () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"thought guardado","content":"parcial á文🙂"}}]}\n\n'));
  } })) });
  try {
    for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
      const run = launch(["--config", config, "--llm_server", `http://127.0.0.1:${server.port}/v1`, "--model", "fixture", "--prompting", "lento", "--reasoning", "off"], root);
      try { await until(() => run.stdout.includes("parcial á文🙂")); run.child.kill(signal); const result = await run.done;
        expect(result.code).toBe(code); expect(result.stdout).toBe("parcial á文🙂\n"); expect(result.stderr).toContain("Turno cancelado"); expect(result.stderr).not.toContain("thought guardado");
      } finally { run.child.kill(); await run.done; }
    }
    const files = await sessionFiles(root); expect(files).toHaveLength(2);
    for (const file of files) { const saved = await Bun.file(file).text(); expect(saved).toContain("thought guardado"); expect(saved).toContain('"state":"cancelled"'); expect(await Bun.file(file + ".lock").exists()).toBe(false); }
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("CLI recupera length por etapas y publica streaming sin el marcador interno", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-cli-stages-")), config = join(root, "config.json"); let requests = 0;
  const server = Bun.serve({ port: 0, fetch: () => {
    requests++; return new Response(event({ content: requests === 1 ? "parcial" : requests === 2 ? "Etapa 1 lista [[S42_CONTINUE]]" : "Etapa 2 terminada" }, requests === 1 ? "length" : "stop"));
  } });
  try {
    const result = await launch(["--config", config, "--cwd", root, "--llm_server", `http://127.0.0.1:${server.port}`, "--model", "fixture", "--prompting", "desarrollar"], root).done;
    expect(result.code).toBe(0); expect(result.stdout).toContain("parcial\n\nEtapa 1 lista"); expect(result.stdout).toContain("Etapa 2 terminada"); expect(result.stdout).not.toContain("S42_CONTINUE");
    expect(result.stderr).toContain("dividiendo el pedido en etapas pequeñas"); expect(result.stderr).toContain("Tokens E/S 300/30"); expect(requests).toBe(3);
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});
