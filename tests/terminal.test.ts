import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const command = process.env.S42_TEST_BINARY ? [resolve(process.env.S42_TEST_BINARY)] : [process.execPath, `${root}/index.ts`];
const { NO_COLOR: inheritedNoColor, ...inheritedEnv } = process.env;
const env = { ...inheritedEnv, TERM: "xterm-256color", COLORTERM: "truecolor" };

async function until(check: () => boolean, timeout = 3000): Promise<void> {
  const deadline = performance.now() + timeout;
  while (!check()) {
    if (performance.now() > deadline) throw new Error("Timeout esperando respuesta del terminal");
    await Bun.sleep(5);
  }
}

function session(args: string[] = [], cmd = command) {
  let output = "";
  const decoder = new TextDecoder();
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => { output += decoder.decode(data, { stream: true }); } });
  const child = Bun.spawn([...cmd, ...args], { cwd: "/tmp", env, terminal });
  return { child, terminal, get output() { return output; }, dispose() { child.kill(); terminal.close(); } };
}

describe(process.env.S42_TEST_BINARY ? "binario en PTY fuera del checkout" : "entrypoint Bun en PTY", () => {
  test("no TTY y ayuda devuelven mensajes limpios", async () => {
    const help = Bun.spawn([...command, "--help"], { cwd: "/tmp", env, stdout: "pipe", stderr: "pipe" });
    expect(await new Response(help.stdout).text()).toContain("Demo TUI estilo QBasic"); expect(await help.exited).toBe(0);
    const noTTY = Bun.spawn(command, { cwd: "/tmp", env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const error = await new Response(noTTY.stderr).text();
    expect(error).toContain("terminal interactivo"); expect(error).not.toContain("\x1b"); expect(await noTTY.exited).toBe(1);
  });

  test("prompt, respuesta en editor, componentes, modal y resize producen frames reales", async () => {
    const run = session();
    try {
      await until(() => run.output.includes("Demo sin LLM"));
      expect(run.output).toContain("\x1b[?1006h");
      expect(run.output).toContain("\x1b[?1003h");
      expect(run.output).toContain("48;2;0;0;170m");
      expect(run.output).toContain("48;2;0;170;170m");
      // Pegar no envía: el botón Enviar comparte la acción de Enter.
      run.terminal.write("\x1b[200~á文🙂\nSegunda línea\x1b[201~");
      await until(() => run.output.includes("Segunda línea"));
      expect(run.output).not.toContain("Respuesta de demostración");
      run.terminal.write("\x1b[<0;66;18M\x1b[<0;66;18m");
      await until(() => run.output.includes("Respuesta de demostración · tmp"));
      expect(run.output).toContain("á文🙂");
      run.terminal.write("\x1b[200~borrador pendiente\x1b[201~");
      await until(() => run.output.includes("borrador pendiente"));
      // El laboratorio sigue disponible dentro del área del editor.
      run.terminal.write("\x1bd\r");
      await until(() => run.output.includes("Laboratorio TUI"));
      run.terminal.write("\x1b[<0;59;8M\x1b[<0;59;8m");
      await until(() => run.output.includes("Aceptar (1): s42-agent"));
      run.terminal.write("\x1b[<0;11;6M\x1b[<0;11;6m\x01\x1b[200~proyecto-local\x1b[201~");
      await until(() => run.output.includes("Nombre: proyecto-local"));
      const beforePanel = run.output.length; run.terminal.write("\x0e");
      await until(() => run.output.slice(beforePanel).includes("^N Panel"));
      const beforeReturn = run.output.length; run.terminal.write("\x1bd\r");
      await until(() => run.output.slice(beforeReturn).includes("proyecto-local"));
      // Abrir ayuda mientras el desplegable sigue abierto.
      const beforeHelp = run.output.length;
      run.terminal.write("\x1b");
      await until(() => run.output.slice(beforeHelp).includes("Ctrl+Q"));
      run.terminal.write("\x1by");
      await until(() => run.output.slice(beforeHelp).includes("Ctrl+A / Shift+flechas"));
      run.terminal.write("\x1b"); await Bun.sleep(80);
      for (const [cols, rows] of [[120, 40], [60, 16], [80, 24]] as const) {
        const beforeResize = run.output.length;
        run.terminal.resize(cols, rows);
        // Bun.Terminal 1.4.2 cambia el tamaño del PTY, pero en este entorno no
        // notifica al hijo automáticamente. El emulador real sí envía SIGWINCH.
        run.child.kill("SIGWINCH");
        await until(() => run.output.slice(beforeResize).includes(`\x1b[${rows};1H`));
        const resized = run.output.slice(beforeResize);
        expect(resized).toContain("\x1b[2J");
        if (rows === 16) expect(resized).not.toMatch(/\x1b\[(?:1[7-9]|2\d);1H/);
      }
      run.terminal.write("\x11");
      expect(await run.child.exited).toBe(0);
      await until(() => run.output.includes("\x1b[?1049l"));
      expect(run.output).toContain("\x1b[?1006l"); expect(run.output).toContain("\x1b[?25h");
      expect(run.output).toContain("\x1b[?1003l");
    } finally { run.dispose(); }
  });

  test("idle 10 s emite cero bytes y SIGTERM restaura modos", async () => {
    const run = session();
    try {
      await until(() => run.output.includes("\x1b[24;1H")); await Bun.sleep(60);
      const start = run.output.length; await Bun.sleep(10_000);
      expect(run.output.length).toBe(start);
      run.child.kill("SIGTERM"); expect(await run.child.exited).toBe(0);
      await until(() => run.output.includes("\x1b[?1049l"));
      expect(run.output).toContain("\x1b[?1002l");
    } finally { run.dispose(); }
  }, 15_000);

  test("Ctrl+C restaura raw mode y --no-color/--no-mouse siguen usables", async () => {
    // Ejecutable y paths se pasan como argumentos de bash, nunca interpolados en código shell.
    const wrapper = ["/usr/bin/bash", "-c", 'printf "BEFORE:%s\\n" "$(stty -g)"; "$@" --no-color --no-mouse; printf "AFTER:%s\\n" "$(stty -g)"', "pty-check", ...command];
    const run = session([], wrapper);
    try {
      await until(() => run.output.includes("Demo sin LLM"));
      expect(run.output).not.toContain("\x1b[?1006h");
      expect(run.output).not.toMatch(/\x1b\[(?:3\d|4\d|9\d|10\d)[;\dm]/);
      expect(run.output).toContain("\x1b[7m");
      const beforeFocus = run.output.length; run.terminal.write("\t");
      await until(() => run.output.slice(beforeFocus).includes("< Enviar >"));
      expect(run.output.slice(beforeFocus)).toContain("\x1b[7m");
      run.terminal.write("\x03"); expect(await run.child.exited).toBe(0);
      await until(() => run.output.includes("AFTER:"));
      expect(run.output.match(/BEFORE:([^\r\n]+)/)?.[1]).toBe(run.output.match(/AFTER:([^\r\n]+)/)?.[1]);
    } finally { run.dispose(); }
  });
});

test("un fallo de render restaura terminal y propaga el error", async () => {
  const source = `import {createDemo} from ${JSON.stringify(`${root}/src/ui/demo.ts`)};
import {runTerminal} from ${JSON.stringify(`${root}/src/ui/terminal.ts`)};
const desktop=createDemo(); const draw=desktop.draw.bind(desktop); let count=0;
desktop.draw=()=>{if(++count>1) throw new Error('fallo-controlado'); return draw()};
try {await runTerminal(desktop,{color:true,mouse:true})} catch(e){console.error(e.message);process.exitCode=1}`;
  const run = session([], [process.execPath, "-e", source]);
  try {
    await until(() => run.output.includes("Laboratorio TUI")); run.terminal.write("\t");
    expect(await run.child.exited).toBe(1);
    await until(() => run.output.includes("fallo-controlado"));
    expect(run.output.indexOf("\x1b[?1049l")).toBeLessThan(run.output.indexOf("fallo-controlado"));
    expect(run.output).toContain("\x1b[?25h");
  } finally { run.dispose(); }
});
