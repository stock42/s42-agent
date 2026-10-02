import {test,expect} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {McpClient,McpConnections} from '../src/mcp/client.ts';
import {defaultConfig,validateConfig,type McpServer} from '../src/storage/config.ts';
const signal=()=>new AbortController().signal;
const tool={name:'echo',description:'Echo',inputSchema:{type:'object',properties:{message:{type:'string','x-mcp-header':'Message'}},required:['message']}};
const rpc=(id:number,result:any)=>({jsonrpc:'2.0',id,result});
test('MCP stdio conserva mensajes de más de 8 MiB y resultados completos',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-full-mcp-'));
 const script=join(root,'server.ts');
 await Bun.write(script,`let buffer='';for await(const chunk of Bun.stdin.stream()){buffer+=new TextDecoder().decode(chunk);let end;while((end=buffer.indexOf('\\n'))>=0){const p=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(p.id===undefined)continue;const result=p.method==='server/discover'?{supportedVersions:['2026-07-28']}:p.method==='tools/list'?{tools:[${JSON.stringify(tool)}]}:{content:[{type:'text',text:'á文🙂'.repeat(1000000)}],structuredContent:{complete:true}};console.log(JSON.stringify({jsonrpc:'2.0',id:p.id,result}));}}`);
 const client=new McpClient({id:'large',name:'Large',enabled:true,transport:'stdio',command:process.execPath,args:[script]},root);
 try{await client.connect(signal());const result=await client.call(tool,{message:'large'},signal());
  expect(result.failed).toBe(false);expect(result.truncated).toBe(false);expect(result.output).toBe('á文🙂'.repeat(1000000)+'\n'+JSON.stringify({complete:true}));
 }finally{await client.close();await rm(root,{recursive:true,force:true});}
});
test('modern HTTP JSON/SSE, mirrored Unicode headers, progress, pagination y tool error',async()=>{
 let page=0,header='',meta='',method='',progress:string[]=[];
 const server=Bun.serve({port:0,async fetch(req){const body=await req.json() as any;method=req.headers.get('Mcp-Method')!;meta=body.params._meta['io.modelcontextprotocol/protocolVersion'];
  if(body.method==='server/discover')return Response.json(rpc(body.id,{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}));
  if(body.method==='tools/list'){page++;return Response.json(rpc(body.id,{tools:body.params.cursor?[]:[tool],nextCursor:body.params.cursor?undefined:'page2'}));}
  header=req.headers.get('Mcp-Param-Message')!;return new Response(`data: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{progress:1,total:2,message:'trabajando'}})}\n\ndata: ${JSON.stringify(rpc(body.id,{content:[{type:'text',text:body.params.arguments.message}],isError:true}))}\n\n`,{headers:{'Content-Type':'text/event-stream'}});
 }});
 const client=new McpClient({id:'A',name:'A',enabled:true,transport:'http',url:`http://127.0.0.1:${server.port}/mcp`},process.cwd(),text=>progress.push(text));
 try{await client.connect(signal());expect(page).toBe(2);const result=await client.call(client.tools[0]!,{message:'á texto'},signal());expect(result.output).toBe('á texto');expect(result.failed).toBe(true);expect(header).toBe('=?base64?'+Buffer.from('á texto').toString('base64')+'?=');expect(meta).toBe('2026-07-28');expect(method).toBe('tools/call');expect(progress[0]).toContain('trabajando');}
 finally{await client.close();server.stop(true);}
});
test('legacy HTTP initialize, session/auth, cancel notification y DELETE; auth failure no fallback',async()=>{
 let methods:string[]=[],deleted=false,sessions:string[]=[],auth:string|null=null;
 process.env.S42_TEST_MCP_KEY='test-only';
 const server=Bun.serve({port:0,async fetch(req){auth=req.headers.get('authorization');if(req.method==='DELETE'){deleted=true;return new Response(null,{status:204});}const body=await req.json() as any;methods.push(body.method);sessions.push(req.headers.get('Mcp-Session-Id')??'');
 if(body.method==='server/discover')return Response.json({jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'unknown method'}});
 if(body.method==='initialize')return Response.json(rpc(body.id,{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}),{headers:{'Mcp-Session-Id':'fixture-session'}});
 if(body.id===undefined)return new Response(null,{status:202});
 if(body.method==='tools/list')return Response.json(rpc(body.id,{tools:[tool]}));
 return new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const client=new McpClient({id:'A',name:'A',enabled:true,transport:'http',url:`http://127.0.0.1:${server.port}/mcp`,apiKeyEnv:'S42_TEST_MCP_KEY'},process.cwd());
 try{await client.connect(signal());const controller=new AbortController();const run=client.call(tool,{message:'slow'},controller.signal);await Bun.sleep(15);controller.abort();expect((await run).failed).toBe(true);await Bun.sleep(15);await client.close();for(let i=0;i<100&&!deleted;i++)await Bun.sleep(5);expect(methods).toContain('initialize');expect(methods).toContain('notifications/cancelled');expect(sessions.at(-1)).toBe('fixture-session');expect(auth as string|null).toBe('Bearer test-only');expect(deleted).toBe(true);}
 finally{await client.close();server.stop(true);delete process.env.S42_TEST_MCP_KEY;}
 let attempts=0;const denied=Bun.serve({port:0,fetch(){attempts++;return new Response('denied',{status:401});}});const bad=new McpClient({id:'D',name:'D',enabled:true,transport:'http',url:`http://127.0.0.1:${denied.port}`},process.cwd());
 try{await expect(bad.connect(signal())).rejects.toThrow('401');expect(attempts).toBe(1);}finally{await bad.close();denied.stop(true);}
});
test('stdio legacy newline RPC; cancellation kills server descendant; disabled server never starts; names unique',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s42-mcp-'));
 await Bun.write(join(root,'server.ts'),`const sleep=Bun.spawn(['sleep','30'],{stdout:'ignore',stderr:'ignore'});await Bun.write('child.pid',String(sleep.pid));let buffer='';for await(const chunk of Bun.stdin.stream()){buffer+=new TextDecoder().decode(chunk);let end;while((end=buffer.indexOf('\\n'))>=0){const p=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(p.id===undefined)continue;const result=p.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:p.method==='tools/list'?{tools:[${JSON.stringify(tool)}]}:{content:[{type:'text',text:p.params.arguments?.message}]};console.log(JSON.stringify({jsonrpc:'2.0',id:p.id,...(p.method==='server/discover'?{error:{code:-32601,message:'unknown'}}:{result})}));}}`);
 const config:McpServer={id:'A',name:'Same',enabled:true,transport:'stdio',command:process.execPath,args:[join(root,'server.ts')],cwd:root};const connections=new McpConnections();
 try{await connections.open([config,{...config,id:'B'},{id:'disabled',name:'disabled',enabled:false,transport:'stdio',command:'not-a-command',args:[]}],root,signal(),()=>{});const definitions=await connections.definitions(signal());expect(definitions).toHaveLength(2);expect(new Set(definitions.map(t=>t.function.name)).size).toBe(2);expect((await connections.execute(definitions[0]!.function.name,JSON.stringify({message:'ok'}),signal())).output).toBe('ok');const pid=Number(await Bun.file(join(root,'child.pid')).text());await connections.close();let alive=false;try{alive=!(await Bun.file('/proc/'+pid+'/stat').text()).includes(') Z ');}catch{}expect(alive).toBe(false);}
 finally{await connections.close();await rm(root,{recursive:true,force:true});}
});
test('config v1 migration, MCP/skills persisted validation',()=>{const initial:any=defaultConfig();delete initial.mcpServers;delete initial.skills;expect(validateConfig(initial).mcpServers).toEqual([]);const bad=defaultConfig();bad.mcpServers=[{id:'a',name:'a',enabled:true,transport:'stdio',command:'bun',args:'bad' as any}];expect(()=>validateConfig(bad)).toThrow('args');});
