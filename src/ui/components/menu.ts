import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { contains, type InputEvent, type Rect } from "../types.ts";

export interface MenuItem { label: string; shortcut?: string; disabled?: boolean; run: () => void }
export interface Menu { label: string; hotkey?: string; align?: "right"; items: MenuItem[] }

export class MenuBar {
  translate: (text: string) => string = text => text;
  opened = -1;
  private selected = 0;
  private offset = 0;
  private pressed = -1;
  private tracking = false;
  private width = 80;
  private height = 24;

  constructor(readonly menus: Menu[]) {}

  resize(width: number, height: number): void { this.width = width; this.height = height; }

  private header(index: number): Rect {
    const menu = this.menus[index]!; const width = Bun.stringWidth(this.translate(menu.label)) + 2;
    const required=1+this.menus.reduce((sum,m)=>sum+Bun.stringWidth(this.translate(m.label))+3,0);
    const compact = 1 + this.menus.reduce((sum, m) => sum + Bun.stringWidth(this.translate(m.label)) + 2, 0);
    const spacing = required > this.width ? (compact > this.width ? 1 : 2) : 3;
    return { x: menu.align === "right" ? this.width - width - 1
      : 1 + this.menus.slice(0, index).filter(menu => menu.align !== "right").reduce((sum, menu) => sum + Bun.stringWidth(this.translate(menu.label)) + spacing, 0),
      y: 0, width, height: 1 };
  }

  private popup(): Rect {
    const menu = this.menus[this.opened]!;
    const width = Math.min(this.width, Math.max(...menu.items.map((item) => Bun.stringWidth(this.translate(item.label)) + Bun.stringWidth(item.shortcut ?? "") + 6), 10));
    return { x: Math.max(0, Math.min(this.header(this.opened).x, this.width - width)), y: 1,
      width, height: Math.min(menu.items.length + 2, this.height - 2) };
  }

  private reveal():void {
    if(this.opened<0)return;const visible=Math.max(1,this.popup().height-2),count=this.menus[this.opened]!.items.length;
    this.offset=Math.max(0,Math.min(this.offset,count-visible));
    if(this.selected<this.offset)this.offset=this.selected;
    if(this.selected>=this.offset+visible)this.offset=this.selected-visible+1;
  }
  private move(direction:number):void {
    const items=this.menus[this.opened]!.items;
    for(let step=0;step<items.length;step++){this.selected=(this.selected+direction+items.length)%items.length;if(!items[this.selected]!.disabled)break;}
    this.reveal();
  }
  close(): void { this.opened = -1; this.pressed = -1; this.tracking = false; }

  private open(index: number): void {
    this.opened = index; this.offset=0; this.selected = Math.max(0, this.menus[index]!.items.findIndex((item) => !item.disabled)); this.pressed = -1;
  }

  private activate(index: number): boolean {
    const item = this.menus[this.opened]?.items[index];
    if (!item || item.disabled) return false;
    this.close(); item.run(); return true;
  }

  handle(event: InputEvent): boolean {
    if (!this.menus.length) return false;
    if (event.type === "key") {
      if (event.key === "escape") { this.opened < 0 ? this.open(0) : this.close(); return true; }
      const hotkey = event.key.startsWith("alt+") ? event.key.slice(4) : "";
      const match = hotkey ? this.menus.findIndex((menu) => (menu.hotkey ?? this.translate(menu.label)[0])?.toLowerCase() === hotkey) : -1;
      if (match >= 0) { this.open(match); return true; }
      if (this.opened < 0) return false;
      if (event.key === "left" || event.key === "right") this.open((this.opened + (event.key === "left" ? -1 : 1) + this.menus.length) % this.menus.length);
      else if (event.key === "up" || event.key === "down") this.move(event.key==="up"?-1:1);
      else if(event.key==="pageup"||event.key==="pagedown"){for(let i=0;i<Math.max(1,this.popup().height-2);i++)this.move(event.key==="pageup"?-1:1);}
      else if (event.key === "enter") return this.activate(this.selected);
      else return false;
      return true;
    }
    if(event.type!=="mouse")return false;
    if(event.action==="wheel"){if(this.opened<0||!contains(this.popup(),event.x,event.y))return false;this.move(event.delta>0?1:-1);return true;}
    const header = this.menus.findIndex((_, index) => contains(this.header(index), event.x, event.y));
    if (event.action === "move" && this.opened >= 0 && header >= 0 && header !== this.opened) { this.open(header); return true; }
    if (event.action !== "move" && event.button !== 0) return false;
    if (event.action === "press" && header >= 0) {
      if (this.opened === header) this.close();
      else { this.open(header); this.tracking = true; }
      return true;
    }
    if (this.opened < 0) return false;
    this.reveal();const popup = this.popup();
    const row=event.y-popup.y-1,index=row+this.offset;
    const inside = contains(popup, event.x, event.y) && event.x > popup.x && event.x < popup.x + popup.width - 1
      && row >= 0 && row < popup.height - 2 && index<this.menus[this.opened]!.items.length;
    if (event.action === "move") {
      const changed = inside && this.selected !== index;
      if (inside) this.selected = index;
      if (this.tracking) this.pressed = inside ? index : -1;
      return changed;
    }
    if (event.action === "press") {
      this.pressed = inside ? index : -1;
      if (inside) { this.selected = index; this.tracking = true; }
      else this.close();
    } else if (event.action === "release") {
      const activate = inside && (this.tracking || index === this.pressed);
      this.pressed = -1; this.tracking = false;
      return activate ? this.activate(index) : false;
    }
    return true;
  }

  draw(canvas: Canvas): void {
    canvas.fill({ x: 0, y: 0, width: canvas.width, height: 1 }, theme.menu);
    this.menus.forEach((menu, index) => {
      const rect = this.header(index);
      const label = this.translate(menu.label);
      canvas.text(rect.x, 0, ` ${label} `, index === this.opened ? theme.menuSelection : theme.menu);
      const hotkey = label.toLowerCase().indexOf((menu.hotkey ?? this.translate(menu.label)[0] ?? "").toLowerCase());
      if (hotkey >= 0) canvas.text(rect.x + 1 + Bun.stringWidth(label.slice(0, hotkey)), 0, label[hotkey]!,
        index === this.opened ? theme.selectedHotkey : theme.menuHotkey);
    });
    if (this.opened < 0) return;
    this.reveal();const popup = this.popup();
    canvas.fill({ ...popup, x: popup.x + 1, y: popup.y + 1 }, theme.shadow);
    canvas.fill(popup, theme.menu); canvas.box(popup, theme.menu);
    if(this.offset)canvas.text(popup.x+popup.width-3,popup.y,"↑",theme.menu);
    if(this.offset+popup.height-2<this.menus[this.opened]!.items.length)canvas.text(popup.x+popup.width-3,popup.y+popup.height-1,"↓",theme.menu);
    this.menus[this.opened]!.items.slice(this.offset,this.offset+popup.height - 2).forEach((item, index) => {
      const style = item.disabled ? theme.disabled : index+this.offset === this.selected ? theme.menuSelection : theme.menu;
      canvas.fill({ x: popup.x + 1, y: popup.y + index + 1, width: popup.width - 2, height: 1 }, style);
      const shortcutWidth = Bun.stringWidth(item.shortcut ?? "");
      canvas.text(popup.x + 2, popup.y + index + 1, this.translate(item.label), style,
        popup.width - 4 - (shortcutWidth ? shortcutWidth + 1 : 0));
      if (item.shortcut) canvas.text(popup.x + popup.width - Bun.stringWidth(item.shortcut) - 2, popup.y + index + 1, item.shortcut, style);
    });
  }
}
