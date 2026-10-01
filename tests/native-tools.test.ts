import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, toolDefinitions } from "../src/agent/tools/index.ts";

test("find busca nombre/glob fuera del proyecto, respeta límites, omisiones y cancelación", async () => {
  const root=await mkdtemp(join(tmpdir(),"s42-native-find-")), project=join(root,"proyecto"), outside=join(root,"otro");
  await mkdir(project);await mkdir(join(outside,"sub"),{recursive:true});await mkdir(join(outside,"node_modules"));
  await Bun.write(join(outside,"sub","Notas á.ts"),"hola");await Bun.write(join(outside,"node_modules","ignorado.ts"),"ignored");
  await symlink(outside,join(outside,"sub","ciclo"));
  const run=(args:object,signal=new AbortController().signal)=>execute("find",JSON.stringify(args),project,signal);
  try {
    const found=await run({path:outside,pattern:"NOTAS"});expect(found.failed).toBe(false);expect(found.output).toContain(join(outside,"sub","Notas á.ts"));expect(found.output).not.toContain("ciclo");
    const glob=await run({path:outside,pattern:"*.ts"});expect(glob.output).toContain("Notas á.ts");expect(glob.output).not.toContain("ignorado.ts");
    expect((await run({path:outside,pattern:"*.ts",includeIgnored:true})).output).toContain("ignorado.ts");
    expect((await run({path:outside,pattern:"*.ts",limit:1})).truncated).toBe(true);
    for(const args of [{pattern:""},{pattern:"a",extra:1},{pattern:"a",limit:0},{pattern:"a",includeIgnored:"yes"},{pattern:"a",path:join(root,"ausente")},{pattern:"a",toString:"x"}])expect((await run(args)).failed).toBe(true);
    const abort=new AbortController();abort.abort(new Error("cancelled"));expect((await run({path:outside,pattern:"*.ts"},abort.signal)).failed).toBe(true);
    expect(toolDefinitions.map(tool=>tool.function.name)).toEqual(["read","write","edit","list","find","search","fetch","shell","internal_skill","markdown_html","websocket"]);
  } finally {await rm(root,{recursive:true,force:true});}
});

test("fetch ejecuta métodos/headers, JSON, forms, multipart y texto; HTTP fallido conserva respuesta",async()=>{
  const received:{method:string;type:string|null;body:unknown;header:string|null}[]=[];
  const server=Bun.serve({port:0,async fetch(req){
    const type=req.headers.get("content-type"),body=type?.includes("json")?await req.json():type?.includes("form")||type?.includes("multipart")?Object.fromEntries(await req.formData()):await req.text();
    received.push({method:req.method,type,body,header:req.headers.get("x-fixture")});
    if(req.url.endsWith("/error"))return new Response("detalle del error",{status:422});
    return new Response("respuesta á文🙂",{headers:{"x-response":"ok"}});
  }});
  const run=(args:object)=>execute("fetch",JSON.stringify({url:`http://127.0.0.1:${server.port}/`,...args}),process.cwd(),new AbortController().signal);
  try {
    expect(JSON.parse((await run({})).output).body).toBe("respuesta á文🙂");
    await run({method:"post",headers:{"x-fixture":"custom"},body:{a:1,nested:[true,null,"á"]}});
    await run({method:"PUT",bodyType:"form",body:{nombre:"á & +",value:"a=b"}});
    await run({method:"PATCH",bodyType:"multipart",headers:{"Content-Type":"wrong"},body:{nombre:"文🙂"}});
    await run({method:"DELETE",bodyType:"text",body:"texto"});
    await run({method:"HEAD"});
    expect(received.map(r=>r.method)).toEqual(["GET","POST","PUT","PATCH","DELETE","HEAD"]);
    expect(received[1]!.header).toBe("custom");expect(received[1]!.body).toEqual({a:1,nested:[true,null,"á"]});
    expect(received[2]!.body).toEqual({nombre:"á & +",value:"a=b"});expect(received[3]!.body).toEqual({nombre:"文🙂"});expect(received[3]!.type).toContain("boundary=");
    expect(received[4]!.body).toBe("texto");
    const error=await run({url:`http://127.0.0.1:${server.port}/error`});expect(error.failed).toBe(true);expect(JSON.parse(error.output)).toMatchObject({status:422,body:"detalle del error"});
    for(const args of [{body:"invalidGET"},{method:"POST",bodyType:"form",body:{a:1}},{method:"POST",bodyType:"xml",body:"x"},{headers:{wrong:42}},{url:"file:///tmp/thing"}])expect((await run(args)).failed).toBe(true);
    expect(received).toHaveLength(7); // Invalid arguments did not make requests.
  }finally{server.stop(true);}
});

test("fetch recorta stream sin romper JSON/Unicode y cancela por timeout o señal",async()=>{
  let bodyCancelled=false;
  const server=Bun.serve({port:0,fetch(req){
    if(req.url.endsWith("/slow"))return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode("inicio"));},cancel(){bodyCancelled=true;}}));
    if(req.url.endsWith("/exact"))return new Response("a".repeat(65536));
    return new Response("á文🙂".repeat(100000));
  }});
  const run=(path:string,args:object={},signal=new AbortController().signal)=>execute("fetch",JSON.stringify({url:`http://127.0.0.1:${server.port}${path}`,...args}),process.cwd(),signal);
  try {
    const large=await run("/big");expect(large.failed).toBe(false);expect(large.truncated).toBe(true);const body=JSON.parse(large.output).body;expect(Buffer.byteLength(body)).toBeLessThanOrEqual(65536);expect(body).not.toContain("�");
    const exact=await run("/exact");expect(exact.truncated).toBe(false);expect(JSON.parse(exact.output).body.length).toBe(65536);
    const timeout=await run("/slow",{timeoutMs:25});expect(timeout.failed).toBe(true);expect(timeout.output).toContain("Timeout");
    const controller=new AbortController(),pending=run("/slow",{},controller.signal);await Bun.sleep(20);controller.abort(new Error("Cancelado por usuario"));const cancelled=await pending;expect(cancelled.failed).toBe(true);expect(cancelled.output).toContain("Cancelado por usuario");
    for(let i=0;i<20&&!bodyCancelled;i++)await Bun.sleep(5);expect(bodyCancelled).toBe(true);
  }finally{server.stop(true);}
});
