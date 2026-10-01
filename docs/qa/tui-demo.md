# Demo QBasic — evidencia de viabilidad

Fecha: 2026-10-01. Entrega: 0.1.0. Entrypoint: `index.ts` raíz.
Estado: demo implementada, binario Linux x64 comprobado; fase 00 **En curso**.
Este registro documenta el hito inicial `c098d88`. La experiencia actual y la
prioridad de validar desde la fuente están en [tui-ux.md](tui-ux.md).

## Implementación

Ventanas con título/cierre, superposición, arrastre y foco; botones con estados;
input de una línea con grafemas Unicode y paste; lista con selección/rueda;
cabecera con desplegables y opciones deshabilitadas; modales que bloquean input
y restauran foco. Los componentes viven en `src/ui/components/` y se componen
en `src/ui/demo.ts`. El desktop, parser, canvas y lifecycle están en `src/ui/`.

Paleta QBasic de 16 colores ANSI, fondo azul, títulos/menús grises y sombras.
`--no-color` / `NO_COLOR` conservan el cursor por video inverso y los botones
por marcadores de texto. `--no-mouse` desactiva los reportes del emulador.
La UI admite 80×24, 120×40 y un layout compacto 60×16; debajo muestra un aviso.

La demo no conecta LLMs ni ejecuta tools. Los elementos de la lista son ejemplos.
Drag de títulos y paste de texto están implementados; el drag & drop de archivos
desde el SO sigue en fase 05.

## Comprobaciones

| Prueba | Resultado y límite |
| --- | --- |
| `bun install --frozen-lockfile` | Lockfile con Bun/types 1.4.2 y TypeScript 7.0.2; cero dependencias de runtime. |
| `bun run typecheck` | Correcto, independiente del build. |
| `bun test` | 17 tests correctos; teclado/SGR/UTF-8 fragmentados, paste, Escape y CSI desconocidas. |
| UI | Release dentro activa una sola vez; release fuera cancela; disabled se omite; capas, cierre, foco, drag, wheel y modal comprobados. |
| Canvas | Unicode ancho, cobertura parcial, clipping, cursor ancho al borde, filas modificadas y cero bytes para pantalla idéntica. |
| PTY fuente | Flujo desde el entrypoint, menú, botón, ventana, drag, modal, Unicode y resize 80×24 → 120×40 → 60×16 → 80×24. |
| PTY binario | `S42_TEST_BINARY="$PWD/dist/s42-agent" bun test`: mismos escenarios desde `/tmp`; 17 tests correctos. El fallo controlado se inyecta sobre el módulo fuente. |
| Cleanup | Ctrl+Q, Ctrl+C, SIGTERM y fallo de render emiten desactivación de mouse/paste, restauración de cursor/pantalla; `stty -g` antes/después coincide en salida por Ctrl+C. |
| Idle | Durante 10 s en PTY no se emitió ningún byte. Sin timer de repintado periódico. |
| tmux | [Capturas de texto reales](tui-captures.txt) de componentes, capas, modal, menú, 80×24, 60×16 y 120×40. No son screenshots gráficos. |

Entorno: Ubuntu 24.04.5 LTS, Linux x64, Intel Core Ultra 9 275HX, aproximadamente
62,25 GiB de RAM, Bun 1.4.2, `Bun.Terminal` 80×24/xterm-256color y tmux.

## Mediciones del binario

Artefacto: `dist/s42-agent`, **81.352.160 bytes** (~77,58 MiB), incluye Bun.
Checksum y muestras agregadas: [tui-benchmark.json](tui-benchmark.json).
Reproducción: `bun run build`, luego `bun run bench:tui`.

| Métrica | Muestras / resultado | Objetivo de SPECS |
| --- | --- | --- |
| Arranque a primer frame en PTY | 30 ejecuciones; p95 **16,76 ms** | ≤ 200 ms |
| Entrada completa a frame en PTY | 100 entradas distintas; p95 **35,93 ms** | ≤ 50 ms |
| RSS en reposo | **36,39 MiB**, una sesión sin LLM | ≤ 100 MiB |
| Idle | **0 bytes** durante 10 s | 0 frames |
| Abrir/cerrar modal | **50 ciclos** en una sesión, después salida con cleanup | Estabilidad de componentes; no son 50 reinicios del terminal |

Caché del SO caliente. Se mide llegada de bytes del frame al PTY, no pintura
gráfica ni latencia de un mouse físico. Las entradas alternan caracteres para
provocar cambios visibles incluso al desplazar el input. No hay red, LLM,
modelo, sesión durable ni tools en estas mediciones.

El benchmark copia el ejecutable fuera del checkout y lo inicia con `PATH` sin
Bun/Node. Demuestra que ese flujo no necesita invocarlos ni leer módulos del
checkout. Los runtimes siguen instalados en el host; falta un destino donde estén
ausentes para cumplir esa validación de distribución.

## Hallazgos y correcciones durante la validación

- El primer test de resize en `Bun.Terminal` agotó el timeout. En Bun 1.4.2/Linux,
  `terminal.resize()` actualizó dimensiones pero no notificó al hijo en esta
  prueba. Se agregó `SIGWINCH` explícito al test; tmux envía la señal por sí mismo.
  Las pruebas posteriores de tres tamaños pasan sin cambiar el runtime TUI.
- El primer benchmark usó `x` repetida. Al llenarse el viewport, una nueva `x`
  dejaba las mismas celdas visibles y el renderer correctamente no emitía bytes;
  el benchmark fallaba esperando un frame. Se corrigió el fixture para alternar
  caracteres y medir entradas que realmente producen una actualización visible.
- La captura inicial 120×40 se hizo antes de completar el resize de tmux y aún
  mostraba el layout 60×16. Se reemplazó por una captura posterior, verificando
  que la barra inferior estuviera en la fila 40.
- La revisión añadió marcadores de estados y cursor en video inverso para
  monocromo; el test de Unicode verifica el cursor sobre un carácter ancho al
  borde. Se limita el scheduler a 30 fps y se evita scroll al escribir la última
  celda de la pantalla.
- Al abrir un modal/menú o cambiar ventana, se cancela la captura anterior para
  que soltar un botón previamente pulsado no active una acción detrás del modal.
  El escenario está cubierto por el test de foco y bloqueo modal.

## Validaciones pendientes

- Mouse físico: clic, release fuera, rueda, arrastre de título y menús en el
  emulador gráfico del usuario. Eventos SGR inyectados no demuestran ese recorrido.
- Flujo en un host sin Bun/Node instalados; otros SO/arquitecturas sin validar.
- Drag & drop de archivos del SO, conversación, proyectos, Vim, LLMs y tools
  pertenecen a sus fases y no son capacidades de esta demo.

Para comprobar el mouse: ejecutar `bun run dev`, pulsar Aceptar y soltar afuera,
abrir Ventana y mover su título, abrir Diálogo y probar clic detrás, desplazar
la lista con rueda y elegir una opción desde el menú superior. Salir con Ctrl+Q.
