import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {defaultConfig} from '../src/storage/config.ts';
const minutes=Number(Bun.argv[2]??30),root=await mkdtemp(join(tmpdir(),'s42-soak-')),started=Date.now();
let output='',requests=0,cycles=0,frames=0;const rss:number[]=[];
const server=Bun.serve({port:0,async fetch(req){await req.json();requests++;
  if(requests%3===0)return new Response('fixture unavailable',{status:503});
  if(requests%3===2)return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"SOAK parcial"}}]}\n\n'));}}));
  return new Response('data: {"choices":[{"delta":{"content":"SOAK completo"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
}});
const config=defaultConfig();config.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`;config.providers[0]!.models=[{id:'soak',name:'Soak',contextWindow:100000,maxOutputTokens:1000,capabilities:{tools:false,images:false}}];config.defaults.modelId='soak';
await Bun.write(join(root,'config.json'),JSON.stringify(config));
const terminal=new Bun.Terminal({cols:80,rows:24,data:(_,bytes)=>{output+=new TextDecoder().decode(bytes);frames++;if(output.length>100000)output=output.slice(-50000);}});
const child=Bun.spawn([process.execPath,resolve(import.meta.dir,'../index.ts'),'--config',join(root,'config.json'),'--cwd',root],{cwd:root,terminal,env:{...process.env,TERM:'xterm-256color'}});
async function until(check:()=>boolean){const end=Date.now()+6000;while(!check()){if(Date.now()>end)throw new Error('Timeout soak: '+output.slice(-500));await Bun.sleep(5);}}
try{
 await until(()=>output.includes('Prompt'));
 while(Date.now()-started<minutes*60000){
  output='';terminal.write(`ciclo ${cycles}\r`);
  if((requests+1)%3===2){await until(()=>output.includes('SOAK parcial'));terminal.write('\x03');await until(()=>output.includes('Turno cancelado'));}
  else await until(()=>output.includes('SOAK completo')||output.includes('503'));
  output='';terminal.write('\x05');await until(()=>output.includes('Explorador'));terminal.write('\x1b');
  terminal.resize(cycles%2?80:60,cycles%2?24:16);child.kill('SIGWINCH');await Bun.sleep(40);
  terminal.write('/new\r');await Bun.sleep(60);cycles++;
  const status=await Bun.file(`/proc/${child.pid}/status`).text();rss.push(Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1])/1024);
  if(cycles%10===0)console.log(JSON.stringify({elapsedSeconds:Math.round((Date.now()-started)/1000),cycles,requests,rssMiB:rss.at(-1)}));
  await Bun.sleep(Math.min(30000,Math.max(1,started+minutes*60000-Date.now())));
 }
 output='';terminal.write('\x11');const exitCode=await child.exited;await until(()=>output.includes('\x1b[?1049l'));
 const evidence={startedAt:new Date(started).toISOString(),endedAt:new Date().toISOString(),durationSeconds:(Date.now()-started)/1000,cycles,requests,frames,exitCode,rssMiB:{first:rss[0],last:rss.at(-1),max:Math.max(...rss)},mode:'Bun source in PTY; 80x24/60x16; complete/partial-cancel/HTTP503; explorer modal; new sessions',physicalMouse:false};
 await Bun.write(resolve(import.meta.dir,'../docs/qa/tui-soak.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{child.kill();terminal.close();server.stop(true);await rm(root,{recursive:true,force:true});}
