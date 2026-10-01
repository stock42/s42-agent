import { Renderer } from "./canvas.ts";
import type { Desktop } from "./desktop.ts";
import { InputParser } from "./input-parser.ts";

// Request distinguishable Shift+Enter; unsupported terminals ignore these modes.
const enter = "\x1b[?1049h\x1b[?25l\x1b[?2004h\x1b[>4;2m\x1b[>1u";
const mouseOn = "\x1b[?1003h\x1b[?1006h";
const leave = "\x1b[<u\x1b[>4m\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[0m\x1b[?25h\x1b[?1049l";

export function runTerminal(desktop: Desktop, options: { color: boolean; mouse: boolean }): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb") {
    return Promise.reject(new Error("La demo necesita un terminal interactivo. Usa --help para ver las opciones."));
  }
  return new Promise((resolve, reject) => {
    const renderer = new Renderer();
    const trueColor = /^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? "");
    const wasRaw = process.stdin.isRaw;
    let done = false;
    let frameTimer: ReturnType<typeof setTimeout> | undefined;
    let escapeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastFrame = 0;

    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(frameTimer); clearTimeout(escapeTimer);
      process.stdin.off("data", data); process.stdout.off("resize", resize);
      process.off("SIGINT", stop); process.off("SIGTERM", stop);
      process.stdin.setRawMode(wasRaw ?? false); process.stdin.pause();
      process.stdout.write(leave);
      desktop.invalidate = () => {};
      Promise.resolve().then(() => desktop.onBeforeExit?.()).then(() => error ? reject(error) : resolve(), reject);
    };
    const frame = () => {
      frameTimer = undefined;
      if (done) return;
      try {
        // A full last row must not scroll the terminal at the bottom-right cell.
        const output = renderer.frame(desktop.draw(), options.color, trueColor);
        if (output) process.stdout.write(`\x1b[?7l${output}\x1b[?7h`);
        lastFrame = performance.now();
      } catch (error) { finish(error); }
    };
    const requestFrame = () => {
      if (!done && !frameTimer) frameTimer = setTimeout(frame, Math.max(0, Math.ceil(1000 / 30 - (performance.now() - lastFrame))));
    };
    const parser = new InputParser((event) => {
      try { if (desktop.handle(event)) requestFrame(); } catch (error) { finish(error); }
    });
    const data = (chunk: Buffer) => {
      clearTimeout(escapeTimer);
      parser.feed(chunk);
      if (parser.waitingForEscape) escapeTimer = setTimeout(() => parser.flushEscape(), 35);
    };
    const resize = () => { desktop.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24); requestFrame(); };
    const stop = () => finish();
    desktop.onExit = stop;
    desktop.invalidate = requestFrame;
    try {
      process.stdin.setRawMode(true); process.stdin.resume();
      process.stdin.on("data", data); process.stdout.on("resize", resize);
      process.on("SIGINT", stop); process.on("SIGTERM", stop);
      process.stdout.write(enter + (options.mouse ? mouseOn : ""));
      desktop.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24); desktop.onStart?.(); frame();
    } catch (error) { finish(error); }
  });
}
