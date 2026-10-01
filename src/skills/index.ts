import {basename,dirname,join,resolve} from 'node:path';
import {cp,mkdir,mkdtemp,realpath,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import type {Skill} from '../storage/config.ts';
import type {ToolDefinition} from '../llm/client.ts';
import type {ToolResult} from '../agent/tools.ts';
import {killTree} from '../agent/process.ts';

export interface LoadedSkill {name:string;description:string;path:string;body:string;source?:string}
export async function readSkill(path:string):Promise<LoadedSkill>{
  path=await realpath(path);if((await stat(path)).isDirectory())path=join(path,'SKILL.md');
  const file=Bun.file(path);if(file.size>262144)throw new Error('SKILL.md excede 256 KiB');
  const text=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  const match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);if(!match)throw new Error('SKILL.md requiere frontmatter YAML');
  const meta=Bun.YAML.parse(match[1]!) as {name?:unknown;description?:unknown};
  if(!meta||typeof meta.name!=='string'||!meta.name||meta.name.length>64||!/^\p{Ll}[\p{Ll}\p{N}-]*$/u.test(meta.name)||meta.name.endsWith('-')||meta.name.includes('--'))throw new Error('Nombre de skill inválido');
  if(basename(dirname(path))!==meta.name)throw new Error('El name de SKILL.md debe coincidir con su carpeta');
  if(typeof meta.description!=='string'||!meta.description.trim()||meta.description.length>1024)throw new Error('Skill requiere description (hasta 1024 caracteres)');
  return {name:meta.name,description:meta.description.trim(),path,body:text.slice(match[0].length).trim()};
}
export class SkillCatalog {
  readonly entries:LoadedSkill[]=[];
  async open(skills:Skill[],projectId:string,notice:(text:string)=>void):Promise<void>{
    for(const skill of skills.filter(s=>s.enabled && (!s.projectId||s.projectId===projectId)))try{
      const loaded=await readSkill(skill.path);if(this.entries.some(s=>s.name===loaded.name))throw new Error(`Nombre duplicado: ${loaded.name}`);this.entries.push({...loaded,source:skill.source});
    }catch(error){notice(`Skill ${skill.name}: ${(error as Error).message}`);}
  }
  get guidance():string{return this.entries.length?'Skills disponibles (cargá instrucciones completas con la herramienta skill cuando sean pertinentes; respetá las invocadas por el usuario):\n'+this.entries.map(s=>`- ${s.name}: ${s.description}`).join('\n'):'';}
  get definition():ToolDefinition{return {type:'function',function:{name:'skill',description:'Load the instructions of an enabled skill. Use its base directory to resolve referenced scripts/assets. Loading does not execute scripts.',parameters:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}}};}
  async execute(raw:string,signal:AbortSignal):Promise<ToolResult>{
    try{signal.throwIfAborted();const args=JSON.parse(raw);if(!args||typeof args.name!=='string'||Object.keys(args).length!==1)throw new Error('skill requiere {name}');const skill=this.entries.find(s=>s.name===args.name);if(!skill)throw new Error('Skill no disponible para este proyecto');
      return {output:`Skill ${skill.name}\nBase directory: ${dirname(skill.path)}\n\n${skill.body}`,failed:false,durationMs:0};
    }catch(error){return {output:(error as Error).message,failed:true,durationMs:0};}
  }
}
export interface SkillResult {id:string;name:string;skillId:string;source:string;installs:number}
export async function searchSkills(query:string,signal:AbortSignal,base='https://skills.sh'):Promise<SkillResult[]>{
  if(!query.trim())throw new Error('Escribí una búsqueda');const url=new URL('/api/search',base);url.searchParams.set('q',query.trim());url.searchParams.set('limit','20');
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!response.ok)throw new Error(`skills.sh HTTP ${response.status}`);
  const data=await response.json() as {skills?:SkillResult[]};if(!Array.isArray(data.skills))throw new Error('Respuesta skills.sh inválida');
  return data.skills.filter(s=>typeof s.id==='string'&&typeof s.name==='string'&&typeof s.skillId==='string'&&typeof s.source==='string'&&Number.isFinite(s.installs)).toSorted((a,b)=>b.installs-a.installs);
}
export function catalogUrl(skill:SkillResult):string{return 'https://skills.sh/'+skill.id.split('/').map(encodeURIComponent).join('/');}
export async function installSkill(result:SkillResult,destination:string,signal:AbortSignal):Promise<LoadedSkill>{
  if(!/^[\w.-]+\/[\w.-]+$/.test(result.source))throw new Error(`Origen sin repositorio GitHub instalable. Consultá ${catalogUrl(result)}`);
  const temp=await mkdtemp(join(tmpdir(),'s42-skill-'));let copied:string|undefined;
  try{
    signal.throwIfAborted();const child=Bun.spawn(['git','clone','--depth','1',`https://github.com/${result.source}.git`,join(temp,'repo')],{detached:true,stdin:'ignore',stdout:'ignore',stderr:'pipe',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
    const abort=()=>{void killTree(child).catch(()=>{});};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();const timer=setTimeout(abort,120000);let exit:number,stderr:string;
    try{[exit,stderr]=await Promise.all([child.exited,new Response(child.stderr).text()]);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);await killTree(child);}
    signal.throwIfAborted();if(exit!==0)throw new Error(`Git clone falló: ${stderr.slice(-500)}`);
    const matches:LoadedSkill[]=[];const glob=new Bun.Glob('**/SKILL.md');for await(const path of glob.scan({cwd:join(temp,'repo'),absolute:true,onlyFiles:true})){try{const skill=await readSkill(path);if(skill.name===result.skillId||basename(dirname(path))===result.skillId)matches.push(skill);}catch{}}
    if(matches.length!==1)throw new Error(matches.length?'Skill ambigua en el repositorio':'No se encontró la skill del catálogo en el repositorio');
    const selected=matches[0]!;copied=join(resolve(destination),crypto.randomUUID());await mkdir(copied,{recursive:true});const target=join(copied,selected.name);await cp(dirname(selected.path),target,{recursive:true});
    const license=new Bun.Glob('{LICENSE*,COPYING*,NOTICE*}');for await(const path of license.scan({cwd:join(temp,'repo'),absolute:true,onlyFiles:true}))await cp(path,join(copied,basename(path)));
    signal.throwIfAborted();return {...await readSkill(target),source:catalogUrl(result)};
  }catch(error){if(copied)await rm(copied,{recursive:true,force:true});throw error;}
  finally{await rm(temp,{recursive:true,force:true});}
}
