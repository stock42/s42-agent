import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {App} from '../src/app.ts';
import {defaultConfig} from '../src/storage/config.ts';
const base=Bun.argv[2]??'http://127.0.0.1:8080/v1';
const models=await (await fetch(base+'/models')).json() as any;const id=models.data?.[0]?.id;if(!id)throw new Error('No hay modelos');
const root=await mkdtemp(join(tmpdir(),'s42-real-')),started=Date.now(),path=join(root,'config.json');
let mcpEffects=0;const mcp=Bun.serve({port:0,async fetch(req){const p=await req.json() as any;const result=p.method==='server/discover'?{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}:p.method==='tools/list'?{tools:[{name:'project_hint',description:'Get the QA project hint before modifying sum.ts.',inputSchema:{type:'object',properties:{}}}]}:{content:[{type:'text',text:'QA hint: implement addition a + b, keep tests unchanged. Request '+(++mcpEffects)}]};return Response.json({jsonrpc:'2.0',id:p.id,result});}});
const config=defaultConfig();config.mcpServers=[{id:'qa-mcp',name:'QA',enabled:true,transport:'http',url:`http://127.0.0.1:${mcp.port}/mcp`}];
const skillPath=join(root,'qa-guide');await mkdir(skillPath);await Bun.write(join(skillPath,'SKILL.md'),'---\nname: qa-guide\ndescription: Verify a coding fix using the QA MCP and native tools\n---\nRead both files before editing. Consult the MCP project_hint tool before modifying sum.ts. Then edit sum.ts and run bun test with shell. Do not modify tests.');config.skills=[{id:'qa-guide',name:'qa-guide',path:join(skillPath,'SKILL.md'),enabled:true}];config.providers[0]!.baseUrl=base;config.providers[0]!.models=[{id,name:id,contextWindow:32768,maxOutputTokens:4096,capabilities:{tools:true,images:false}}];config.defaults.modelId=id;
await Bun.write(path,JSON.stringify(config));await Bun.write(join(root,'sum.ts'),'export function sum(a: number, b: number) { return a - b; }\n');
await Bun.write(join(root,'sum.test.ts'),"import {test,expect} from 'bun:test';\nimport {sum} from './sum';\ntest('suma',()=>expect(sum(2,3)).toBe(5));\n");
await Bun.write(join(root,'AGENTS.md'),'Este proyecto es un ejemplo de QA. Leer sum.ts y sum.test.ts antes de editar. Usar edit con coincidencia exacta y shell para ejecutar bun test. No modificar sum.test.ts.');
const app=await App.open({config:path,cwd:root});let previous='';app.desktop.invalidate=()=>{if(app.status!==previous){previous=app.status;console.log(previous);}};
try{
 app.view.prompt.setValue('/skill qa-guide Corregí el bug de sum.ts usando herramientas reales. Leé los dos archivos, hacé la edición exacta mínima y ejecutá bun test con shell. No cambies los tests. Cerrá con una respuesta breve indicando el resultado real.');await app.submit();
 const deadline=Date.now()+240000;while(app.busy){if(Date.now()>deadline){app.cancel();throw new Error('Timeout de coding real');}await Bun.sleep(100);}
 const content=await Bun.file(join(root,'sum.ts')).text();const tools=app.session!.state.events.filter(e=>e.type==='tool-start'||e.type==='tool-result');
 if(mcpEffects<1)throw new Error('No usó MCP real');if(!content.includes('a + b'))throw new Error('No corrigió sum');if(!tools.some(e=>e.type==='tool-start'&&e.name==='shell'))throw new Error('No verificó con shell');
 const independent=Bun.spawn([process.execPath,'test'],{cwd:root,stdout:'pipe',stderr:'pipe'});const [exitCode,stdout,stderr]=await Promise.all([independent.exited,new Response(independent.stdout).text(),new Response(independent.stderr).text()]);if(exitCode!==0)throw new Error('Verificación independiente falló');
 const completedMessages=structuredClone(app.session!.state.messages),codingStatus=app.status;
 const cancelPrompt='Escribí una explicación extensa de 100 puntos sobre este ejemplo. No uses herramientas y no termines antes de completar todos los puntos.';
 app.view.prompt.setValue(cancelPrompt);await app.submit();
 const cancelStart=Date.now();const streamed=()=>{const index=app.view.response.value.lastIndexOf('Vos:\n'+cancelPrompt);return index>=0&&/(?:Razonamiento:|Agente:)\n[^\n]/.test(app.view.response.value.slice(index+cancelPrompt.length+5));};
 while(!streamed()&&app.busy&&Date.now()-cancelStart<45000)await Bun.sleep(1);
 if(!app.busy||!streamed())throw new Error('No hubo stream activo para cancelar');
 app.cancel();while(app.busy)await Bun.sleep(10);const cancellationStatus=app.status;const partial=app.session!.state.messages.at(-1);if(partial?.role!=="assistant"||!(partial.content||partial.reasoning_content||partial.reasoning))throw new Error("No conservó el parcial cancelado");
 const sessionId=app.session!.state.id;await app.desktop.onBeforeExit!();const reopened=await App.open({config:path,session:sessionId});const recovered=reopened.session!.state.messages.some(m=>m.role==='assistant'&&m.content===partial?.content);await reopened.desktop.onBeforeExit!();
 const evidence={date:new Date().toISOString(),base,model:id,mcpEffects,skillInvoked:"qa-guide",contextWindow:32768,maxOutputTokens:4096,durationSeconds:(Date.now()-started)/1000,codingStatus,content,messages:completedMessages,tools,independentVerification:{exitCode,stdout,stderr},cancellation:{status:cancellationStatus,elapsedMs:Date.now()-cancelStart,partial,recovered},environment:{bun:Bun.version,platform:process.platform,arch:process.arch},ui:'App from source; rendering/events verified separately in PTY; no physical mouse/drop'};
 await Bun.write(resolve(import.meta.dir,'../docs/qa/local-llm.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({model:id,codingStatus,cancellationStatus,exitCode,tools:tools.length,durationSeconds:evidence.durationSeconds}));
}finally{if(app.session && await Bun.file(app.session.lock).exists())await app.desktop.onBeforeExit!();mcp.stop(true);await rm(root,{recursive:true,force:true});}
