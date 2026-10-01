import { contains, graphemes, intersect, type Rect } from "./types.ts";
import { palettes, theme, type PaletteId, type Style } from "./theme.ts";

export interface Cell { text: string; style: Style; width: number }

export class Canvas {
  readonly cells: Cell[][];
  private clip: Rect;

  constructor(readonly width: number, readonly height: number, readonly palette: PaletteId = "qbasic") {
    this.clip = { x: 0, y: 0, width, height };
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ text: " ", style: theme.desktop, width: 1 })));
  }

  clipped(rect: Rect, draw: () => void): void {
    const previous = this.clip;
    this.clip = intersect(previous, rect);
    try { draw(); } finally { this.clip = previous; }
  }

  fill(rect: Rect, style: Style, text = " "): void {
    const area = intersect(this.clip, rect);
    for (let y = area.y; y < area.y + area.height; y++) {
      for (let x = area.x; x < area.x + area.width; x++) this.put(x, y, text, style);
    }
  }

  private put(x: number, y: number, text: string, style: Style, width = 1): void {
    if (!contains(this.clip, x, y) || !contains(this.clip, x + width - 1, y)) return;
    const row = this.cells[y]!;
    // Clear both halves when a later layer covers part of a wide glyph.
    if (row[x]?.width === 0 && x > 0) row[x - 1] = { text: " ", style: row[x - 1]!.style, width: 1 };
    if (row[x]?.width === 2 && x + 1 < this.width) row[x + 1] = { text: " ", style: row[x + 1]!.style, width: 1 };
    row[x] = { text, style, width };
    if (width === 2) {
      if (row[x + 1]?.width === 2 && x + 2 < this.width) row[x + 2] = { text: " ", style: row[x + 2]!.style, width: 1 };
      row[x + 1] = { text: "", style, width: 0 };
    }
  }

  text(x: number, y: number, text: string, style: Style, maxWidth = this.width): void {
    let used = 0;
    for (const glyph of graphemes(text)) {
      const width = Bun.stringWidth(glyph);
      if (width === 0 || /[\x00-\x1f\x7f]/.test(glyph)) continue;
      if (used + width > maxWidth) break;
      this.put(x + used, y, glyph, style, width);
      used += width;
    }
  }

  box(rect: Rect, style: Style, double = false): void {
    const [tl, tr, bl, br, h, v] = double ? ["╔", "╗", "╚", "╝", "═", "║"] : ["┌", "┐", "└", "┘", "─", "│"];
    if (rect.width < 2 || rect.height < 2) return;
    this.text(rect.x, rect.y, tl! + h!.repeat(rect.width - 2) + tr!, style);
    this.text(rect.x, rect.y + rect.height - 1, bl! + h!.repeat(rect.width - 2) + br!, style);
    for (let y = rect.y + 1; y < rect.y + rect.height - 1; y++) {
      this.text(rect.x, y, v!, style);
      this.text(rect.x + rect.width - 1, y, v!, style);
    }
  }

  lines(): string[] {
    return this.cells.map((row) => row.map((cell) => cell.text).join(""));
  }
}

function ansi(style: Style, trueColor: boolean, palette: PaletteId): string {
  const colors = palettes[palette];
  const resolved = colors.styles.get(style) ?? style;
  if (trueColor) return `\x1b[38;2;${colors.colors[resolved.fg]};48;2;${colors.colors[resolved.bg]}m`;
  const fg = colors.ansi[resolved.fg]!, bg = colors.ansi[resolved.bg]!;
  return `\x1b[${fg < 8 ? 30 + fg : 90 + fg - 8};${bg < 8 ? 40 + bg : 100 + bg - 8}m`;
}

export class Renderer {
  private previous: string[] = [];
  private size = "";

  frame(canvas: Canvas, color = true, trueColor = false): string {
    const size = `${canvas.width}:${canvas.height}:${color}:${trueColor}:${canvas.palette}`;
    let output = size !== this.size ? "\x1b[2J" : "";
    if (size !== this.size) this.previous = [];
    this.size = size;
    const next: string[] = [];
    for (let y = 0; y < canvas.height; y++) {
      let line = "";
      let current = "";
      for (const cell of canvas.cells[y]!) {
        if (cell.width === 0) continue;
        const inverted = cell.style === theme.focused || cell.style === theme.selected || cell.style === theme.selectedHotkey || cell.style === theme.menuSelection;
        const mnemonic = cell.style === theme.menuHotkey || cell.style === theme.selectedHotkey;
        const dim = cell.style === theme.disabled || cell.style === theme.inactiveTitle;
        const code = color ? ansi(cell.style, trueColor, canvas.palette) : (inverted ? "\x1b[7m" : "\x1b[27m") + (mnemonic ? "\x1b[4m" : "\x1b[24m") + (dim ? "\x1b[2m" : "\x1b[22m");
        if (code !== current) { line += code; current = code; }
        line += cell.text;
      }
      next.push(line);
      if (line !== this.previous[y]) output += `\x1b[${y + 1};1H${line}`;
    }
    this.previous = next;
    return output + (output ? "\x1b[0m" : "");
  }
}
