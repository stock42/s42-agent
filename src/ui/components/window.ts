import type { Canvas } from "../canvas.ts";
import { theme } from "../theme.ts";
import { contains, intersect, type Rect } from "../types.ts";
import type { Component } from "./component.ts";

export class Window {
  readonly controls: Component[] = [];
  focusedId?: string;
  closePressed = false;
  modal = false;
  onLayout?: (client: Rect) => void;
  onDraw?: (canvas: Canvas, client: Rect) => void;
  readonly preferred: { width: number; height: number };

  constructor(readonly id: string, public title: string, public bounds: Rect) {
    this.preferred = { width: bounds.width, height: bounds.height };
  }

  get client(): Rect {
    return { x: this.bounds.x + 1, y: this.bounds.y + 1, width: this.bounds.width - 2, height: this.bounds.height - 2 };
  }

  get closeRect(): Rect {
    return { x: this.bounds.x + this.bounds.width - 5, y: this.bounds.y, width: 3, height: 1 };
  }

  controlRect(control: Component): Rect {
    return { ...control.bounds, x: this.client.x + control.bounds.x, y: this.client.y + control.bounds.y };
  }

  controlAt(x: number, y: number): Component | undefined {
    return this.controls.findLast((control) => contains(intersect(this.controlRect(control), this.client), x, y));
  }

  focusable(): Component[] {
    return this.controls.filter((control) => !control.disabled && intersect(this.controlRect(control), this.client).width > 0
      && intersect(this.controlRect(control), this.client).height > 0);
  }

  draw(canvas: Canvas, active: boolean): void {
    const style = this.modal ? theme.dialog : theme.window;
    canvas.fill({ ...this.bounds, x: this.bounds.x + 2, y: this.bounds.y + 1 }, theme.shadow);
    canvas.fill(this.bounds, style);
    canvas.box(this.bounds, style, active);
    const titleStyle = active ? theme.title : theme.inactiveTitle;
    canvas.fill({ ...this.bounds, height: 1 }, titleStyle);
    canvas.text(this.bounds.x + 1, this.bounds.y, ` ${this.title} `, titleStyle, this.bounds.width - 7);
    canvas.text(this.closeRect.x, this.closeRect.y, "[X]", this.closePressed ? theme.selected : titleStyle);
    canvas.clipped(this.client, () => {
      this.onDraw?.(canvas, this.client);
      for (const control of this.controls) {
        const rect = this.controlRect(control);
        canvas.clipped(rect, () => control.draw(canvas, rect, active && control.id === this.focusedId));
      }
    });
  }
}
