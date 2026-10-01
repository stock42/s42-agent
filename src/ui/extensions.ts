import {dirname,join} from 'node:path';
import type {Config,ConfigStore,McpServer,Project,Skill} from '../storage/config.ts';
import type {Desktop} from './desktop.ts';
import type {Menu} from './components/menu.ts';
import {choose,form,info} from './dialogs.ts';
import {McpClient} from '../mcp/client.ts';
import {readSkill,searchSkills,installSkill,catalogUrl,type SkillResult} from '../skills/index.ts';
import {FileExplorer} from './components/file-explorer.ts';

interface Context {desktop:Desktop;store:ConfigStore;cwd:string;project:()=>Project|undefined;change:(task:()=>Promise<void>)=>Promise<void>;run:(task:()=>Promise<void>)=>void;task:<T>(label:string,operation:(signal:AbortSignal)=>Promise<T>)=>Promise<T>;status:(text:string)=>void;idle:()=>void}
export class Extensions {
 constructor(private ctx:Context){}
 get menus():Menu[]{return [{label:this.ctx.desktop.t('MCP'),hotkey:'c',items:[{label:this.ctx.desktop.t('Servidores / CRUD'),run:()=>this.servers()},{label:this.ctx.desktop.t('Agregar stdio'),run:()=>this.serverForm('stdio')},{label:this.ctx.desktop.t('Agregar HTTP'),run:()=>this.serverForm('http')}]},{label:this.ctx.desktop.t('Skills'),hotkey:'s',items:[{label:this.ctx.desktop.t('Skills registradas'),run:()=>this.skills()},{label:this.ctx.desktop.t('Registrar SKILL.md'),run:()=>this.skillForm()},{label:this.ctx.desktop.t('Buscar en skills.sh'),run:()=>this.search()}]}];}
 private async edit(operation:(next:Config)=>void):Promise<void>{this.ctx.idle();const next=structuredClone(this.ctx.store.value);operation(next);await this.ctx.store.save(next);this.ctx.status('Configuración guardada');}
 servers():void{choose(this.ctx.desktop,this.ctx.desktop.t('MCP · servidores'),this.ctx.store.value.mcpServers.map(value=>({label:`${value.enabled?'[on]':'[off]'} ${value.name} · ${value.transport}`,value})),server=>choose(this.ctx.desktop,`MCP · ${server.name}`,['Editar',server.enabled?'Deshabilitar':'Habilitar','Probar conexión','Eliminar'].map(value=>({label:this.ctx.desktop.t(value),value})),action=>{
  if(action==='Editar')this.serverForm(server.transport,server);
  else if(action==='Probar conexión')this.ctx.run(async()=>{const tools=await this.ctx.task('Conectando MCP…',async signal=>{const client=new McpClient(server,this.ctx.project()?.path??this.ctx.cwd,text=>this.ctx.status(text));try{await client.connect(signal);return client.tools.map(t=>`${t.name}: ${t.description??''}`);}finally{await client.close();}});info(this.ctx.desktop,`MCP · ${server.name}`,tools.length?tools:[this.ctx.desktop.t('Servidor conectado; sin herramientas.')]);});
  else this.ctx.run(()=>this.edit(next=>{if(action==='Eliminar')next.mcpServers=next.mcpServers.filter(s=>s.id!==server.id);else next.mcpServers.find(s=>s.id===server.id)!.enabled=!server.enabled;}));
 }));}
 serverForm(transport:McpServer['transport'],server?:McpServer):void{
  const fields=transport==='stdio'?[{label:this.ctx.desktop.t('Nombre'),value:server?.name??''},{label:this.ctx.desktop.t('Comando'),value:server?.command??'bun'},{label:this.ctx.desktop.t('Argumentos (JSON)'),value:JSON.stringify(server?.args??[])},{label:this.ctx.desktop.t('Cwd (opcional)'),value:server?.cwd??''},{label:this.ctx.desktop.t('Env refs (JSON)'),value:JSON.stringify(server?.envRefs??{})}]:[{label:this.ctx.desktop.t('Nombre'),value:server?.name??''},{label:this.ctx.desktop.t('URL /mcp'),value:server?.url??'http://127.0.0.1:3000/mcp'},{label:this.ctx.desktop.t('API key env'),value:server?.apiKeyEnv??''}];
  form(this.ctx.desktop,this.ctx.desktop.t(`MCP · ${server?'editar':'nuevo'} ${transport}`),fields,values=>this.ctx.change(()=>this.edit(next=>{
    const [name,commandOrUrl,argsOrEnv,cwd,env]=values;const record:McpServer={id:server?.id??crypto.randomUUID(),name:name!.trim(),enabled:server?.enabled??true,transport};
    if(transport==='stdio')Object.assign(record,{command:commandOrUrl!.trim(),args:JSON.parse(argsOrEnv!),cwd:cwd?.trim()||undefined,envRefs:JSON.parse(env!)});
    else Object.assign(record,{url:commandOrUrl!.trim(),apiKeyEnv:argsOrEnv?.trim()||undefined});
    next.mcpServers=[...next.mcpServers.filter(s=>s.id!==record.id),record];
  })));
 }
 skills():void{choose(this.ctx.desktop,this.ctx.desktop.t('Skills · registradas'),this.ctx.store.value.skills.map(value=>({label:`${value.enabled?'[on]':'[off]'} ${value.name} · ${value.projectId?this.ctx.desktop.t('proyecto'):'global'}`,value})),skill=>choose(this.ctx.desktop,`Skill · ${skill.name}`,['Ver instrucciones',skill.enabled?'Deshabilitar':'Habilitar','Invocar en prompt','Quitar del registro'].map(value=>({label:this.ctx.desktop.t(value),value})),action=>{
  if(action==='Ver instrucciones')this.ctx.run(async()=>{const loaded=await readSkill(skill.path);info(this.ctx.desktop,loaded.name,[loaded.description,`Base: ${dirname(loaded.path)}`,loaded.body]);});
  else if(action==='Invocar en prompt')this.ctx.status(`/skill ${skill.name}`);
  else this.ctx.run(()=>this.edit(next=>{if(action==='Quitar del registro')next.skills=next.skills.filter(s=>s.id!==skill.id);else next.skills.find(s=>s.id===skill.id)!.enabled=!skill.enabled;}));
 }));}
 private async register(loaded:Awaited<ReturnType<typeof readSkill>>,projectId?:string):Promise<void>{await this.edit(next=>{if(next.skills.some(s=>s.path===loaded.path))throw new Error('Esta skill ya está registrada');next.skills.push({id:crypto.randomUUID(),name:loaded.name,path:loaded.path,enabled:true,projectId,source:loaded.source});});}
 skillForm():void{form(this.ctx.desktop,this.ctx.desktop.t('Skills · registrar'),[{label:this.ctx.desktop.t('Folder / SKILL.md'),value:this.ctx.project()?.path??this.ctx.cwd,browse:(value,select,parent)=>{const explorer=new FileExplorer(this.ctx.desktop,this.ctx.cwd,{parent,initialPath:value,pickFolder:select});this.ctx.run(()=>explorer.show());}},{label:this.ctx.desktop.t('Scope global/proyecto'),value:'global'}],([path,scope])=>this.ctx.change(async()=>{const projectId=this.scope(scope!);await this.register(await readSkill(path!),projectId);}));}
 private scope(scope:string):string|undefined{if(scope.trim()==='global')return undefined;if(!['proyecto','project'].includes(scope.trim()))throw new Error('Scope: global o proyecto');if(!this.ctx.project())throw new Error('Elegí un proyecto');return this.ctx.project()!.id;}
 search():void{form(this.ctx.desktop,this.ctx.desktop.t('Buscar · https://skills.sh'),[{label:this.ctx.desktop.t('Buscar en skills.sh'),value:''}],async([query])=>{
  const results=await this.ctx.task('Buscando https://skills.sh…',signal=>searchSkills(query!,signal));return ()=>this.results(results);
 });}
 private results(results:SkillResult[]):void{if(!results.length){info(this.ctx.desktop,this.ctx.desktop.t('https://skills.sh'),[this.ctx.desktop.t('Sin resultados en https://skills.sh')]);return;}choose(this.ctx.desktop,this.ctx.desktop.t('https://skills.sh · resultados'),results.map(value=>({label:`${value.name} · ${value.installs} installs · ${value.source}`,value})),result=>choose(this.ctx.desktop,result.name,[{label:this.ctx.desktop.t('Ver origen'),value:'view'},{label:this.ctx.desktop.t('Instalar global'),value:'global'},{label:this.ctx.desktop.t('Instalar para proyecto'),value:'proyecto'}],action=>{
  if(action==='view'){info(this.ctx.desktop,result.name,[this.ctx.desktop.t(`Origen: ${result.source}`),this.ctx.desktop.t(`Instalaciones: ${result.installs}`),catalogUrl(result),this.ctx.desktop.t('Instalar copia SKILL.md y los recursos de su carpeta. No ejecuta scripts.')]);return;}
  this.ctx.run(async()=>{const projectId=this.scope(action);const loaded=await this.ctx.task('Instalando skill…',signal=>installSkill(result,join(dirname(this.ctx.store.path),'skills'),signal));await this.register(loaded,projectId);info(this.ctx.desktop,this.ctx.desktop.t('Skill instalada'),[loaded.name,loaded.description,loaded.path]);});
 }));}
}
