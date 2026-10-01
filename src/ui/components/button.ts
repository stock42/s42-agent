import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { contains, type InputEvent, type Rect } from "../types.ts";
import { Component } from "./component.ts";

export class Button extends Component {
  private pressed = false;
  private inside = false;
  constructor(id: string, bounds: Rect, public label: string, public onClick: () => void) { super(id, bounds); }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    const down = this.pressed && this.inside;
    const style = this.disabled ? theme.disabled : down ? theme.selected : focused ? theme.focused : theme.button;
    canvas.fill(bounds, style);
    const text = `< ${this.label} >`;
    const inset = Math.max(0, Math.floor((bounds.width - Bun.stringWidth(text)) / 2));
    canvas.text(bounds.x + inset, bounds.y, text, style, bounds.width - inset);
  }

  handle(event: InputEvent): boolean {
    if (this.disabled) { this.pressed = false; return false; }
    if (event.type === "key" && (event.key === "enter" || event.key === " ")) { this.onClick(); return true; }
    if (event.type !== "mouse" || event.button !== 0) return false;
    if (event.action === "press") { this.pressed = true; this.inside = true; return true; }
    if (event.action === "move" && this.pressed) {
      const inside = contains({ ...this.bounds, x: 0, y: 0 }, event.x, event.y);
      const changed = inside !== this.inside; this.inside = inside; return changed;
    }
    if (event.action === "release") {
      const activate = this.pressed && contains({ ...this.bounds, x: 0, y: 0 }, event.x, event.y);
      const changed = this.pressed;
      this.pressed = false;
      if (activate) this.onClick();
      return changed;
    }
    return false;
  }
}
