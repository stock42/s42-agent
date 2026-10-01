import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { graphemes, type InputEvent, type Rect } from "../types.ts";
import { Component } from "./component.ts";

interface Row { start: number; end: number }

const normalize = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, " ");

export class TextArea extends Component {
  private chars: string[] = [];
  private cursor = 0;
  private anchor?: number;
  private dragging = false;
  private top = 0;
  private reveal = true;
  private following = true;
  private column?: number;
  private rows?: Row[];
  private rowWidth = 0;
  private viewHeight = 0;
  onSubmit?: () => void;
  placeholder = "";

  constructor(id: string, bounds: Rect, value = "") { super(id, bounds); this.setValue(value); }

  get value(): string { return this.chars.join(""); }

  setValue(value: string, position: "start" | "end" = "end"): void {
    this.chars = graphemes(normalize(value)); this.cursor = position === "start" ? 0 : this.chars.length;
    this.anchor = undefined; this.top = 0; this.rows = undefined; this.reveal = true; this.following = true; this.column = undefined;
  }

  private layout(): Row[] {
    const width = Math.max(1, this.bounds.width);
    if (this.rows && this.rowWidth === width) return this.rows;
    if (this.rowWidth !== width && this.following) this.reveal = true;
    const rows: Row[] = []; let start = 0; let used = 0;
    for (let index = 0; index < this.chars.length; index++) {
      const char = this.chars[index]!;
      if (char === "\n") { rows.push({ start, end: index }); start = index + 1; used = 0; continue; }
      const cells = Bun.stringWidth(char);
      if (used && used + cells > width) { rows.push({ start, end: index }); start = index; used = 0; }
      used += cells;
    }
    rows.push({ start, end: this.chars.length });
    if (used >= width) rows.push({ start: this.chars.length, end: this.chars.length });
    this.rowWidth = width; this.rows = rows; return rows;
  }

  private rowAt(position: number, rows: Row[]): number {
    return Math.max(0, rows.findLastIndex((row) => row.start <= position));
  }

  private viewport(rows: Row[]): void {
    const height = Math.max(1, this.bounds.height);
    if (this.viewHeight !== height && this.following) this.reveal = true;
    this.viewHeight = height;
    this.top = Math.min(this.top, Math.max(0, rows.length - height));
    if (this.reveal) {
      const row = this.rowAt(this.cursor, rows);
      if (row < this.top) this.top = row;
      if (row >= this.top + height) this.top = row - height + 1;
      this.reveal = false;
    }
  }

  private position(row: Row, column: number): number {
    let used = 0; let index = row.start;
    while (index < row.end && used + Bun.stringWidth(this.chars[index]!) <= Math.max(0, column)) used += Bun.stringWidth(this.chars[index++]!);
    return index;
  }

  private get selection(): [number, number] | undefined {
    return this.anchor !== undefined && this.anchor !== this.cursor
      ? [Math.min(this.anchor, this.cursor), Math.max(this.anchor, this.cursor)] : undefined;
  }

  private replace(text: string): void {
    const [start, end] = this.selection ?? [this.cursor, this.cursor];
    const added = graphemes(normalize(text));
    this.chars.splice(start, end - start, ...added); this.cursor = start + added.length;
    this.anchor = undefined; this.rows = undefined; this.reveal = true; this.following = true; this.column = undefined;
  }

  draw(canvas: Canvas, bounds: Rect, focused: boolean): void {
    const rows = this.layout(); this.viewport(rows);
    canvas.fill(bounds, theme.window);
    if (!this.chars.length && this.placeholder) {
      this.placeholder.split("\n").slice(0, bounds.height).forEach((line, row) => canvas.text(bounds.x, bounds.y + row, line, theme.window, bounds.width));
    }
    const selection = focused ? this.selection : undefined;
    for (let y = 0; y < bounds.height; y++) {
      const row = rows[this.top + y]; if (!row) break;
      let x = 0;
      for (let index = row.start; index < row.end; index++) {
        const char = this.chars[index]!; const width = Bun.stringWidth(char);
        if (x + width > bounds.width) break;
        const style = selection && index >= selection[0] && index < selection[1] ? theme.selected : theme.window;
        canvas.text(bounds.x + x, bounds.y + y, char, style, width); x += width;
      }
    }
    if (focused && !this.disabled) {
      const rowIndex = this.rowAt(this.cursor, rows); const row = rows[rowIndex]!;
      const x = Bun.stringWidth(this.chars.slice(row.start, this.cursor).join("")); const y = rowIndex - this.top;
      const caret = this.chars[this.cursor] ?? (!this.chars.length ? graphemes(this.placeholder)[0] : undefined) ?? " ";
      if (y >= 0 && y < bounds.height) canvas.text(bounds.x + x, bounds.y + y,
        caret === "\n" ? " " : caret, theme.focused, bounds.width - x);
    }
  }

  handle(event: InputEvent): boolean {
    if (this.disabled) return false;
    const rows = this.layout(); this.viewport(rows);
    if (event.type === "mouse") {
      if (event.action === "wheel") {
        const before = this.top; this.top = Math.max(0, Math.min(rows.length - Math.max(1, this.bounds.height), this.top + event.delta * 3));
        if (this.top !== before) this.following = false;
        return this.top !== before;
      }
      if (event.button !== 0) return false;
      if (event.action === "release") { this.dragging = false; return false; }
      if (event.action !== "press" && !(event.action === "move" && this.dragging)) return false;
      const index = Math.max(0, Math.min(rows.length - 1, this.top + event.y));
      const before = this.cursor; this.cursor = this.position(rows[index]!, event.x);
      if (event.action === "press") { this.anchor = this.cursor; this.dragging = true; }
      this.reveal = true; this.following = true; this.column = undefined;
      return event.action === "press" || before !== this.cursor;
    }
    if (event.type === "paste") { this.replace(event.text); return true; }
    if (event.text) { this.replace(event.text); return true; }
    if (event.key === "enter" && this.onSubmit) { this.onSubmit(); return true; }
    if (event.key === "enter" || event.key === "shift+enter" || event.key === "ctrl+j") { this.replace("\n"); return true; }
    if (event.key === "ctrl+a") { this.anchor = 0; this.cursor = this.chars.length; this.reveal = true; this.following = true; return true; }
    if (event.key === "backspace" || event.key === "delete") {
      if (!this.selection) {
        this.anchor = event.key === "backspace" ? Math.max(0, this.cursor - 1) : Math.min(this.chars.length, this.cursor + 1);
      }
      this.replace(""); return true;
    }
    const shift = event.key.startsWith("shift+"); const key = shift ? event.key.slice(6) : event.key;
    if (!["left", "right", "up", "down", "home", "end", "ctrl+home", "ctrl+end", "pageup", "pagedown"].includes(key)) return false;
    const selection = this.selection;
    if (shift && this.anchor === undefined) this.anchor = this.cursor;
    const rowIndex = this.rowAt(this.cursor, rows); const row = rows[rowIndex]!;
    if (key === "left") this.cursor = !shift && selection ? selection[0] : Math.max(0, this.cursor - 1);
    else if (key === "right") this.cursor = !shift && selection ? selection[1] : Math.min(this.chars.length, this.cursor + 1);
    else if (key === "home" || key === "end") this.cursor = key === "home" ? row.start : row.end;
    else if (key === "ctrl+home" || key === "ctrl+end") this.cursor = key === "ctrl+home" ? 0 : this.chars.length;
    else {
      this.column ??= Bun.stringWidth(this.chars.slice(row.start, this.cursor).join(""));
      const distance = key === "pageup" || key === "pagedown" ? Math.max(1, this.bounds.height) : 1;
      const next = Math.max(0, Math.min(rows.length - 1, rowIndex + (key === "up" || key === "pageup" ? -distance : distance)));
      this.cursor = this.position(rows[next]!, this.column);
    }
    if (["left", "right", "home", "end", "ctrl+home", "ctrl+end"].includes(key)) this.column = undefined;
    if (!shift) this.anchor = undefined;
    this.reveal = true; this.following = true; return true;
  }
}
