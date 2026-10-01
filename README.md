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
| Abrir menú | F10, Alt+A / V / D, o clic en su cabecera |
| Navegar menú | Flechas, Enter; Escape o clic afuera para cerrar |
| Cambiar foco | Tab / Shift+Tab, o clic en un control |
| Activar botón | Enter / Espacio, o pulsar y soltar dentro |
| Cambiar ventana | F6 o clic en la ventana visible |
| Mover ventana | Arrastrar su barra de título |
| Cerrar ventana | Ctrl+W o `[X]` |
| Lista | Flechas / Home / End, clic o rueda |
| Ayuda | F1 |
| Cerrar modal | Escape, su botón o `[X]` |
| Salir | Ctrl+Q / Ctrl+C o Archivo → Salir |

```bash
bun run index.ts --help
bun run index.ts --no-color
bun run index.ts --no-mouse
```

También se respeta `NO_COLOR`. Sin color, el cursor usa video inverso y los
botones indican foco, presión y deshabilitado por texto. Fuera de TTY o con
`TERM=dumb`, se informa el requisito del terminal sin emitir escapes.

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

## Validar y compilar

```bash
bun run typecheck
bun test
bun run build
./dist/s42-agent
```

El build incorpora Bun en el ejecutable. La validación actual corresponde a
Linux x64; otros sistemas requieren sus propias pruebas.

Para repetir los escenarios PTY sobre el binario y medir rendimiento:

```bash
S42_TEST_BINARY="$PWD/dist/s42-agent" bun test
bun run bench:tui
```

El benchmark copia el binario a un directorio temporal, lo ejecuta con un `PATH`
sin Bun/Node y guarda sus resultados en `docs/qa/tui-benchmark.json`.
Eso verifica operación fuera del checkout; no equivale a desinstalar los runtimes
del equipo. Las pruebas PTY requieren Linux/macOS; esta entrega se probó en Linux.

[Evidencia y límites](docs/qa/tui-demo.md): quedan pendientes el mouse físico en
un terminal gráfico y un host sin Bun/Node instalados. El drag & drop de archivos
del SO, Vim, proyectos y LLMs pertenecen a las siguientes fases.
