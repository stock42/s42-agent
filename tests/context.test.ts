import { taskWorkflow } from "./task-provider-fixture.ts";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { activeHistory, compactContext, contextWeight, estimateContext, reportedContext } from "../src/agent/context.ts";
import { runTurn } from "../src/agent/loop.ts";
import { emptyUsage } from "../src/agent/usage.ts";
import { tokenLine } from "../src/system/metrics.ts";
import { Session } from "../src/storage/sessions.ts";
import { defaultConfig, type Model, type Provider } from "../src/storage/config.ts";
import { App } from "../src/app.ts";
import { complete, CompletionError } from "../src/llm/client.ts";
import type { Message } from "../src/agent/messages.ts";

const packet = (delta: unknown, usage?: unknown) => new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: "stop" }], usage })}\n\ndata: [DONE]\n\n`);
const summary = "Objetivo: terminar juego. Restricción: conservar Unicode. Archivo game.ts ya modificado; efecto confirmado, no repetir. Validación pendiente. Siguiente acción: verificar y continuar.";
const isSummary = (body: any) => body.messages[0].content.startsWith("Compactá TODO");
const inputText = (body: any) => body.messages.map((m: any) => typeof m.content === "string" ? m.content : m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")).join("\n");
async function save(session: Session, message: Message) { await session.append({ type: "message", message }); session.state.messages.push(message); }
function options(root: string, session: Session, port: number, window: number | undefined = 12000) {
  const model: Model = { id: "fixture", name: "Fixture", manual: true, contextWindow: window, capabilities: { tools: true, images: true } };
  const provider: Provider = { id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${port}`, models: [model] };
  return { project: { id: "project", name: "Proyecto", path: root }, session, provider, model, signal: new AbortController().signal, onDelta: () => {}, onState: () => {}, onMessage: () => {} };
}

test("contexto usa la última petición, incluye schemas/reasoning y distingue reporte, estimación y ventana desconocida", () => {
  const messages: Message[] = [{ role: "user", content: "á文🙂" }, { role: "assistant", content: "OK", reasoning_content: "pensamiento" }];
  const estimate = estimateContext("p", "m", 10000, messages), reported = reportedContext(estimate, contextWeight(messages), { prompt_tokens: 4200, completion_tokens: 300 });
  expect(reported).toMatchObject({ used: 4500, window: 10000, estimated: false });
  expect(tokenLine(emptyUsage(), undefined, reported)).toContain("Contexto 45.0%");
  const next = estimateContext("p", "m", 10000, [...messages, { role: "tool", content: "resultado adicional" }], undefined, reported);
  expect(next.used!).toBeGreaterThan(reported.inputTokens!); expect(tokenLine(undefined, undefined, next)).toContain("Contexto ≈");
  expect(tokenLine(undefined, undefined, { ...reported, window: undefined })).toContain("Contexto N/D");
  expect(estimateContext("p", "otro", 20000, messages, undefined, reported).inputTokens).toBeUndefined();
  expect(contextWeight(messages, [{ type: "function", function: { name: "large", description: "schema".repeat(1000), parameters: {} } }])).toBeGreaterThan(estimate.used!);
});

test("el único ajuste de salida es el espacio real restante; sin metadata de salida decide el servidor", async () => {
  const bodies: any[] = [];const server = Bun.serve({port:0,async fetch(req){bodies.push(await req.json());return packet({content:"OK"});}});
  const model: Model = {id:"m",name:"M",contextWindow:10000,maxOutputTokens:9000,capabilities:{tools:false,images:false}};
  const provider: Provider = {id:"p",name:"P",kind:"openai-compatible",baseUrl:`http://127.0.0.1:${server.port}`,models:[model]};
  try {
    await complete({provider,model,messages:[{role:"user",content:"hola"}],contextTokens:7000,signal:new AbortController().signal,onDelta:()=>{}});
    expect(bodies[0].max_tokens).toBe(3000);
    await complete({provider,model:{...model,manual:true,maxOutputTokens:1000},messages:[{role:"user",content:"hola"}],contextTokens:7000,signal:new AbortController().signal,onDelta:()=>{}});
    expect(Object.hasOwn(bodies[1],"max_tokens")).toBe(false);
  }finally{server.stop(true);}
});

test("compactación jerárquica integra todos los resúmenes y divide un chunk rechazado por contexto",async()=>{
  const source: Message[] = [{role:"user",content:"INICIO " + "x".repeat(160000) + " FINAL"}];let first=true,passes=0;const seen:string[]=[];
  const result=await compactContext({messages:source,fixed:[],window:10000,scale:1,signal:new AbortController().signal,onPart:async()=>{},
    summarize:async messages=>{const text=inputText({messages});seen.push(text);passes++;
      if(first){first=false;throw new CompletionError("context length exceeded",{role:"assistant",content:""},undefined,undefined,true);}
      return {message:{role:"assistant",content:text.includes("Registro del contexto")||text.includes("x".repeat(100)) ? "MARCA DE RESUMEN " + "r".repeat(10000) : "Resumen final integrado"}};
    }});
  expect(result).toBe("Resumen final integrado");expect(passes).toBeGreaterThan(2);expect(seen.join("")).toContain("INICIO");expect(seen.join("")).toContain("FINAL");expect(seen.some(t=>t.includes("MARCA DE RESUMEN"))).toBe(true);
});

test("instrucciones al 90% no se rechazan por el umbral de compactación; solo importa la ventana",async()=>{
  const fixed: Message[]=[{role:"system",content:"a".repeat(29500)}];expect(contextWeight(fixed)).toBeGreaterThan(8500);expect(contextWeight(fixed)).toBeLessThan(10000);
  const result=await compactContext({messages:[...fixed,{role:"user",content:"Historial extenso"}],fixed,window:10000,scale:1,signal:new AbortController().signal,onPart:async()=>{},summarize:async()=>({message:{role:"assistant",content:"Objetivo pendiente"}})});
  expect(result).toBe("Objetivo pendiente");
});

test("compacta TODO el contexto por partes, preserva imágenes/razonamiento/efectos y restaura el checkpoint en JSONL y SQLite", async () => {
  for (const sqlite of [false, true]) {
    const root = await mkdtemp(join(tmpdir(), "s42-context-")), path = join(root, sqlite ? "agent.sqlite" : "sessions"), session = await Session.open(path, "project");
    const bodies: any[] = [], fragments: string[] = [];
    const server = Bun.serve({ port: 0, async fetch(req) {
      const body: any = await req.json(); bodies.push(body);
      if (isSummary(body)) { fragments.push(inputText(body)); expect(body.tools).toBeUndefined(); return packet({ content: summary, reasoning_content: "Resumen real recibido" }); }
      expect(inputText(body)).toContain("Contexto compactado"); expect(inputText(body)).toContain("game.ts ya modificado"); return packet({ content: "Pedido continuado" }, { prompt_tokens: 2000, completion_tokens: 30 });
    } });
    let closed = false;
    try {
      await Bun.write(join(root, "AGENTS.md"), "Conservar Unicode y todos los cambios previos."); await Bun.write(join(root, "game.ts"), "efecto único");
      const history = "INICIO á文🙂\n" + "contenido intermedio ".repeat(4000) + "\nFINAL DEL HISTORIAL";
      await save(session, { role: "user", content: [{ type: "text", text: "Objetivo original: terminar juego" }, { type: "image_url", image_url: { url: "data:image/png;base64,fixture" } }] });
      await save(session, { role: "assistant", content: history, reasoning_content: "DECISIÓN IMPORTANTE", tool_calls: [{ id: "done", type: "function", function: { name: "write", arguments: '{"path":"game.ts","content":"efecto único"}' } }] });
      await save(session, { role: "tool", tool_call_id: "done", content: "Efecto confirmado y validación pendiente" }); await save(session, { role: "user", content: "Continuá el pedido sin repetir el efecto" });
      await runTurn(options(root, session, server.port!));
      expect(fragments.length).toBeGreaterThan(1); const material = fragments.join("");
      for (const fact of ["INICIO á文🙂", "FINAL DEL HISTORIAL", "DECISIÓN IMPORTANTE", "Efecto confirmado", "Continuá el pedido", "Conservar Unicode"]) expect(material).toContain(fact);
      expect(bodies.some(b => isSummary(b) && b.messages[1].content.some((p: any) => p.type === "image_url"))).toBe(true);
      expect(session.state.messages[1]!.content).toBe(history); expect(session.state.messages.at(-1)!.content).toBe("Pedido continuado");
      expect(await Bun.file(join(root, "game.ts")).text()).toBe("efecto único"); expect(session.state.compaction?.through).toBe(4);
      expect(session.state.contextUsage).toMatchObject({ used: 2030, window: 12000, estimated: false });
      const original = structuredClone(session.state.messages), checkpoint = session.state.compaction;
      await session.close(); closed = true;
      const resumed = await Session.open(path, "project", session.state.id);
      try { expect(resumed.state.messages).toEqual(original); expect(resumed.state.compaction).toEqual(checkpoint); expect(activeHistory(resumed.state)).toHaveLength(2); expect(resumed.state.contextUsage?.used).toBe(2030); }
      finally { await resumed.close(); }
    } finally { if (!closed) await session.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});

test("un resultado grande de herramienta se compacta completo y el loop continúa sin repetir sus efectos", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-context-tools-")), session = await Session.open(join(root, "sessions"), "project");
  let ordinary = 0; const fragments: string[] = [];const workflow=taskWorkflow(2);
  const server = Bun.serve({ port: 0, async fetch(req) {
    const body: any = await req.json();
    if (isSummary(body)) { fragments.push(inputText(body)); return packet({ content: summary }); }
    const flow=workflow(body, ordinary >= 2);if(flow)return flow; ordinary++;
    if (ordinary === 1) return packet({ tool_calls: [{ index: 0, id: "read", function: { name: "read", arguments: '{"path":"large.txt"}' } }] });
    if (ordinary === 2) return packet({ tool_calls: [{ index: 0, id: "write", function: { name: "write", arguments: '{"path":"done.txt","content":"hecho"}' } }] });
    return packet({ content: "Finalizado" });
  } });
  try {
    await Bun.write(join(root, "large.txt"), "a".repeat(90000) + "MARCADOR FINAL COMPLETO"); await save(session, { role: "user", content: "Leé, luego escribí done.txt" });
    await runTurn(options(root, session, server.port!));
    expect(ordinary).toBe(3); expect(fragments.join("")).toContain("MARCADOR FINAL COMPLETO");
    expect(await Bun.file(join(root, "done.txt")).text()).toBe("hecho"); expect(session.state.events.filter(e => e.type === "tool-start" && !e.name.startsWith("task_"))).toHaveLength(2);
    expect(session.state.messages.filter(m => m.role === "tool" && !m.tool_call_id?.startsWith("fixture-task-"))).toHaveLength(2); expect(activeHistory(session.state).some(m => m.role === "tool" && m.tool_call_id === "write")).toBe(true);
  } finally { await session.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("el reporte real al 90% dispara compactación aunque la estimación previa sea menor", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-context-report-")), session = await Session.open(join(root, "sessions"), "project"); let compacted = 0;
  const server = Bun.serve({ port: 0, async fetch(req) { const body: any = await req.json(); if (isSummary(body)) { compacted++; return packet({ content: summary }); } return packet({ content: "Hecho" }, { prompt_tokens: 25000, completion_tokens: 2000 }); } });
  try {
    await save(session, { role: "user", content: "Historial necesario " + "a".repeat(50000) });
    const seen: number[] = []; await runTurn({ ...options(root, session, server.port!, 30000), onContext: usage => { if (usage.used !== undefined) seen.push(usage.used); } });
    expect(seen).toContain(27000); expect(compacted).toBeGreaterThan(0); expect(session.state.compaction).toBeDefined(); expect(session.state.contextUsage!.used!).toBeLessThan(25500);
  } finally { await session.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("cancelación durante compactación conserva checkpoint previo, historial y reasoning parcial", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-context-cancel-")), session = await Session.open(join(root, "sessions"), "project"), controller = new AbortController();
  const server = Bun.serve({ port: 0, async fetch(req) { const body: any = await req.json(); expect(isSummary(body)).toBe(true);
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"Resumen pendiente"}}]}\n\n')); } })); } });
  try {
    await save(session, { role: "user", content: "Estado anterior" });
    const checkpoint = { through: 1, summary: "Objetivo anterior conservado" };await session.append({ type: "compaction", ...checkpoint });session.state.compaction = checkpoint;
    await save(session, { role: "user", content: "a".repeat(90000) }); const original = structuredClone(session.state.messages);
    await expect(runTurn({ ...options(root, session, server.port!), signal: controller.signal, onReasoning: () => controller.abort(new Error("Cancelación explícita")) })).rejects.toThrow("Cancelación explícita");
    expect(session.state.compaction).toEqual(checkpoint); expect(session.state.messages).toEqual(original);
    expect(session.state.events.some(e => e.type === "compaction-part" && e.message.reasoning_content === "Resumen pendiente")).toBe(true);
  } finally { await session.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("un rechazo real de contexto revela capacidad, compacta y continúa; otros HTTP 400 no se reintentan", async () => {
  for (const context of [true, false]) {
    const root = await mkdtemp(join(tmpdir(), "s42-context-http-")), session = await Session.open(join(root, "sessions"), "project"); let ordinary = 0, summaries = 0;
    const server = Bun.serve({ port: 0, async fetch(req) {
      if (req.method === "GET") return Response.json({ data: [{ id: "fixture" }] }); const body: any = await req.json();
      if (isSummary(body)) { summaries++; return packet({ content: summary }); }
      ordinary++; if (ordinary === 1) return Response.json({ error: { message: context ? "This model's maximum context length is 12000 tokens. Your input exceeds the context window." : "Invalid assistant message: content or tool_calls must be set" } }, { status: 400 });
      return packet({ content: "Recuperado" });
    } });
    try {
      await save(session, { role: "user", content: "a".repeat(90000) }); const settings = options(root, session, server.port!); settings.model.contextWindow = undefined; const work = runTurn(settings);
      if (context) { await work; expect(ordinary).toBe(2); expect(summaries).toBeGreaterThan(0); expect(session.state.contextUsage?.window).toBe(12000); }
      else { await expect(work).rejects.toThrow("HTTP 400"); expect(ordinary).toBe(1); expect(summaries).toBe(0); }
    } finally { await session.close(); server.stop(true); await rm(root, { recursive: true, force: true }); }
  }
});

test("TUI conserva porcentajes independientes por proyecto, cambia modelo, traduce y restaura el indicador", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-context-ui-")), path = join(root, "config.json"), config = defaultConfig();
  const { mkdir } = await import("node:fs/promises");
  for (const id of ["A", "B"]) { const folder = join(root, id); await mkdir(folder); config.projects.push({ id, name: id, path: folder, selection: { providerId: "fixture", modelId: id } }); }
  const server = Bun.serve({ port: 0, async fetch(req) { const body: any = await req.json(); return packet({ content: "OK" }, { prompt_tokens: body.model === "A" ? 1000 : 4000, completion_tokens: 100 }); } });
  config.providers = [{ id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: ["A", "B"].map(id => ({ id, name: id, manual: true, contextWindow: 20000, capabilities: { tools: false, images: false } })) }]; config.defaults = { providerId: "fixture", modelId: "A" }; config.lastProjectId = "A"; await Bun.write(path, JSON.stringify(config));
  const app = await App.open({ config: path }); let closed = false;
  try {
    app.view.prompt.setValue("Hola A"); await app.submit(); await app.tabs[0]!.turn; expect(app.desktop.draw().lines().join("\n")).toContain("Contexto 5.5%");
    await app.switchProject(config.projects[1]!); app.view.prompt.setValue("Hola B"); await app.submit(); await app.tabs[1]!.turn; expect(app.desktop.draw().lines().join("\n")).toContain("Contexto 20.5%");
    await app.activateTab(app.tabs[0]!.id); await app.setLanguage("en");
    for (const [width, height] of [[60, 16], [80, 24], [190, 50]] as const) { app.desktop.resize(width, height); const line = app.desktop.draw().lines()[app.view.promptWindow.client.y]!; expect(line).toContain("Context 5.5%"); expect(line).toContain("Tokens I/O"); expect(line.startsWith("│") && line.endsWith("│")).toBe(true); }
    await app.selectModel({ providerId: "fixture", modelId: "B" }); expect(app.desktop.draw().lines().join("\n")).toContain("Context N/A"); await app.selectModel({ providerId: "fixture", modelId: "A" });expect(app.desktop.draw().lines().join("\n")).toContain("Context 5.5%");
    await app.session!.append({type:"compaction-part",message:{role:"assistant",content:"Resumen",reasoning_content:"Razonamiento de compactación guardado"}});app.showHistory();
    expect(app.view.response.value).toContain("Razonamiento de compactación guardado");await app.toggleReasoning();expect(app.view.response.value).not.toContain("Razonamiento de compactación guardado");await app.toggleReasoning();expect(app.view.response.value).toContain("Razonamiento de compactación guardado");
    await save(app.session!,{role:"user",content:[{type:"image_url",image_url:{url:"data:image/png;base64,fixture"}}]});
    const checkpoint={through:app.session!.state.messages.length,summary:"Imagen ya resumida"};await app.session!.append({type:"compaction",...checkpoint});app.session!.state.compaction=checkpoint;
    await app.selectModel({providerId:"fixture",modelId:"B"});await app.selectModel({providerId:"fixture",modelId:"A"});
    await app.desktop.onBeforeExit!(); closed = true; const reopened = await App.open({ config: path });
    try { await reopened.activateTab(reopened.tabs.find(t => t.project?.id === "A")!.id); expect(reopened.desktop.draw().lines().join("\n")).toContain("Context 5.5%"); }
    finally { await reopened.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("bun run dev en PTY muestra porcentaje junto a E/S, conserva Unicode y restaura terminal tras resize",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-context-pty-")),path=join(root,"config.json"),config=defaultConfig();let output="",requests=0;
  const server=Bun.serve({port:0,async fetch(req){await req.json();requests++;return packet({content:"Respuesta á文🙂"},{prompt_tokens:2500,completion_tokens:100});}});
  config.projects=[{id:"project",name:"Ventana á文🙂",path:root,selection:{providerId:"fixture",modelId:"fixture"}}];config.lastProjectId="project";
  config.providers=[{id:"fixture",name:"Fixture",kind:"openai-compatible",baseUrl:`http://127.0.0.1:${server.port}`,models:[{id:"fixture",name:"Fixture",manual:true,contextWindow:10000,capabilities:{tools:false,images:false}}]}];config.defaults={providerId:"fixture",modelId:"fixture"};await Bun.write(path,JSON.stringify(config));
  const terminal=new Bun.Terminal({cols:80,rows:24,data:(_,bytes)=>{output+=new TextDecoder().decode(bytes);}});
  const child=Bun.spawn([process.execPath,"run","dev","--config",path,"--no-color"],{cwd:resolve(import.meta.dir,".."),env:{...process.env,TERM:"xterm-256color"},terminal});
  const until=async(check:()=>boolean)=>{for(let i=0;i<600;i++){if(check())return;await Bun.sleep(5);}throw new Error("No apareció el contexto en PTY");};
  try{
    await until(()=>output.includes("Fixture · fixture"));terminal.write("\x1b[200~Hola á文🙂\x1b[201~\r");await until(()=>output.includes("Contexto 26.0%"));
    expect(output).toContain("Tokens E/S 2500/100");expect(output).toContain("Respuesta á文🙂");expect(requests).toBe(1);
    const saved = await Bun.file(path).json();const lock = await Bun.file(join(root,"sessions","project",saved.projects[0].lastSessionId+".jsonl.lock")).json();
    output="";terminal.resize(60,16);process.kill(lock.pid,"SIGWINCH");await until(()=>output.includes("Contexto 26.0%"));expect(output).toContain("Prompt");expect(output).toContain("Tokens E/S 2500/100");
    terminal.write("\x11");expect(await child.exited).toBe(0);expect(output).toContain("\x1b[?1049l");expect(output).toContain("\x1b[?1006l");
  }finally{child.kill();terminal.close();server.stop(true);await rm(root,{recursive:true,force:true});}
},15000);
