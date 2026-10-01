export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type InputEvent =
  | { type: "key"; key: string; text?: string }
  | { type: "paste"; text: string }
  | {
      type: "mouse";
      action: "press" | "release" | "move" | "wheel";
      x: number;
      y: number;
      button: number;
      delta: number;
    };

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}

const segmenter = new Intl.Segmenter("es", { granularity: "grapheme" });
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}
