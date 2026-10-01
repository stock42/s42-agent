import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import type { InputEvent, Rect } from "../types.ts";
import { Component } from "./component.ts";

export class SelectList extends Component {
  bordered = true;
  emptyText = "";
  private get inset(): number { return this.bordered ? 1 : 0; }
  private get rows(): number { return Math.max(1, this.bounds.height - this.inset * 2); }
  selected = 0;
  private top = 0;
  constructor(id: string, bounds: Rect, readonly items: string[], private onChange: (item: string) => void = () => {}) { super(id, bounds); }

  setItems(items: string[], selected = 0): void {
    this.items.splice(0, this.items.length, ...items);
    this.selected = Math.max(0, Math.min(items.length - 1, selected));
    this.top = Math.max(0, this.selected - this.rows + 1);
  }

  indexAt(x: number, y: number): number | undefined {
    const index=this.top+y-this.inset;
    return x>=this.inset && x<this.bounds.width-this.inset && y>=this.inset && y<this.bounds.height-this.inset && index<this.items.length ? index : undefined;
  }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    this.top = Math.min(this.top, Math.max(0, this.items.length - this.rows));
    canvas.fill(bounds, theme.window); if (this.bordered) canvas.box(bounds, focused ? theme.selected : theme.window);
    for (let row = 0; row < this.rows; row++) {
      const index = this.top + row;
      const style = index === this.selected ? theme.selected : theme.window;
      canvas.fill({ x: bounds.x + this.inset, y: bounds.y + row + this.inset, width: bounds.width - this.inset * 2, height: 1 }, style);
      canvas.text(bounds.x + this.inset, bounds.y + row + this.inset, this.items[index] ?? (row === 0 && !this.items.length ? this.emptyText : ""), style, bounds.width - this.inset * 2);
    }
    const border = focused ? theme.selected : theme.window;
    if (this.bordered && this.top > 0) canvas.text(bounds.x + bounds.width - 2, bounds.y, "↑", border);
    if (this.bordered && this.top + this.rows < this.items.length) canvas.text(bounds.x + bounds.width - 2, bounds.y + bounds.height - 1, "↓", border);
  }

  handle(event: InputEvent): boolean {
    if (this.disabled || !this.items.length) return false;
    const rows = this.rows;
    if (event.type === "mouse" && event.action === "wheel") {
      const before = this.top; this.top = Math.max(0, Math.min(this.items.length - rows, this.top + event.delta)); return before !== this.top;
    }
    const previous = this.selected; const previousTop = this.top;
    let next = this.selected;
    if (event.type === "mouse" && event.action === "press") {
      const index=this.indexAt(event.x,event.y); if(index===undefined)return false;
      next = index;
    }
    else if (event.type === "key" && event.key === "up") next--;
    else if (event.type === "key" && event.key === "down") next++;
    else if (event.type === "key" && event.key === "home") next = 0;
    else if (event.type === "key" && event.key === "end") next = this.items.length - 1;
    else if (event.type === "key" && event.key === "pageup") { next -= rows; this.top = Math.max(0, this.top - rows); }
    else if (event.type === "key" && event.key === "pagedown") { next += rows; this.top = Math.max(0, Math.min(this.items.length - rows, this.top + rows)); }
    else return false;
    this.selected = Math.max(0, Math.min(this.items.length - 1, next));
    if (this.selected < this.top) this.top = this.selected;
    if (this.selected >= this.top + rows) this.top = this.selected - rows + 1;
    if (this.selected !== previous) this.onChange(this.items[this.selected]!);
    return this.selected !== previous || this.top !== previousTop;
  }
}
