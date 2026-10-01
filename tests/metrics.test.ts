import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SystemMonitor, cpuUsage, diskCapacity, parseNvidiaMemory, metricLines } from "../src/system/metrics.ts";
import { addUsage, emptyUsage } from "../src/agent/usage.ts";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";

test("métricas calculan CPU por intervalo, disco disponible y VRAM reportada sin inventar cero",async()=>{
  expect(cpuUsage({idle:50,total:100},{idle:90,total:200})).toEqual({used:60,free:40,total:100});expect(cpuUsage({idle:1,total:1},{idle:1,total:1})).toBeUndefined();
  expect(diskCapacity({bsize:4096,blocks:100,bfree:40,bavail:30})).toEqual({used:60*4096,free:30*4096,total:100*4096});
  expect(parseNvidiaMemory("1000, 250, 750\n2000, 500, 1500")).toEqual({total:3000*1048576,used:750*1048576,free:2250*1048576});
  for(const value of ["","N/A, N/A, N/A","driver error","1000,-1,1001"])expect(parseNvidiaMemory(value)).toBeUndefined();
  const monitor=new SystemMonitor(()=>process.cwd());try{await monitor.refresh();expect(monitor.snapshot.ram!.total).toBeGreaterThan(0);expect(monitor.snapshot.disk!.free).toBeGreaterThan(0);expect(monitor.snapshot.at).toBeDefined();if(!monitor.snapshot.gpu)expect(monitor.snapshot.gpuError).toBeTruthy();}finally{await monitor.stop();}
  const unknown={diskPath:"/path"};expect(metricLines(unknown,undefined,60).join("\n")).toContain("VRAM N/D · Tokens E/S N/D/N/D");
  const partial=addUsage(addUsage(emptyUsage(),{prompt_tokens:12,completion_tokens:3,total_tokens:15}),undefined);
  expect(partial).toMatchObject({input:12,output:3,total:15,requests:2,reported:1,partial:true});expect(metricLines(unknown,partial,80).join("\n")).toContain("12/3 (parcial)");
});

test("tokens suman calls y length, se aíslan por pestaña, persisten y vuelven a N/D sin reporte",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-token-usage-")),config=join(root,"config.json"),initial=defaultConfig();
  const packet=(delta:unknown,finish_reason:string,usage:unknown)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}],usage})}\n\ndata: [DONE]\n\n`;
  const requests=new Map<string,number>();
  const server=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;expect(body.stream_options).toEqual({include_usage:true});const model=body.model as string,index=requests.get(model)??0;requests.set(model,index+1);
    if(model==="B")return new Response(packet({content:"sin uso"},"stop",null));
    if(index===0)return new Response(packet({tool_calls:[{index:0,id:"read",function:{name:"list",arguments:"{}"}}]},"tool_calls",{prompt_tokens:10,completion_tokens:5,total_tokens:15}));
    if(index===1)return new Response(packet({content:"parcial"},"length",{prompt_tokens:20,completion_tokens:10,total_tokens:30}));
    return new Response(packet({content:"Terminado"},"stop",{prompt_tokens:30,completion_tokens:15,total_tokens:45}));
  }});
  for(const id of ["A","B"]){const path=join(root,id);await mkdir(path);initial.projects.push({id,name:id,path,selection:{providerId:"llama.cpp",modelId:id}});}
  initial.lastProjectId="A";initial.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`;
  initial.providers[0]!.models=["A","B"].map(id=>({id,name:id,contextWindow:32000,maxOutputTokens:500,capabilities:{tools:true,images:false}}));await Bun.write(config,JSON.stringify(initial));
  const app=await App.open({config});let closed=false;
  try {
    app.view.prompt.setValue("Pedido A");await app.submit();await app.tabs[0]!.turn;
    expect(app.tabs[0]!.tokens).toEqual({input:60,output:30,total:90,requests:3,reported:3,partial:false});expect(app.desktop.draw().lines().join("\n")).toContain("Tokens E/S 60/30");
    await app.switchProject(app.store.value.projects[1]!);app.view.prompt.setValue("Pedido B");await app.submit();await app.tabs[1]!.turn;expect(app.tabs[1]!.tokens).toMatchObject({requests:1,reported:0,partial:true});
    expect(app.desktop.draw().lines().join("\n")).toContain("Tokens E/S N/D/N/D");await app.activateTab(app.tabs[0]!.id);
    for(const [width,height] of [[60,16],[80,24],[190,50]] as const){app.desktop.resize(width,height);const lines=app.desktop.draw().lines();expect(lines.join("\n")).toContain("Prompt");expect(lines.join("\n")).toContain("Tokens E/S 60/30");expect(app.view.promptWindow.bounds.y+app.view.promptWindow.bounds.height).toBeLessThanOrEqual(height-(width>=120?1:2));}
    const tools=app.desktop.menu.menus.find(menu=>menu.label==="Tools")!;tools.items.find(item=>item.label==="Nativas · catálogo")!.run!();expect(app.desktop.modal!.title).toBe("Tools nativas");app.desktop.close();
    await app.desktop.onBeforeExit!();closed=true;
    const reopened=await App.open({config});try{expect(reopened.tabs[0]!.tokens?.input).toBe(60);expect(reopened.tabs[1]!.tokens?.input).toBeUndefined();}finally{await reopened.desktop.onBeforeExit!();}
  }finally{server.stop(true);if(!closed)await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});
