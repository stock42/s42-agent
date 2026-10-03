import { taskWorkflow } from "./task-provider-fixture.ts";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import { complete, CompletionError } from "../src/llm/client.ts";
import type { ToolCall } from "../src/agent/messages.ts";
import type { Model, Provider } from "../src/storage/config.ts";

const model:Model={id:"fixture",name:"Fixture",manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}};
const provider=(port:number):Provider=>({id:"fixture",name:"Fixture",kind:"openai-compatible",baseUrl:`http://127.0.0.1:${port}/v1`,models:[model]});
const event=(delta:unknown,finish_reason?:string)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`;
const encoder=new TextEncoder();
async function until(check:()=>boolean) {
  for(let i=0;i<600;i++){if(check())return;await Bun.sleep(5);}throw new Error("Timeout del stream visible");
}

for(const field of ["reasoning_content","reasoning"] as const) test(`SSE ${field}: UTF-8 fragmentado y snapshots de calls independientes`,async()=>{
  const source=event({[field]:"Analizo á文🙂",tool_calls:[{index:1,id:"b",function:{name:"read",arguments:'{"path":'}},{index:0,id:"a",function:{name:"list",arguments:"{"}}]})
    +event({[field]:" y verifico",content:"Respuesta",tool_calls:[{index:0,function:{arguments:"}"}},{index:1,function:{arguments:'"code.ts"}'}}]},"tool_calls")+"data: [DONE]\n\n";
  const server=Bun.serve({port:0,fetch(){return new Response(new ReadableStream({start(controller){for(const byte of encoder.encode(source))controller.enqueue(new Uint8Array([byte]));controller.close();}}));}});
  const thoughts:string[]=[],calls:{index:number;call:ToolCall}[]=[];
  try {
    const result=await complete({provider:provider(server.port!),model,messages:[],signal:new AbortController().signal,onDelta:()=>{},onReasoning:delta=>thoughts.push(delta),onToolCall:(index,call)=>calls.push({index,call})});
    expect(thoughts).toEqual(["Analizo á文🙂"," y verifico"]);expect(result.message[field]).toBe("Analizo á文🙂 y verifico");expect(result.message.content).toBe("Respuesta");
    expect(calls.map(c=>c.index)).toEqual([1,0,0,1]);expect(calls[0]!.call.function.arguments).toBe('{"path":');expect(calls[3]!.call.function.arguments).toBe('{"path":"code.ts"}');
    expect(result.message.tool_calls?.map(c=>c.id)).toEqual(["a","b"]);
  } finally {server.stop(true);}
});

test("stream cortado conserva razonamiento y calls parciales sin inventar texto",async()=>{
  const server=Bun.serve({port:0,fetch(){return new Response(event({reasoning_content:"Todavía analizando",tool_calls:[{index:0,id:"parcial",function:{name:"write",arguments:'{"path":'}}]}));}});
  try {
    await complete({provider:provider(server.port!),model,messages:[],signal:new AbortController().signal,onDelta:()=>{}});throw new Error("Debe fallar");
  } catch(error) {
    expect(error).toBeInstanceOf(CompletionError);expect((error as CompletionError).partial.reasoning_content).toBe("Todavía analizando");expect((error as CompletionError).partial.content).toBeNull();expect((error as CompletionError).partial.tool_calls?.[0]?.function.arguments).toBe('{"path":');
  } finally {server.stop(true);}
});

test("chat muestra reasoning, argumentos parciales, ejecución y resultado antes del fin; persiste cancelación/reapertura",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-visible-stream-")),config=join(root,"config.json");const workflow=taskWorkflow(1);let controller:ReadableStreamDefaultController<Uint8Array>|undefined,requests:any[]=[];
  const server=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;const flow=workflow(body);if(flow)return flow;requests.push(body);
    if(body.messages.findLast((m:any)=>m.role==="user")?.content==="cancelar")return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(event({reasoning_content:"Razonamiento parcial guardado",tool_calls:[{index:0,id:"cancelled",function:{name:"write",arguments:'{"path":'}}]})));}}));
    if(requests.length===1)return new Response(new ReadableStream({start(c){controller=c;}}));
    return new Response(event({reasoning:"Ya tengo el resultado"})+event({content:"Terminé y verifiqué"},"stop")+"data: [DONE]\n\n");
  }});
  const app=await App.open({config,cwd:root});
  try {
    const next=structuredClone(app.store.value);next.providers=[provider(server.port!)];await app.store.save(next);await app.selectModel({providerId:"fixture",modelId:"fixture"});
    app.view.prompt.setValue("mostrar proceso");await app.submit();await until(()=>Boolean(controller));
    controller!.enqueue(encoder.encode(event({reasoning_content:"Primero verifico á文🙂"})));await until(()=>app.view.response.value.includes("Primero verifico á文🙂"));expect(app.busy).toBe(true);expect(app.view.response.value).toContain("Razonamiento:");
    controller!.enqueue(encoder.encode(event({tool_calls:[{index:0,id:"call-1",function:{name:"shell",arguments:'{"command":'}}]})));await until(()=>app.view.response.value.includes('{"command":'));expect(app.view.response.value).toContain("Tool call · shell");expect(app.session!.state.events.some(e=>e.type==="tool-start" && e.name==="shell")).toBe(false);
    const args=JSON.stringify({command:"sleep 0.15; printf 'salida visible'"});controller!.enqueue(encoder.encode(event({tool_calls:[{index:0,function:{arguments:args.slice('{"command":'.length)}}]})));await until(()=>app.view.response.value.includes("salida visible"));expect(app.session!.state.events.some(e=>e.type==="tool-start" && e.name==="shell")).toBe(false);
    controller!.enqueue(encoder.encode(event({},"tool_calls")+"data: [DONE]\n\n"));controller!.close();await until(()=>app.view.response.value.includes("Herramienta · shell · ejecutando…"));expect(app.busy).toBe(true);
    const lines=app.desktop.draw().lines(),editor=app.view.editorWindow,prompt=app.view.promptWindow;
    expect(lines[editor.client.y+editor.client.height-1]).toContain("Agente: Ejecutando shell…");
    expect(lines.slice(prompt.bounds.y,prompt.bounds.y+prompt.bounds.height).join("\n")).not.toContain("Ejecutando shell…");
    app.view.prompt.setValue("siguiente borrador");await until(()=>!app.busy);
    expect(app.view.response.value).toContain("Herramienta · shell:\nOK · exit 0");expect(app.view.response.value).toContain("salida visible");expect(app.view.response.value).toContain("Ya tengo el resultado");expect(app.view.response.value).toContain("Terminé y verifiqué");expect(app.view.prompt.value).toBe("siguiente borrador");
    expect(requests[1].messages.find((m:any)=>m.role==="assistant" && m.reasoning_content).reasoning_content).toBe("Primero verifico á文🙂");expect(app.session!.state.messages.filter(m=>m.role==="tool" && !m.tool_call_id?.startsWith("fixture-task-"))).toHaveLength(1);
    const original=app.view.response.value;app.desktop.focus(app.view.editorWindow);app.desktop.handle({type:"paste",text:"editar"});app.desktop.handle({type:"key",key:"delete"});expect(app.view.response.value).toBe(original);
    app.view.prompt.setValue("cancelar");await app.submit();await until(()=>app.view.response.value.includes("Razonamiento parcial guardado"));app.cancel();await until(()=>!app.busy);
    const partial=app.session!.state.messages.at(-1)!;expect(partial.reasoning_content).toBe("Razonamiento parcial guardado");expect(partial.content).toBeNull();expect(partial.tool_calls).toBeUndefined();expect(app.session!.state.events.filter(e=>e.type==="tool-start" && e.name==="shell")).toHaveLength(1);
    await app.desktop.onBeforeExit!();const reopened=await App.open({config});
    try{expect(reopened.view.response.value).toContain("Razonamiento parcial guardado");expect(reopened.view.response.value).toContain("Primero verifico á文🙂");expect(reopened.view.response.value).toContain("Ya tengo el resultado");expect(reopened.view.response.value).toContain("Herramienta · shell:\nOK · exit 0");expect(reopened.view.response.value).toContain("Turno cancelado");}finally{await reopened.desktop.onBeforeExit!();}
  } finally {await app.session?.close();server.stop(true);await rm(root,{recursive:true,force:true});}
});
