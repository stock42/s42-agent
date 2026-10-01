# s42-agent

Harness de coding en TypeScript/Bun con una TUI estilo QBasic. El primer
entregable es una demo interactiva de componentes; el agente y los proveedores
LLM están planificados en [las specs](docs/SPECS.md).

## Ejecutar la demo

Requiere Bun **1.4.2** y un terminal ANSI de al menos **60×16**; recomendado 80×24.
El mouse usa el protocolo SGR del emulador de terminal.

```bash
bun install --frozen-lockfile
bun run dev
```

`index.ts` es el punto de entrada del agente y hoy abre el laboratorio visual.
La demo permite mover y superponer ventanas, cerrar con `[X]`, editar texto
Unicode, pulsar botones, desplazar una lista y usar menús y diálogos modales.
El botón Aceptar actualiza un contador; los datos de la lista son ejemplos.

| Acción | Teclado / mouse |
| --- | --- |
| Abrir menú | Escape, Alt+A / V / D, o clic en su cabecera |
| Navegar menú | Flechas, Enter, hover o arrastrar y soltar; Escape / clic afuera cierra |
| Cambiar foco | Tab / Shift+Tab, o clic en un control |
| Activar botón | Enter / Espacio, o pulsar y soltar dentro |
| Cambiar ventana | Ctrl+N o clic en la ventana visible |
| Mover ventana | Arrastrar su barra de título |
| Cerrar ventana | Ctrl+W o `[X]` |
| Lista | Flechas / Home / End / PageUp / PageDown, clic o rueda; ↑/↓ en el marco indican más filas |
| Seleccionar texto | Ctrl+A, Shift+flechas / Home / End, o arrastre del mouse |
| Reemplazar selección | Escribir, pegar, Backspace o Delete |
| Ayuda | Alt+Y o Ayuda → Atajos y mouse |
| Cerrar modal | Escape, su botón o `[X]` |
| Salir | Ctrl+Q / Ctrl+C o Archivo → Salir |

No se asignan acciones a F1–F12. Al cerrar todas las ventanas, Ventanas →
Componentes vuelve a abrir el laboratorio; los desplegables cubren el mensaje
del escritorio vacío.

```bash
bun run index.ts --help
bun run index.ts --no-color
bun run index.ts --no-mouse
```

También se respeta `NO_COLOR`. Sin color, cursor y selección usan video inverso,
los menús subrayan sus letras de acceso y los botones indican sus estados por
texto. Fuera de TTY o con `TERM=dumb`, se informa el requisito del terminal sin
emitir escapes.

## Componentes y organización

```text
index.ts                    argumentos y arranque; único entrypoint
src/ui/
  terminal.ts               lifecycle, resize y frames por demanda
  input-parser.ts           teclado, paste y mouse incremental
  canvas.ts                 celdas, Unicode, clipping y filas modificadas
  theme.ts                  paleta QBasic
  desktop.ts                foco, capas, captura de mouse y ventanas
  demo.ts                   composición del laboratorio
  components/
    component.ts            contrato pequeño de controles
    window.ts               ventana; también usada para modales
    button.ts
    input.ts
    select-list.ts
    menu.ts                 cabecera y desplegable integrado
tests/                      comportamiento y terminal PTY
scripts/bench-tui.ts         mediciones del binario local
```

No hay dependencias de runtime. Los controles reciben eventos locales; el
escritorio decide foco, captura y clipping. El renderer emite únicamente filas
que cambiaron y no tiene un intervalo activo en reposo.

## Validar la experiencia TUI

```bash
bun run typecheck
bun test
```

La prioridad actual es iterar sobre `bun run dev`, mouse, teclado, foco y layout.
[Correcciones y comprobaciones de UX](docs/qa/tui-ux.md).

## Distribución, cuando corresponda

El build incorpora Bun en el ejecutable. Build, smoke y benchmark se realizan
para una entrega o cuando se soliciten; no forman parte de cada iteración de UX.
La validación inicial del binario corresponde a Linux x64.

Comandos disponibles para esa tarea:

```bash
bun run build
./dist/s42-agent
S42_TEST_BINARY="$PWD/dist/s42-agent" bun test
bun run bench:tui
```

El benchmark copia el binario a un directorio temporal, lo ejecuta con un `PATH`
sin Bun/Node y guarda sus resultados en `docs/qa/tui-benchmark.json`.
Eso verifica operación fuera del checkout; no equivale a desinstalar los runtimes
del equipo. Las pruebas PTY requieren Linux/macOS; esta entrega se probó en Linux.

[Evidencia inicial del binario](docs/qa/tui-demo.md). La UX actual se comprobó
desde la fuente; sigue pendiente el mouse físico en un terminal gráfico.
El host sin Bun/Node se verifica en distribución. El drag & drop de archivos
del SO, Vim, proyectos y LLMs pertenecen a las siguientes fases.
