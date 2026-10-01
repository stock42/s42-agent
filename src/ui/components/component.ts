import type { Canvas } from "../canvas.ts";
import type { InputEvent, Rect } from "../types.ts";

export abstract class Component {
  disabled = false;
  constructor(readonly id: string, public bounds: Rect) {}
  abstract draw(canvas: Canvas, bounds: Rect, focused: boolean): void;
  abstract handle(event: InputEvent): boolean;
}
