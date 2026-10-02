import {test,expect} from 'bun:test';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSkill,SkillCatalog,searchSkills,installSkill} from '../src/skills/index.ts';
test('skills conservan cuerpos de más de 256 KiB y descripciones completas',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-full-skill-')),path=join(root,'large-guide');await mkdir(path);
 const body='Instrucción á文🙂\n'.repeat(25000),description='Descripción '.repeat(1000);
 await Bun.write(join(path,'SKILL.md'),'---\nname: large-guide\ndescription: '+JSON.stringify(description)+'\n---\n'+body);
 try{const skill=await readSkill(path);expect(skill.description).toBe(description.trim());expect(skill.body).toBe(body.trim());}
 finally{await rm(root,{recursive:true,force:true});}
});
test('native YAML frontmatter, progressive loading, disabled/project isolation and exact base directory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-skills-')),path=join(root,'bun-guide');await mkdir(path);await Bun.write(join(path,'SKILL.md'),'---\nname: bun-guide\ndescription: >\n  Build with Bun.\n  Use native APIs.\n---\nRead scripts/check.ts and report actual results.');
 try{const loaded=await readSkill(path);expect(loaded.description).toContain('Build with Bun. Use native APIs.');const catalog=new SkillCatalog(),notices:string[]=[];
 await catalog.open([{id:'1',name:'bun-guide',path,enabled:true},{id:'2',name:'missing',path:join(root,'missing'),enabled:false},{id:'3',name:'other',path:join(root,'missing'),enabled:true,projectId:'B'}],'A',t=>notices.push(t));expect(catalog.entries).toHaveLength(1);expect(notices).toEqual([]);expect(catalog.guidance).not.toContain('scripts/check');const result=await catalog.execute('{"name":"bun-guide"}',new AbortController().signal);expect(result.output).toContain(path);expect(result.output).toContain('scripts/check');expect((await catalog.execute('{"name":"missing"}',new AbortController().signal)).failed).toBe(true);
 await Bun.write(join(path,'SKILL.md'),'---\nname: wrong\ndescription: test\n---\nbody');await expect(readSkill(path)).rejects.toThrow('carpeta');expect((await readSkill(path,false)).name).toBe('wrong');}
 finally{await rm(root,{recursive:true,force:true});}
});
test('skills.sh search contract, URL encoded queries, error/cancel, unsupported install origin',async()=>{
 let query='';const server=Bun.serve({port:0,fetch(req){query=new URL(req.url).searchParams.get('q')!;return Response.json({skills:[{id:'a/b/x',name:'x',skillId:'x',source:'a/b',installs:2},{id:'a/b/y',name:'y',skillId:'y',source:'a/b',installs:9}]});}});
 try{const results=await searchSkills('bun + tui',new AbortController().signal,`http://127.0.0.1:${server.port}`);expect(query).toBe('bun + tui');expect(results[0]!.installs).toBe(9);await expect(installSkill({id:'bun.sh/bun',name:'Bun',skillId:'bun',source:'bun.sh',installs:1},'/tmp/unused',new AbortController().signal)).rejects.toThrow('https://skills.sh/bun.sh/bun');const controller=new AbortController();controller.abort();await expect(searchSkills('bun',controller.signal)).rejects.toThrow();}
 finally{server.stop(true);}
});
