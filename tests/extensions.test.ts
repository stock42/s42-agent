import {test,expect,spyOn} from 'bun:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {App} from '../src/app.ts';
import {defaultConfig} from '../src/storage/config.ts';
import {Input} from '../src/ui/components/input.ts';
import {TextArea} from '../src/ui/components/text-area.ts';
import {version} from '../package.json';
const key=(app:App,key:string)=>app.desktop.handle({type:'key',key});
async function until(check:()=>boolean){for(let i=0;i<500;i++){if(check())return;await Bun.sleep(5);}throw new Error('Timeout Extensions UI');}
test('MCP CRUD y skill registro/toggle/removal, compact menu mouse and modal save focus',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-ext-ui-')),app=await App.open({config:join(root,'config.json'),cwd:root});
 const save=async(values:string[])=>{const modal=app.desktop.modal!;const inputs=modal.controls.filter(c=>c instanceof Input) as Input[];values.forEach((value,i)=>inputs[i]!.setValue(value));modal.focusedId='save';key(app,'enter');await until(()=>!app.desktop.modal);};
 try{app.desktop.resize(60,16);const header=app.desktop.draw().lines()[0]!;for(const name of ['Projects','Models','Promptings','Tools','Vista','Ayuda'])expect(header).toContain(name);
 key(app,"alt+c");expect(app.desktop.modal!.title).toContain("MCP");key(app,"escape");
 app.extensions.serverForm('http');await save(['Local MCP','http://127.0.0.1:3000/mcp','']);expect(app.store.value.mcpServers[0]!.enabled).toBe(true);
 app.extensions.servers();key(app,'enter');key(app,'down');key(app,'enter');await until(()=>!app.store.value.mcpServers[0]!.enabled);
 app.extensions.serverForm('http',app.store.value.mcpServers[0]);await save(['Renamed MCP','http://127.0.0.1:3001/mcp','']);expect(app.store.value.mcpServers[0]!.url).toContain('3001');
 app.extensions.servers();key(app,'enter');key(app,'down');key(app,'down');key(app,'down');key(app,'enter');await until(()=>!app.store.value.mcpServers.length);
 const skill=join(root,'guide');await mkdir(skill);await Bun.write(join(skill,'SKILL.md'),'---\nname: guide\ndescription: Make precise edits\n---\nUse read before edit.');app.extensions.skillForm();await save([skill,'proyecto']);expect(app.store.value.skills[0]!.projectId).toBe(app.project!.id);
 app.extensions.skills();key(app,'enter');key(app,'down');key(app,'enter');await until(()=>!app.store.value.skills[0]!.enabled);
 app.extensions.skills();key(app,'enter');key(app,'down');key(app,'down');key(app,'down');key(app,'enter');await until(()=>!app.store.value.skills.length);
 key(app,"escape");app.desktop.handle({type:"key",key:"space",text:" "});app.desktop.handle({type:"key",key:"k",text:"k"});expect(app.desktop.modal!.title).toContain("Skills");key(app,"escape");
 expect(app.view.response.readOnly).toBe(true);expect(app.desktop.draw().lines().join('\n')).toContain('Prompt');
 }finally{await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});
test('app loop loads invoked skill, executes MCP tool, persists named results and resumes without effects',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-ext-loop-')),skillPath=join(root,'guide');await mkdir(skillPath);await Bun.write(join(skillPath,'SKILL.md'),'---\nname: guide\ndescription: Use local catalog\n---\nInstruction ONLY_IN_BODY.');let effects=0,requests=0;let usedSkill=false;
 const mcp=Bun.serve({port:0,async fetch(req){const p=await req.json() as any;return Response.json({jsonrpc:'2.0',id:p.id,result:p.method==='server/discover'?{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}:p.method==='tools/list'?{tools:[{name:'status',description:'Status',inputSchema:{type:'object',properties:{}}}]}:{content:[{type:'text',text:'MCP_RESULT '+(++effects)}]}});}});
 const llm=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;usedSkill=body.messages[0].content.includes('ONLY_IN_BODY');requests++;const name=body.tools.find((t:any)=>t.function.name.startsWith('mcp_')).function.name;
  const delta=requests===1?{reasoning_content:'Consulto herramienta externa',tool_calls:[{index:0,id:'external-1',function:{name,arguments:'{}'}}]}:{content:'MCP response verified'};
  return new Response(`data: ${JSON.stringify({choices:[{delta,finish_reason:requests===1?'tool_calls':'stop'}]})}\n\ndata: [DONE]\n\n`);
 }});
 const config=defaultConfig();config.providers[0]!.baseUrl=`http://127.0.0.1:${llm.port}/v1`;config.providers[0]!.models=[{id:'fixture',name:'Fixture',contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:true,images:false}}];config.defaults.modelId='fixture';config.mcpServers=[{id:'mcp',name:'Fixture',enabled:true,transport:'http',url:`http://127.0.0.1:${mcp.port}`}];config.skills=[{id:'guide',name:'guide',path:join(skillPath,'SKILL.md'),enabled:true}];const path=join(root,'config.json');await Bun.write(path,JSON.stringify(config));const app=await App.open({config:path,cwd:root});let closed=false;
 try{app.view.prompt.setValue('/skill guide check MCP');await app.submit();await until(()=>!app.busy);expect(usedSkill).toBe(true);expect(effects).toBe(1);expect(app.view.response.value).toContain('MCP_RESULT 1');expect(app.view.response.value).toContain('Razonamiento:');expect(app.session!.state.events.some(e=>e.type==='notice' && e.text.includes('MCP Fixture'))).toBe(true);expect(app.session!.state.messages.at(-1)?.content).toBe('MCP response verified');const id=app.session!.state.id;await app.desktop.onBeforeExit!();closed=true;const reopened=await App.open({config:path,session:id});try{expect(reopened.view.response.value).toContain('MCP_RESULT 1');expect(effects).toBe(1);}finally{await reopened.desktop.onBeforeExit!();}}
 finally{if(!closed)await app.desktop.onBeforeExit!();mcp.stop(true);llm.stop(true);await rm(root,{recursive:true,force:true});}
});

test('long Models menu scrolls with keys and wheel without covering the fixed prompt at 60x16',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-long-menu-')),app=await App.open({config:join(root,'config.json'),cwd:root});
 try{app.desktop.resize(60,16);const promptRows=()=>app.desktop.draw().lines().slice(app.view.promptWindow.bounds.y,15);const baseline=promptRows();key(app,'alt+m');
 expect(promptRows()).toEqual(baseline);for(let i=0;i<app.desktop.menu.menus[2]!.items.length-1;i++)key(app,'down');expect(app.desktop.draw().lines().join('\n')).toContain('Quitar proveedor');expect(promptRows()).toEqual(baseline);
 app.desktop.handle({type:'mouse',action:'wheel',x:25,y:4,button:0,delta:-1});expect(promptRows()).toEqual(baseline);key(app,'escape');expect(app.desktop.menu.opened).toBe(-1);
 }finally{await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});

test('completed background tasks restore status and a closed search form does not reopen results',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-task-ui-')),app=await App.open({config:join(root,'config.json'),cwd:root});
 try{expect(await app.task('Buscando…',async()=>42)).toBe(42);expect(app.status).toBe('Listo');expect(app.busy).toBe(false);await expect(app.task('Conectando…',async()=>{throw new Error('network failed');})).rejects.toThrow('network failed');expect(app.status).toBe('network failed');
 const {form}=await import('../src/ui/dialogs.ts');let release:()=>void=()=>{},opened=false;const wait=new Promise<void>(resolve=>release=resolve);form(app.desktop,'Buscar',[{label:'query',value:'bun'}],async()=>{await wait;return ()=>{opened=true;};});const modal=app.desktop.modal!;modal.focusedId='save';key(app,'enter');key(app,'escape');release();await Bun.sleep(5);expect(opened).toBe(false);expect(app.desktop.modal).toBeUndefined();
 }finally{await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});

test('About bilingüe tiene scroll y conserva prompt en 60x16; buscador usa el sitio skills.sh',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-about-search-')),app=await App.open({config:join(root,'config.json'),cwd:root});
 const original=globalThis.fetch;let target:URL|undefined;
 const fetch=spyOn(globalThis,'fetch').mockImplementation(Object.assign(async(input:Parameters<typeof original>[0],options?:Parameters<typeof original>[1])=>{
  const url=new URL(input instanceof Request?input.url:String(input));if(url.origin!=='https://skills.sh')return original(input,options);
  target=url;return Response.json({skills:[{id:'vercel-labs/agent-skills/vercel-react-best-practices',name:'vercel-react-best-practices',skillId:'vercel-react-best-practices',source:'vercel-labs/agent-skills',installs:100}]});
 },{preconnect:original.preconnect}));
 try{app.desktop.resize(60,16);app.view.prompt.setValue('Borrador conservado');
 const header=app.desktop.draw().lines()[0]!,x=header.indexOf('Ayuda');for(const action of ['press','release'] as const)app.desktop.handle({type:'mouse',action,x,y:0,button:0,delta:0});
 key(app,'down');key(app,'enter');expect(app.desktop.modal?.title).toBe('About');const screen=app.desktop.draw().lines().join('\n');
 for(const text of ['Powered by César Casas.','MIT.','S42 Agent.',`Version: ${version}`,'Borrador conservado'])expect(screen).toContain(text);
 const about=app.desktop.modal!,content=about.controls.find(c=>c instanceof TextArea) as TextArea,originalContent=content.value;
 expect(content.readOnly).toBe(true);key(app,'backspace');app.desktop.handle({type:'paste',text:'No editar'});expect(content.value).toBe(originalContent);
 key(app,'ctrl+end');expect(app.desktop.draw().lines().join('\n')).toContain('https://www.linkedin.com/in/cesarcasas/');key(app,'ctrl+home');key(app,'pagedown');expect(app.desktop.draw().lines().join('\n')).not.toContain('Powered by César Casas.');
 app.desktop.resize(100,30);key(app,'ctrl+home');expect(about.bounds.y+about.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);expect(app.desktop.draw().lines().join('\n')).toContain('Qué puede hacer por vos');
 key(app,'escape');expect(app.view.prompt.value).toBe('Borrador conservado');await app.setLanguage('en');
 app.desktop.menu.menus.find(m=>m.label==='Ayuda')!.items.find(i=>i.label==='About')!.run();expect(app.desktop.draw().lines().join('\n')).toContain('The power of a coding agent.');
 key(app,'ctrl+end');expect(app.desktop.draw().lines().join('\n')).toContain('Windows, Linux and macOS');key(app,'enter');expect(app.desktop.modal).toBeUndefined();await app.setLanguage('es');
 app.extensions.search();expect(app.desktop.modal?.title).toBe('Buscar · https://skills.sh');
 const modal=app.desktop.modal!,input=modal.controls.find(c=>c instanceof Input) as Input;input.setValue('react + bun');modal.focusedId='save';key(app,'enter');await until(()=>app.desktop.modal?.title==='https://skills.sh · resultados');
 expect(target!.origin).toBe('https://skills.sh');expect(target!.pathname).toBe('/api/search');expect(target!.searchParams.get('q')).toBe('react + bun');expect(target!.searchParams.get('limit')).toBe('20');
 key(app,'enter');key(app,'enter');expect(app.desktop.draw().lines().join('\n')).toContain('https://skills.sh/');expect(app.view.prompt.value).toBe('Borrador conservado');
 }finally{fetch.mockRestore();await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});
