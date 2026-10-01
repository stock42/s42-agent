import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SystemMonitor, cpuUsage, diskCapacity, parseNvidiaMemory, metricLines, tokenLine } from "../src/system/metrics.ts";
import { addUsage, emptyUsage, tokensPerSecond } from "../src/agent/usage.ts";
import { App } from "../src/app.ts";
import { ConfigStore, defaultConfig } from "../src/storage/config.ts";

test("métricas calculan CPU por intervalo, disco disponible y VRAM reportada sin inventar cero",async()=>{
  expect(cpuUsage({idle:50,total:100},{idle:90,total:200})).toEqual({used:60,free:40,total:100});expect(cpuUsage({idle:1,total:1},{idle:1,total:1})).toBeUndefined();
  expect(diskCapacity({bsize:4096,blocks:100,bfree:40,bavail:30})).toEqual({used:60*4096,free:30*4096,total:100*4096});
  expect(parseNvidiaMemory("1000, 250, 750\n2000, 500, 1500")).toEqual({total:3000*1048576,used:750*1048576,free:2250*1048576});
  for(const value of ["","N/A, N/A, N/A","driver error","1000,-1,1001"])expect(parseNvidiaMemory(value)).toBeUndefined();
  const monitor=new SystemMonitor(()=>process.cwd());try{await monitor.refresh();expect(monitor.snapshot.ram!.total).toBeGreaterThan(0);expect(monitor.snapshot.disk!.free).toBeGreaterThan(0);expect(monitor.snapshot.at).toBeDefined();if(!monitor.snapshot.gpu)expect(monitor.snapshot.gpuError).toBeTruthy();}finally{await monitor.stop();}
  const unknown={diskPath:"/path"};expect(metricLines(unknown,defaultConfig().ui.resources,60).join("\n")).toContain("VRAM: N/D");expect(tokenLine()).toBe("Tokens E/S N/D/N/D · N/D tok/s");
  const partial=addUsage(addUsage(emptyUsage(),{prompt_tokens:12,completion_tokens:3,total_tokens:15}),undefined);
  expect(partial).toMatchObject({input:12,output:3,total:15,requests:2,reported:1,partial:true});expect(tokenLine(partial)).toContain("12/3 · N/D tok/s (parcial)");
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
    expect(app.tabs[0]!.tokens).toMatchObject({input:60,output:30,total:90,requests:3,reported:3,partial:false,timedOutput:30});expect(app.tabs[0]!.tokens!.generationMs).toBeGreaterThan(0);expect(app.desktop.draw().lines().join("\n")).toContain("Tokens E/S 60/30");
    await app.switchProject(app.store.value.projects[1]!);app.view.prompt.setValue("Pedido B");await app.submit();await app.tabs[1]!.turn;expect(app.tabs[1]!.tokens).toMatchObject({requests:1,reported:0,partial:true});
    expect(app.desktop.draw().lines().join("\n")).toContain("Tokens E/S N/D/N/D");await app.activateTab(app.tabs[0]!.id);
    for(const [width,height] of [[60,16],[80,24],[190,50]] as const){app.desktop.resize(width,height);const lines=app.desktop.draw().lines();expect(lines.join("\n")).toContain("Prompt");expect(lines.join("\n")).toContain("Tokens E/S 60/30");expect(app.view.promptWindow.bounds.y+app.view.promptWindow.bounds.height).toBeLessThanOrEqual(height-Math.max(1,app.desktop.statusLines!().length));}
    const tools=app.desktop.menu.menus.find(menu=>menu.label==="Tools")!;tools.items.find(item=>item.label==="Nativas · catálogo")!.run!();expect(app.desktop.modal!.title).toBe("Tools nativas");app.desktop.close();
    await app.desktop.onBeforeExit!();closed=true;
    const reopened=await App.open({config});try{expect(reopened.tabs[0]!.tokens?.input).toBe(60);expect(tokensPerSecond(reopened.tabs[0]!.tokens)).toBe(tokensPerSecond(app.tabs[0]!.tokens));expect(reopened.tabs[1]!.tokens?.input).toBeUndefined();}finally{await reopened.desktop.onBeforeExit!();}
  }finally{server.stop(true);if(!closed)await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});

test("tok/s usa solo tokens reportados con duración, y contadores grandes caben en Prompt", () => {
  const usage = addUsage(addUsage(emptyUsage(), { prompt_tokens: 20, completion_tokens: 10 }, 1000), { prompt_tokens: 50, completion_tokens: 30 }, 3000);
  expect(tokensPerSecond(usage)).toBe(10);
  expect(tokenLine(usage)).toBe("Tokens E/S 70/40 · 10.0 tok/s");
  expect(tokensPerSecond(addUsage(emptyUsage(), { completion_tokens: 10 }))).toBeUndefined();
  expect(tokensPerSecond(addUsage(emptyUsage(), undefined, 1000))).toBeUndefined();
  expect(tokensPerSecond(addUsage(emptyUsage(), { completion_tokens: 0 }, 1000))).toBe(0);
  const partial = addUsage(addUsage(usage, { completion_tokens: 100 }), undefined, 2000);
  expect(tokensPerSecond(partial)).toBe(10); expect(partial.partial).toBe(true);
  expect(Bun.stringWidth(tokenLine({ ...partial, input: Number.MAX_SAFE_INTEGER, output: Number.MAX_SAFE_INTEGER }))).toBeLessThanOrEqual(56);
});

test("config antigua muestra recursos por defecto, opciones inválidas conservan archivo", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-resource-config-")), path = join(root, "config.json");
  try {
    const config = defaultConfig(); delete (config.ui as Partial<typeof config.ui>).resources;
    const source = JSON.stringify(config); await Bun.write(path, source);
    expect((await ConfigStore.load(path)).value.ui.resources).toEqual({ cpu: true, ram: true, disk: true, gpu: true });
    expect(await Bun.file(path).text()).toBe(source);
    for (const resources of [null, [], "off", {}, { cpu: "off", ram: true, disk: true, gpu: true }]) {
      const invalid = JSON.stringify({ ...config, ui: { ...config.ui, resources } }); await Bun.write(path, invalid);
      await expect(ConfigStore.load(path)).rejects.toThrow("Indicadores de recursos inválidos"); expect(await Bun.file(path).text()).toBe(invalid);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Vista cambia recursos con teclado y mouse sin modal, tokens fijos y prompt sin superposición", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-resource-ui-")), config = join(root, "config.json"), app = await App.open({ config, cwd: root });
  const key = (key: string) => app.desktop.handle({ type: "key", key });
  const until = async (check: () => boolean) => { for (let i = 0; i < 200; i++) { if (check()) return; await Bun.sleep(5); } throw new Error("No cambió el indicador"); };
  let closed = false;
  try {
    app.metrics.snapshot = { diskPath: root, cpu: { used: 25, free: 75, total: 100 }, ram: { used: 24 * 1073741824, free: 1073741824, total: 25 * 1073741824 }, disk: { used: 700 * 1073741824, free: 200 * 1073741824, total: 900 * 1073741824 } };
    app.view.prompt.setValue("BORRADOR"); app.tabs[0]!.tokens = addUsage(emptyUsage(), { prompt_tokens: 100, completion_tokens: 20 }, 1000);
    for (const [width, height] of [[60, 16], [80, 24], [190, 50]] as const) {
      app.desktop.resize(width, height); const canvas = app.desktop.draw(), prompt = app.view.promptWindow, rect = prompt.controlRect(app.view.prompt);
      expect(canvas.lines()[prompt.client.y]).toContain("Tokens E/S 100/20 · 20.0 tok/s");
      expect(rect.y).toBe(prompt.client.y + 1); expect(rect.y + rect.height).toBe(prompt.client.y + prompt.client.height - 1);
      const footer = app.desktop.statusLines!(); expect(footer.join(" ")).toContain("CPU: 25%"); expect(footer.join(" ")).toContain("RAM: 24.0G/25.0G"); expect(footer.join(" ")).toContain("VRAM: N/D");
      expect(prompt.bounds.y + prompt.bounds.height).toBe(height - footer.length);
      expect(canvas.lines().join("\n")).toContain("BORRADOR"); expect(canvas.lines().join("\n")).not.toContain("< Enviar >");
      for (const line of footer) expect(Bun.stringWidth(line)).toBeLessThanOrEqual(width - 2);
    }
    key("alt+v"); for (let i = 0; i < 3; i++) key("down"); key("enter"); await until(() => !app.store.value.ui.resources.cpu);
    expect(app.desktop.modal).toBeUndefined(); expect(app.desktop.statusLines!().join(" ")).not.toContain("CPU:");
    await app.setLanguage("en"); const x = app.desktop.draw().lines()[0]!.indexOf("View") + 1;
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, button: 0, delta: 0, x, y: 0 });
    expect(app.desktop.draw().lines().join("\n")).toContain("Disk: on");
    for (const action of ["press", "release"] as const) app.desktop.handle({ type: "mouse", action, button: 0, delta: 0, x: x + 2, y: 7 });
    await until(() => !app.store.value.ui.resources.disk);
    for (const resource of ["ram", "gpu"] as const) await app.toggleResource(resource);
    expect(app.desktop.statusLines!()).toEqual([]); expect(app.desktop.draw().lines().join("\n")).toContain("Tokens I/O 100/20 · 20.0 tok/s");
    expect(app.view.prompt.value).toBe("BORRADOR"); expect(app.desktop.active).toBe(app.view.promptWindow);
    expect(Object.keys(app.store.value.ui.resources).sort()).toEqual(["cpu", "disk", "gpu", "ram"]);
    const save = app.store.save; app.store.save = async () => { throw new Error("save failed"); };
    await expect(app.toggleResource("cpu")).rejects.toThrow("save failed"); expect(app.store.value.ui.resources.cpu).toBe(false); app.store.save = save;
    await app.desktop.onBeforeExit!(); closed = true;
    const reopened = await App.open({ config }); try { expect(reopened.store.value.ui.resources).toEqual({ cpu: false, ram: false, disk: false, gpu: false }); expect(reopened.desktop.draw().lines().join("\n")).toContain("Tokens I/O"); } finally { await reopened.desktop.onBeforeExit!(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});
