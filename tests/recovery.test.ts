import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";
import { complete, CompletionError } from "../src/llm/client.ts";

const packet = (delta: unknown, finish_reason = "stop") => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\ndata: [DONE]\n\n`;
async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("Timeout en recuperación por etapas");
}
async function fixture(port: number, maxSteps = 30) {
  const root = await mkdtemp(join(tmpdir(), "s42-recovery-")), config = defaultConfig(), path = join(root, "config.json");
  config.providers[0]!.baseUrl = `http://127.0.0.1:${port}/v1`;
  config.providers[0]!.models = [{ id: "fixture", name: "Fixture", contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }];
  config.defaults.modelId = "fixture"; config.limits.maxSteps = maxSteps;
  await Bun.write(path, JSON.stringify(config)); return { root, path };
}

test("length conserva parcial, entrega etapas, oculta control fragmentado y no repite tools previas", async () => {
  const requests: any[] = [], seen: string[] = [];
  const call = (id: string, path: string, content: string) => ({ tool_calls: [{ index: 0, id, function: { name: "write", arguments: JSON.stringify({ path, content }) } }] });
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any; requests.push(body);
    if (requests.length === 1) return new Response(packet(call("first", "first.txt", "realizado una vez"), "tool_calls"));
    if (requests.length === 2) return new Response(packet({ reasoning_content: "Razonamiento parcial", content: "Código á文🙂 incompleto", tool_calls: [{ index: 0, id: "discarded", function: { name: "write", arguments: '{"path":"discarded.txt","content":' } }] }, "length"));
    if (requests.length === 3) return new Response(new ReadableStream({ async start(c) {
      for (const character of "Etapa 1 · parte pequeña\n[[S42_CONTINUE]]") {
        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: character } }] })}\n\n`)); await Bun.sleep(1);
      }
      c.enqueue(new TextEncoder().encode(packet({}))); c.close();
    } }));
    if (requests.length === 4) return new Response(packet(call("second", "second.txt", "segunda etapa"), "tool_calls"));
    return new Response(packet({ content: "Etapa 2 · pedido completado", reasoning_content: "Verifico las dos etapas" }));
  } });
  const { root, path } = await fixture(server.port!), app = await App.open({ config: path, cwd: root }); let closed = false;
  app.desktop.invalidate = () => seen.push(app.view.response.value);
  try {
    app.view.prompt.setValue("Pedido original completo"); await app.submit(); await until(() => !app.busy);
    expect(requests).toHaveLength(5); expect(app.status).toStartWith("Listo");
    expect(requests[2].messages.at(-1).content).toContain("dividilo en etapas pequeñas");
    expect(requests[2].messages.at(-1).content).toContain("etapa 1");
    expect(requests[3].messages.at(-1).content).toContain("etapa 2");
    expect(requests[4].messages.at(-1).role).toBe("tool");
    expect(requests[4].messages.filter((m:any)=>m.role==="user" && m.content.includes("Esta es la etapa"))).toHaveLength(1);
    expect(requests[2].messages.some((m: any) => m.content === "Pedido original completo")).toBe(true);
    expect(requests[2].messages.some((m: any) => m.content === "Código á文🙂 incompleto" && !m.tool_calls)).toBe(true);
    expect(requests.every(body => body.max_tokens === 1000)).toBe(true);
    expect(await Bun.file(join(root, "first.txt")).text()).toBe("realizado una vez");
    expect(await Bun.file(join(root, "second.txt")).text()).toBe("segunda etapa");
    expect(await Bun.file(join(root, "discarded.txt")).exists()).toBe(false);
    expect(app.session!.state.events.filter(e => e.type === "tool-start")).toHaveLength(2);
    expect(app.session!.state.messages.filter(m => m.role === "user")).toHaveLength(1);
    for (const text of seen) expect(text).not.toContain("[[S42_");
    expect(app.view.response.value).toContain("Razonamiento parcial"); expect(app.view.response.value).toContain("Etapa 1 · parte pequeña");
    expect(app.view.response.value).toContain("Etapa 2 · pedido completado");
    const id = app.session!.state.id; await app.desktop.onBeforeExit!(); closed = true;
    const reopened = await App.open({ config: path, session: id });
    try { expect(reopened.view.response.value).toContain("Código á文🙂 incompleto"); expect(reopened.view.response.value).toContain("Etapa 2 · pedido completado"); expect(requests).toHaveLength(5); }
    finally { await reopened.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("length es tipado; HTTP, timeout y cancelación no disparan etapas ni nuevos requests", async () => {
  const limited = Bun.serve({ port: 0, fetch: () => new Response(packet({ content: "parcial" }, "length")) });
  const f = await fixture(limited.port!), app = await App.open({ config: f.path, cwd: f.root });
  try {
    try { await complete({ provider: app.store.value.providers[0]!, model: app.current().model, messages: [], signal: new AbortController().signal, firstEventMs: 1000, idleMs: 1000, onDelta: () => {} }); throw Error("Debe fallar"); }
    catch (e) { expect(e).toBeInstanceOf(CompletionError); expect((e as CompletionError).finishReason).toBe("length"); expect((e as CompletionError).partial.content).toBe("parcial"); }
  } finally { await app.desktop.onBeforeExit!(); limited.stop(true); await rm(f.root, { recursive: true, force: true }); }
  for (const mode of ["http", "idle", "cancel"] as const) {
    let requests = 0;
    const server = Bun.serve({ port: 0, fetch() {
      requests++;
      return mode === "http" ? new Response("", { status: 503 }) : new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"parcial de fallo"}}]}\n\n')); } }));
    } });
    const { root, path } = await fixture(server.port!), app = await App.open({ config: path, cwd: root });
    try {
      app.store.value.limits.idleMs = 20; app.view.prompt.setValue("Pedido"); await app.submit();
      if (mode === "cancel") { await until(() => app.view.response.value.includes("parcial de fallo")); app.cancel(); }
      await until(() => !app.busy); expect(requests).toBe(1);
      expect(app.session!.state.notices.some(n => n.includes("dividiendo"))).toBe(false);
      if (mode !== "http") expect(app.view.response.value).toContain("parcial de fallo");
    } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});

test("recuperación repetida está acotada por maxSteps y cancelación detiene la etapa activa", async () => {
  for (const mode of ["length", "next", "cancel"] as const) {
    let requests = 0;
    const server = Bun.serve({ port: 0, fetch() {
      requests++;
      if (requests === 1 || mode === "length") return new Response(packet({ content: `parcial ${requests}` }, "length"));
      if (mode === "cancel") return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"etapa activa\\n[[S42_CON"}}]}\n\n')); } }));
      return new Response(packet({ content: "Etapa pequeña\n[[S42_CONTINUE]]" }));
    } });
    const { root, path } = await fixture(server.port!, 2), app = await App.open({ config: path, cwd: root });
    try {
      app.view.prompt.setValue("Pedido"); await app.submit();
      if (mode === "cancel") { await until(() => app.view.response.value.includes("etapa activa")); app.cancel(); }
      await until(() => !app.busy); expect(requests).toBe(mode === "cancel" ? 2 : 3);
      expect(app.status).toContain(mode === "cancel" ? "cancelado" : "Límite de etapas");
      expect(app.view.response.value).toContain("parcial 1"); expect(app.view.response.value).not.toContain("[[S42_");
      expect(app.session!.state.events.some(e => e.type === "turn" && e.state === (mode === "cancel" ? "cancelled" : "failed"))).toBe(true);
    } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});
