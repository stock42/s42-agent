import { createWorkspace } from "./src/ui/workspace.ts";
import { runTerminal } from "./src/ui/terminal.ts";
import { version } from "./package.json";
import { App, type AppOptions } from "./src/app.ts";

export function parseArgs(args: string[]): AppOptions & { demo: boolean; color: boolean; mouse: boolean } {
  const options: AppOptions & { demo: boolean; color: boolean; mouse: boolean } = { demo: false, color: true, mouse: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--demo") options.demo = true;
    else if (arg === "--no-color") options.color = false;
    else if (arg === "--no-mouse") options.mouse = false;
    else if (["--config", "--project", "--cwd", "--provider", "--model", "--session"].includes(arg)) {
      const value = args[++i]; if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${arg}`);
      options[arg.slice(2) as keyof AppOptions] = value;
    } else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (options.project && options.cwd) throw new Error("Usá --project o --cwd, no ambos");
  return options;
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`s42-agent ${version} · Demo TUI estilo QBasic

Uso: s42-agent [--config archivo] [--project nombre | --cwd carpeta]

  --no-color   Desactivar colores
  --no-mouse   Usar solamente el teclado
  --version    Mostrar versión
  --help       Mostrar ayuda
  --demo       Abrir la demo sin datos persistentes ni proveedor
  --config     Configuración JSON; sesiones junto al archivo
  --project    Proyecto registrado por nombre o ID
  --cwd        Registrar/elegir carpeta de proyecto
  --session    Reabrir sesión por ID
  --provider   Elegir proveedor registrado
  --model      Elegir ID real del modelo

Enter: enviar demo · Shift+Enter: nueva línea · Esc: menú
Tab: foco · Ctrl+N: panel · Alt+Y: ayuda · Ctrl+Q: salir`);
  } else if (args.includes("--version")) console.log(version);
  else {
    try {
      const options = parseArgs(args);
      if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb") throw new Error("La demo necesita un terminal interactivo. Usa --help para ver las opciones.");
      const app = options.demo ? undefined : await App.open(options);
      await runTerminal(app?.desktop ?? createWorkspace(), { color: options.color && process.env.NO_COLOR === undefined && app?.store.value.ui.color !== "never", mouse: options.mouse });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
