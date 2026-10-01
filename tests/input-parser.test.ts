import { describe, expect, test } from "bun:test";
import { InputParser } from "../src/ui/input-parser.ts";
import type { InputEvent } from "../src/ui/types.ts";

describe("input del terminal", () => {
  test("Shift+Enter CSI-u y modifyOtherKeys fragmentados se distinguen de Enter", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser(event => events.push(event));
    const data = new TextEncoder().encode("\r\x1b[13;2u\x1b[27;2;13~\x1b[13;2:1u\x1b[13;2:3u\x1b[57414;2u\n");
    for (const byte of data) parser.feed(new Uint8Array([byte]));
    expect(events).toEqual([
      { type: "key", key: "enter" }, { type: "key", key: "shift+enter" },
      { type: "key", key: "shift+enter" }, { type: "key", key: "shift+enter" },
      { type: "key", key: "shift+enter" }, { type: "key", key: "ctrl+j" },
    ]);
  });

  test("teclado extendido conserva atajos, texto, Tab, Escape y navegación", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser(event => events.push(event));
    parser.feed("\x1b[113;5u\x1b[27;5;99~\x1b[121;3u\x1b[9;2u\x1b[27u\x1b[27;2;65~\x1b[57417u\x1b[57358u\x1b[57376u");
    expect(events).toEqual([
      { type: "key", key: "ctrl+q" }, { type: "key", key: "ctrl+c" },
      { type: "key", key: "alt+y" }, { type: "key", key: "shift+tab" },
      { type: "key", key: "escape" }, { type: "key", key: "shift+a", text: "A" },
      { type: "key", key: "left" },
    ]);
  });

  test("SGR, paste y UTF-8 partidos en cada byte conservan los eventos", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser((event) => events.push(event));
    const data = new TextEncoder().encode("á文🙂\x1b[<0;12;7M\x1b[<32;13;8M\x1b[<0;13;8m\x1b[<35;14;1M\x1b[<65;4;9M\x1b[200~\t\x1b[Apegado\x1b[201~\x1b[1;5A");
    for (const byte of data) parser.feed(new Uint8Array([byte]));
    expect(events).toEqual([
      { type: "key", key: "á", text: "á" }, { type: "key", key: "文", text: "文" }, { type: "key", key: "🙂", text: "🙂" },
      { type: "mouse", action: "press", x: 11, y: 6, button: 0, delta: 0 },
      { type: "mouse", action: "move", x: 12, y: 7, button: 0, delta: 0 },
      { type: "mouse", action: "release", x: 12, y: 7, button: 0, delta: 0 },
      { type: "mouse", action: "move", x: 13, y: 0, button: 3, delta: 0 },
      { type: "mouse", action: "wheel", x: 3, y: 8, button: 1, delta: 1 },
      { type: "paste", text: "\t\x1b[Apegado" }, { type: "key", key: "ctrl+up" },
    ]);
  });

  test("Escape aislado se resuelve; secuencias CSI desconocidas no bloquean el texto", () => {
    const events: InputEvent[] = [];
    const parser = new InputParser((event) => events.push(event));
    parser.feed("\x1b"); expect(parser.waitingForEscape).toBe(true); parser.flushEscape();
    parser.feed("\x1b[>0c\x1bOP\x1bOQ\x1bOR\x1bOS\x1b[15~\x1b[17~\x1b[18~\x1b[19~\x1b[20~\x1b[21;2~\x1b[23~\x1b[24~\x1ba\t\x03x");
    expect(events.map((event) => event.type === "key" ? event.key : event.type)).toEqual(["escape", "alt+a", "tab", "ctrl+c", "x"]);
  });
});
