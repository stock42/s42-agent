import { taskWorkflow } from "./task-provider-fixture.ts";
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import { runCommand } from "../src/system/command.ts";

async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("No llegó la salida del proceso en ejecución");
}

test("shell transmite stdout/stderr y UTF-8 fragmentado antes de terminar, conservando salida al cancelar", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-shell-stream-")), controller = new AbortController();
  let stdout = "", stderr = "", settled = false;
  await Bun.write(join(root, "check.ts"), `
    const bytes = Buffer.from("RESULTADO: OK á文🙂\\n");
    for (const byte of bytes) { process.stdout.write(new Uint8Array([byte])); await Bun.sleep(2); }
    console.error("timer activo á文🙂"); setInterval(() => {}, 1000);
  `);
  const pending = runCommand([process.execPath, "check.ts"], { cwd: root, signal: controller.signal,
    onOutput: (stream, text) => { if (stream === "stdout") stdout += text; else stderr += text; },
  }).finally(() => { settled = true; });
  try {
    await until(() => stderr.includes("timer activo"));
    expect(settled).toBe(false); expect(stdout).toBe("RESULTADO: OK á文🙂\n"); expect(stderr).toBe("timer activo á文🙂\n");
    controller.abort(new Error("Cancelado por usuario"));
    expect(await pending).toMatchObject({ stdout, stderr, failed: true, cancelled: true, timedOut: false, truncated: false });
  } finally { controller.abort(); await pending; await rm(root, { recursive: true, force: true }); }
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-shell-ui-")), config = join(root, "config.json"), initial = defaultConfig();
  for (const id of ["alpha", "beta"]) { await mkdir(join(root, id)); initial.projects.push({ id, name: id, path: join(root, id) }); }
  initial.lastProjectId = "alpha";
  await Bun.write(join(root, "alpha/check.ts"), `console.log("RESULTADO: OK á文🙂"); console.error("Timer sigue abierto"); setInterval(() => {}, 1000);`);
  let requests = 0; const workflow=taskWorkflow(1);
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body=await req.json() as any;const flow=workflow(body);if(flow)return flow; requests++;
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "check", function: { name: "shell", arguments: JSON.stringify({ command: "bun check.ts" }) } }] }, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`);
  } });
  initial.providers = [{ id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}/v1`, models: [
    { id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, capabilities: { tools: true, images: false } },
  ] }]; initial.defaults = { providerId: "fixture", modelId: "fixture" };
  await Bun.write(config, JSON.stringify(initial));
  return { root, config, server, requests: () => requests };
}

test("TUI muestra salida durante shell, aísla proyectos y conserva un resultado único al cancelar y reabrir", async () => {
  const { root, config, server, requests } = await fixture(); let app = await App.open({ config });
  try {
    const alpha = app.tabs[0]!, session = alpha.session!;
    await session.append({ type: "turn", state: "failed", detail: "Proveedor: HTTP 400" }); session.state.notices.push("Proveedor: HTTP 400");
    app.view.prompt.setValue("Verificar ahora"); await app.submit();
    await until(() => alpha.response.value.includes("Timer sigue abierto"));
    expect(alpha.busy).toBe(true); expect(alpha.agentState).toBe("Ejecutando shell…"); expect(requests()).toBe(1);
    expect(alpha.response.value.indexOf("HTTP 400")).toBeLessThan(alpha.response.value.indexOf("Verificar ahora"));
    expect(alpha.response.value).toContain("stdout · shell:\nRESULTADO: OK á文🙂");
    expect(alpha.response.value).toContain("stderr · shell:\nTimer sigue abierto");
    expect(session.state.messages.filter(message => message.role === "tool" && !message.tool_call_id?.startsWith('fixture-task-'))).toHaveLength(0);
    await app.switchProject(app.store.value.projects[1]!);
    expect(app.view.response.value).not.toContain("RESULTADO:"); expect(alpha.busy).toBe(true);
    await app.activateTab(alpha.id); await app.setLanguage("en");
    expect(app.view.response.value).toContain("RESULTADO: OK á文🙂"); expect(app.view.response.value).toContain("Turn failed:");
    for (const [width, height] of [[60, 16], [120, 32]] as const) {
      app.desktop.resize(width, height); expect(app.desktop.draw().lines().every(line => Bun.stringWidth(line) === width)).toBe(true);
    }
    app.cancel(); await alpha.turn;
    expect(alpha.busy).toBe(false); expect(requests()).toBe(1);
    const tool = session.state.messages.find(message => message.role === "tool" && !message.tool_call_id?.startsWith('fixture-task-'))!;
    const result = JSON.parse(tool.content as string); expect(result.failed).toBe(true);
    expect(JSON.parse(result.output)).toMatchObject({ stdout: "RESULTADO: OK á文🙂\n", stderr: "Timer sigue abierto\n", cancelled: true });
    expect(alpha.response.value.split("RESULTADO:")).toHaveLength(2);
    expect(alpha.response.value).toContain("Turn cancelled:");
    const before = alpha.response.value;
    await app.desktop.onBeforeExit!(); app = await App.open({ config });
    expect(app.view.response.value).toBe(before);
    expect(app.session!.state.messages.filter(message => message.role === "tool" && !message.tool_call_id?.startsWith("fixture-task-"))).toHaveLength(1);
  } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("bun run dev en PTY muestra salida sin esperar cierre; Ctrl+C y Ctrl+Q restauran terminal", async () => {
  const { root, config, server, requests } = await fixture(); let output = "";
  const decoder = new TextDecoder(), terminal = new Bun.Terminal({ cols: 100, rows: 30, data: (_, bytes) => { output += decoder.decode(bytes, { stream: true }); } });
  const child = Bun.spawn([process.execPath, "run", "dev", "--config", config, "--no-color"], {
    cwd: resolve(import.meta.dir, ".."), terminal, env: { ...process.env, TERM: "xterm-256color" },
  });
  try {
    await until(() => output.includes("Fixture · fixture")); terminal.write("Verificar ahora\r");
    await until(() => output.includes("Timer sigue abierto"));
    expect(output).toContain("RESULTADO: OK á文🙂"); expect(output).toContain("stdout · shell:"); expect(requests()).toBe(1);
    expect(child.exitCode).toBeNull();
    terminal.resize(60, 16); child.kill("SIGWINCH");
    terminal.write("\x03"); await until(() => output.includes("Turno cancelado"));
    terminal.write("\x11"); expect(await child.exited).toBe(0);
    for (const restore of ["\x1b[?1049l", "\x1b[?25h", "\x1b[?1003l", "\x1b[?1006l", "\x1b[?2004l"]) expect(output).toContain(restore);
  } finally { child.kill(); await child.exited; terminal.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
