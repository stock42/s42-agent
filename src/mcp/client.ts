import { join, resolve } from "node:path";
import { preserveMcpContent } from "./artifacts.ts";
import { pathToFileURL } from "node:url";
import type { McpServer } from "../storage/config.ts";
import type { ToolDefinition } from "../llm/client.ts";
import type { ToolResult } from "../agent/tools.ts";
import { SSEParser } from "../llm/client.ts";
import { killTree } from "../agent/process.ts";
import { version } from "../../package.json";

interface Rpc {jsonrpc:"2.0";id?:number|string;method?:string;params?:any;result?:any;error?:{code:number;message:string;data?:any}}
interface McpTool {name:string;description?:string;inputSchema:Record<string,any>}
class RpcError extends Error {constructor(readonly error:NonNullable<Rpc["error"]>){super(error.message);}}
const modern="2026-07-28",legacy=["2025-11-25","2025-06-18","2025-03-26","2024-11-05"];

export class McpClient {
  private child?:Bun.Subprocess<"pipe","pipe","pipe">;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  private serial=0;
  private protocol=modern;
  private sessionId?:string;
  private closed=false;
  private fatal?:Error; private stderr = "";
  dirty=false;
  tools:McpTool[]=[];
  private lifetime=new AbortController();
  constructor(readonly server:McpServer,private cwd:string,private onProgress:(text:string)=>void=()=>{}, private artifacts=join(cwd,".s42-artifacts")){}

  get alive(): boolean { return !this.closed && !this.fatal; }
  async connect(signal:AbortSignal):Promise<void>{
    signal.throwIfAborted();
    if(this.server.transport==="stdio"){
      const env={...process.env};for(const [name,source] of Object.entries(this.server.envRefs??{})){if(process.env[source]===undefined)throw new Error(`Falta variable MCP ${source}`);env[name]=process.env[source];}
      this.child=Bun.spawn([this.server.command!,...(this.server.args??[])],{cwd:this.server.cwd??this.cwd,env,detached:true,stdin:"pipe",stdout:"pipe",stderr:"pipe"});
      void this.readStdout(this.child.stdout).catch(error=>this.fail(error));
      const errors = (async()=>{const decoder = new TextDecoder(); for await(const bytes of this.child!.stderr) this.stderr += decoder.decode(bytes, { stream: true }); this.stderr += decoder.decode();})(); void errors.catch(()=>{});
      void this.child.exited.then(async code=>{await errors.catch(()=>{});this.fail(new Error(`MCP ${this.server.name} terminó (${code})${this.stderr.trim() ? " · " + this.stderr.trim() : ""}`));});
    }
    try{
      const discovered=await this.request("server/discover",{},signal);
      if(!Array.isArray(discovered.supportedVersions)||!discovered.supportedVersions.includes(modern))throw new Error("MCP sin versión compatible");
    }catch(error){
      signal.throwIfAborted();
      if(error instanceof RpcError && Array.isArray(error.error.data?.supported)){
        if(!error.error.data.supported.includes(modern))throw new Error(`MCP requiere versión no soportada: ${error.error.data.supported.join(", ")}`);
        throw error;
      }
      if(!(error instanceof RpcError))throw error;
      this.protocol=legacy[0]!;
      const initialized=await this.request("initialize",{protocolVersion:this.protocol,capabilities:this.child?{roots:{listChanged:false}}:{},clientInfo:{name:"s42-agent",version}},signal);
      if(!legacy.includes(initialized.protocolVersion))throw new Error("Versión MCP legacy no soportada");this.protocol=initialized.protocolVersion;
      await this.notify("notifications/initialized",{});
    }
    await this.refresh(signal);
  }

  private fail(error:Error):void{this.fatal=error;for(const p of this.pending.values())p.reject(error);this.pending.clear();}
  private async readStdout(stream:ReadableStream<Uint8Array>):Promise<void>{
    const decoder=new TextDecoder();let buffer="";
    for await(const chunk of stream){buffer+=decoder.decode(chunk,{stream:true});let end:number;
      while((end=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(line)this.receive(JSON.parse(line));}}
    buffer+=decoder.decode();if(buffer.trim())throw new Error("Mensaje MCP incompleto");
  }
  private receive(packet:Rpc):void{
    if(packet.jsonrpc!=="2.0")throw new Error("Respuesta MCP no es JSON-RPC 2.0");
    if(packet.method){
      if(packet.id!==undefined){const result=packet.method==="ping"?{}:packet.method==="roots/list"?{roots:[{uri:pathToFileURL(this.cwd).href,name:"Proyecto"}]}:undefined;
        void this.reply({jsonrpc:"2.0",id:packet.id,...(result?{result}:{error:{code:-32601,message:"Capacidad cliente no disponible"}})}).catch(()=>{});
      }else if(packet.method==="notifications/tools/list_changed")this.dirty=true;
      else if(packet.method==="notifications/progress")this.onProgress(`${this.server.name}: ${packet.params?.message??""} ${packet.params?.progress??""}${packet.params?.total ? "/"+packet.params.total : ""}`);
      return;
    }
    const id=packet.id;if(typeof id!=="number")return;const pending=this.pending.get(id);if(!pending)return;
    this.pending.delete(id);if(packet.error)pending.reject(new RpcError(packet.error));else if("result" in packet)pending.resolve(packet.result);else pending.reject(new Error("Respuesta MCP sin result/error"));
  }
  private async reply(packet:Rpc):Promise<void>{if(this.child)await this.sendStdio(packet);else await this.http(packet,this.lifetime.signal);}
  private async sendStdio(packet:Rpc):Promise<void>{if(!this.child||this.closed)throw new Error("MCP cerrado");this.child.stdin.write(JSON.stringify(packet)+"\n");await this.child.stdin.flush();}
  private headers(method:string,params:any,schema?:Record<string,any>):Headers{
    const headers=new Headers({"Content-Type":"application/json",Accept:"application/json, text/event-stream","MCP-Protocol-Version":this.protocol});
    if(this.sessionId && this.protocol!==modern)headers.set("Mcp-Session-Id",this.sessionId);
    if(this.server.apiKeyEnv){const key=process.env[this.server.apiKeyEnv];if(!key)throw new Error(`Falta variable MCP ${this.server.apiKeyEnv}`);headers.set("Authorization",`Bearer ${key}`);}
    if(this.protocol===modern && method){headers.set("Mcp-Method",method);if(params?.name)headers.set("Mcp-Name",encodeHeader(params.name));
      const mirror=(s:Record<string,any>,value:any)=>{for(const [key,child] of Object.entries(s.properties??{}) as [string,any][]){const item=value?.[key];if(item===undefined)continue;if(child["x-mcp-header"])headers.set(`Mcp-Param-${child["x-mcp-header"]}`,encodeHeader(typeof item==="string"?item:JSON.stringify(item)));if(child.properties)mirror(child,item);}};
      if(schema)mirror(schema,params.arguments);
    }return headers;
  }
  private async http(packet:Rpc,signal:AbortSignal,schema?:Record<string,any>):Promise<any>{
    const response=await fetch(this.server.url!,{method:"POST",headers:this.headers(packet.method??"",packet.params??{},schema),body:JSON.stringify(packet),signal});
    const session=response.headers.get("Mcp-Session-Id");if(session)this.sessionId=session;
    if(packet.id===undefined || !packet.method){if(!response.ok)throw new Error(`MCP HTTP ${response.status}`);return;}
    let result:Rpc|undefined;
    if(response.headers.get("content-type")?.includes("text/event-stream")){
      if(!response.body)throw new Error("MCP sin stream");const reader=response.body.getReader();
      const parser=new SSEParser(data=>{if(!data.trim())return;const p=JSON.parse(data) as Rpc;if(p.id===packet.id&&!p.method)result=p;else this.receive(p);});
      try{while(!result){const chunk=await reader.read();if(chunk.done){parser.end();break;}parser.feed(chunk.value);}}finally{await reader.cancel().catch(()=>{});}
    }else {try{result=await response.json() as Rpc;}catch{throw new Error(`MCP HTTP ${response.status}`);}}
    if(result?.error)throw new RpcError(result.error);if(!response.ok)throw new Error(`MCP HTTP ${response.status}`);
    if(result?.jsonrpc!=="2.0"||result.id!==packet.id||!("result" in result))throw new Error("MCP respuesta ausente o ID incorrecto");return result.result;
  }
  async request(method:string,params:any,signal:AbortSignal,schema?:Record<string,any>):Promise<any>{
    if(this.closed)throw new Error("MCP cerrado");if(this.fatal)throw this.fatal;signal.throwIfAborted();const controller=new AbortController(),id=++this.serial;
    const packet:Rpc={jsonrpc:"2.0",id,method,params:{...params,_meta:{progressToken:id,...(this.protocol===modern?{"io.modelcontextprotocol/protocolVersion":this.protocol,"io.modelcontextprotocol/clientInfo":{name:"s42-agent",version},"io.modelcontextprotocol/clientCapabilities":{}}:{})}}};
    const abort=()=>controller.abort(signal.reason??new Error("MCP cancelado")),closed=()=>controller.abort(new Error("MCP cerrado"));
    signal.addEventListener("abort",abort,{once:true});this.lifetime.signal.addEventListener("abort",closed,{once:true});
    const work=this.server.transport==="http"?this.http(packet,controller.signal,schema):new Promise<any>((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});void this.sendStdio(packet).catch(reject);
    });
    const cancelled=new Promise<never>((_resolve,reject)=>controller.signal.addEventListener("abort",()=>{
      this.pending.delete(id);if(method!=="initialize"&&(this.child||this.protocol!==modern))void this.notify("notifications/cancelled",{requestId:id,reason:"Cancelado"}).catch(()=>{});reject(controller.signal.reason);
    },{once:true}));
    if(signal.aborted)abort();if(this.lifetime.signal.aborted)closed();
    try{return await Promise.race([work,cancelled]);}finally{signal.removeEventListener("abort",abort);this.lifetime.signal.removeEventListener("abort",closed);this.pending.delete(id);}
  }
  private async notify(method:string,params:any):Promise<void>{const packet:Rpc={jsonrpc:"2.0",method,params};if(this.child)await this.sendStdio(packet);else await this.http(packet,this.lifetime.signal);}
  async refresh(signal:AbortSignal):Promise<void>{
    const tools:McpTool[]=[],seen=new Set<string>();let cursor:string|undefined;
    do{const result=await this.request("tools/list",cursor?{cursor}:{},signal);if(!Array.isArray(result.tools))throw new Error("MCP tools/list inválido");
      for(const tool of result.tools){if(!tool||typeof tool.name!=="string"||!tool.inputSchema||tool.inputSchema.type!=="object")throw new Error("Schema de herramienta MCP inválido");tools.push(tool);}
      cursor=result.nextCursor;if(cursor){if(typeof cursor!=="string"||seen.has(cursor))throw new Error("Cursor MCP inválido o repetido");seen.add(cursor);}
    }while(cursor);if(new Set(tools.map(t=>t.name)).size!==tools.length)throw new Error("MCP herramientas duplicadas");this.tools=tools;this.dirty=false;
  }
  async call(tool:McpTool,args:Record<string,unknown>,signal:AbortSignal):Promise<ToolResult>{
    const started=performance.now();try{const result=await this.request("tools/call",{name:tool.name,arguments:args},signal,tool.inputSchema);
      if(!result || !Array.isArray(result.content))throw new Error("MCP tools/call inválido");
      if(result.inputRequests)throw new Error("MCP requiere una capacidad cliente no habilitada");
      const content = [...result.content];
      if (tool.name === "take_screenshot" && typeof args.filePath === "string" && !result.isError) content.push({ type: "resource_link", uri: pathToFileURL(resolve(this.cwd, args.filePath)).href, mimeType: `image/${args.format ?? "png"}`, name: "Screenshot" });
      const preserved = await preserveMcpContent(content, this.artifacts);
      const output = preserved.output + (result.structuredContent ? "\n" + JSON.stringify(result.structuredContent) : "");
      return {output,failed:Boolean(result.isError),durationMs:Math.round(performance.now()-started),truncated:false,...(preserved.artifacts.length ? { artifacts: preserved.artifacts } : {})};
    }catch(error){return {output:(error as Error).message,failed:true,durationMs:Math.round(performance.now()-started)};}
  }
  async close():Promise<void>{
    if(this.closed)return;this.closed=true;this.lifetime.abort();this.fail(new Error("MCP cerrado"));
    if(this.child){const child=this.child;try{await child.stdin.end();}catch{}
      await Promise.race([child.exited,Bun.sleep(300)]);await killTree(child);await child.exited;
    }else if(this.sessionId && this.protocol!==modern){void fetch(this.server.url!,{method:"DELETE",headers:this.headers("",{})}).catch(()=>{});}
  }
}

function encodeHeader(value:string):string{return /^[\x20-\x7e\t]*$/.test(value)&&value.trim()===value&&!(value.startsWith("=?base64?")&&value.endsWith("?="))?value:"=?base64?"+Buffer.from(value).toString("base64")+"?=";}
export class McpConnections {
  private clients:McpClient[]=[];
  private tools=new Map<string,{client:McpClient;tool:McpTool}>();
  get alive(): boolean { return this.clients.length > 0 && this.clients.every(c => c.alive); }
  async open(servers:McpServer[],cwd:string,signal:AbortSignal,progress:(text:string)=>void, artifacts?:string):Promise<void>{
    await Promise.all(servers.filter(s=>s.enabled).map(async server=>{const client=new McpClient(server,cwd,progress,artifacts);this.clients.push(client);
      try{await client.connect(signal);progress(`MCP ${server.name}: ${client.tools.length} herramientas disponibles`);}catch(error){await client.close();progress(`MCP ${server.name}: ${(error as Error).message}`);this.clients=this.clients.filter(c=>c!==client);}
    }));signal.throwIfAborted();
  }
  async definitions(signal:AbortSignal):Promise<ToolDefinition[]>{
    this.tools.clear();const definitions:ToolDefinition[]=[];
    for(const client of this.clients){if(client.dirty)await client.refresh(signal);for(const tool of client.tools){
      const hash=new Bun.CryptoHasher("sha256").update(client.server.id+"\0"+tool.name).digest("hex").slice(0,8);
      const name=`mcp_${client.server.name.replace(/[^a-zA-Z0-9_]/g,"_").slice(0,15)}_${tool.name.replace(/[^a-zA-Z0-9_]/g,"_").slice(0,24)}_${hash}`;
      this.tools.set(name,{client,tool});definitions.push({type:"function",function:{name,description:`MCP ${client.server.name}: ${tool.description??tool.name}`,parameters:tool.inputSchema}});
    }}return definitions;
  }
  has(name:string):boolean{return this.tools.has(name);}
  async execute(name:string,raw:string,signal:AbortSignal):Promise<ToolResult>{const target=this.tools.get(name);if(!target)throw new Error("Herramienta MCP no disponible");
    try{const args=JSON.parse(raw);if(!args||Array.isArray(args)||typeof args!=="object")throw new Error("Argumentos MCP deben ser objeto JSON");return await target.client.call(target.tool,args,signal);}
    catch(error){return {output:(error as Error).message,failed:true,durationMs:0};}
  }
  async close():Promise<void>{await Promise.all(this.clients.map(c=>c.close()));this.clients=[];this.tools.clear();}
}
