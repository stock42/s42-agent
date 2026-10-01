import { expect, test } from "bun:test";
import { complete, CompletionError, SSEParser } from "../src/llm/client.ts";
import type { Model, Provider } from "../src/storage/config.ts";
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
