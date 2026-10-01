# QA — Explorador, Projects y chat progresivo

Fecha: 2026-10-01. Linux x64, Bun 1.4.2, tmux 3.4. Ejecución desde `index.ts`,
con configuración/carpetas temporales; no se modificó la configuración personal.
Sin builds ni benchmarks de binarios, sin modelo real.

`bun run typecheck` correcto. Suite completa: **71 pasan, 0 fallan, 675 assertions**,
13 archivos, 12,35 s. Después de ajustar el espacio entre bloques del chat y el
ancho del botón Elegir folder, se repitieron typecheck y las suites relevantes:
**10 pasan, 0 fallan, 110 assertions** en 1,23 s.

## Recorridos comprobados

- `tests/explorer.test.ts`: navegar desde el proyecto al padre y una carpeta
  hermana, seguir un enlace, mostrar ocultos, ir a raíz y escribir una ruta.
  Una ruta ausente conserva la carpeta/listado anterior y muestra ENOENT.
- Doble clic sobre una fila válida abre preview; clics en filas vacías no abren
  el elemento seleccionado. Texto UTF-8 con Unicode, preview recortado a 64 KiB
  y aviso de binario. Paste/borrado no editan preview ni archivo. Escape conserva
  selección y vuelve al listado.
- Projects solicita dos campos: Name/Folder. Explorar conserva Name, permite
  preview dentro del picker, devuelve la carpeta seleccionada y vuelve al campo
  Folder. Guardar cambia el título central; reapertura y borrador del proyecto
  anterior se conservan. Folder inexistente no reemplaza config válida.
- Ctrl+E y Adjuntar preparan un archivo de una carpeta externa, conservando
  el proyecto y el texto del prompt, sin request al modelo.
- Resize 60×16 / 80×24 / 120×40 mantiene el prompt visible y lista/estado/botones
  separados; Elegir folder cabe completo en el tamaño mínimo.
- `tests/reasoning.test.ts`: `reasoning_content` y `reasoning` con UTF-8 dividido
  byte a byte; calls intercaladas por índice y snapshots que no mutan después.
  Razonamiento y argumentos aparecen antes del fin del stream; no hay tool-start
  durante la recepción parcial. Shell muestra ejecución antes del resultado y
  luego nombre, exit 0, duración y stdout. El siguiente request conserva el campo
  de razonamiento recibido y su call/result.
- Cancelar un stream con reasoning y una call incompleta conserva el pensamiento
  recibido con contenido null, sin persistir/ejecutar la call incompleta. Reabrir
  muestra razonamiento, resultados y aviso de cancelación. Chat sigue read-only.
- `tests/app-terminal.test.ts`: `index.ts` normal en Bun.Terminal, Projects de
  primer uso por teclado, picker, guardado, Ctrl+E, listado externo, resize 60×16,
  reasoning/call/resultado fixture y restauración del terminal al salir.
  Se envía SIGWINCH explícito después de Bun.Terminal.resize, porque el PTY Bun
  no notifica al hijo automáticamente en este entorno.

## Pantallas inspeccionadas

[Capturas textuales tmux](explorer-and-reasoning-captures.txt):

1. Explorador en la carpeta del proyecto, con ruta, listado y botones.
2. Carpeta hermana fuera del proyecto.
3. Preview read-only del archivo externo; prompt visible.
4. Projects con Name/Folder y Explorar/Guardar.
5. Picker 60×16, botones completos y prompt fijo.
6. Reasoning y argumentos incompletos de shell mientras se reciben.
7. Resultado con exit/duración y respuesta final, en 80×24.
8. Historial completo en 80×40, con reasoning, call, resultado real `42` del
   comando `bun code.ts` y respuesta fixture. También se inspeccionó shell
   ejecutándose antes del resultado.

Se corrigieron durante esta iteración: doble clic en filas vacías, apertura
asíncrona obsoleta tras navegar a otra carpeta, foco de lista durante carga,
recorte del botón Elegir folder y líneas vacías sobrantes entre reasoning/calls.

## Límites

El proveedor debe exponer reasoning; el harness no lo obtiene ni lo inventa si
no llega en el stream. Contratos consultados: [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
(`reasoning_content`) y [vLLM](https://docs.vllm.ai/en/latest/features/reasoning_outputs/)
(`reasoning`). Los endpoints de QA son fixtures, no inferencia real.

Mouse inyectado y tmux/PTY no prueban mouse físico ni drop desde el SO. La
navegación se validó en Linux; no se afirma runtime Windows/macOS. La salida de
shell se muestra al terminar; el estado de ejecución aparece antes.

`git pull` intentado al empezar: `main` sin upstream. Trabajo/commit locales,
sin publicación ni sincronización remota afirmada.
