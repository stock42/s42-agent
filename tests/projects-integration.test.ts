import {expect,test} from 'bun:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {App} from '../src/app.ts';
async function idle(app:App){for(let i=0;i<300 && app.busy;i++)await Bun.sleep(5);expect(app.busy).toBe(false);}
test('dos proyectos: endpoint/modelo, adjuntos, edit/shell, cancelación y reanudación aislados',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s42-projects-')),folderA=join(root,'Proyecto A'),folderB=join(root,'Proyecto B');await mkdir(folderA);await mkdir(folderB);
  await Bun.write(join(folderA,'code.ts'),'console.log(1 + 1);');await Bun.write(join(folderB,'code.ts'),'console.log(1 + 1);');
  const calls:string[]=[];const servers=['A','B'].map(name=>Bun.serve({port:0,async fetch(req){const body=await req.json() as any;const user=body.messages.findLast((m:any)=>m.role==='user');calls.push(name);
    if(user.content==='cancelar')return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"parcial B"}}]}\n\n'));}}));
    expect(body.model).toBe('igual');expect(user.content[1].text).toContain(name==='A'?folderA:folderB);
    const tools=body.messages.filter((m:any)=>m.role==='tool').length;
    const call=tools===0?{name:'edit',arguments:JSON.stringify({path:'code.ts',oldText:'1 + 1',newText:name==='A'?'2 + 2':'3 + 3'})}:tools===1?{name:'shell',arguments:'{"command":"bun code.ts"}'}:undefined;
    const delta=call?{tool_calls:[{index:0,id:`${name}-${tools}`,function:call}]}:{content:`Verificado ${name}`};
    return new Response(`data: ${JSON.stringify({choices:[{delta,finish_reason:call?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);
  }}));
  const config=join(root,'config.json'),app=await App.open({config,cwd:folderA});
  try{const next=structuredClone(app.store.value);next.providers=servers.map((server,i)=>({id:String(i),name:String(i),kind:'llama.cpp',baseUrl:`http://127.0.0.1:${server.port}/v1`,models:[{id:'igual',name:'Igual',manual: true, contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}]}));await app.store.save(next);
    const a=app.project!,b=await app.store.project('B',folderB,root);
    await app.selectModel({providerId:'0',modelId:'igual'});await app.attach([join(folderA,'code.ts')]);app.view.prompt.setValue('editar y verificar A');await app.submit();await idle(app);app.view.prompt.setValue('borrador A');
    await app.switchProject(b);await app.selectModel({providerId:'1',modelId:'igual'});await app.attach([join(folderB,'code.ts')]);app.view.prompt.setValue('editar y verificar B');await app.submit();await idle(app);
    expect(await Bun.file(join(folderA,'code.ts')).text()).toBe('console.log(2 + 2);');expect(await Bun.file(join(folderB,'code.ts')).text()).toBe('console.log(3 + 3);');expect(calls).toEqual(['A','A','A','B','B','B']);
    app.view.prompt.setValue('cancelar');await app.submit();for(let i=0;i<200 && !app.view.response.value.includes('parcial B');i++)await Bun.sleep(5);app.cancel();await idle(app);app.view.prompt.setValue('borrador B');
    await app.switchProject(a);expect(app.view.prompt.value).toBe('borrador A');expect(app.selection.providerId).toBe('0');expect(app.view.response.value).not.toContain('Verificado B');await app.desktop.onBeforeExit!();
    const resumed=await App.open({config});expect(resumed.view.prompt.value).toBe('borrador A');await resumed.switchProject(b);expect(resumed.view.prompt.value).toBe('borrador B');expect(resumed.view.response.value).toContain('parcial B');expect(resumed.selection.providerId).toBe('1');await resumed.desktop.onBeforeExit!();
  }finally{await app.session?.close();servers.forEach(s=>s.stop(true));await rm(root,{recursive:true,force:true});}
});
