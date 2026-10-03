import { taskWorkflow } from "./task-provider-fixture.ts";
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
async function fixture(port: number) {
  const root = await mkdtemp(join(tmpdir(), "s42-recovery-")), config = defaultConfig(), path = join(root, "config.json");
  config.providers[0]!.baseUrl = `http://127.0.0.1:${port}/v1`;
  config.providers[0]!.models = [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: true, images: false } }];
  config.defaults.modelId = "fixture";
  await Bun.write(path, JSON.stringify({ ...config, limits: { maxSteps: 1, shellTimeoutMs: 1, firstEventMs: 1, idleMs: 1 } })); return { root, path };
}
test('TUI ignora timeouts legacy durante primer evento y pausas SSE, sin recortar tokens manuales',async()=>{
 let body:any;
 const server=Bun.serve({port:0,async fetch(req){body=await req.json();return new Response(new ReadableStream({async start(c){
  await Bun.sleep(30);c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"Parcial"}}]}\n\n'));
  await Bun.sleep(30);c.enqueue(new TextEncoder().encode(packet({content:'Completado'})));c.close();
 }}));}});
 const {root,path}=await fixture(server.port!),app=await App.open({config:path,cwd:root});
 try{app.view.prompt.setValue('Continuá');await app.submit();await until(()=>!app.busy);
  expect(app.status).toStartWith('Listo');expect(app.view.response.value).toContain('Completado');expect(app.view.response.value).toContain('Parcial');
  expect(Object.hasOwn(body,'max_tokens')).toBe(false);expect(Object.hasOwn(JSON.parse(await Bun.file(path).text()),'limits')).toBe(false);
 }finally{await app.desktop.onBeforeExit!();server.stop(true);await rm(root,{recursive:true,force:true});}
});

test("length conserva parcial, entrega etapas, oculta control fragmentado y no repite tools previas", async () => {
  const requests: any[] = [], seen: string[] = [];const workflow=taskWorkflow(2);
  const call = (id: string, path: string, content: string) => ({ tool_calls: [{ index: 0, id, function: { name: "write", arguments: JSON.stringify({ path, content }) } }] });
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body = await req.json() as any;const flow=workflow(body);if(flow)return flow; requests.push(body);
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
    expect(requests.every(body => !Object.hasOwn(body,"max_tokens"))).toBe(true);
    expect(await Bun.file(join(root, "first.txt")).text()).toBe("realizado una vez");
    expect(await Bun.file(join(root, "second.txt")).text()).toBe("segunda etapa");
    expect(await Bun.file(join(root, "discarded.txt")).exists()).toBe(false);
    expect(app.session!.state.events.filter(e => e.type === "tool-start" && !e.name.startsWith("task_"))).toHaveLength(2);
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

test("length es tipado; HTTP y cancelación no disparan etapas ni nuevos requests", async () => {
  const limited = Bun.serve({ port: 0, fetch: () => new Response(packet({ content: "parcial" }, "length")) });
  const f = await fixture(limited.port!), app = await App.open({ config: f.path, cwd: f.root });
  try {
    try { await complete({ provider: app.store.value.providers[0]!, model: app.current().model, messages: [], signal: new AbortController().signal, onDelta: () => {} }); throw Error("Debe fallar"); }
    catch (e) { expect(e).toBeInstanceOf(CompletionError); expect((e as CompletionError).finishReason).toBe("length"); expect((e as CompletionError).partial.content).toBe("parcial"); }
  } finally { await app.desktop.onBeforeExit!(); limited.stop(true); await rm(f.root, { recursive: true, force: true }); }
  for (const mode of ["http", "cancel"] as const) {
    let requests = 0;
    const server = Bun.serve({ port: 0, fetch() {
      requests++;
      return mode === "http" ? Response.json({ error: { message: "Invalid assistant message: content or tool_calls must be set" } }, { status: 400 }) : new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"parcial de fallo"}}]}\n\n')); } }));
    } });
    const { root, path } = await fixture(server.port!), app = await App.open({ config: path, cwd: root });
    try {
      app.view.prompt.setValue("Pedido"); await app.submit();
      if (mode === "cancel") { await until(() => app.view.response.value.includes("parcial de fallo")); app.cancel(); }
      await until(() => !app.busy); expect(requests).toBe(1);
      expect(app.session!.state.notices.some(n => n.includes("dividiendo"))).toBe(false);
      if (mode === "http") {
        expect(app.status).toContain("HTTP 400: Invalid assistant message");
        expect(app.view.response.value).toContain("content or tool_calls must be set");
      }
      if (mode !== "http") expect(app.view.response.value).toContain("parcial de fallo");
    } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});

test("reasoning sin texto recupera tools y una sesión reabierta sin HTTP 400", async () => {
  for (const resume of [false, true]) {
    const requests: any[] = [];const workflow=taskWorkflow(1);
    const server = Bun.serve({ port: 0, async fetch(req) {
      const body = await req.json() as any;const flow=workflow(body);if(flow)return flow; requests.push(body);
      if (body.messages.some((m: any) => m.role === "assistant" && m.content === null && !m.tool_calls?.length))
        return Response.json({ error: { message: "Invalid assistant message: content or tool_calls must be set" } }, { status: 400 });
      if (!resume && requests.length === 1) return new Response(packet({ reasoning_content: "Razonamiento truncado á文🙂" }, "length"));
      if (!body.messages.some((m: any) => m.role === "tool")) return new Response(packet({ reasoning_content: "Escribo el archivo", tool_calls: [
        { index: 0, id: "complete-write", function: { name: "write", arguments: JSON.stringify({ path: "tetris.html", content: "<!doctype html><title>Tetris</title>" }) } },
      ] }, "tool_calls"));
      return new Response(packet({ reasoning_content: "Archivo escrito", content: "Archivo creado" }));
    } });
    const { root, path } = await fixture(server.port!); let app = await App.open({ config: path, cwd: root });
    try {
      if (resume) {
        const partial = { role: "assistant" as const, content: null, reasoning_content: "Razonamiento truncado á文🙂" };
        await app.session!.append({ type: "message", message: partial });
        const id = app.session!.state.id; await app.desktop.onBeforeExit!(); app = await App.open({ config: path, session: id });
      }
      app.view.prompt.setValue("Crea el Tetris"); await app.submit(); await until(() => !app.busy);
      expect(app.status).toStartWith("Listo"); expect(requests).toHaveLength(resume ? 2 : 3);
      expect(await Bun.file(join(root, "tetris.html")).text()).toContain("Tetris");
      expect(app.session!.state.messages.find(m => m.reasoning_content === "Razonamiento truncado á文🙂")?.content).toBeNull();
      expect(requests.at(-1).messages.find((m: any) => m.reasoning_content === "Razonamiento truncado á文🙂")?.content).toBe("");
      expect(app.session!.state.events.filter(e => e.type === "tool-start" && !e.name.startsWith("task_"))).toHaveLength(1);
      expect(app.view.response.value).toContain("Razonamiento truncado á文🙂");
    } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});

test("recuperación continúa más de 30 etapas, ignora límites legacy y permite cancelar la etapa activa", async () => {
  for (const mode of ["length", "next", "cancel"] as const) {
    let requests = 0;
    const server = Bun.serve({ port: 0, fetch() {
      requests++;
      if (requests > 35) return new Response(packet({ content: "Pedido completado" }));
      if (requests === 1 || mode === "length") return new Response(packet({ content: `parcial ${requests}` }, "length"));
      if (mode === "cancel") return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"etapa activa\\n[[S42_CON"}}]}\n\n')); } }));
      return new Response(packet({ content: "Etapa pequeña\n[[S42_CONTINUE]]" }));
    } });
    const { root, path } = await fixture(server.port!), app = await App.open({ config: path, cwd: root });
    try {
      app.view.prompt.setValue("Pedido"); await app.submit();
      if (mode === "cancel") { await until(() => app.view.response.value.includes("etapa activa")); app.cancel(); }
      await until(() => !app.busy); expect(requests).toBe(mode === "cancel" ? 2 : 36);
      expect(app.status).toContain(mode === "cancel" ? "cancelado" : "Listo");
      expect(Object.hasOwn(app.store.value, "limits")).toBe(false);
      expect(app.view.response.value).toContain("parcial 1"); expect(app.view.response.value).not.toContain("[[S42_");
      expect(app.session!.state.events.some(e => e.type === "turn" && e.state === (mode === "cancel" ? "cancelled" : "completed"))).toBe(true);
    } finally { await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});
