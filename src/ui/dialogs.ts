import { Button } from "./components/button.ts";
import { Input } from "./components/input.ts";
import { SelectList } from "./components/select-list.ts";
import { Window } from "./components/window.ts";
import type { Desktop } from "./desktop.ts";
import { theme } from "./theme.ts";
import { TextArea } from "./components/text-area.ts";

export function info(desktop: Desktop, title: string, lines: string[], parent?: Window): void {
  if(desktop.modal && desktop.modal!==parent)return;
  const area=desktop.floatingArea ?? {y:1,height:desktop.height-2},height=Math.min(13,area.height);
  const window=new Window(`info-${crypto.randomUUID()}`,title,{x:Math.max(0,(desktop.width-58)>>1),y:area.y+Math.max(0,(area.height-height)>>1),width:58,height});window.modal=true;
  const text=new TextArea("info",{x:1,y:0,width:54,height:8});text.readOnly=true;text.setValue(lines.join("\n"),"start");
  const close=new Button("close",{x:1,y:0,width:15,height:1},"Aceptar",()=>desktop.close(window));
  const handle=text.handle.bind(text);text.handle=event=>event.type==="key" && event.key==="enter" ? (desktop.close(window),true):handle(event);
  window.controls.push(text,close);window.onLayout=client=>{text.bounds.width=client.width-2;text.bounds.height=Math.max(1,client.height-2);close.bounds.y=client.height-1;};
  window.onDraw=(canvas,client)=>canvas.text(client.x+1,client.y+client.height-2,"↑/↓ PgUp/PgDn o rueda · Esc cerrar",theme.dialog,client.width-2);
  desktop.add(window);
}

export interface Field { label: string; value: string; browse?: (value: string, select: (value: string) => void, parent: Window) => void }
export function form(desktop: Desktop, title: string, fields: Field[], save: (values: string[]) => Promise<void|(()=>void)>): void {
  if (desktop.modal) return;
  const area = desktop.floatingArea ?? { y: 1, height: desktop.height - 2 };
  const height = Math.min(10,area.height);
  const window = new Window(`form-${crypto.randomUUID()}`, title, { x: Math.max(0, (desktop.width - 58) >> 1), y: area.y + Math.max(0,(area.height-height)>>1), width: 58, height });
  window.modal = true; let page = 0, error = "", saving = false;
  const inputs = fields.map((field, index) => new Input(`field-${index}`, { x: 20, y: 0, width: 32, height: 1 }, field.value));
  const pages = Math.ceil(fields.length / 3);
  const refresh = () => { window.controls.splice(0, window.controls.length, ...inputs.slice(page * 3, page * 3 + 3),
    ...(fields.slice(page*3,page*3+3).some(f=>f.browse)?[browse]:[]), ...(pages>1?[previous,next]:[]), accept); window.focusedId = window.controls[0]?.id; desktop.invalidate(); };
  const previous = new Button("previous", { x: 1, y: 0, width: 12, height: 1 }, "Anterior", () => { if (page) { page--; refresh(); } });
  const next = new Button("next", { x: 14, y: 0, width: 13, height: 1 }, "Siguiente", () => { if (page + 1 < pages) { page++; refresh(); } });
  const browse = new Button("browse", {x:1,y:0,width:15,height:1}, "Explorar", () => {
    const index=fields.findIndex((field,index)=>Math.floor(index/3)===page && field.browse);
    if(index<0)return;
    fields[index]!.browse!(inputs[index]!.value,value=>{inputs[index]!.setValue(value);window.focusedId=inputs[index]!.id;desktop.invalidate();},window);
  });
  const accept = new Button("save", { x: 36, y: 0, width: 16, height: 1 }, "Guardar", () => {
    if (saving) return; saving = true; accept.disabled = true; error = "Guardando…"; desktop.invalidate();
    void save(inputs.map(input => input.value)).then(next => {const visible=desktop.windows.includes(window);desktop.close(window);if(visible)next?.();}, e => { error = (e as Error).message; }).finally(() => { saving = false; accept.disabled = false; desktop.invalidate(); });
  });
  window.onLayout = client => {
    inputs.forEach((input, index) => { input.bounds.y = 1 + index % 3; input.bounds.width = Math.max(1, client.width - 21); });
    for (const button of [previous, next, browse, accept]) button.bounds.y = client.height - 1;
    accept.bounds.x = client.width - accept.bounds.width - 1;
    previous.disabled = page === 0; next.disabled = page + 1 === pages;
  };
  window.onDraw = (canvas, client) => {
    canvas.text(client.x + 1, client.y, `${page + 1}/${pages} · Tab: campo · Esc: cerrar`, theme.dialog, client.width - 2);
    fields.slice(page * 3, page * 3 + 3).forEach((field, index) => canvas.text(client.x + 1, client.y + index + 1, field.label, theme.dialog, 18));
    canvas.text(client.x + 1, client.y + client.height - 2, error, theme.dialog, client.width - 2);
  };
  refresh(); desktop.add(window);
}

export function choose<T>(desktop: Desktop, title: string, entries: { label: string; value: T }[], select: (value: T) => void, selected = 0): void {
  if (desktop.modal) return;
  const area = desktop.floatingArea ?? { y: 1, height: desktop.height - 2 };
  const height = Math.min(13,area.height);
  const window = new Window(`choose-${crypto.randomUUID()}`, title, { x: Math.max(0, (desktop.width - 58) >> 1), y: area.y + Math.max(0,(area.height-height)>>1), width: 58, height });
  window.modal = true;
  const list = new SelectList("entries", { x: 0, y: 0, width: 56, height: 8 }, entries.map(e => e.label));
  const activate = () => { const entry = entries[list.selected]; if (entry) { desktop.close(window); select(entry.value); } };
  const original = list.handle.bind(list); list.handle = event => event.type === "key" && event.key === "enter" ? (activate(), true)
    : original(event.type === "key" && (event.text === "j" || event.text === "k") ? {type:"key",key:event.text === "j" ? "down" : "up"} : event);
  const accept = new Button("select", { x: 1, y: 0, width: 15, height: 1 }, "Elegir", activate);
  window.controls.push(list, accept);
  window.onLayout = client => { list.bounds.width = client.width; list.bounds.height = Math.max(3, client.height - 1); accept.bounds.y = client.height - 1; };
  desktop.add(window);
  list.setItems(entries.map(e => e.label), selected);
}
