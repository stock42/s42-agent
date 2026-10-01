import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {searchSkills,installSkill,readSkill} from '../src/skills/index.ts';
const controller=new AbortController(),root=await mkdtemp(join(tmpdir(),'s42-live-skill-')),start=Date.now();
try{
 const results=await searchSkills('vercel-react-best-practices',controller.signal);const selected=results.find(s=>s.source==='vercel-labs/agent-skills'&&s.skillId==='vercel-react-best-practices');if(!selected)throw new Error('No se encontró la skill oficial de Vercel');console.log(JSON.stringify(selected));
 const skill=await installSkill(selected,root,controller.signal);const parsed=await readSkill(skill.path);const files=await readdir(dirname(skill.path));if(!files.includes('rules'))throw new Error('No conservó las referencias de la skill');const parentFiles=await readdir(dirname(dirname(skill.path)));
 const evidence={at:new Date().toISOString(),durationMs:Date.now()-start,result:selected,loaded:{name:parsed.name,description:parsed.description,bodyBytes:Buffer.byteLength(parsed.body)},files,parentFiles,scriptsExecuted:false,scope:'temporary directory; removed after validation',bun:Bun.version};
 await Bun.write(resolve(import.meta.dir,'../docs/qa/skills-catalog.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await rm(root,{recursive:true,force:true});}
