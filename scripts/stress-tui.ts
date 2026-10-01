import {chmod,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {defaultConfig,ConfigStore} from '../src/storage/config.ts';
const root=await mkdtemp(join(tmpdir(),'s42-stress-')),started=Date.now();let requests=0,cycles=0,restored=0;
const server=Bun.serve({port:0,async fetch(req){await req.json();requests++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"STRESS razonamiento real fixture"}}]}\n\n'));}}));}});
const config=defaultConfig();config.providers[0]!.baseUrl=`http://127.0.0.1:${server.port}/v1`;config.providers[0]!.models=[{id:'stress',name:'Stress',contextWindow:32000,maxOutputTokens:1000,capabilities:{tools:false,images:false}}];config.defaults.modelId='stress';
async function until(check:()=>boolean){const deadline=Date.now()+4000;while(!check()){if(Date.now()>deadline)throw new Error('Timeout stress');await Bun.sleep(2);}}
try{
 for(let i=0;i<50;i++){const path=join(root,`config-${i}.json`);await Bun.write(path,JSON.stringify(config));let output='';const terminal=new Bun.Terminal({cols:80,rows:24,data:(_,bytes)=>output+=new TextDecoder().decode(bytes)});const child=Bun.spawn([process.execPath,resolve(import.meta.dir,'../index.ts'),'--config',path,'--cwd',root],{cwd:root,terminal,env:{...process.env,TERM:'xterm-256color'}});
  try{await until(()=>output.includes('Prompt'));terminal.write('stream cancellation\r');await until(()=>output.includes('STRESS razonamiento'));terminal.resize(60,16);child.kill('SIGWINCH');terminal.write('\x03');await until(()=>output.includes('Turno cancelado'));terminal.write('\x11');if(await child.exited!==0)throw new Error('Exit failed');await until(()=>output.includes('\x1b[?1049l'));for(const mode of ['\x1b[?25h','\x1b[?1006l','\x1b[?2004l'])if(!output.includes(mode))throw new Error('Mode not restored');restored++;cycles++;}finally{child.kill();terminal.close();}
 }
 const protectedFolder=join(root,'protected');const {mkdir}=await import('node:fs/promises');await mkdir(protectedFolder);await chmod(protectedFolder,0o500);let diskError='';try{await new ConfigStore(join(protectedFolder,'config.json'),config).save(config);}catch(error){diskError=(error as Error).message;}finally{await chmod(protectedFolder,0o700);}if(!diskError)throw new Error('Filesystem permissions did not fail as expected');
 const evidence={at:new Date().toISOString(),durationSeconds:(Date.now()-started)/1000,cycles,requests,restored,diskError,source:'index.ts in Bun.Terminal 80x24 -> 60x16; streamed reasoning, Ctrl+C, Ctrl+Q',physicalMouse:false,bun:Bun.version};await Bun.write(resolve(import.meta.dir,'../docs/qa/tui-stress.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{server.stop(true);await rm(root,{recursive:true,force:true});}
