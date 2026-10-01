import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {App} from '../src/app.ts';
import {defaultConfig} from '../src/storage/config.ts';
import {Input} from '../src/ui/components/input.ts';
const key=(app:App,key:string)=>app.desktop.handle({type:'key',key});
async function until(check:()=>boolean){for(let i=0;i<500;i++){if(check())return;await Bun.sleep(5);}throw new Error('Timeout Extensions UI');}
test('MCP CRUD y skill registro/toggle/removal, compact menu mouse and modal save focus',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-ext-ui-')),app=await App.open({config:join(root,'config.json'),cwd:root});
 const save=async(values:string[])=>{const modal=app.desktop.modal!;const inputs=modal.controls.filter(c=>c instanceof Input) as Input[];values.forEach((value,i)=>inputs[i]!.setValue(value));modal.focusedId='save';key(app,'enter');await until(()=>!app.desktop.modal);};
 try{app.desktop.resize(60,16);const header=app.desktop.draw().lines()[0]!;for(const name of ['Projects','Models','MCP','Skills','Ayuda'])expect(header).toContain(name);
 app.extensions.serverForm('http');await save(['Local MCP','http://127.0.0.1:3000/mcp','']);expect(app.store.value.mcpServers[0]!.enabled).toBe(true);
 app.extensions.servers();key(app,'enter');key(app,'down');key(app,'enter');await until(()=>!app.store.value.mcpServers[0]!.enabled);
 app.extensions.serverForm('http',app.store.value.mcpServers[0]);await save(['Renamed MCP','http://127.0.0.1:3001/mcp','']);expect(app.store.value.mcpServers[0]!.url).toContain('3001');
 app.extensions.servers();key(app,'enter');key(app,'down');key(app,'down');key(app,'down');key(app,'enter');await until(()=>!app.store.value.mcpServers.length);
 const skill=join(root,'guide');await mkdir(skill);await Bun.write(join(skill,'SKILL.md'),'---\nname: guide\ndescription: Make precise edits\n---\nUse read before edit.');app.extensions.skillForm();await save([skill,'proyecto']);expect(app.store.value.skills[0]!.projectId).toBe(app.project!.id);
 app.extensions.skills();key(app,'enter');key(app,'down');key(app,'enter');await until(()=>!app.store.value.skills[0]!.enabled);
 app.extensions.skills();key(app,'enter');key(app,'down');key(app,'down');key(app,'down');key(app,'enter');await until(()=>!app.store.value.skills.length);
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
