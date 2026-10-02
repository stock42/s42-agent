import { expect, test } from "bun:test";
import { complete, CompletionError, SSEParser } from "../src/llm/client.ts";
import type { Model, Provider } from "../src/storage/config.ts";
import type { Message } from "../src/agent/messages.ts";
import { translate } from "../src/ui/i18n.ts";
const model: Model = { id: "fixture", name: "fixture", contextWindow: 8192, maxOutputTokens: 1024, capabilities: { tools: true, images: false } };
test("SSE fragmentado UTF-8/CRLF, datos multilínea y múltiples eventos", () => {
  const events: string[] = [], parser = new SSEParser(data => events.push(data));
  for (const b of new TextEncoder().encode(': keepalive\r\ndata: {"text":"á文🙂"}\r\n\r\ndata: uno\ndata: dos\n\ndata: [DONE]\n\n')) parser.feed(new Uint8Array([b]));
  parser.end(); expect(events).toEqual(['{"text":"á文🙂"}', 'uno\ndos', '[DONE]']);
});
test("Chat Completions conserva deltas/tool calls intercaladas y credencial del proveedor", async () => {
  let request: any, auth: string | null = null;
  const server = Bun.serve({ port: 0, async fetch(req) { request = await req.json(); auth = req.headers.get('authorization');
    const packets = [ {choices:[{delta:{content:'Hola á',tool_calls:[{index:1,id:'b',function:{name:'read',arguments:'{"path":'}},{index:0,id:'a',function:{name:'list',arguments:'{'}}]}}]},
      {choices:[{delta:{content:'文🙂',tool_calls:[{index:0,function:{arguments:'}'}},{index:1,function:{arguments:'"x"}'}}]},finish_reason:'tool_calls'}]}, {usage:{total_tokens:9}}, '[DONE]' ];
    return new Response(packets.map(p => `data: ${typeof p === 'string' ? p : JSON.stringify(p)}\n\n`).join(''), {headers:{'content-type':'text/event-stream'}}); } });
  try { const provider: Provider = { id:'a', name:'A', kind:'openai-compatible', baseUrl:`http://127.0.0.1:${server.port}/v1`, models:[model] }; let text = '';
    const result = await complete({ provider, model, messages:[{role:'user',content:'hola'}], key:'fixture-key', signal:new AbortController().signal, firstEventMs:1000,idleMs:1000,onDelta:delta=>{text+=delta;} });
    expect(auth as string | null).toBe('Bearer fixture-key'); expect(request.model).toBe('fixture'); expect(text).toBe('Hola á文🙂'); expect(result.message.tool_calls?.map(c=>c.id)).toEqual(['a','b']); expect(result.message.tool_calls?.[1]?.function.arguments).toBe('{"path":"x"}'); expect(result.usage?.total_tokens).toBe(9);
  } finally { server.stop(true); }
});
test("stream truncado preserva parcial y errores HTTP no inventan respuesta", async () => {
  const server = Bun.serve({port:0,fetch:req=>req.url.endsWith('/models') ? new Response('',{status:401}) : new Response('data: {"choices":[{"delta":{"content":"parcial"}}]}\n\n')});
  const provider: Provider = {id:'a',name:'A',kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]};
  try { await complete({provider,model,messages:[],signal:new AbortController().signal,firstEventMs:1000,idleMs:1000,onDelta:()=>{}}); throw new Error('debe fallar'); }
  catch(e) { expect(e).toBeInstanceOf(CompletionError); expect((e as CompletionError).partial.content).toBe('parcial'); expect((e as Error).message).toContain('sin completar'); }
  finally {server.stop(true);}
});
test("parciales de solo reasoning se envían con content vacío sin mutar el historial", async () => {
  let request: any;
  const server = Bun.serve({ port: 0, async fetch(req) {
    request = await req.json();
    if (request.messages.some((m: Message) => m.role === "assistant" && m.content === null && !m.tool_calls?.length))
      return Response.json({ error: { message: "Invalid assistant message: content or tool_calls must be set" } }, { status: 400 });
    return new Response('data: {"choices":[{"delta":{"content":"Recuperado"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  } });
  const messages: Message[] = [{ role: "user", content: "Tetris" }, { role: "assistant", content: null, reasoning_content: "Parcial á文🙂" },
    { role: "assistant", content: null, reasoning: "Segundo parcial" }, { role: "user", content: "Continuá" }];
  const before = structuredClone(messages);
  try {
    const result = await complete({ provider: { id: "deepseek", name: "DeepSeek", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: [model] },
      model, messages, signal: new AbortController().signal, firstEventMs: 1000, idleMs: 1000, onDelta: () => {} });
    expect(result.message.content).toBe("Recuperado"); expect(messages).toEqual(before);
    expect(request.messages[1]).toEqual({ ...before[1], content: "" }); expect(request.messages[2]).toEqual({ ...before[2], content: "" });
  } finally { server.stop(true); }
});

test("errores HTTP muestran el detalle del proveedor y el prefijo se traduce", async () => {
  let requests = 0;
  const detail = "Invalid assistant message: content or tool_calls must be set";
  const server = Bun.serve({ port: 0, fetch() { requests++; return Response.json({ error: { message: detail, type: "invalid_request_error" } }, { status: 400 }); } });
  try {
    await expect(complete({ provider: { id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${server.port}`, models: [model] },
      model, messages: [], signal: new AbortController().signal, firstEventMs: 1000, idleMs: 1000, onDelta: () => {} })).rejects.toThrow(`Proveedor: HTTP 400: ${detail}`);
    expect(requests).toBe(1); expect(translate(`Proveedor: HTTP 400: ${detail}`, "en")).toBe(`Provider: HTTP 400: ${detail}`);
    expect(translate("Proveedor: HTTP 401 · revisar API key: Authentication Fails", "en")).toBe("Provider: HTTP 401 · check API key: Authentication Fails");
  } finally { server.stop(true); }
});
test('dos endpoints con mismo modelo conservan keys; errores HTTP e idle/cancel parcial',async()=>{
  const seen:string[]=[];const fixtures=['A','B'].map(name=>Bun.serve({port:0,fetch(req){seen.push(`${name}:${req.headers.get('authorization')}`);return new Response(`data: {"choices":[{"delta":{"content":"${name}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`);}}));
  const options={model,messages:[],signal:new AbortController().signal,firstEventMs:1000,idleMs:1000,onDelta:()=>{}};
  try{for(const [i,server] of fixtures.entries()) {const provider:Provider={id:String(i),name:String(i),kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]};expect((await complete({...options,provider,key:`key-${i}`})).message.content).toBe(i?'B':'A');}expect(seen).toEqual(['A:Bearer key-0','B:Bearer key-1']);}finally{fixtures.forEach(s=>s.stop(true));}
  for(const status of [401,404,429,503]){const server=Bun.serve({port:0,fetch(){return new Response('',{status});}});try{await expect(complete({...options,provider:{id:'err',name:'err',kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]}})).rejects.toThrow(`HTTP ${status}`);}finally{server.stop(true);}}
  const server=Bun.serve({port:0,fetch(){return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"parcial"}}]}\n\n'));}}));}});
  const provider:Provider={id:'idle',name:'Idle',kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[model]};
  try{await expect(complete({...options,provider,idleMs:15})).rejects.toThrow('sin actividad');const controller=new AbortController();const promise=complete({...options,provider,signal:controller.signal,onDelta:()=>controller.abort(new Error('Cancelación fixture'))});await expect(promise).rejects.toThrow('Cancelación fixture');}finally{server.stop(true);}
});
