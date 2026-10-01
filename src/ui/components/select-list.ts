import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import type { InputEvent, Rect } from "../types.ts";
import { Component } from "./component.ts";

export class SelectList extends Component {
  selected = 0;
  private top = 0;
  constructor(id: string, bounds: Rect, readonly items: string[], private onChange: (item: string) => void = () => {}) { super(id, bounds); }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    this.top = Math.min(this.top, Math.max(0, this.items.length - (bounds.height - 2)));
    canvas.fill(bounds, theme.window); canvas.box(bounds, focused ? theme.selected : theme.window);
    for (let row = 0; row < bounds.height - 2; row++) {
      const index = this.top + row;
      const style = index === this.selected ? theme.selected : theme.window;
      canvas.fill({ x: bounds.x + 1, y: bounds.y + row + 1, width: bounds.width - 2, height: 1 }, style);
      canvas.text(bounds.x + 1, bounds.y + row + 1, this.items[index] ?? "", style, bounds.width - 2);
    }
    const border = focused ? theme.selected : theme.window;
    if (this.top > 0) canvas.text(bounds.x + bounds.width - 2, bounds.y, "↑", border);
    if (this.top + bounds.height - 2 < this.items.length) canvas.text(bounds.x + bounds.width - 2, bounds.y + bounds.height - 1, "↓", border);
  }

  handle(event: InputEvent): boolean {
    if (this.disabled || !this.items.length) return false;
    const rows = Math.max(1, this.bounds.height - 2);
    if (event.type === "mouse" && event.action === "wheel") {
      const before = this.top; this.top = Math.max(0, Math.min(this.items.length - rows, this.top + event.delta)); return before !== this.top;
    }
    const previous = this.selected; const previousTop = this.top;
    let next = this.selected;
    if (event.type === "mouse" && event.action === "press" && event.x > 0 && event.x < this.bounds.width - 1
      && event.y > 0 && event.y < this.bounds.height - 1) {
      next = this.top + event.y - 1;
      if (next >= this.items.length) return false;
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
