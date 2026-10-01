import { Canvas } from "./canvas.ts";
import type { Component } from "./components/component.ts";
import { MenuBar } from "./components/menu.ts";
import { Window } from "./components/window.ts";
import { theme } from "./theme.ts";
import { contains, type InputEvent, type Rect } from "./types.ts";

type Capture = { window: Window; control: Component } | { window: Window; close: true }
  | { window: Window; offsetX: number; offsetY: number };

export class Desktop {
  readonly windows: Window[] = [];
  active?: Window;
  status = "Demo de componentes · Bun";
  onExit: () => void = () => {};
  onHelp: () => void = () => {};
  onResize?: (width: number, height: number) => void;
  floatingArea?: Rect;
  private capture?: Capture;

  constructor(readonly menu: MenuBar, public width = 80, public height = 24) { menu.resize(width, height); }

  get modal(): Window | undefined { return this.windows.findLast((window) => window.modal); }

  add(window: Window): void {
    this.cancelCapture();
    this.menu.close(); this.windows.push(window); this.active = window;
    this.fit(window); window.onLayout?.(window.client); this.ensureFocus(window);
  }

  close(window = this.active): void {
    if (!window || window.fixed || (this.modal && window !== this.modal)) return;
    const index = this.windows.indexOf(window);
    if (index < 0) return;
    this.windows.splice(index, 1);
    if (this.capture?.window === window) this.cancelCapture();
    if (this.active === window) this.active = this.modal ?? this.windows.at(-1);
    this.status = `Ventana cerrada: ${window.title}`;
  }

  private fit(window: Window): void {
    if (window.fixed) return;
    const area = this.floatingArea ?? { x: 0, y: 1, width: this.width, height: this.height - 2 };
    window.bounds.width = Math.min(window.preferred.width, Math.max(2, area.width - 2));
    window.bounds.height = Math.min(window.preferred.height, Math.max(2, area.height));
    window.bounds.x = Math.max(area.x, Math.min(window.bounds.x, area.x + area.width - window.bounds.width));
    window.bounds.y = Math.max(area.y, Math.min(window.bounds.y, area.y + area.height - window.bounds.height));
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width); this.height = Math.max(1, height); this.menu.resize(this.width, this.height);
    this.onResize?.(this.width, this.height);
    for (const window of this.windows) { this.fit(window); window.onLayout?.(window.client); this.ensureFocus(window); }
  }

  private ensureFocus(window: Window): void {
    const controls = window.focusable();
    if (!controls.some((control) => control.id === window.focusedId)) window.focusedId = controls[0]?.id;
  }

  private raise(window: Window): void {
    const index = this.windows.indexOf(window);
    this.windows.splice(index, 1); this.windows.push(window); this.active = window;
    this.ensureFocus(window);
  }

  focus(window: Window): void {
    if (!this.windows.includes(window) || (this.modal && this.modal !== window)) return;
    this.cancelCapture(); this.menu.close(); this.raise(window);
  }

  cycle(): void {
    if (this.modal || this.windows.length < 2) return;
    this.cancelCapture();
    const next = this.windows[0]!; this.raise(next);
  }

  private local(event: Extract<InputEvent, { type: "mouse" }>, window: Window, control: Component): InputEvent {
    const rect = window.controlRect(control);
    return { ...event, x: event.x - rect.x, y: event.y - rect.y };
  }

  private cancelCapture(): void {
    const capture = this.capture;
    this.capture = undefined;
    if (!capture) return;
    if ("control" in capture) capture.control.handle({ type: "mouse", action: "release", x: -1, y: -1, button: 0, delta: 0 });
    if ("close" in capture) capture.window.closePressed = false;
  }

  handle(event: InputEvent): boolean {
    if (event.type === "key" && (event.key === "ctrl+q" || event.key === "ctrl+c")) { this.onExit(); return false; }
    if (this.width < 60 || this.height < 16) return false;
    if (event.type === "mouse" && this.capture) {
      const capture = this.capture;
      if (event.action === "release" && event.button === 0) {
        this.capture = undefined;
        if ("control" in capture) {
          const local = this.local(event, capture.window, capture.control);
          capture.control.handle(contains(capture.window.client, event.x, event.y) ? local : { ...event, x: -1, y: -1 });
        }
        else if ("close" in capture) {
          capture.window.closePressed = false;
          if (contains(capture.window.closeRect, event.x, event.y)) this.close(capture.window);
        }
        return true;
      }
      if (event.action === "move") {
        if ("control" in capture) return capture.control.handle(this.local(event, capture.window, capture.control));
        if ("close" in capture) {
          const inside = contains(capture.window.closeRect, event.x, event.y);
          const changed = inside !== capture.window.closePressed; capture.window.closePressed = inside; return changed;
        }
        const before = `${capture.window.bounds.x}:${capture.window.bounds.y}`;
        capture.window.bounds.x = event.x - capture.offsetX; capture.window.bounds.y = event.y - capture.offsetY;
        this.fit(capture.window); return before !== `${capture.window.bounds.x}:${capture.window.bounds.y}`;
      }
      return false;
    }
    if (event.type === "key") {
      if (event.key === "alt+y" && !this.modal) { this.cancelCapture(); this.menu.close(); this.onHelp(); return true; }
      if (event.key === "ctrl+n" && !this.modal) { this.menu.close(); this.cycle(); return true; }
      if (event.key === "ctrl+w" || (event.key === "escape" && this.modal)) { this.menu.close(); this.close(); return true; }
    }
    // An open menu owns input even when moving over the same option changes no pixels.
    const menuWasOpen = this.menu.opened >= 0;
    if (!this.modal && this.menu.handle(event)) { this.cancelCapture(); return true; }
    if (!this.modal && menuWasOpen) return false;
    if (event.type === "key") {
      const window = this.active;
      if (!window) return false;
      if (event.key === "tab" || event.key === "shift+tab") {
        const controls = window.focusable();
        if (!controls.length) return false;
        const current = controls.findIndex((control) => control.id === window.focusedId);
        window.focusedId = controls[(current + (event.key === "tab" ? 1 : -1) + controls.length) % controls.length]!.id;
        return true;
      }
    }
    if (event.type !== "mouse") return this.active?.controls.find((control) => control.id === this.active?.focusedId)?.handle(event) ?? false;
    const window = this.modal ?? this.windows.findLast((candidate) => contains(candidate.bounds, event.x, event.y));
    if (!window || !contains(window.bounds, event.x, event.y)) return false;
    if (event.action === "wheel") {
      const control = window.controlAt(event.x, event.y);
      return control?.handle(this.local(event, window, control)) ?? false;
    }
    if (event.action !== "press" || event.button !== 0) return false;
    this.raise(window);
    if (!window.fixed && contains(window.closeRect, event.x, event.y)) {
      window.closePressed = true; this.capture = { window, close: true }; return true;
    }
    if (!window.fixed && event.y === window.bounds.y) {
      this.capture = { window, offsetX: event.x - window.bounds.x, offsetY: event.y - window.bounds.y }; return true;
    }
    const control = window.controlAt(event.x, event.y);
    if (control && !control.disabled) {
      window.focusedId = control.id; this.capture = { window, control };
      control.handle(this.local(event, window, control));
    }
    return true;
  }

  draw(): Canvas {
    const canvas = new Canvas(this.width, this.height);
    if (this.width < 60 || this.height < 16) {
      canvas.text(1, 1, "Terminal pequeño: mínimo 60 × 16", theme.window, this.width - 2);
      canvas.text(1, 3, "Ctrl+Q para salir", theme.window, this.width - 2);
      return canvas;
    }
    canvas.clipped({ x: 0, y: 1, width: this.width, height: this.height - 2 }, () => {
      if (!this.windows.length) canvas.text(2, 3, "Esc → Ventanas → Componentes para volver", theme.window, this.width - 4);
      for (const window of this.windows) {
        window.onLayout?.(window.client); this.ensureFocus(window);
        if (!window.fixed && this.floatingArea) canvas.clipped(this.floatingArea, () => window.draw(canvas, window === this.active));
        else window.draw(canvas, window === this.active);
      }
    });
    this.menu.draw(canvas);
    const footer = this.height - 1;
    canvas.fill({ x: 0, y: footer, width: this.width, height: 1 }, theme.menu);
    const hints = this.menu.opened >= 0 ? "←/→ Menú  ↑/↓ Opción  Enter Elegir  Esc Cerrar  ^Q Salir"
      : this.modal ? "Tab Foco  Enter Aceptar  Esc Cerrar  ^Q Salir"
      : this.active?.fixed ? "Esc Menú  Tab Foco  ^N Panel  Alt+Y Ayuda  ^Q Salir"
      : "Esc Menú  Tab Foco  ^N Ventana  ^W Cerrar  ^Q Salir";
    canvas.text(1, footer, hints, theme.menu, this.width - 2);
    return canvas;
  }
}
