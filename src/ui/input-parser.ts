import type { InputEvent } from "./types.ts";

const simpleKeys: Record<string, string> = {
  "\r": "enter", "\n": "ctrl+j", "\t": "tab", "\x7f": "backspace", "\b": "backspace",
};
const csiKeys: Record<string, string> = {
  A: "up", B: "down", C: "right", D: "left", H: "home", F: "end", Z: "shift+tab",
  "1~": "home", "2~": "insert", "3~": "delete", "4~": "end", "5~": "pageup", "6~": "pagedown",
};

export class InputParser {
  private buffer = "";
  private paste = false;
  private decoder = new TextDecoder();

  constructor(private emit: (event: InputEvent) => void) {}

  get waitingForEscape(): boolean { return !this.paste && this.buffer === "\x1b"; }

  flushEscape(): void {
    if (this.waitingForEscape) { this.buffer = ""; this.emit({ type: "key", key: "escape" }); }
  }

  feed(data: string | Uint8Array): void {
    this.buffer += typeof data === "string" ? data : this.decoder.decode(data, { stream: true });
    while (this.buffer) {
      if (this.paste) {
        const end = this.buffer.indexOf("\x1b[201~");
        if (end < 0) return;
        this.emit({ type: "paste", text: this.buffer.slice(0, end) });
        this.buffer = this.buffer.slice(end + 6);
        this.paste = false;
        continue;
      }
      if (this.buffer.startsWith("\x1b[200~")) {
        this.buffer = this.buffer.slice(6); this.paste = true; continue;
      }
      if (this.buffer[0] === "\x1b") {
        if (this.buffer.length === 1) return;
        if (this.buffer[1] === "[") {
          const sequence = this.buffer.match(/^\x1b\[([\x30-\x3f]*)[\x20-\x2f]*([\x40-\x7e])/);
          if (!sequence) {
            if (/^\x1b\[[\x20-\x3f]*$/.test(this.buffer)) return;
            this.buffer = this.buffer.slice(2); continue;
          }
          this.buffer = this.buffer.slice(sequence[0].length);
          const params = sequence[1]!;
          const final = sequence[2]!;
          const mouse = params.match(/^<(\d+);(\d+);(\d+)$/);
          if (mouse && (final === "M" || final === "m")) {
            const code = Number(mouse[1]);
            this.emit({ type: "mouse", action: code & 64 ? "wheel" : final === "m" ? "release" : code & 32 ? "move" : "press",
              x: Number(mouse[2]) - 1, y: Number(mouse[3]) - 1, button: code & 3,
              delta: code & 64 ? (code & 1 ? 1 : -1) : 0 });
            continue;
          }
          let key = csiKeys[params.split(";")[0] + final] ?? csiKeys[final];
          const modifier = params.includes(";") ? Number(params.split(";").at(-1)) - 1 : 0;
          if (key && modifier > 0 && key !== "shift+tab") {
            key = (modifier & 4 ? "ctrl+" : "") + (modifier & 2 ? "alt+" : "") + (modifier & 1 ? "shift+" : "") + key;
          }
          if (key) this.emit({ type: "key", key });
          continue;
        }
        if (this.buffer[1] === "O") {
          if (this.buffer.length < 3) return;
          const key = ({ A: "up", B: "down", C: "right", D: "left", H: "home", F: "end" } as Record<string, string>)[this.buffer[2]!];
          this.buffer = this.buffer.slice(3);
          if (key) this.emit({ type: "key", key });
          continue;
        }
        const char = Array.from(this.buffer.slice(1))[0]!;
        this.buffer = this.buffer.slice(1 + char.length);
        this.emit({ type: "key", key: `alt+${char.toLowerCase()}` });
        continue;
      }
      const char = Array.from(this.buffer)[0]!;
      this.buffer = this.buffer.slice(char.length);
      const key = simpleKeys[char] ?? (char.charCodeAt(0) < 32 ? `ctrl+${String.fromCharCode(char.charCodeAt(0) + 96)}` : char);
      this.emit(char.charCodeAt(0) >= 32 && char !== "\x7f" ? { type: "key", key, text: char } : { type: "key", key });
    }
  }
}
