import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { contains, type InputEvent, type Rect } from "../types.ts";

export interface MenuItem { label: string; shortcut?: string; disabled?: boolean; run: () => void }
export interface Menu { label: string; items: MenuItem[] }

export class MenuBar {
  opened = -1;
  private selected = 0;
  private pressed = -1;
  private width = 80;
  private height = 24;

  constructor(readonly menus: Menu[]) {}

  resize(width: number, height: number): void { this.width = width; this.height = height; }

  private header(index: number): Rect {
    return { x: 1 + this.menus.slice(0, index).reduce((sum, menu) => sum + Bun.stringWidth(menu.label) + 3, 0),
      y: 0, width: Bun.stringWidth(this.menus[index]!.label) + 2, height: 1 };
  }

  private popup(): Rect {
    const menu = this.menus[this.opened]!;
    const width = Math.min(this.width, Math.max(...menu.items.map((item) => Bun.stringWidth(item.label) + Bun.stringWidth(item.shortcut ?? "") + 6), 10));
    return { x: Math.max(0, Math.min(this.header(this.opened).x, this.width - width)), y: 1,
      width, height: Math.min(menu.items.length + 2, this.height - 2) };
  }

  close(): void { this.opened = -1; this.pressed = -1; }

  private open(index: number): void {
    this.opened = index; this.selected = Math.max(0, this.menus[index]!.items.findIndex((item) => !item.disabled)); this.pressed = -1;
  }

  private activate(index: number): void {
    const item = this.menus[this.opened]?.items[index];
    if (!item || item.disabled) return;
    this.close(); item.run();
  }

  handle(event: InputEvent): boolean {
    if (!this.menus.length) return false;
    if (event.type === "key") {
      if (event.key === "f10") { this.opened < 0 ? this.open(0) : this.close(); return true; }
      const hotkey = event.key.startsWith("alt+") ? event.key.slice(4) : "";
      const match = hotkey ? this.menus.findIndex((menu) => menu.label[0]?.toLowerCase() === hotkey) : -1;
      if (match >= 0) { this.open(match); return true; }
      if (this.opened < 0) return false;
      if (event.key === "escape") this.close();
      else if (event.key === "left" || event.key === "right") this.open((this.opened + (event.key === "left" ? -1 : 1) + this.menus.length) % this.menus.length);
      else if (event.key === "up" || event.key === "down") {
        const items = this.menus[this.opened]!.items;
        for (let step = 0; step < items.length; step++) {
          this.selected = (this.selected + (event.key === "up" ? -1 : 1) + items.length) % items.length;
          if (!items[this.selected]!.disabled) break;
        }
      } else if (event.key === "enter") this.activate(this.selected);
      return true;
    }
    if (event.type !== "mouse") return this.opened >= 0;
    if (event.button !== 0 || event.action === "wheel") return this.opened >= 0;
    const header = this.menus.findIndex((_, index) => contains(this.header(index), event.x, event.y));
    if (event.action === "press" && header >= 0) {
      this.opened === header ? this.close() : this.open(header); return true;
    }
    if (this.opened < 0) return false;
    const popup = this.popup();
    const index = event.y - popup.y - 1;
    const inside = contains(popup, event.x, event.y) && event.x > popup.x && event.x < popup.x + popup.width - 1
      && index >= 0 && index < popup.height - 2;
    if (event.action === "press") {
      this.pressed = inside ? index : -1;
      if (inside) this.selected = index;
      else this.close();
    } else if (event.action === "release") {
      if (inside && index === this.pressed) this.activate(index);
      this.pressed = -1;
    }
    return true;
  }

  draw(canvas: Canvas): void {
    canvas.fill({ x: 0, y: 0, width: canvas.width, height: 1 }, theme.menu);
    this.menus.forEach((menu, index) => {
      const rect = this.header(index);
      canvas.text(rect.x, 0, ` ${menu.label} `, index === this.opened ? theme.selected : theme.menu);
    });
    if (this.opened < 0) return;
    const popup = this.popup();
    canvas.fill({ ...popup, x: popup.x + 1, y: popup.y + 1 }, theme.shadow);
    canvas.fill(popup, theme.menu); canvas.box(popup, theme.menu);
    this.menus[this.opened]!.items.slice(0, popup.height - 2).forEach((item, index) => {
      const style = item.disabled ? theme.disabled : index === this.selected ? theme.selected : theme.menu;
      canvas.fill({ x: popup.x + 1, y: popup.y + index + 1, width: popup.width - 2, height: 1 }, style);
      canvas.text(popup.x + 2, popup.y + index + 1, `${index === this.selected ? ">" : " "}${item.label}`, style, popup.width - 4);
      if (item.shortcut) canvas.text(popup.x + popup.width - Bun.stringWidth(item.shortcut) - 2, popup.y + index + 1, item.shortcut, style);
    });
  }
}
