import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig, defaultProviders, type Model } from "../src/storage/config.ts";
import { discoverModels, runtimeModel } from "../src/llm/client.ts";
import { tokensPerSecond } from "../src/agent/usage.ts";

const props={model_alias:"local",default_generation_settings:{n_ctx:128768},chat_template_caps:{supports_tools:true},modalities:{vision:false}};
const model: Model={id:"local",name:"Local",contextWindow:8192,maxOutputTokens:2048,capabilities:{tools:false,images:false}};
const data=(packet:unknown)=>new TextEncoder().encode(`data: ${typeof packet === "string" ? packet : JSON.stringify(packet)}\n\n`);
async function until(check:()=>boolean){for(let i=0;i<500;i++){if(check())return;await Bun.sleep(5);}throw new Error("Timeout progreso");}

test("llama.cpp detecta tools/contexto reales, respeta manual y fallback sin /props",async()=>{
 let calls=0, supported=true;
 const server=Bun.serve({port:0,fetch(req){calls++; if(req.url.endsWith("/models"))return Response.json({data:[{id:"local"}]});return supported ? Response.json(props) : new Response("",{status:404});}});
 const provider=defaultProviders()[0]!;provider.baseUrl=`http://127.0.0.1:${server.port}/v1`;
 try {
   expect((await discoverModels(provider))[0]).toMatchObject({contextWindow:128768,maxOutputTokens:undefined,capabilities:{tools:true,images:false}});
   expect(await runtimeModel(provider,model)).toMatchObject({contextWindow:128768,maxOutputTokens:undefined,capabilities:{tools:true}});
   const before=calls; expect(await runtimeModel(provider,{...model,manual:true})).toEqual({...model,manual:true});expect(calls).toBe(before);
   supported=false;expect(await runtimeModel(provider,model)).toEqual({...model,maxOutputTokens:undefined});
 }finally{server.stop(true);}
});

test("tokens y promedio se actualizan antes del final y acumulan sin duplicar; tools descubiertas llegan al LLM",async()=>{
 const root=await mkdtemp(join(tmpdir(),"s42-progress-")),config=join(root,"config.json"),initial=defaultConfig();
 let controller:ReadableStreamDefaultController<Uint8Array>|undefined, request:any;
 const server=Bun.serve({port:0,async fetch(req){if(req.method==="GET")return Response.json(props);request=await req.json();return new Response(new ReadableStream({start(c){controller=c;}}));}});
 initial.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`; initial.providers[0]!.models=[model];initial.defaults.modelId="local";await Bun.write(config,JSON.stringify(initial));
 const app=await App.open({config,cwd:root});
 try {
   app.view.prompt.setValue("Hola");await app.submit();await until(()=>!!controller);
   expect(Object.hasOwn(request,"max_tokens")).toBe(false);expect(request.timings_per_token).toBe(true);expect(request.tools.some((t:any)=>t.function.name==="write")).toBe(true);
   expect(app.current().model.capabilities.tools).toBe(true); expect(app.desktop.draw().lines().join("\n")).not.toContain("sin tools");
   controller!.enqueue(data({choices:[{delta:{reasoning_content:"Pensando"}}],timings:{cache_n:20,prompt_n:80,predicted_n:5}}));
   await until(()=>app.tabs[0]!.tokens!.output===5);expect(app.tabs[0]!.busy).toBe(true);expect(tokensPerSecond(app.tabs[0]!.tokens)).toBeGreaterThan(0);
   const previous=app.tabs[0]!.tokens!.generationMs!;await Bun.sleep(40);
   controller!.enqueue(data({choices:[{delta:{content:"Hola"}}],timings:{cache_n:20,prompt_n:80,predicted_n:15}}));
   await until(()=>app.tabs[0]!.tokens!.output===15);expect(app.tabs[0]!.tokens!.input).toBe(100);expect(app.tabs[0]!.tokens!.requests).toBe(1);expect(app.tabs[0]!.tokens!.generationMs).toBeGreaterThan(previous);
   controller!.enqueue(data({choices:[{finish_reason:"stop",delta:{}}],usage:{prompt_tokens:100,completion_tokens:15,total_tokens:115}}));controller!.enqueue(data("[DONE]"));controller!.close();await app.tabs[0]!.turn;
   expect(app.tabs[0]!.tokens!.output).toBe(15);expect(app.tabs[0]!.tokens!.requests).toBe(1);expect(app.tabs[0]!.tokens!.partial).toBe(false);
 }finally{await app.desktop.onBeforeExit!();server.stop(true);await rm(root,{recursive:true,force:true});}
});


test("props opcional tiene timeout corto y conserva fallback; cancelación del turno sí interrumpe",async()=>{
 const server=Bun.serve({port:0,fetch:()=>new Response(new ReadableStream())});
 const provider=defaultProviders()[0]!;provider.baseUrl=`http://127.0.0.1:${server.port}/v1`;
 try {
   expect(await runtimeModel(provider,model,undefined,undefined,20)).toEqual({...model,maxOutputTokens:undefined});
   const controller=new AbortController();const pending=runtimeModel(provider,model,undefined,controller.signal,1000);controller.abort(new Error("Cancelado por usuario"));
   await expect(pending).rejects.toThrow("Cancelado por usuario");
 }finally{server.stop(true);}
});
