import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { graphemes, type InputEvent, type Rect } from "../types.ts";
import { Component } from "./component.ts";

export class Input extends Component {
  secret = false;
  placeholder = "";
  private cursor: number;
  private start = 0;
  private anchor?: number;
  private dragging = false;

  constructor(id: string, bounds: Rect, public value = "", private onChange: (value: string) => void = () => {}) {
    super(id, bounds); this.cursor = graphemes(value).length;
  }

  setValue(value: string): void {
    this.value = value; this.cursor = graphemes(value).length; this.start = 0; this.anchor = undefined; this.dragging = false;
  }

  private visible(): string[] {
    const chars = graphemes(this.value);
    this.cursor = Math.min(this.cursor, chars.length);
    this.start = Math.min(this.start, this.cursor);
    const width = Math.max(1, this.bounds.width);
    const displayWidth = (items: string[]) => this.secret ? items.length : Bun.stringWidth(items.join(""));
    const caretWidth = this.secret ? 1 : Math.min(width, Math.max(1, Bun.stringWidth(chars[this.cursor] ?? " ")));
    while (displayWidth(chars.slice(this.start, this.cursor)) + caretWidth > width) this.start++;
    while (this.start > 0 && displayWidth(chars.slice(this.start - 1, this.cursor)) + caretWidth <= width) this.start--;
    return chars;
  }

  private get selection(): [number, number] | undefined {
    return this.anchor !== undefined && this.anchor !== this.cursor ? [Math.min(this.anchor, this.cursor), Math.max(this.anchor, this.cursor)] : undefined;
  }

  private positionAt(x: number, chars: string[]): number {
    let width = 0;
    let index = this.start;
    const column = Math.max(0, Math.min(this.bounds.width, x));
    while (index < chars.length && width + (this.secret ? 1 : Bun.stringWidth(chars[index]!)) <= column) { width += this.secret ? 1 : Bun.stringWidth(chars[index]!); index++; }
    if (this.dragging && x < 0) return Math.max(0, this.start - 1);
    if (this.dragging && x >= this.bounds.width) return Math.min(chars.length, index + 1);
    return index;
  }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    const chars = this.visible().map(char => this.secret ? "*" : char);
    const style = this.disabled ? theme.disabled : theme.menu;
    canvas.fill(bounds, style);
    if (!this.value) canvas.text(bounds.x, bounds.y, this.placeholder, theme.disabled, bounds.width);
    const selection = this.selection;
    let used = 0;
    for (let index = this.start; index < chars.length; index++) {
      const glyph = chars[index]!; const width = Bun.stringWidth(glyph);
      if (used + width > bounds.width) break;
      const selected = focused && selection && index >= selection[0] && index < selection[1];
      canvas.text(bounds.x + used, bounds.y, glyph, selected ? theme.selected : style, width); used += width;
    }
    if (focused && !this.disabled) {
      const offset = Bun.stringWidth(chars.slice(this.start, this.cursor).join(""));
      canvas.text(bounds.x + offset, bounds.y, chars[this.cursor] ?? " ", theme.focused, bounds.width - offset);
    }
  }

  handle(event: InputEvent): boolean {
    if (this.disabled) return false;
    const chars = this.visible();
    if (event.type === "mouse" && event.action === "press") {
      this.cursor = this.positionAt(event.x, chars); this.anchor = this.cursor; this.dragging = true;
      return true;
    }
    if (event.type === "mouse" && event.action === "move" && this.dragging) {
      const before = this.cursor; this.cursor = this.positionAt(event.x, chars); return this.cursor !== before;
    }
    if (event.type === "mouse" && event.action === "release") {
      this.dragging = false; if (this.anchor === this.cursor) this.anchor = undefined; return false;
    }
    if (event.type === "mouse") return false;
    const before = this.value;
    const text = event.type === "paste" ? event.text.replace(/[\x00-\x1f\x7f]/g, " ") : event.text;
    const selection = this.selection;
    const removeSelection = () => {
      if (!selection) return;
      chars.splice(selection[0], selection[1] - selection[0]); this.cursor = selection[0]; this.anchor = undefined;
    };
    if (text) {
      removeSelection();
      const added = graphemes(text);
      chars.splice(this.cursor, 0, ...added); this.cursor += added.length; this.anchor = undefined;
    } else if (event.type === "key") {
      if (event.key === "ctrl+a") { this.anchor = 0; this.cursor = chars.length; return true; }
      const shift = event.key.startsWith("shift+"); const movement = shift ? event.key.slice(6) : event.key;
      if (["left", "right", "home", "end"].includes(movement)) {
        if (shift && this.anchor === undefined) this.anchor = this.cursor;
        if (movement === "left") this.cursor = !shift && selection ? selection[0] : Math.max(0, this.cursor - 1);
        else if (movement === "right") this.cursor = !shift && selection ? selection[1] : Math.min(chars.length, this.cursor + 1);
        else this.cursor = movement === "home" ? 0 : chars.length;
        if (!shift) this.anchor = undefined;
      } else if (event.key === "backspace" || event.key === "delete") {
        if (selection) removeSelection();
        else if (event.key === "backspace" && this.cursor) chars.splice(--this.cursor, 1);
        else if (event.key === "delete") chars.splice(this.cursor, 1);
        this.anchor = undefined;
      } else return false;
    }
    this.value = chars.join("");
    if (before !== this.value) this.onChange(this.value);
    return true;
  }
}
