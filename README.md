# s42-agent

Harness de coding en TypeScript/Bun con una TUI estilo QBasic. El primer
entregable es una demo del escritorio del agente; el agente y los proveedores
LLM están planificados en [las specs](docs/SPECS.md).

## Ejecutar la demo

Requiere Bun **1.4.2** y un terminal ANSI de al menos **60×16**; recomendado 80×24.
El mouse usa el protocolo SGR del emulador de terminal.

```bash
bun install --frozen-lockfile
bun run dev
```

`index.ts` abre un editor central titulado con el nombre de la carpeta actual
y un panel **Prompt** fijo abajo. Enter o Enviar coloca una respuesta de
demostración en el editor; todavía no hay un LLM conectado. La respuesta es de
solo lectura; podés seleccionarla, desplazarte por ella y escribir el siguiente prompt.

El editor y el prompt no se cierran ni se arrastran. Las ventanas auxiliares
quedan dentro del área del editor y conservan visible el prompt. **Demo →
Componentes** abre el laboratorio de controles: ventanas, input, botones,
lista y modales. Sus datos siguen siendo ejemplos.

| Acción | Teclado / mouse |
| --- | --- |
| Abrir menú | Escape, Alt+A / V / D, o clic en su cabecera |
| Navegar menú | Flechas, Enter, hover o arrastrar y soltar; Escape / clic afuera cierra |
| Cambiar foco | Tab / Shift+Tab, o clic en un control |
| Activar botón | Enter / Espacio, o pulsar y soltar dentro |
| Cambiar panel/ventana | Ctrl+N, menú Ventanas o clic en la ventana visible |
| Mover ventana | Arrastrar su barra de título |
| Cerrar auxiliar | Ctrl+W o `[X]`; editor y prompt son fijos |
| Enviar prompt de demo | Enter o botón Enviar |
| Nueva línea en el prompt | Shift+Enter; el pegado multilínea no envía |
| Respuestas (solo lectura) | Flechas / Home / End / Ctrl+Home / Ctrl+End / PageUp / PageDown, clic o rueda |
| Lista | Flechas / Home / End / PageUp / PageDown, clic o rueda; ↑/↓ en el marco indican más filas |
| Seleccionar texto | Ctrl+A, Shift+flechas / Home / End, o arrastre del mouse |
| Reemplazar selección | Escribir, pegar, Backspace o Delete |
| Ayuda | Alt+Y o Ayuda → Atajos y mouse |
| Cerrar modal | Escape, su botón o `[X]` |
| Salir | Ctrl+Q / Ctrl+C o Archivo → Salir |

No se asignan acciones a F1–F12. Cerrar un auxiliar conserva el editor y el
borrador del prompt. El contexto de proyecto usa la carpeta de ejecución;
el registro persistente de múltiples proyectos corresponde a la fase 02.

La TUI solicita teclado extendido para distinguir Shift+Enter de Enter. Si el
emulador entrega la misma secuencia para ambos, Ctrl+J sigue disponible como
alternativa para nueva línea. No se requiere usar el terminal Kitty.

```bash
bun run index.ts --help
bun run index.ts --no-color
bun run index.ts --no-mouse
```

La apariencia sigue las capturas de QBasic: azul DOS, marcos finos, títulos en
pestañas grises, Ayuda a la derecha y barra inferior turquesa. Con
`COLORTERM=truecolor` o `24bit` se usa la paleta RGB propia; en otros terminales
se conservan los 16 colores ANSI, cuyo tono depende de la paleta del emulador.

También se respeta `NO_COLOR`. Sin color, cursor y selección usan video inverso,
los menús subrayan sus letras de acceso; botones deshabilitados y títulos
inactivos usan texto tenue. Fuera de TTY o con `TERM=dumb`, se informa el
requisito del terminal sin emitir escapes.

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
  workspace.ts              editor del proyecto, prompt fijo y respuesta demo
  components/
    component.ts            contrato pequeño de controles
    window.ts               ventana; también usada para modales
    button.ts
    input.ts
    text-area.ts            edición multilínea, selección, wrap y scroll
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
[Apariencia y comprobaciones actuales](docs/qa/qbasic-style.md),
[layout y edición](docs/qa/workspace.md), [Shift+Enter](docs/qa/shift-enter.md).

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
