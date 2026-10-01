import { version } from "./package.json";
import type { CliOptions } from "./src/cli.ts";

export function parseArgs(args: string[]): CliOptions & { demo: boolean; color: boolean; mouse: boolean; help: boolean; version: boolean } {
  const options: ReturnType<typeof parseArgs> = { demo: false, color: true, mouse: true, help: false, version: false };
  const names = { "--config": "config", "--project": "project", "--cwd": "cwd", "--provider": "provider", "--model": "model", "--session": "session",
    "--llm_server": "llmServer", "--llm_apikey": "llmApiKey", "--prompting": "prompting" } as const;
  for (let i = 0; i < args.length; i++) {
    const raw = args[i]!, equals = raw.indexOf("="), arg = equals < 0 ? raw : raw.slice(0, equals);
    if (["--demo", "--no-color", "--no-mouse", "--help", "-h", "--version"].includes(arg)) {
      if (equals >= 0) throw new Error(`${arg} no recibe un valor`);
      if (arg === "--demo") options.demo = true;
      else if (arg === "--no-color") options.color = false;
      else if (arg === "--no-mouse") options.mouse = false;
      else if (arg === "--version") options.version = true;
      else options.help = true;
    } else if (Object.hasOwn(names, arg) || arg === "--llm_port" || arg === "--reasoning") {
      const value = equals < 0 ? args[++i] : raw.slice(equals + 1);
      if (!value?.trim() || (equals < 0 && value.startsWith("--"))) throw new Error(`Falta valor para ${arg}`);
      if (arg === "--llm_port") {
        if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("--llm_port requiere un entero entre 1 y 65535");
        options.llmPort = Number(value);
      } else if (arg === "--reasoning") {
        if (value !== "on" && value !== "off") throw new Error("--reasoning requiere on u off");
        options.reasoning = value;
      } else options[names[arg as keyof typeof names]] = value;
    } else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (options.help || options.version) return options;
  if (options.project && options.cwd) throw new Error("Usá --project o --cwd, no ambos");
  if (options.demo && options.prompting !== undefined) throw new Error("--demo no se puede combinar con --prompting");
  if (options.prompting === undefined && [options.llmServer, options.llmPort, options.llmApiKey, options.reasoning].some(value => value !== undefined))
    throw new Error("--llm_server, --llm_port, --llm_apikey y --reasoning requieren --prompting para ejecutar sin TUI");
  return options;
}

// Keep startup inside an async function for Bun bytecode compilation.
async function main():Promise<void> {
  try {
    if (Bun.argv.length === 3 && Bun.argv[2] === "--internal-shell") {
      const { shellWorker } = await import("./src/system/shell-worker.ts");
      await shellWorker(); return;
    }
    const options = parseArgs(Bun.argv.slice(2));
    if (options.help) {
      console.log(`s42-agent ${version} · TUI estilo QBasic

Uso: s42-agent [--config archivo] [--project nombre | --cwd carpeta]
CLI: s42-agent --prompting "pedido" [--llm_server host] [--llm_port puerto]

  --no-color   Desactivar colores
  --no-mouse   Usar solamente el teclado
  --version    Mostrar versión
  --help       Mostrar ayuda
  --demo       Abrir la demo sin datos persistentes ni proveedor
  --config     Configuración JSON; sesiones junto al archivo
  --project    Abrir proyecto registrado por nombre o ID
  --cwd        Abrir/registrar carpeta de proyecto
  --session    Reabrir sesión por ID
  --provider   Elegir proveedor registrado
  --model      Elegir ID real del modelo
  --prompting  Ejecutar el pedido sin TUI; respuesta por stdout
  --llm_server Host o URL base HTTP/HTTPS (sin path: usa /v1)
  --llm_port   Puerto del servidor (1–65535)
  --llm_apikey API key de esta ejecución; no se guarda
  --reasoning  on | off: mostrar/ocultar razonamiento recibido por stderr

CLI: tools, errores, sesión y tokens por stderr; Ctrl+C cancela.
Sin --model usa el configurado o el primero disponible en /models.

Enter: enviar · Shift+Enter: nueva línea · Esc: NORMAL/menú
Tab: foco · Ctrl+N: panel · Alt+←/→: pestañas · Alt+1…9: proyecto
Alt+T: promptings · Alt+Y: ayuda · Ctrl+W: cerrar · Ctrl+Q: salir`);
      return;
    }
    if (options.version) { console.log(version); return; }
    if (options.prompting !== undefined) {
      const { runCli } = await import("./src/cli.ts");
      process.exitCode = await runCli(options); return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb") throw new Error("s42-agent necesita un terminal interactivo. Usa --help para ver las opciones.");
    const { App } = await import("./src/app.ts");
    const { runTerminal } = await import("./src/ui/terminal.ts");
    const { createWorkspace } = await import("./src/ui/workspace.ts");
    const app = options.demo ? undefined : await App.open(options);
    await runTerminal(app?.desktop ?? createWorkspace(), { color: options.color && process.env.NO_COLOR === undefined && app?.store.value.ui.color !== "never", mouse: options.mouse });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    Bun.WebView.closeAll();
  }
}

if(import.meta.main)void main();
