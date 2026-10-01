import { createDemo } from "./src/ui/demo.ts";
import { runTerminal } from "./src/ui/terminal.ts";
import { version } from "./package.json";

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`s42-agent ${version} · Demo TUI estilo QBasic

Uso: s42-agent [--no-color] [--no-mouse]

  --no-color   Desactivar colores
  --no-mouse   Usar solamente el teclado
  --version    Mostrar versión
  --help       Mostrar ayuda

F1: ayuda · F10: menú · Tab: foco · F6: ventana · Ctrl+Q: salir`);
  } else if (args.includes("--version")) console.log(version);
  else {
    const unknown = args.find((arg) => arg !== "--no-color" && arg !== "--no-mouse");
    try {
      if (unknown) throw new Error(`Opción desconocida: ${unknown}`);
      await runTerminal(createDemo(), { color: !args.includes("--no-color") && process.env.NO_COLOR === undefined, mouse: !args.includes("--no-mouse") });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
