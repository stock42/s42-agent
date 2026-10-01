import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { contains, type InputEvent, type Rect } from "../types.ts";
import { Component } from "./component.ts";

export interface TabItem { id: string; label: string; busy: boolean; activity?: string }
type Target = { id: string; close?: boolean } | "previous" | "next" | "open";

export class TabBar extends Component {
  private offset = 0;
  private lastActive = "";
  private lastWidth = 0;
  private lastItems = "";
  private pressed?: Target;
  constructor(private readonly items: () => TabItem[], private readonly active: () => string,
    private readonly select: (id: string) => void, private readonly close: (id: string) => void, private readonly open: () => void) {
    super("project-tabs", { x: 0, y: 1, width: 80, height: 1 });
  }

  private layout(): { item: TabItem; rect: Rect }[] {
    const items = this.items(), active = this.active(), width = this.bounds.width;
    const identity = items.map(item => item.id).join("|");
    const size = (item: TabItem) => Math.min(Math.max(12, Bun.stringWidth(item.label) + 9), 26, Math.max(1, width - 11));
    this.offset = Math.min(this.offset, Math.max(0, items.length - 1));
    if (active !== this.lastActive || width !== this.lastWidth || identity !== this.lastItems) {
      const index = items.findIndex(item => item.id === active);
      if (index >= 0) {
        if (index < this.offset) this.offset = index;
        while (this.offset < index && items.slice(this.offset, index + 1).reduce((sum, item) => sum + size(item) + 1, 0) > width - 10) this.offset++;
      }
      this.lastActive = active; this.lastWidth = width; this.lastItems = identity;
    }
    const entries: { item: TabItem; rect: Rect }[] = [];
    let x = this.bounds.x + 3;
    for (const item of items.slice(this.offset)) {
      const itemWidth = size(item);
      if (x + itemWidth > this.bounds.x + width - 7) break;
      entries.push({ item, rect: { x, y: this.bounds.y, width: itemWidth, height: 1 } }); x += itemWidth + 1;
    }
    return entries;
  }

  draw(canvas: Canvas): void {
    canvas.fill(this.bounds, theme.menu);
    const entries = this.layout(), all = this.items();
    canvas.text(this.bounds.x, this.bounds.y, " < ", this.offset ? theme.menu : theme.disabled);
    for (const { item, rect } of entries) {
      const style = item.id === this.active() ? theme.selected : theme.menu;
      canvas.fill(rect, style);
      canvas.text(rect.x, rect.y, ` ${all.findIndex(t => t.id === item.id) + 1}:${item.label}`, style, rect.width - 4);
      canvas.text(rect.x + rect.width - 4, rect.y, `${item.activity ?? (item.busy ? "~" : " ")} × `, style, 4);
    }
    canvas.text(this.bounds.x + this.bounds.width - 7, this.bounds.y, " > ", this.offset + entries.length < all.length ? theme.menu : theme.disabled);
    canvas.text(this.bounds.x + this.bounds.width - 4, this.bounds.y, " + ", theme.menuHotkey);
  }

  private target(x: number, y: number): Target | undefined {
    if (!contains(this.bounds, x, y)) return;
    const entries = this.layout();
    if (x < this.bounds.x + 3) return this.offset ? "previous" : undefined;
    if (x >= this.bounds.x + this.bounds.width - 4) return "open";
    if (x >= this.bounds.x + this.bounds.width - 7) return this.offset + entries.length < this.items().length ? "next" : undefined;
    const hit = entries.find(entry => contains(entry.rect, x, y));
    if (hit) return { id: hit.item.id, close: x >= hit.rect.x + hit.rect.width - 2 };
  }

  handle(event: InputEvent): boolean {
    if (event.type !== "mouse") return false;
    if (event.action === "wheel" && contains(this.bounds, event.x, event.y)) {
      this.offset = Math.max(0, Math.min(this.items().length - 1, this.offset + (event.delta > 0 ? 1 : -1))); return true;
    }
    if (event.button !== 0) return false;
    const target = this.target(event.x, event.y);
    if (event.action === "press" && contains(this.bounds, event.x, event.y)) { this.pressed = target; return true; }
    if (event.action !== "release" || !this.pressed) return false;
    const pressed = this.pressed; this.pressed = undefined;
    if (JSON.stringify(target) !== JSON.stringify(pressed)) return true;
    if (target === "previous") this.offset--; else if (target === "next") this.offset++;
    else if (target === "open") this.open();
    else if (target) target.close ? this.close(target.id) : this.select(target.id);
    return true;
  }
}
