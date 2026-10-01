import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { graphemes, type InputEvent, type Rect } from "../types.ts";
import { Component } from "./component.ts";

export class Input extends Component {
  private cursor: number;
  private start = 0;

  constructor(id: string, bounds: Rect, public value = "", private onChange: (value: string) => void = () => {}) {
    super(id, bounds); this.cursor = graphemes(value).length;
  }

  private visible(): string[] {
    const chars = graphemes(this.value);
    this.cursor = Math.min(this.cursor, chars.length);
    this.start = Math.min(this.start, this.cursor);
    const width = Math.max(1, this.bounds.width - 2);
    const caretWidth = Math.min(width, Math.max(1, Bun.stringWidth(chars[this.cursor] ?? " ")));
    while (Bun.stringWidth(chars.slice(this.start, this.cursor).join("")) + caretWidth > width) this.start++;
    return chars;
  }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    const chars = this.visible();
    const style = this.disabled ? theme.disabled : theme.menu;
    canvas.fill(bounds, style);
    canvas.text(bounds.x, bounds.y, "[", style);
    canvas.text(bounds.x + bounds.width - 1, bounds.y, "]", style);
    canvas.text(bounds.x + 1, bounds.y, chars.slice(this.start).join(""), style, bounds.width - 2);
    if (focused && !this.disabled) {
      const offset = Bun.stringWidth(chars.slice(this.start, this.cursor).join(""));
      canvas.text(bounds.x + 1 + offset, bounds.y, chars[this.cursor] ?? " ", theme.focused, bounds.width - 2 - offset);
    }
  }

  handle(event: InputEvent): boolean {
    if (this.disabled) return false;
    const chars = this.visible();
    if (event.type === "mouse" && event.action === "press") {
      let width = 0;
      this.cursor = this.start;
      while (this.cursor < chars.length && width + Bun.stringWidth(chars[this.cursor]!) <= Math.max(0, event.x - 1)) {
        width += Bun.stringWidth(chars[this.cursor++]!);
      }
      return true;
    }
    if (event.type === "mouse") return false;
    const before = this.value;
    const text = event.type === "paste" ? event.text.replace(/[\x00-\x1f\x7f]/g, " ") : event.text;
    if (text) {
      const added = graphemes(text);
      chars.splice(this.cursor, 0, ...added); this.cursor += added.length;
    } else if (event.type === "key") {
      switch (event.key) {
        case "left": this.cursor = Math.max(0, this.cursor - 1); break;
        case "right": this.cursor = Math.min(chars.length, this.cursor + 1); break;
        case "home": this.cursor = 0; break;
        case "end": this.cursor = chars.length; break;
        case "backspace": if (this.cursor) chars.splice(--this.cursor, 1); break;
        case "delete": chars.splice(this.cursor, 1); break;
        default: return false;
      }
    }
    this.value = chars.join("");
    if (before !== this.value) this.onChange(this.value);
    return true;
  }
}
