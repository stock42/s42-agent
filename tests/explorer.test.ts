import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { App } from "../src/app.ts";
import { FileExplorer } from "../src/ui/components/file-explorer.ts";
import { Input } from "../src/ui/components/input.ts";
import { SelectList } from "../src/ui/components/select-list.ts";
import { TextArea } from "../src/ui/components/text-area.ts";
import { createWorkspaceView } from "../src/ui/workspace.ts";
import type { Desktop } from "../src/ui/desktop.ts";
import type { Window } from "../src/ui/components/window.ts";

async function until(check: () => boolean) {
  for (let i=0;i<600;i++) { if(check())return;await Bun.sleep(5); }
  throw new Error("Timeout del explorador");
}
const screen=(desktop:Desktop)=>desktop.draw().lines().join("\n");
function button(desktop:Desktop, window:Window, id:string) {
  desktop.draw();const rect=window.controlRect(window.controls.find(c=>c.id===id)!);
  for(const action of ["press","release"] as const) desktop.handle({type:"mouse",action,x:rect.x+1,y:rect.y,button:0,delta:0});
}

test("explorador sale del proyecto: padre, carpeta hermana, enlaces, raíz y ruta escrita",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-explorer-")),project=join(root,"Proyecto á"),outside=join(root,"Otra carpeta");
  await mkdir(project);await mkdir(outside);await Bun.write(join(outside,".oculto"),"hola");await symlink(outside,join(project,"enlace"));
  const view=createWorkspaceView({name:"Proyecto",path:project}),explorer=new FileExplorer(view.desktop,project);
  try {
    await explorer.show();expect(explorer.window.focusedId).toBe("files");
    explorer.list.selected=explorer.entries.findIndex(e=>e.name==="enlace");await explorer.openSelected();expect(explorer.folder).toBe(outside);
    button(view.desktop,explorer.window,"up");await until(()=>explorer.folder===root);expect(explorer.entries.map(e=>e.name)).toContain("Otra carpeta");
    explorer.list.selected=explorer.entries.findIndex(e=>e.name==="Proyecto á");explorer.window.focusedId="files";view.desktop.handle({type:"key",key:"enter"});await until(()=>explorer.folder===project);
    view.desktop.handle({type:"key",key:"left"});await until(()=>explorer.folder===dirname(project));
    explorer.pathInput.setValue(outside);explorer.window.focusedId="path";view.desktop.handle({type:"key",key:"enter"});await until(()=>explorer.folder===outside);expect(explorer.entries.map(e=>e.name)).toContain(".oculto");
    await explorer.navigate(join(root,"inexistente"));expect(explorer.folder).toBe(outside);expect(explorer.status).toContain("ENOENT");
    button(view.desktop,explorer.window,"root");await until(()=>explorer.folder===parse(root).root);expect(explorer.entries.some(e=>e.name==="..")).toBe(false);
    await explorer.navigate(outside);expect(view.editorWindow.title).toBe("Proyecto");
    for(const [width,height] of [[60,16],[80,24],[120,40]] as const) {
      view.desktop.resize(width,height);const text=screen(view.desktop);expect(text).toContain("Prompt");expect(text).toContain("< Adjuntar >");
      expect(explorer.window.bounds.y+explorer.window.bounds.height).toBeLessThanOrEqual(view.promptWindow.bounds.y);
      expect(explorer.list.bounds.y+explorer.list.bounds.height).toBeLessThan(explorer.window.client.height-1);
    }
  } finally {await rm(root,{recursive:true,force:true});}
});

test("doble clic solo abre filas válidas; preview UTF-8/binario es de solo lectura y vuelve al listado",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-preview-"));
  const code="á文🙂\n".repeat(12000);await Bun.write(join(root,"code.ts"),code);await Bun.write(join(root,"bin"),new Uint8Array([0,255,1]));
  const view=createWorkspaceView({name:"Preview",path:root}),explorer=new FileExplorer(view.desktop,root);
  const click=(y:number)=>{for(const action of ["press","release"] as const)explorer.list.handle({type:"mouse",action,x:2,y,button:0,delta:0});};
  try {
    await explorer.show();explorer.list.selected=explorer.entries.findIndex(e=>e.name==="code.ts");
    click(explorer.entries.length+1);click(explorer.entries.length+1);await Bun.sleep(10);expect(view.desktop.modal).toBe(explorer.window);
    const row=explorer.list.selected+1;click(row);click(row);await until(()=>view.desktop.modal!==explorer.window);
    const preview=view.desktop.modal!,text=preview.controls[0] as TextArea;
    expect(text.value).toContain("á文🙂");expect(text.value).toContain("64 KiB");expect(text.value).not.toContain("�");expect(text.readOnly).toBe(true);
    preview.focusedId="info";const before=text.value;view.desktop.handle({type:"paste",text:"cambiar"});view.desktop.handle({type:"key",key:"backspace"});expect(text.value).toBe(before);
    view.desktop.handle({type:"key",key:"escape"});expect(view.desktop.modal).toBe(explorer.window);expect(explorer.window.focusedId).toBe("files");
    expect(await Bun.file(join(root,"code.ts")).text()).toBe(code);
    explorer.list.selected=explorer.entries.findIndex(e=>e.name==="bin");await explorer.openSelected();expect((view.desktop.modal!.controls[0] as TextArea).value).toContain("Archivo binario");
  } finally {await rm(root,{recursive:true,force:true});}
});

test("Projects pide solo Name/Folder; picker conserva formulario, guarda y reabre proyecto",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-project-form-")),a=join(root,"A"),b=join(root,"B á");await mkdir(a);await mkdir(b);await Bun.write(join(b,"archivo"),"hola");
  const config=join(root,"config.json"),app=await App.open({config,cwd:a});
  try {
    app.view.prompt.setValue("borrador A");app.projectForm();const parent=app.desktop.modal!;
    const fields=parent.controls.filter(c=>c instanceof Input) as Input[];expect(fields).toHaveLength(2);expect(parent.controls.map(c=>c.id)).toEqual(["field-0","field-1","browse","save"]);
    fields[0]!.setValue("Proyecto nuevo á");fields[1]!.setValue(b);button(app.desktop,parent,"browse");await until(()=>app.desktop.modal?.title==="Elegir folder" && screen(app.desktop).includes("archivo"));
    const picker=app.desktop.modal!;expect(app.desktop.windows).toContain(parent);expect(fields[0]!.value).toBe("Proyecto nuevo á");
    const list=picker.controls.find(c=>c instanceof SelectList) as SelectList;list.selected=list.items.findIndex(item=>item.includes("archivo"));picker.focusedId=list.id;app.desktop.handle({type:"key",key:"enter"});await until(()=>app.desktop.modal?.title==="archivo");
    app.desktop.handle({type:"key",key:"escape"});expect(app.desktop.modal).toBe(picker);
    button(app.desktop,picker,"select");await until(()=>app.desktop.modal===parent);expect(fields[1]!.value).toBe(b);expect(fields[0]!.value).toBe("Proyecto nuevo á");expect(parent.focusedId).toBe("field-1");
    button(app.desktop,parent,"save");await until(()=>app.project?.name==="Proyecto nuevo á" && !app.desktop.modal);expect(app.project?.path).toBe(b);expect(app.view.editorWindow.title).toBe("Proyecto nuevo á");
    app.projectForm(app.project);const invalid=app.desktop.modal!;(invalid.controls[1] as Input).setValue(join(root,"ausente"));button(app.desktop,invalid,"save");await until(()=>screen(app.desktop).includes("ENOENT"));expect(app.project!.path).toBe(b);expect(app.desktop.modal).toBe(invalid);
    app.desktop.close(invalid);await app.desktop.onBeforeExit!();
    const reopened=await App.open({config});try{expect(reopened.project?.name).toBe("Proyecto nuevo á");expect(reopened.project?.path).toBe(b);await reopened.switchProject(reopened.store.value.projects.find(p=>p.path===a)!);expect(reopened.view.prompt.value).toBe("borrador A");}finally{await reopened.desktop.onBeforeExit!();}
  } finally {await app.session?.close();await rm(root,{recursive:true,force:true});}
});

test("Ctrl+E abre explorador, adjunta archivo externo y conserva proyecto y prompt",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-explorer-app-")),project=join(root,"proyecto");await mkdir(project);const file=join(root,"externo.ts");await Bun.write(file,"export const valor = 1;");
  const app=await App.open({config:join(root,"config.json"),cwd:project});
  try {
    app.view.prompt.setValue("pedido conservado");app.desktop.handle({type:"key",key:"ctrl+e"});await until(()=>app.desktop.modal?.title==="Explorador de archivos");const window=app.desktop.modal!;
    const path=window.controls[0] as Input;path.setValue(root);window.focusedId="path";app.desktop.handle({type:"key",key:"enter"});await until(()=>screen(app.desktop).includes("externo.ts"));
    const list=window.controls.find(c=>c instanceof SelectList) as SelectList;list.selected=list.items.findIndex(item=>item.includes("externo.ts"));button(app.desktop,window,"select");await until(()=>app.attachments.length===1);
    expect(app.attachments[0]!.path).toBe(file);expect(app.project!.path).toBe(project);expect(app.view.prompt.value).toBe("pedido conservado");expect(app.busy).toBe(false);
    app.desktop.handle({type:"key",key:"escape"});app.desktop.handle({type:"key",key:"alt+p"});expect(app.desktop.menu.opened).toBe(1);expect(app.desktop.menu.menus[1]!.label).toBe("Projects");
  } finally {await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});

test("explorador grande busca en disco, preview/adjuntos por resultado, cancela y conserva compactos",async()=>{
  const root=await mkdtemp(join(tmpdir(),"s42-explorer-search-")),project=join(root,"proyecto"),outside=join(root,"otro","sub");
  await mkdir(project);await mkdir(outside,{recursive:true});await Bun.write(join(outside,"Notas á.ts"),"texto fuera del proyecto");
  const app=await App.open({config:join(root,"config.json"),cwd:project});const explorer=new FileExplorer(app.desktop,project,{attach:path=>app.attach([path])});
  try {
    app.view.prompt.setValue("conservar borrador");app.desktop.resize(190,50);await explorer.show();
    expect(explorer.window.bounds.width).toBeGreaterThan(170);expect(explorer.window.bounds.height).toBeGreaterThan(35);
    const before=explorer.entries;await explorer.search();expect(explorer.entries).toBe(before);expect(explorer.window.focusedId).toBe("query");
    explorer.pathInput.setValue(root);explorer.searchInput.setValue("*.ts");explorer.window.focusedId="query";
    app.desktop.handle({type:"key",key:"enter"});await until(()=>explorer.status.includes("1 resultados"));
    expect(explorer.list.items).toEqual(["[F] otro/sub/Notas á.ts"]);expect(explorer.folder).toBe(root);expect(app.project!.path).toBe(project);
    await explorer.openSelected();expect(app.desktop.modal?.title).toBe("Notas á.ts");expect((app.desktop.modal!.controls[0] as TextArea).readOnly).toBe(true);app.desktop.close();
    button(app.desktop,explorer.window,"select");await until(()=>app.attachments.length===1);expect(app.attachments[0]!.path).toBe(join(outside,"Notas á.ts"));
    const pending=explorer.search();await explorer.search();await pending;expect(explorer.status).toContain("cancelada");
    await explorer.search();expect(explorer.entries).toHaveLength(1);
    for (const [width,height] of [[60,16],[80,24],[190,50]] as const) {
      app.desktop.resize(width,height);const text=screen(app.desktop);expect(text).toContain("Buscar");expect(text).toContain("Notas á.ts");expect(text).toContain("Prompt");expect(text).toContain("Tokens E/S");
      expect(explorer.window.bounds.y+explorer.window.bounds.height).toBeLessThanOrEqual(app.view.promptWindow.bounds.y);
    }
    app.desktop.resize(60,16);const rect=explorer.window.controlRect(explorer.list);
    for(const action of ["press","release"] as const)app.desktop.handle({type:"mouse",action,x:rect.x+2,y:rect.y,button:0,delta:0});
    expect(explorer.window.focusedId).toBe("files");
    explorer.searchInput.setValue("no-match");await explorer.search();expect(screen(app.desktop)).toContain("Sin resultados");
    const closed=explorer.search();app.desktop.close(explorer.window);await closed;expect(app.desktop.modal).toBeUndefined();expect(app.view.prompt.value).toBe("conservar borrador");
  } finally {await app.desktop.onBeforeExit!();await rm(root,{recursive:true,force:true});}
});
