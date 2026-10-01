import { describe, expect, test } from "bun:test";
import { InputParser } from "../src/ui/input-parser.ts";
import type { InputEvent } from "../src/ui/types.ts";

describe("input del terminal", () => {
  test("SGR, paste y UTF-8 partidos en cada byte conservan los eventos", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser((event) => events.push(event));
    const data = new TextEncoder().encode("á文🙂\x1b[<0;12;7M\x1b[<32;13;8M\x1b[<0;13;8m\x1b[<65;4;9M\x1b[200~\t\x1b[Apegado\x1b[201~\x1b[1;5A");
    for (const byte of data) parser.feed(new Uint8Array([byte]));
    expect(events).toEqual([
      { type: "key", key: "á", text: "á" }, { type: "key", key: "文", text: "文" }, { type: "key", key: "🙂", text: "🙂" },
      { type: "mouse", action: "press", x: 11, y: 6, button: 0, delta: 0 },
      { type: "mouse", action: "move", x: 12, y: 7, button: 0, delta: 0 },
      { type: "mouse", action: "release", x: 12, y: 7, button: 0, delta: 0 },
      { type: "mouse", action: "wheel", x: 3, y: 8, button: 1, delta: 1 },
      { type: "paste", text: "\t\x1b[Apegado" }, { type: "key", key: "ctrl+up" },
    ]);
  });

  test("Escape aislado se resuelve; secuencias CSI desconocidas no bloquean el texto", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser((event) => events.push(event));
    parser.feed("\x1b"); expect(parser.waitingForEscape).toBe(true); parser.flushEscape();
    parser.feed("\x1b[>0c\x1b[21;2~\x1ba\t\x03x");
    expect(events.map((event) => event.type === "key" ? event.key : event.type)).toEqual(["escape", "shift+f10", "alt+a", "tab", "ctrl+c", "x"]);
  });
});
