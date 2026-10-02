import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const index=resolve(import.meta.dir,'../index.ts');
async function until(check:()=>boolean){for(let i=0;i<600;i++){if(check())return;await Bun.sleep(5);}throw new Error('Timeout en TUI del agente');}
test('entrypoint real: Models primer uso, host/puerto/key, coding, cancelación y borrador reabierto',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-app-pty-')),config=join(root,'config.json');let text='',requests=0,auth:string|null=null;
  const encode=new TextEncoder();
  const server=Bun.serve({port:0,async fetch(req){if(req.method==='GET')return new Response('',{status:404});const body=await req.json() as any;auth=req.headers.get('authorization');requests++;
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
    paste('fixture');write('\t');paste('Fixture');write('\t');paste('http://127.0.0.1/v1');write('\t\r');await until(()=>text.includes('API key · llavero'));
    paste(String(server.port));write('\t');paste('fixture-secret');write('\t\t\t\r');await until(()=>text.includes('Tools / imágenes'));
    paste('sí/no');write('\t\t\r');
    await until(()=>text.includes('Local · llama.cpp · fixture'));expect(await Bun.file(config).text()).not.toContain('fixture-secret');
    write('cambiar suma\x1b[13;2u');write('y verificar\r');await until(()=>text.includes('Resultado verificado: 4'));
    expect(await Bun.file(join(root,'code.ts')).text()).toBe('console.log(2 + 2);');expect(auth as string|null).toBe('Bearer fixture-secret');expect(requests).toBe(4);
    // The last streamed fragment arrives before the turn is persisted and idle.
    await until(()=>text.includes('Listo · uso no reportado'));
    write('lento\r');await until(()=>text.includes('parcial cancelable'));write('\x03');await until(()=>text.includes('Turno cancelado'));
    write('borrador conservado');await until(()=>text.includes('borrador conservado'));write('\x11');expect(await child.exited).toBe(0);expect(text).toContain('\x1b[?1049l');
    text='';child=Bun.spawn([process.execPath,index,'--config',config,'--no-color'],{cwd:root,env:{...process.env,TERM:'xterm-256color'},terminal});
    await until(()=>text.includes('borrador conservado'));expect(text).toContain('Resultado verificado: 4');write('\x11');expect(await child.exited).toBe(0);
  }catch(e){throw new Error((e as Error).message+' · salida reciente: '+text.slice(-3500).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''));}finally{child.kill();terminal.close();server.stop(true);await rm(root,{recursive:true,force:true});}
},15000);

test('entrypoint: Projects Nombre/Carpeta, picker, explorador externo, reasoning y tool call visibles',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-explorer-pty-')),project=join(root,'proyecto'),config=join(root,'config.json');
  const {mkdir}=await import('node:fs/promises');await mkdir(project);await Bun.write(join(root,'externo.ts'),'export const externo = 42;');
  let text='',requests=0;
  const server=Bun.serve({port:0,async fetch(req){await req.json();requests++;
    if(requests===1)return new Response(new ReadableStream({async start(c){
      const packet=(delta:unknown,finish_reason?:string)=>new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`);
      c.enqueue(packet({reasoning_content:'Inspecciono el proyecto'}));await Bun.sleep(60);
      c.enqueue(packet({tool_calls:[{index:0,id:'call',function:{name:'list',arguments:'{"path":"."}'}}]}));await Bun.sleep(60);
      c.enqueue(packet({},'tool_calls'));c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));c.close();
    }}));
    return new Response(`data: ${JSON.stringify({choices:[{delta:{reasoning:'Ya revisé las entradas',content:'Resultado fixture visible'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
  }});
  const {defaultConfig}=await import('../src/storage/config.ts'),initial=defaultConfig();
  initial.providers=[{id:'fixture',name:'Fixture',kind:'openai-compatible',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[{id:'fixture',name:'Fixture',manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}]}];initial.defaults={providerId:'fixture',modelId:'fixture'};await Bun.write(config,JSON.stringify(initial));
  const terminal=new Bun.Terminal({cols:80,rows:24,data:(_,data)=>{text+=new TextDecoder().decode(data);}});
  const child=Bun.spawn([process.execPath,index,'--config',config,'--no-color'],{cwd:project,env:{...process.env,TERM:'xterm-256color'},terminal});
  const write=(s:string)=>terminal.write(s),paste=(s:string)=>write(`\x01\x1b[200~${s}\x1b[201~`);
  try {
    await until(()=>text.includes('Projects · nuevo'));expect(text).toContain('Nombre');expect(text).toContain('Carpeta');
    paste('Proyecto PTY');write('\t');paste(root);write('\t\r');await until(()=>text.includes('Elegir folder'));await until(()=>text.includes('doble clic'));
    text='';write('\t\t\t\t\r');await until(()=>text.includes('< Guardar >'));
    // The folder picker restores focus to Folder in the underlying form.
    write('\t\t\r');await until(()=>text.includes('Fixture · fixture'));
    expect((await Bun.file(config).json()).projects[0].name).toBe('Proyecto PTY');
    text='';terminal.resize(60,16);child.kill('SIGWINCH');await until(()=>text.includes('Prompt'));
    write('\x05');await until(()=>text.includes('Explorador de archivos'));write('\x1b[F');await until(()=>text.includes('externo.ts'));expect(text).toContain('Prompt');
    text='';write('\x1b');await until(()=>text.includes('Fixture · fixture'));
    text='';terminal.resize(80,24);child.kill('SIGWINCH');await until(()=>text.includes('Prompt'));
    write('mostrar eventos\r');await until(()=>text.includes('Resultado fixture visible'));expect(text).toContain('Razonamiento:');expect(text).toContain('Tool call · list');
    // The project-tab row leaves one less chat row; scroll to inspect the tool-result heading.
    write('\x1b[<64;10;8M');await until(()=>text.includes('Herramienta · list'));expect(requests).toBe(2);
    write('\x11');expect(await child.exited).toBe(0);expect(text).toContain('\x1b[?1049l');
  } catch(e){throw new Error((e as Error).message+' · '+text.slice(-3000).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''));}
  finally {child.kill();terminal.close();server.stop(true);await rm(root,{recursive:true,force:true});}
},15000);
