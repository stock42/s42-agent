import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const index=resolve(import.meta.dir,'../index.ts');
async function until(check:()=>boolean){for(let i=0;i<600;i++){if(check())return;await Bun.sleep(5);}throw new Error('Timeout en TUI del agente');}
test('entrypoint real: Models primer uso, host/puerto/key, coding, cancelación y borrador reabierto',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-app-pty-')),config=join(root,'config.json');let text='',requests=0,auth:string|null=null;
  const encode=new TextEncoder();
  const server=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;auth=req.headers.get('authorization');requests++;
    const user=body.messages.findLast((m:any)=>m.role==='user');
    if(user.content==='lento')return new Response(new ReadableStream({start(c){c.enqueue(encode.encode('data: {"choices":[{"delta":{"content":"parcial cancelable"}}]}\n\n'));}}));
    const steps=[{name:'read',arguments:'{"path":"code.ts"}'},{name:'edit',arguments:'{"path":"code.ts","oldText":"1 + 1","newText":"2 + 2"}'},{name:'shell',arguments:'{"command":"bun code.ts"}'}];
    const call=steps[body.messages.filter((m:any)=>m.role==='tool').length];
    const delta=call?{tool_calls:[{index:0,id:`call-${requests}`,function:call}]}:{content:'Resultado verificado: 4'};
    return new Response(`data: ${JSON.stringify({choices:[{delta,finish_reason:call?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);
  }});
  const terminal=new Bun.Terminal({cols:80,rows:24,data:(_,data)=>{text+=new TextDecoder().decode(data);}});
  let child=Bun.spawn([process.execPath,index,'--config',config,'--cwd',root,'--no-color'],{cwd:root,env:{...process.env,TERM:'xterm-256color'},terminal});
  const write=(s:string)=>terminal.write(s),paste=(s:string)=>write(`\x01\x1b[200~${s}\x1b[201~`);
  try{
    await Bun.write(join(root,'code.ts'),'console.log(1 + 1);');await until(()=>text.includes('No hay modelo configurado'));
    write('\x1bm\x1b[B\r');await until(()=>text.includes('ID del modelo'));
    paste('fixture');write('\t');paste('Fixture');write('\t');paste('http://127.0.0.1/v1');write('\t\r');await until(()=>text.includes('API key (sesión)'));
    paste(String(server.port));write('\t');paste('fixture-secret');write('\t\t\t\r');await until(()=>text.includes('Tools / imágenes'));
    paste('32000');write('\t');paste('1000');write('\t');paste('sí/no');write('\t\t\r');
    await until(()=>text.includes('Local · llama.cpp · fixture'));expect(await Bun.file(config).text()).not.toContain('fixture-secret');
    write('cambiar suma\x1b[13;2u');write('y verificar\r');await until(()=>text.includes('Resultado verificado: 4'));
    expect(await Bun.file(join(root,'code.ts')).text()).toBe('console.log(2 + 2);');expect(auth as string|null).toBe('Bearer fixture-secret');expect(requests).toBe(4);
    write('lento\r');await until(()=>text.includes('parcial cancelable'));write('\x03');await until(()=>text.includes('Turno cancelado'));
    write('borrador conservado');await until(()=>text.includes('borrador conservado'));write('\x11');expect(await child.exited).toBe(0);expect(text).toContain('\x1b[?1049l');
    text='';child=Bun.spawn([process.execPath,index,'--config',config,'--no-color'],{cwd:root,env:{...process.env,TERM:'xterm-256color'},terminal});
    await until(()=>text.includes('borrador conservado'));expect(text).toContain('Resultado verificado: 4');write('\x11');expect(await child.exited).toBe(0);
  }catch(e){throw new Error((e as Error).message+' · salida reciente: '+text.slice(-3500).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''));}finally{child.kill();terminal.close();server.stop(true);await rm(root,{recursive:true,force:true});}
},15000);
