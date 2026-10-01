import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/app.ts';
import { parsePaths, pastedPaths, snapshot, validateAttachments } from '../src/agent/attachments.ts';
import { TextArea } from '../src/ui/components/text-area.ts';
import { bindings } from '../src/ui/bindings.ts';
import { Session } from '../src/storage/sessions.ts';
const event=(text:string)=>({type:'key' as const,key:text,text});
async function settled(app:App){for(let i=0;i<200 && app.busy;i++)await Bun.sleep(5);expect(app.busy).toBe(false);}
test('rutas POSIX, quotes, Windows/UNC, file URL y bloques no convertidos',async()=>{
  expect(parsePaths('/tmp/a\\ b.txt "/tmp/tildé.txt"')).toEqual(['/tmp/a b.txt','/tmp/tildé.txt']);
  expect(parsePaths('"C:\\Users\\A B\\x.txt" \\\\server\\share\\x.txt')).toEqual(['C:\\Users\\A B\\x.txt','\\\\server\\share\\x.txt']);
  expect(parsePaths('file:///tmp/tild%C3%A9.txt file:///C:/Users/x.txt')).toEqual(['/tmp/tildé.txt','C:\\Users\\x.txt']);
  const root=await mkdtemp(join(tmpdir(),'s42-paths-'));try{await Bun.write(join(root,'a b.txt'),'hola');expect(await pastedPaths('a b.txt',root)).toEqual(['a b.txt']);expect(await pastedPaths('El archivo a b.txt debe cambiar',root)).toBeUndefined();expect(parsePaths('"no cerrado')).toBeUndefined();}finally{await rm(root,{recursive:true,force:true});}
});
test('Vim edita por grafema/línea, undo; conversación no modifica texto',()=>{
  const area=new TextArea('test',{x:0,y:0,width:20,height:3},'uno 😀\ndos\ntres');
  area.vim('0');area.vim('dd');expect(area.value).toBe('uno 😀\ndos\n');area.vim('u');expect(area.value).toBe('uno 😀\ndos\ntres');
  area.vim('0');area.vim('x');expect(area.value).toBe('uno 😀\ndos\nres');area.vim('u');area.vim('b');area.vim('b');area.vim('w');area.vim('A');
  area.readOnly=true;const before=area.value;area.vim('j');area.vim('gg');area.vim('G');area.vim('dd');expect(area.value).toBe(before);
  expect(()=>bindings({global:{projects:'ctrl+o'}})).toThrow('Colisión');expect(()=>bindings({global:{projects:'f10'}})).toThrow('inválido');
});
test('paste NORMAL no ejecuta Vim ni envía; modales tienen prioridad',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-vim-')),app=await App.open({config:join(root,'config.json'),cwd:root});
  try{app.view.prompt.setValue('base');app.desktop.handle({type:'key',key:'escape'});expect(app.mode).toBe('NORMAL');expect(app.desktop.menu.opened).toBe(-1);
    app.desktop.handle({type:'paste',text:'i dd\n\x1bEnter'});app.desktop.handle(event('i'));app.desktop.handle(event('!'));
    app.projects();app.desktop.handle({type:'key',key:'escape'});expect(app.mode).toBe('NORMAL');
    await app.desktop.onBeforeExit!();expect(app.view.prompt.value).toContain('i dd\n Enter');expect(app.view.prompt.value.endsWith('!')).toBe(true);expect(app.session?.state.messages.length).toBe(0);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('snapshot, cambio antes de enviar y payload enviado conservado tras borrar original',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-attach-'));let payload:any;
  const server=Bun.serve({port:0,async fetch(req){payload=await req.json();return new Response('data: {"choices":[{"delta":{"content":"Hecho"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');}});
  const app=await App.open({config:join(root,'config.json'),cwd:root});
  try{const next=structuredClone(app.store.value);next.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`;next.providers[0]!.models.push({id:'fixture',name:'Fixture',manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:false,images:true}});await app.store.save(next);await app.selectModel({providerId:'llama.cpp',modelId:'fixture'});
    const path=join(root,'adjunto.txt');await Bun.write(path,'versión 1');await app.attach([path]);await Bun.write(path,'versión 2');app.view.prompt.setValue('leer');await expect(app.submit()).rejects.toThrow('cambió');expect(app.view.prompt.value).toBe('leer');
    await app.submit();await settled(app);expect(payload.messages[1].content[1].text).toContain('versión 2');const id=app.session!.state.id,project=app.project!.id;
    const png=join(root,'image.png');await Bun.write(png,new Uint8Array([137,80,78,71,13,10,26,10,0]));const image=await snapshot(png,root);expect(image.content).toContain('data:image/png;base64,');expect(()=>validateAttachments([image],false)).toThrow('no admite imágenes');
    await Bun.write(join(root,'bad.pdf'),'PDF');await expect(snapshot(join(root,'bad.pdf'),root)).rejects.toThrow('Formato');
    await app.desktop.onBeforeExit!();await rm(path);const restored=await Session.open(app.sessionsPath,project,id);expect(JSON.stringify(restored.state.messages)).toContain('versión 2');await restored.close();
  }finally{server.stop(true);await app.session?.close();await rm(root,{recursive:true,force:true});}
});
test('rutas absolutas sin paste adjuntan al primer Enter, prompt compacto visible',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-fallback-')),app=await App.open({config:join(root,'config.json'),cwd:root});
  try{const path=join(root,'archivo con espacio.txt');await Bun.write(path,'texto');app.view.prompt.setValue(path);await app.submit();expect(app.attachments.length).toBe(1);expect(app.view.prompt.value).toBe('');expect(app.session!.state.messages.length).toBe(0);
    app.desktop.resize(60,16);const screen=app.desktop.draw().lines().join('\n');expect(screen).toContain('Adjuntos (1)');expect(screen).toContain('INSERT');expect(screen).toContain('tok/s');expect(screen).not.toContain('< Enviar >');await app.desktop.onBeforeExit!();
  }finally{await rm(root,{recursive:true,force:true});}
});
test('ayuda completa navegable y cambios de modelo durante turno rechazados',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-help-')),app=await App.open({config:join(root,'config.json'),cwd:root});
  try{app.desktop.resize(60,16);app.desktop.onHelp();let found=false;for(let i=0;i<16;i++){if(app.desktop.draw().lines().join('\n').includes('/detach /quit'))found=true;app.desktop.handle({type:'key',key:'pagedown'});}expect(found).toBe(true);app.desktop.handle({type:'key',key:'escape'});
    app.busy=true;await expect(app.newSession()).rejects.toThrow('turno activo');app.busy=false;await app.desktop.onBeforeExit!();
  }finally{await rm(root,{recursive:true,force:true});}
});
