import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "../src/agent/tools.ts";
import { runTurn } from "../src/agent/loop.ts";
import { Session } from "../src/storage/sessions.ts";
import { defaultConfig, type Model, type Provider } from "../src/storage/config.ts";
test("loop envía historial completo sin bloquear por contexto estimado y usa el máximo real del proveedor", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-no-token-ceiling-")), session = await Session.open(join(root, "sessions"), "project");
  const history = "á文🙂 contexto previo ".repeat(10000), requests: any[] = [];
  const model: Model = { id: "remote", name: "Remote", contextWindow: 8192, maxOutputTokens: 2048, capabilities: { tools: true, images: false } };
  let metadata = true;
  const server = Bun.serve({ port: 0, async fetch(req) {
    if (req.method === "GET") return metadata ? Response.json({ data: [{ id: model.id, context_window: 1048576, max_output_tokens: 393216 }] }) : new Response("", { status: 404 });
    requests.push(await req.json());
    return new Response('data: {"choices":[{"delta":{"content":"Recibido"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  } });
  const provider: Provider = { id: "remote", name: "Remote", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: [model] };
  try {
    session.state.messages.push({ role: "assistant", content: history }, { role: "user", content: "Continuá" });
    const options = { project: { id: "project", name: "Fixture", path: root }, session, provider, model, signal: new AbortController().signal,
      onDelta: () => {}, onState: () => {}, onMessage: () => {} };
    await runTurn(options); metadata = false; await runTurn({ ...options, model: { ...model, contextWindow: 1048576 } });
    expect(requests).toHaveLength(2); expect(requests[0].max_tokens).toBe(393216); expect(Object.hasOwn(requests[1],"max_tokens")).toBe(false);
    expect(requests.every(body => body.messages.some((message: any) => message.content === history))).toBe(true);
    expect(requests[1].messages[0].content).not.toContain("2048"); expect(session.state.notices).toHaveLength(0);
  } finally { server.stop(true); await session.close(); await rm(root, { recursive: true, force: true }); }
});
test("tools read/search/edit exacto/write y shell con exit code real", async () => {
  const root = await mkdtemp(join(tmpdir(),'s42-tools-')), signal = new AbortController().signal;
  try {
    await Bun.write(join(root,'a.ts'),'export const suma = 1 + 1;\n');
    expect((await execute('read','{"path":"a.ts"}',root,signal)).output).toContain('1: export');
    expect((await execute('search','{"pattern":"suma"}',root,signal)).output).toContain('a.ts:1');
    expect((await execute('edit',JSON.stringify({path:'a.ts',oldText:'inexistente',newText:'x'}),root,signal)).failed).toBe(true);
    await Bun.write(join(root,'duplicado'),'aaa'); expect((await execute('edit',JSON.stringify({path:'duplicado',oldText:'aa',newText:'x'}),root,signal)).failed).toBe(true); expect(await Bun.file(join(root,'duplicado')).text()).toBe('aaa');
    expect((await execute('write',JSON.stringify({path:'sub/nuevo',content:'hola'}),root,signal)).failed).toBe(false);
    expect((await execute('write',JSON.stringify({path:'sub/nuevo',content:' á文🙂',append:true}),root,signal)).failed).toBe(false);
    expect(await Bun.file(join(root,'sub/nuevo')).text()).toBe('hola á文🙂');
    expect((await execute('write',JSON.stringify({path:'sub/nuevo',content:'oops',append:'yes'}),root,signal)).failed).toBe(true);
    expect(await Bun.file(join(root,'sub/nuevo')).text()).toBe('hola á文🙂');
    const command = await execute('shell',JSON.stringify({command:'echo salida; echo error 1>&2; exit 7'}),root,signal); expect(command.failed).toBe(true); expect(command.exitCode).toBe(7); expect(command.output).toContain('error');
    expect((await execute('inventada','{}',root,signal)).failed).toBe(true);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("loop fixture lee, edita y verifica archivo; persiste call/result sin reejecutar", async () => {
  const root = await mkdtemp(join(tmpdir(),'s42-loop-')), session = await Session.open(join(root,'sessions'),'project'); let requests=0;
  await Bun.write(join(root,'code.ts'),'console.log(1 + 1);');
  const calls = [{name:'read',args:{path:'code.ts'}},{name:'edit',args:{path:'code.ts',oldText:'1 + 1',newText:'2 + 2'}},{name:'shell',args:{command:'bun code.ts'}}];
  const server = Bun.serve({port:0,async fetch(req){const body=await req.json() as any; expect(body.messages[0].role).toBe('system');
    const call=calls[requests++]; const delta=call?{tool_calls:[{index:0,id:`call-${requests}`,function:{name:call.name,arguments:JSON.stringify(call.args)}}]}:{content:'Cambio verificado: 4'};
    return new Response(`data: ${JSON.stringify({choices:[{delta,finish_reason:call?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);}});
  const model:Model={id:'fixture',name:'Fixture',manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}};
  const provider:Provider={id:'fixture',name:'Fixture',kind:'openai-compatible',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]};
  try {await session.append({type:'session',title:'Coding'}); session.state.messages.push({role:'user',content:'Cambiar suma'});
    await runTurn({project:{id:'project',name:'Fixture',path:root},session,provider,model,signal:new AbortController().signal,onDelta:()=>{},onState:()=>{},onMessage:()=>{}});
    expect(await Bun.file(join(root,'code.ts')).text()).toBe('console.log(2 + 2);'); expect(requests).toBe(4); expect(session.state.messages.at(-1)?.content).toBe('Cambio verificado: 4');
    expect(session.state.events.filter(e=>e.type==='tool-start').length).toBe(3); expect(session.state.messages.filter(m=>m.role==='tool').length).toBe(3);
  } finally {server.stop(true);await session.close();await rm(root,{recursive:true,force:true});}
});
test("Bun Shell pipes/redirecciones/cwd y argv literal con metacaracteres", async () => {
  const { runCommand } = await import("../src/system/command.ts");
  const root = await mkdtemp(join(tmpdir(), "s42-bun-shell-")), signal = new AbortController().signal;
  try {
    const command = await execute("shell", JSON.stringify({ command: "echo 'hello á文🙂' | cat > output.txt; cat output.txt" }), root, signal);
    expect(command.failed).toBe(false); expect(await Bun.file(join(root, "output.txt")).text()).toBe("hello á文🙂\n");
    const text = "literal $(touch injected) ; quotes ' \"";
    const result = await runCommand([process.execPath, "-e", "console.log(process.argv.at(-1));console.log(process.env.S42_SHELL_TEST)", text], { cwd: root, signal, env: { ...process.env, S42_SHELL_TEST: "custom" } });
    expect(result.failed).toBe(false); expect(result.stdout).toContain(text); expect(result.stdout).toContain("custom");
    expect(await Bun.file(join(root, "injected")).exists()).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("cancelar shell mata también al descendiente de su grupo", async () => {
  const root=await mkdtemp(join(tmpdir(),'s42-cancel-')), controller=new AbortController();
  try {
    const command=`bun -e 'const child=Bun.spawn(["sleep","30"],{stdout:"inherit",stderr:"inherit"});await Bun.write("child.pid",String(child.pid));await child.exited'`;
    const run=execute('shell',JSON.stringify({command}),root,controller.signal);
    for(let i=0;i<100 && !(await Bun.file(join(root,'child.pid')).exists());i++) await Bun.sleep(5);
    const pid=Number((await Bun.file(join(root,'child.pid')).text()).trim()); controller.abort(new Error('cancelado')); const result=await run; expect(result.failed).toBe(true);
    // A short-lived zombie is no longer executing and is waiting for its parent/reaper.
    let alive=false; try { const status=await Bun.file(`/proc/${pid}/stat`).text(); alive=!status.includes(') Z '); } catch {}
    expect(alive).toBe(false);
  } finally {await rm(root,{recursive:true,force:true});}
});
test("salida abundante se conserva completa y JSON inválido no tiene efectos", async () => {
  const root = await mkdtemp(join(tmpdir(), 's42-output-')), signal = new AbortController().signal;
  try {
    const result = await execute('shell', JSON.stringify({ command: "bun -e 'console.log(\"a\".repeat(100000)); console.error(\"b\".repeat(100000))'" }), root, signal);
    expect(result.exitCode).toBe(0); expect(result.truncated).toBe(false);
    expect(JSON.parse(result.output).stdout).toBe('a'.repeat(100000) + '\n'); expect(JSON.parse(result.output).stderr).toBe('b'.repeat(100000) + '\n');
    expect((await execute('write', '{"path":"oops","content":7}', root, signal)).failed).toBe(true); expect(await Bun.file(join(root,'oops')).exists()).toBe(false);
    await Bun.write(join(root,'AGENTS.md'),'Root A'); await Bun.write(join(root,'sub/AGENTS.md'),'Child A'); await Bun.write(join(root,'sub/file'),'hola');
    expect((await execute('read','{"path":"sub/file"}',root,signal)).output).toContain('Child A');
    const other = await mkdtemp(join(tmpdir(),'s42-other-')); try { await Bun.write(join(other,'AGENTS.md'),'Root B'); await Bun.write(join(other,'file'),'hola'); const read=await execute('read','{"path":"file"}',other,signal); expect(read.output).toContain('Root B'); expect(read.output).not.toContain('Root A'); } finally { await rm(other,{recursive:true,force:true}); }
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("loop completa más de 30 pasos y conserva todos los efectos", async () => {
  const root=await mkdtemp(join(tmpdir(),'s42-limit-')), session=await Session.open(join(root,'sessions'),'A'); let requests=0;
  const server=Bun.serve({port:0,fetch(){requests++;const call=requests<=35;return new Response(`data: ${JSON.stringify({choices:[{delta:call?{tool_calls:[{index:0,id:`id-${requests}`,function:{name:'write',arguments:JSON.stringify({path:'count',content:String(requests)})}}]}:{content:'Completado'},finish_reason:call?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);}});
  const model:Model={id:'fixture',name:'Fixture',manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}};
  try { await runTurn({project:{id:'A',name:'A',path:root},session,provider:{id:'P',name:'P',kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]},model,signal:new AbortController().signal,onDelta:()=>{},onState:()=>{},onMessage:()=>{}});
    expect(requests).toBe(36); expect(await Bun.file(join(root,'count')).text()).toBe('35'); expect(session.state.messages.filter(m=>m.role==='tool').length).toBe(35);
    expect(session.state.messages.at(-1)?.content).toBe('Completado');
  } finally {server.stop(true);await session.close();await rm(root,{recursive:true,force:true});}
});
