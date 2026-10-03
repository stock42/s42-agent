import { taskWorkflow } from "./task-provider-fixture.ts";
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigStore, defaultConfig } from "../src/storage/config.ts";
import { Session, listSessions } from "../src/storage/sessions.ts";
import { openDatabase, setting } from "../src/storage/database.ts";
import { App } from "../src/app.ts";
const folders: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), "s42-sqlite-")); folders.push(root); return root; }
afterEach(async () => { for (const root of folders.splice(0)) await rm(root, { recursive: true, force: true }); });

test("SQLite migra configuración/historial, conserva originales y no vuelve a importar", async () => {
  const root = await fixture(), path = join(root,"agent.sqlite"), legacy = {config:join(root,"config.json"),sessions:join(root,"sessions")};
  const config = defaultConfig(); config.providers[0]!.models = [{id:"local",name:"Local",contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}];
  config.defaults.modelId="local"; config.ui.palette="nord"; config.promptings=[{id:"p",name:"Template",text:"Hola {{name}}"}];
  config.providers[0]!.apiKeySecret="existing-keychain-reference"; await Bun.write(legacy.config,JSON.stringify(config));
  const original=await Session.open(legacy.sessions,"project","session");
  await original.append({type:"session",title:"Historial á文🙂"}); await original.append({type:"draft",text:"mi borrador",attachments:["/file"]});
  await original.append({type:"selection",selection:config.defaults}); await original.append({type:"message",message:{role:"user",content:"Antes"}}); await original.close();
  const json=await Bun.file(legacy.config).text(), log=await Bun.file(original.path).text();
  const store=await ConfigStore.load(path,legacy); expect(store.value).toEqual(config);
  expect(await listSessions(path,"project")).toEqual([{id:"session",title:"Historial á文🙂"}]);
  const resumed=await Session.open(path,"project","session");
  expect(resumed.state.draft).toBe("mi borrador"); expect(resumed.state.selection).toEqual(config.defaults); expect(resumed.state.messages[0]!.content).toBe("Antes");
  await resumed.append({type:"message",message:{role:"assistant",content:"Después"}}); await resumed.close();
  store.value.ui.language="en"; await store.save(store.value); expect((await ConfigStore.load(path,legacy)).value.ui.language).toBe("en");
  const reopened=await Session.open(path,"project","session"); expect(reopened.state.messages).toHaveLength(2); await reopened.close();
  expect(await Bun.file(legacy.config).text()).toBe(json); expect(await Bun.file(original.path).text()).toBe(log);
});

test("migración atómica rechaza corrupción o escritor vivo; permite corregir y reintentar", async () => {
  const root=await fixture(), path=join(root,"agent.sqlite"), legacy={config:join(root,"config.json"),sessions:join(root,"sessions")};
  await Bun.write(legacy.config,JSON.stringify(defaultConfig())); const session=await Session.open(legacy.sessions,"A","one");
  await session.append({type:"session",title:"A"}); await expect(ConfigStore.load(path,legacy)).rejects.toThrow("Cerrá la instancia"); await session.close();
  const original=await Bun.file(session.path).text(); await Bun.write(session.path,original+"{invalid}\n");
  await expect(ConfigStore.load(path,legacy)).rejects.toThrow("corrupta");
  const db=await openDatabase(path); expect(setting(db,"config")).toBeUndefined(); expect(db.query("SELECT * FROM events").all()).toHaveLength(0); db.close(true);
  await Bun.write(session.path,original+'{"truncated'); await ConfigStore.load(path,legacy);
  const resumed=await Session.open(path,"A","one"); expect(resumed.state.title).toBe("A"); expect(resumed.state.notices).toContain("Último registro incompleto recuperado"); await resumed.close();
  expect(await Bun.file(session.path).text()).toBe(original+'{"truncated');
});

test("SQLite aísla escritores de proyectos; rechaza doble sesión y recupera call/result sin repetir efectos", async () => {
  const root=await fixture(), path=join(root,"agent.sqlite"); await ConfigStore.load(path);
  const a=await Session.open(path,"A","one"), b=await Session.open(path,"B","two");
  await expect(Session.open(path,"A","one")).rejects.toThrow("otra instancia");
  await Promise.all([a.append({type:"draft",text:"A",attachments:[]}),b.append({type:"draft",text:"B",attachments:[]})]);
  await a.append({type:"message",message:{role:"assistant",content:null,tool_calls:[{id:"call",type:"function",function:{name:"write",arguments:"{}"}}]}});
  await a.append({type:"tool-start",callId:"call",name:"write",arguments:"{}"}); await a.append({type:"tool-result",callId:"call",output:"Ya escrito",failed:false});
  await a.close(); await b.close();
  for(let i=0;i<2;i++){const resumed=await Session.open(path,"A","one"); expect(resumed.state.draft).toBe("A"); expect(resumed.state.messages.map(m=>m.role)).toEqual(["assistant","tool"]); expect(resumed.state.messages[1]!.content).toBe("Ya escrito"); await resumed.close();}
  const second=await Session.open(path,"B","two"); expect(second.state.draft).toBe("B"); expect(second.state.messages).toHaveLength(0); await second.close();
});

test("TUI SQLite persiste proyectos, modelo, promptings, borradores y reapertura", async () => {
  const root=await fixture(), config=join(root,"agent.sqlite"), app=await App.open({config,cwd:root});
  const model={id:"fixture",name:"Fixture",manual:true,contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}};
  app.store.value.providers[0]!.models=[model]; await app.store.save(app.store.value); await app.selectModel({providerId:"llama.cpp",modelId:model.id});
  app.view.prompt.setValue("Borrador SQLite á文🙂"); const id=app.session!.state.id; await app.desktop.onBeforeExit!();
  const resumed=await App.open({config});
  try { expect(resumed.session!.state.id).toBe(id); expect(resumed.current().model.id).toBe(model.id); expect(resumed.view.prompt.value).toBe("Borrador SQLite á文🙂"); expect(resumed.desktop.draw().lines()[1]).toContain("P:"); }
  finally { await resumed.desktop.onBeforeExit!(); }
});

test("SQLite conserva commit del proceso muerto y recupera lock sin reejecutar la tool", async () => {
  const root=await fixture(), path=join(root,"agent.sqlite"); await ConfigStore.load(path);
  const modulePath=new URL("../src/storage/sessions.ts",import.meta.url).pathname;
  const script=`import {Session} from ${JSON.stringify(modulePath)};const s=await Session.open(${JSON.stringify(path)},'A','crash');await s.append({type:'message',message:{role:'assistant',content:null,tool_calls:[{id:'c',type:'function',function:{name:'write',arguments:'{}'}}]}});await s.append({type:'tool-start',callId:'c',name:'write',arguments:'{}'});console.log('committed');setInterval(()=>{},1000);`;
  const child=Bun.spawn([process.execPath,"-e",script],{stdout:"pipe",stderr:"pipe"}),reader=child.stdout.getReader();
  try { expect(new TextDecoder().decode((await reader.read()).value)).toContain("committed");await expect(Session.open(path,"A","crash")).rejects.toThrow("otra instancia"); }
  finally {child.kill();await child.exited;await reader.cancel();}
  const recovered=await Session.open(path,"A","crash");
  try {expect(recovered.state.messages.map(m=>m.role)).toEqual(["assistant","tool"]);expect(recovered.state.messages[1]!.content).toContain("No reejecutar");}
  finally {await recovered.close();}
});

test("index.ts PTY migra rutas XDG por defecto y reabre el modelo/borrador desde SQLite", async () => {
  const root=await fixture(), legacyConfig=join(root,"xdg/s42-agent/config.json"), legacySessions=join(root,"state/s42-agent/sessions");
  const config=defaultConfig(), original=await Session.open(legacySessions,"project","one");
  config.projects=[{id:"project",name:"Migrado",path:root,lastSessionId:"one"}];config.lastProjectId="project";
  config.providers[0]!.models=[{id:"fixture",name:"Fixture",manual:true,contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}];config.defaults.modelId="fixture";
  await original.append({type:"session",title:"Sesión migrada"});await original.append({type:"draft",text:"Borrador anterior",attachments:[]});await original.close();
  const json=JSON.stringify(config);await Bun.write(legacyConfig,json);
  let output="";const terminal=new Bun.Terminal({cols:100,rows:32,data:(_,bytes)=>output+=new TextDecoder().decode(bytes)});
  const child=Bun.spawn([process.execPath,new URL("../index.ts",import.meta.url).pathname,"--no-color"],{cwd:root,terminal,env:{...process.env,XDG_CONFIG_HOME:join(root,"xdg"),XDG_STATE_HOME:join(root,"state"),TERM:"xterm-256color"}});
  try {
    for(let i=0;i<600&&!output.includes("Borrador anterior");i++)await Bun.sleep(5);
    expect(output).toContain("Borrador anterior");expect(output).toContain("1:P:Migrado");expect(output).not.toContain("No hay modelo configurado");
    terminal.write("\x01Guardado desde PTY\x11");expect(await child.exited).toBe(0);expect(output).toContain("\x1b[?25h\x1b[?1049l");
    const reopened=await App.open({config:join(root,"xdg/s42-agent/agent.sqlite")});
    try {expect(reopened.current().model.id).toBe("fixture");expect(reopened.view.prompt.value).toBe("Guardado desde PTY");}
    finally{await reopened.desktop.onBeforeExit!();}
    expect(await Bun.file(legacyConfig).text()).toBe(json);
  }finally{child.kill();await child.exited;terminal.close();}
},10000);

test("CLI SQLite sin TUI ejecuta tools, muestra ID reanudable y conserva configuración", async () => {
  const root=await fixture(),path=join(root,"agent.sqlite"),store=await ConfigStore.load(path);let requests=0;const workflow=taskWorkflow(1);
  const server=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;const flow=workflow(body);if(flow)return flow;expect(body.tools.some((tool:any)=>tool.function.name==="write")).toBe(true);requests++;
    const delta=requests===1?{tool_calls:[{index:0,id:"write",function:{name:"write",arguments:JSON.stringify({path:"game.html",content:"<!doctype html><title>Fixture</title>"})}}]}:{content:"Archivo escrito"};
    return new Response(`data: ${JSON.stringify({choices:[{delta,finish_reason:requests===1?"tool_calls":"stop"}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}})}\n\ndata: [DONE]\n\n`);
  }});
  store.value.projects=[{id:"project",name:"CLI SQLite",path:root}];store.value.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`;
  store.value.providers[0]!.models=[{id:"fixture",name:"Fixture",manual:true,contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}];store.value.defaults.modelId="fixture";await store.save(store.value);
  try {
    const child=Bun.spawn([process.execPath,new URL("../index.ts",import.meta.url).pathname,"--config",path,"--cwd",root,"--prompting","Crea el archivo"],{stdout:"pipe",stderr:"pipe"});
    const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
    expect(code).toBe(0);expect(stdout.trim()).toBe("Archivo escrito");expect(stdout+stderr).not.toContain("\x1b");expect(await Bun.file(join(root,"game.html")).exists()).toBe(true);
    expect((await ConfigStore.load(path)).value).toEqual(store.value);const saved=await listSessions(path,"project");expect(saved).toHaveLength(1);expect(stderr).toContain(`Sesión: ${saved[0]!.id}`);
    const resumed=await Session.open(path,"project",saved[0]!.id);try{expect(resumed.state.events.some(e=>e.type==="turn"&&e.state==="completed")).toBe(true);expect(resumed.state.messages.filter(m=>m.role==="tool" && !m.tool_call_id?.startsWith("fixture-task-"))).toHaveLength(1);}finally{await resumed.close();}
  }finally{server.stop(true);}
});
