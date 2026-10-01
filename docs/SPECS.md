# s42-agent — Especificaciones

Fecha: 2026-10-01. Estado: harness QBasic desde `index.ts`, con respuesta en solo
lectura y prompt fijo. Proyectos/sesiones/pestañas, Models, streaming, coding, Vim,
adjuntos, MCP/Skills y Promptings implementados con fixtures/PTY. GLM local real
y distribución Linux x64 tienen evidencia previa; mouse/drop físicos y runtime
macOS/Windows/arm64 siguen pendientes. Menús de producto y preparación MIT listos.
[QA actual](qa/project-tabs.md), [QA integral](qa/final-validation.md),
[GLM real](qa/local-llm.md), [QA del agente](qa/agent-mvp.md).
[Apariencia actual](qa/qbasic-style.md), [layout/edición](qa/workspace.md),
[demo inicial](qa/tui-demo.md).

Prioridad confirmada: perfeccionar la experiencia dentro de la TUI mediante
`bun run dev`. Builds, smoke y benchmarks de binarios se realizan al preparar
distribución o a pedido explícito. [UI actual](qa/qbasic-style.md).

## 1. Objetivo

Crear un harness de coding con una TUI en color, simple, rápido y estable,
escrito en TypeScript y ejecutado íntegramente con Bun. Debe distribuirse como
un ejecutable que incluya el runtime, administrar proyectos por nombre y carpeta,
permitir operar con mouse y teclado y usar modelos locales mediante
`llama.cpp` como opción predeterminada.

Un harness incluye el ciclo completo: recibir una tarea, construir el contexto,
consultar al modelo, ejecutar sus herramientas, devolver los resultados al modelo
y mostrar el progreso hasta una respuesta final o una cancelación.

La dirección visual confirmada es **100% estilo QBasic**, con un escritorio de
ventanas simulado dentro del terminal. Mouse y componentes visuales forman parte
del producto desde el primer prototipo, no son mejoras opcionales posteriores.

Pi sigue siendo referencia para streaming y separación entre proveedor, ciclo
del agente y herramientas. Su apariencia no es una alternativa visual pendiente.
La primera versión será una implementación propia pequeña; no un fork completo.

## 2. Alcance y criterios de diseño

### Requisitos solicitados

| ID | Requisito | Resultado verificable |
| --- | --- | --- |
| R01 | TypeScript y Bun en todo el harness | Desarrollo, tests y compilación con Bun; ejecutable sin Node.js instalado. |
| R02 | Simplicidad | Un paquete, un proceso, módulos pequeños y sin servicios internos obligatorios. |
| R03 | Rapidez | Inicio y respuesta del teclado medidos por separado de la inferencia. |
| R04 | Estabilidad | Cancelación, errores de proveedor y cierre restauran el terminal y conservan la sesión. |
| R05 | TUI en color estilo QBasic | Paleta clásica por defecto, grises y verdes configurables; menú superior, ventanas con bordes/títulos y barra de atajos, legibles con y sin color. |
| R06 | Múltiples proyectos | CRUD mediante nombre/carpeta y pestañas con borradores, sesiones y turnos independientes. |
| R07 | Buenos atajos y experiencia Vim | Modos INSERT/NORMAL, navegación y acciones documentadas, sin conflictos entre modos. |
| R08 | Drag & drop de archivos | Rutas entregadas por el terminal se convierten en adjuntos visibles antes del envío. |
| R09 | Proveedores y modelos configurables | Registrar endpoints y modelos, elegirlos y guardar defaults. |
| R10 | `llama.cpp` por defecto | Primera configuración apunta a un servidor local sin requerir una cuenta cloud. |
| R11 | Coding real | Leer, buscar, escribir, editar y ejecutar comandos dentro del contexto del proyecto. |
| R12 | Continuidad del trabajo | Crear y reabrir sesiones asociadas a cada proyecto. |
| R13 | Binarios autónomos | Compilar y ejecutar fuera del checkout y sin Bun instalado en el equipo de destino. |
| R14 | Documentación de trabajo | Specs, fases, AGENTS y CHANGELOG coherentes con el estado real. |
| R15 | Mouse como interacción principal disponible | Clic en controles, foco, rueda y arrastre de ventanas comprobados en terminal real. |
| R16 | Componentes visuales TUI reutilizables | Botones, ventanas con título/cierre, menús con desplegables y controles comparten render e input. |
| R17 | Viabilidad de la TUI primero | Demo de componentes ejecutable y validada antes de integrar proveedores o tools del agente. |
| R18 | MCP configurable | CRUD de servidores stdio/HTTP, enabled/disabled, tools visibles y cancelables en el loop. |
| R19 | Skills | Registro global/proyecto de SKILL.md, activación, carga progresiva, búsqueda e instalación desde skills.sh. |
| R20 | Promptings reutilizables | CRUD con nombre/texto multilínea y preguntas por cada `{{metavar_name}}` al cargar o ejecutar con el modelo actual. |
| R21 | Preparación open source | MIT, README reproducible, contribución, metadata y CI fuente; publicación como acción separada. |

### Decisiones iniciales para mantenerlo pequeño

- Un repositorio y un paquete ESM. No monorepo ni framework de agentes.
- Un turno activo por proyecto; proyectos distintos pueden trabajar a la vez.
  Herramientas secuenciales dentro de cada turno.
- Configuración JSON y sesiones JSONL en disco. Sin base de datos inicial.
- TUI propia estilo QBasic, con ANSI, mouse y las APIs incluidas en Bun.
- Construir primero los componentes visuales y una demo de viabilidad sin LLM;
  luego usar esos mismos componentes en la interfaz del harness.
- Un protocolo LLM inicial: Chat Completions compatible con OpenAI. Sirve para
  `llama.cpp` y otros endpoints que implementen ese contrato concreto.
- Modelos registrados por el usuario; descubrimiento opcional mediante `/models`.
- Dependencias de runtime: objetivo inicial cero. Agregar una solamente si resuelve
  una necesidad concreta que Bun no cubra y funciona en el binario compilado.
- La disponibilidad del servidor LLM no condiciona el arranque de la TUI.
- Usar las capacidades útiles de Bun; incorporar APIs sin una necesidad del
  producto perjudicaría la simplicidad.

### Fuera de la primera versión

Interfaz web, daemon, sincronización cloud, colaboración entre agentes,
plugins, marketplace (excepto el buscador de skills solicitado), RAG, índices vectoriales, LSP, editor completo, instalación
o descarga de modelos y administración automática de `llama-server`.

Los protocolos nativos de otros proveedores, OAuth de suscripciones, OCR y
extracción de PDF se podrán proponer después. Configurar un proveedor no implica
que cualquier API o modalidad sea compatible.

## 3. Stack y significado de «100% Bun»

- Lenguaje: TypeScript con `strict`, módulos ESM y tipos de Bun.
- Versión observada en este repositorio: Bun **1.4.2**. La fase 00 fijará la versión
  reproducible de la demo y compilación antes de construir el agente.
- Runtime: Bun; paquetes: `bun install`; tests: `bun:test`; build: `bun build`.
- Transporte: `fetch`, `ReadableStream`, `TextDecoder` y `AbortController`.
- Archivos: `Bun.file`, `Bun.write`, `Bun.Glob` y APIs de filesystem incluidas en Bun.
- Procesos: `Bun.spawn`; no `spawnSync` en el camino interactivo.
- Texto de terminal: `Bun.color`, `Bun.stringWidth`, `Bun.wrapAnsi`,
  `Bun.stripANSI` y `Bun.markdown.render`.

Las APIs `process.stdin`, `process.stdout`, `node:path`, `node:tty` y
`node:fs/promises` implementadas por Bun siguen ejecutándose dentro de Bun y no
requieren instalar Node.js. Se usarán para raw mode, dimensiones, directorios,
append y rename cuando no haya una API Bun más adecuada. La propia documentación
de Bun recomienda esa combinación para operaciones de directorios.

`Bun.Terminal` crea una PTY para un **subproceso**; no reemplaza el control del
stdin de la TUI principal. Se puede usar en pruebas de terminal. La documentación
actual describe PTY en Linux/macOS y ConPTY en Windows, con diferencias que deben
verificarse en cada plataforma. [Archivos](https://bun.com/docs/runtime/file-io),
[procesos y PTY](https://bun.com/docs/runtime/child-process),
[raw mode](https://bun.com/reference/node/tty/ReadStream/setRawMode).

El binario contiene el harness y Bun. El terminal, el sistema operativo,
`llama-server`, sus GGUF, Git y las herramientas de los proyectos son programas
externos. «100% Bun» se aplica al harness, no al motor de inferencia ni a los
comandos de los repositorios sobre los que trabaja.

Bun transpila TypeScript; ejecutar o compilar no verifica tipos. El chequeo será
TypeScript ejecutado mediante Bun, además de los tests.
[TypeScript](https://bun.com/docs/typescript).

## 4. Arquitectura mínima

```text
CLI → aplicación → TUI
                 → proyectos y sesiones
                 → ciclo del agente → cliente LLM → endpoint configurado
                                    → herramientas → filesystem / procesos
```

Estructura acordada: `index.ts` raíz como único entrypoint y componentes dentro
de `src/ui/components/`. TUI, agente, LLM y persistencia están implementados.

```text
index.ts                   argumentos y arranque de demo/harness
src/
  app.ts                   composición del harness y configuración TUI
  project-tab.ts           estado y controles independientes por proyecto abierto
  prompts.ts               extracción y sustitución literal de metavariables
  ui/
    terminal.ts            lifecycle y frames por demanda
    input-parser.ts        teclado, paste y mouse
    canvas.ts              celdas, clipping y renderer
    theme.ts               estilos QBasic y paletas clásica/grises/verdes
    desktop.ts             foco, capas y captura
    demo.ts                composición de la demo inicial
    promptings.ts           CRUD y preguntas de metavariables
    components/            window, button, input, text-area, select-list, menu, tab-bar, file-explorer
  agent/                   loop, mensajes, tools y adjuntos
  llm/                     Chat Completions y SSE
  storage/                 configuración, proyectos y sesiones
tests/                     pruebas de comportamiento y fixtures
scripts/                   build y mediciones en TypeScript/Bun
docs/SPECS.md
docs/phases/
AGENTS.md
CHANGELOG.md
```

Estos son límites de responsabilidad, no una obligación de crear un archivo para
cada concepto. No agregar contenedores de dependencias, buses de eventos genéricos
ni capas de plugins.

La biblioteca interna de componentes TUI es parte explícita del alcance: debe
resolver los controles del producto con un contrato pequeño de render, eventos,
foco y límites por celdas. No requiere crear un framework publicable, React,
un motor CSS, un lenguaje de layouts o un sistema de plugins.

La TUI consume eventos tipados del agente: inicio, texto parcial, herramienta
iniciada, salida parcial, herramienta terminada, uso reportado, fin, error y
cancelación. El cliente LLM no imprime directamente al terminal.

## 5. TUI y entrada

### Dirección visual

**Decisión confirmada por el usuario:** estética QBasic en toda la UI, con mouse
y ventanas que simulan una interfaz de escritorio dentro del terminal.

- Fondo azul clásico, texto claro, barras grises y selección contrastante por defecto.
- Bordes de caracteres, títulos y control de cierre `[×]`/`[X]` reconocible.
- Ventanas superpuestas, foco visible y menús en la cabecera con desplegables.
- Botones con estados normal, enfocado, presionado y deshabilitado.
- Barra inferior con atajos y estado; estilos y paletas centralizados.

**Vista → Paleta de colores** configura tres opciones: **Clásica · QBasic**,
**Blanco y negro · Grises** y **Verdes**. `ui.palette` guarda `qbasic`, `grayscale`
o `green`; los archivos existentes sin el campo conservan QBasic. La opción actual
queda seleccionada al abrir. Elegir con teclado/mouse repinta toda la TUI en vivo,
sin cambiar borrador, sesión o foco del prompt; Escape descarta la elección.
La escala de grises usa tonos neutros, no equivale a desactivar color.
[Validación desde fuente](qa/color-palettes.md).

No es una interfaz gráfica del sistema operativo: todas las ventanas y controles
se dibujan en celdas de un único terminal. El estilo no exige reproducir las
funciones del IDE QBasic ni incorporar un segundo tema tipo Pi.

### Componentes visuales iniciales

| Componente | Responsabilidad y comportamiento mínimo |
| --- | --- |
| `Desktop` | Área de trabajo, orden de superposición, foco y composición de ventanas. |
| `Window` | Marco, título, contenido recortado, cierre y arrastre por el título. |
| `Button` | Activación por clic/Enter/Espacio, foco y estados visible/deshabilitado. |
| `MenuBar` | Menús de cabecera y desplegable integrado, selección y cierre. |
| `Dialog` | Ventana modal que restringe input al diálogo y restaura el foco al cerrar. |
| `Input` | Campo editable con cursor, foco, teclado y paste. |
| `TextArea` | Edición multilínea, selección por grafemas, wrap, scroll y envío explícito del prompt. |
| `SelectList` | Lista con selección por clic/flechas y scroll con rueda/teclado. |
| `FileExplorer` | Navegación libre de carpetas, ruta editable, preview read-only y selección de archivo/folder. |

Un componente conserva estado mínimo y expone un contrato tipado para dibujar,
recibir eventos y manejar su foco. `Dialog` puede reutilizar `Window`; no crear
una jerarquía compleja de clases ni duplicar la detección de input en cada control.
El editor y el prompt multilínea reutilizan esa base; la respuesta aparece en el editor.

La demo conserva texto, selección y foco al volver a una ventana existente.
Los menús admiten hover y arrastrar/soltar, con accesos Alt únicos; el input
selecciona por Ctrl+A, Shift+flechas/Home/End o arrastre del mouse. La lista
admite PageUp/Down y muestra si hay filas fuera del viewport. Los atajos de la
barra inferior reflejan el contexto de menú o modal. A 60×16, el estado ocupa
una fila separada de los controles.

### Primer entregable: demo de viabilidad

Antes del harness, construir una demo Bun que permita abrir una ventana de
componentes desde un menú, pulsar botones, editar un campo, seleccionar una lista,
abrir/cerrar un modal y mover/cerrar ventanas. Debe existir un submenu desplegable
operable con mouse y teclado. Sus datos son fixtures identificados como demo;
no llama LLMs, ejecuta herramientas de coding ni modifica proyectos.

Verificar layout a 80×24 y 120×40, coordenadas de clic, orden de ventanas,
restauración del terminal y repintado sin flicker desde el entrypoint Bun.
Con esa evidencia se determina la viabilidad antes de integrar el agente.

### Distribución

Una pantalla alternativa organizada como escritorio TUI:

1. Menú superior: **Archivo**, **Projects**, **Models**, **Promptings**, **Tools**,
   **Vista** y **Ayuda**, con desplegables. Archivo agrupa explorador/adjuntos/salir;
   Projects, registro/sesiones/pestañas; Models, proveedores/modelos; Promptings,
   biblioteca/nuevo/guardar borrador; Tools, MCP/Skills; Vista, paneles/paleta/Vim.
   Ayuda muestra atajos. Sin acciones de prueba en el harness normal.
2. Editor central con el **nombre del proyecto centrado en su marco superior**,
   como QBasic mostraba el nombre del archivo. Las respuestas del agente aparecen
   allí en solo lectura, con selección y scroll; no abrir una ventana de chat independiente.
3. Panel **Prompt** fijo debajo del editor, siempre visible. Ambos paneles no
   tienen cierre ni arrastre; auxiliares y modales quedan dentro del área del editor.
   Enter/Enviar envía explícitamente; Shift+Enter inserta una línea y pegar no envía.
4. Contexto visible: proyecto, proveedor/modelo y sesión en la ventana principal.
5. Barra inferior: INSERT/NORMAL, foco, actividad, uso disponible y atajos.
6. Fila de pestañas debajo del menú: nombre de cada proyecto, marca `~` de turno
   activo, cierre `×` y `+` para abrir. Flechas/rueda desplazan las pestañas cuando
   no entran; la activa se revela al cambiar de proyecto o redimensionar.

El arranque normal registra/configura proyectos y conecta el endpoint elegido.
Sin modelo, muestra el aviso en el chat y ofrece Models → Configurar modelo
(host, puerto, ID, API key, contexto y capacidades). `--demo` conserva la demo
sin persistencia/LLM, como único acceso al laboratorio de componentes.
Los inputs no agregan corchetes; botones con etiqueta centrada y
estado por color/video inverso/tenue, sin combinar marcadores de foco/presión.
Los marcos conservan esquinas unidas a la cabecera y sombras de una celda solo
en ventanas flotantes.

Las capturas de QBasic suministradas fijan la guía visual: azul DOS `#0000AA`,
gris `#AAAAAA`, barra inferior turquesa `#00AAAA`, marcos finos de una línea,
títulos centrados en pestañas grises y Ayuda alineada a la derecha. Los menús
seleccionan con fondo negro, sin añadir un marcador `>` a la etiqueta.
El panel inferior conserva el nombre Prompt y sus acciones del harness.

Ventanas y menús usan un orden de superposición común. Cerrar una ventana auxiliar
no elimina una sesión ni borra datos. Las acciones de cancelar o salir deben ser explícitas.

El estado de cada herramienta muestra su nombre, argumentos relevantes,
resultado, código de salida y duración. No llamar «completada» a una herramienta
fallida ni a un turno cancelado.

El razonamiento enviado por el proveedor aparece progresivamente en el chat,
separado de la respuesta. Las tool calls muestran nombre y argumentos durante
la recepción, ejecución y resultado. Los deltas se agregan sin volver a parsear
el historial completo; al finalizar se conserva el mensaje canónico en la sesión.
Si el proveedor no expone razonamiento, no inventarlo.

### Explorador de archivos

Archivo → Explorador de archivos, Ctrl+E o `/files`. Parte de la carpeta del
proyecto, pero permite navegar fuera de ella con padre, raíz o ruta escrita.
Lista un nivel por vez, incluyendo archivos ocultos y enlaces; Enter/doble clic
abre carpetas o una vista previa de archivo. Preview UTF-8 en solo lectura hasta
64 KiB con recorte explícito, o aviso de binario; Escape vuelve al listado.
Flechas/j/k seleccionan, derecha/l/Enter abre, izquierda/h/Backspace sube y la
rueda desplaza. Adjuntar prepara el archivo elegido sin inferencia ni cambio de
proyecto. Rutas inválidas/ilegibles se muestran en el explorador y permiten volver
a navegar. El prompt sigue visible, también en 60×16.

Projects reutiliza el explorador como picker: Elegir folder devuelve la carpeta
visitada al formulario sin perder Name ni el borrador de la conversación.

### Renderizado

- Actualizar únicamente las filas modificadas y agrupar deltas de streaming en
  hasta 30 repintados por segundo. No redibujar por cada token.
- No emitir frames cuando no cambió el estado.
- Mantener caché de mensajes finalizados y recalcular el layout al redimensionar.
- Respetar ancho visible, ANSI, Unicode, tildes, emoji y caracteres anchos.
- Markdown básico: títulos, listas, énfasis, código y enlaces legibles. Resaltar
  bloques de código por estilo; colorear cada lenguaje no es requisito inicial.
- Un tema QBasic con tokens para escritorio, menú, marco/título activo e inactivo,
  control, selección, texto, secundario, éxito, advertencia y error.
- Componer una pantalla por celdas con clipping: el contenido de una ventana no
  invade su marco ni controles vecinos, incluso con texto ancho.
- Detectar capacidad de color y respetar `NO_COLOR` y `TERM=dumb`; acompañar los
  colores con texto. Con `TERM=dumb`, mostrar el requisito de un terminal ANSI.
  Implementación actual: paleta elegida en RGB si `COLORTERM` indica `truecolor` o
  `24bit`; fallback a 16 colores ANSI en los demás casos. El fallback depende de
  la paleta del emulador. No modificar su paleta global ni fijar su tipografía.
- Soportar al menos 80×24 y degradar a un layout compacto en 60×16 sin perder el
  editor ni el estado. Tamaños menores reciben un aviso legible.
- Si stdin o stdout no es TTY, informar que el modo interactivo necesita un
  terminal y salir con código distinto de cero, sin secuencias ANSI.

Raw mode, cursor, pantalla alternativa, mouse y bracketed paste se activan al entrar y
se restauran al salir por cierre normal, error controlado, SIGINT o SIGTERM. En
raw mode Ctrl+C llega como entrada y debe manejarse explícitamente. SIGKILL o
una caída del sistema no permiten garantizar restauración.

### Mouse y ventanas

El protocolo actual es mouse SGR por celdas (`1006`) con tracking de movimiento
por celda (`1003`) para hover y arrastre. El terminal entrega secuencias por stdin;
Bun las decodifica junto con el teclado. Las coordenadas del protocolo parten
de 1 y se normalizan a la grilla interna. No usar coordenadas en píxeles ni un
puente de UI nativa. [Protocolo de xterm](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking).

- Clic enfoca el control/ventana superior que realmente ocupa esa celda.
- Botón activa al soltar dentro del mismo control donde se presionó; soltar fuera
  cancela la activación. Un control deshabilitado no recibe acciones.
- Arrastrar el título mueve la ventana con captura del puntero hasta release;
  limitar la posición al área útil para conservar acceso al título/cierre.
- Rueda desplaza la lista o conversación ubicada bajo el puntero.
- El clipping y el orden visible gobiernan el hit testing: no pulsar controles
  ocultos detrás de otra ventana ni atravesar un modal.
- Menús se abren al hacer clic, permiten elegir una opción y se cierran al elegir,
  hacer clic afuera o pulsar Escape. Menús y modales reciben input antes que Vim.
- No exigir hover o tracking de todos los movimientos para el prototipo.
- Restaurar los modos de mouse activados al cerrar. Si el emulador no envía esos
  eventos, conservar operación por teclado y registrar la limitación de mouse.

Arrastrar una ventana interna y arrastrar un archivo desde el SO son flujos
distintos. El segundo sigue el contrato de adjuntos de la sección 10; recibir
eventos de mouse no entrega por sí mismo archivos del sistema operativo.

### Foco y teclado de controles

Tab/Shift+Tab recorren controles en una ventana/diálogo. Escape activa la barra de
menús desde el escritorio; flechas recorren menú y opciones; Enter selecciona y
Escape cierra el nivel actual. Alt+Y abre ayuda; Ctrl+N cambia de ventana y Ctrl+W
la cierra. Mouse y teclado invocan la misma acción de cada control.
No asignar acciones a F1–F12 por decisión del usuario: colisionan con el sistema
operativo/terminal. Si Alt o Shift+Tab no están disponibles, conservar operación
con Escape, flechas y mouse; no depender exclusivamente de Alt ni de Kitty.

El foco vuelve al control previo después de cerrar un diálogo. Mientras haya un
menú/modal, sus acciones tienen prioridad; los atajos Vim operan sobre el editor
y la conversación cuando esos componentes tienen foco, no sobre todo el escritorio.

### Teclado

El parser conserva secuencias de escape y caracteres UTF-8 divididos entre
chunks. Bracketed paste se procesa como un bloque, incluso si contiene Enter,
Escape o comandos. El pegado no envía mensajes automáticamente.

Shift+Enter es el atajo principal para nueva línea y Enter envía el prompt.
Solicitar desambiguación de teclado Kitty y xterm modifyOtherKeys al entrar;
consumir CSI-u y `CSI 27;modificador;código~`, sin exigir un emulador específico.
Conservar los controles tradicionales. Si el terminal entrega Shift+Enter como
Enter, no se pueden distinguir esos bytes; Ctrl+J queda como alternativa.
Al salir, restaurar la pila Kitty y el valor inicial de modifyOtherKeys.
[Verificación del atajo](qa/shift-enter.md).

| Contexto | Tecla | Acción |
| --- | --- | --- |
| Escritorio | Escape | Abrir barra de menús cuando no lo consume un editor Vim. |
| Escritorio | Alt+Y | Abrir ayuda; también disponible desde el menú Ayuda. |
| Escritorio | Ctrl+N | Cambiar panel o ventana. |
| Escritorio | Ctrl+W | Cerrar auxiliar; desde un panel fijo, cerrar la pestaña del proyecto idle. |
| Ventana/diálogo | Tab / Shift+Tab | Recorrer controles enfocados. |
| Menú/diálogo | Escape | Cerrar menú o diálogo antes de cambiar modo Vim. |
| Global | Ctrl+C | Cancelar el turno de la pestaña activa; idle puede salir si ninguna otra trabaja. |
| Global | Ctrl+Q | Cancelar todos los turnos, guardar borradores y cerrar sesiones/terminal. |
| Global | Ctrl+P | Abrir proyecto en una pestaña o activar la ya abierta. |
| Global | Alt+← / Alt+→ | Activar pestaña anterior/siguiente. |
| Global | Alt+1…9 | Activar proyecto por número visible en su pestaña. |
| Global | Ctrl+O | Seleccionar modelo del proveedor activo. |
| Global | Ctrl+B | Seleccionar/configurar proveedor. |
| Global | Ctrl+R | Seleccionar una sesión del proyecto activo. |
| Global | Ctrl+F | Agregar o quitar adjuntos por ruta. |
| Global | Ctrl+E | Abrir explorador de archivos y carpetas, incluyendo fuera del proyecto. |
| Global | Alt+T | Abrir biblioteca; también Promptings → Biblioteca. |
| INSERT | Escape | Entrar a NORMAL cuando Vim está habilitado. |
| INSERT | Enter | Enviar el borrador; si acaba de reconocer rutas sin marcadores, primero adjuntarlas. |
| INSERT | Shift+Enter | Insertar salto de línea; Ctrl+J como alternativa de compatibilidad. |
| INSERT | Tab | Completar comando o ruta, cuando haya candidatos. |
| NORMAL, editor | i / a / I / A | Insertar antes/después o al principio/final de la línea. |
| NORMAL, editor | h / j / k / l | Mover el cursor. |
| NORMAL, editor | w / b / 0 / $ | Mover por palabra o extremo de línea. |
| NORMAL, editor | x / dd / u | Borrar carácter/línea o deshacer edición del borrador. |
| NORMAL | Tab | Cambiar foco entre editor y conversación. |
| NORMAL, conversación | j / k / Ctrl+D / Ctrl+U | Desplazar una línea o media pantalla. |
| NORMAL, conversación | gg / G | Ir al inicio/final. |
| NORMAL | Espacio, p / m / s / e / f / c / k / t / ? | Proyectos / modelos / sesiones / explorador / adjuntos / MCP / skills / promptings / ayuda. |
| Selector | j / k o flechas, Enter, Escape | Navegar, elegir, cerrar. |
| Conversación | PageUp / PageDown | Desplazar sin modificar el borrador. |

Vim estará habilitado inicialmente y arrancará en INSERT. Se podrá desactivar
en configuración. Es un subconjunto acotado, no una implementación completa de
Vim; no incluye macros, registros, visual mode ni comandos Ex.

La ayuda muestra las acciones y el contexto activo. Los bindings configurables
se asocian a acciones conocidas y se valida que no colisionen en el mismo modo.
No depender de Ctrl+M, que muchos terminales transmiten igual que Enter.

Comandos de la aplicación: `/help`, `/projects`, `/providers`, `/models`,
`/sessions`, `/files`, `/new`, `/mcp`, `/skills`, `/promptings`, `/attach`, `/detach`, `/quit`. Sus nombres no se envían al
modelo cuando se usan como comandos de la TUI.

## 6. Proyectos

Cada proyecto tiene `id` estable, `name` y `path` absoluto. Nombre y carpeta se
configuran desde **Projects**, con solo **Name** y **Folder**; el ID se genera
internamente. Folder admite escritura o selección mediante Explorar.

- Registrar una carpeta existente y legible; expandir `~` y rutas relativas al
  directorio desde el que se inició la aplicación.
- Normalizar la carpeta y detectar registros duplicados de la misma ubicación.
- No exigir que la carpeta sea un repositorio Git.
- Elegir proyecto mediante selector, `--project <id-o-nombre>` o `--cwd <ruta>`.
  Un nombre ambiguo requiere seleccionar el ID; no elegir uno silenciosamente.
- Recordar el último proyecto utilizado. Si no hay proyectos, mostrar el alta.
- Mantener conversación y borrador separados por sesión/proyecto.
- Abrir una pestaña por proyecto. Cambiar de pestaña conserva controles, foco,
  scroll/selección, undo del borrador, adjuntos, modo Vim, modelo y sesión.
- Permitir turnos simultáneos en proyectos distintos. Cada stream, reasoning,
  tool, resultado y cancelación actualiza solo su proyecto de origen.
- Cerrar una pestaña idle guarda su borrador y libera el lock; no quita el
  registro. Un turno activo bloquea cierre/cambio de sesión de su propia pestaña.
- Restaurar pestañas y proyecto activo al iniciar; cerrar todas deja el espacio
  vacío hasta abrir otro proyecto. Modales bloquean cambios por mouse/atajos.
- Todas las herramientas reciben el `cwd` del proyecto de forma explícita; no
  usar `process.chdir()` como estado global compartido.
- Quitar un proyecto del registro no borra su carpeta ni sus sesiones.
- Una carpeta movida o eliminada se informa y puede corregirse desde el registro.

Leer `AGENTS.md` de la raíz seleccionada y las instrucciones aplicables de sus
subcarpetas cuando se trabaje sobre ellas. No cargar instrucciones de otros
proyectos ni inventar reglas Git para el repositorio del usuario.

## 7. Configuración, proveedores y modelos

### Persistencia y precedencia

- `--config <archivo>` permite elegir la configuración global.
- Linux: configuración en `${XDG_CONFIG_HOME:-~/.config}/s42-agent/config.json`
  y sesiones en `${XDG_STATE_HOME:-~/.local/state}/s42-agent/sessions/`.
- macOS: bajo `~/Library/Application Support/s42-agent/`.
- Windows: configuración bajo `%APPDATA%/s42-agent/` y sesiones bajo
  `%LOCALAPPDATA%/s42-agent/sessions/`.
- Precedencia para una sesión nueva: selección explícita de CLI/TUI, preferencia
  del proyecto, default global. Una sesión reabierta conserva su selección salvo
  override explícito; si fue eliminada, se solicita elegir otra.
- Configuración versionada con `version: 1`. Validar antes de guardar y escribir
  mediante archivo temporal más rename en la misma carpeta.
- `workspace?: { openProjectIds: string[] }` conserva IDs existentes, únicos y en
  orden; `lastProjectId` indica la activa y cada proyecto su `lastSessionId`.
  Sin workspace, abrir el último/default/primer proyecto como antes. `[]` mantiene
  todas cerradas; un proyecto explícito de CLI se abre igualmente. Restaurar no
  reejecuta tools; si una sesión está bloqueada, liberar las ya abiertas durante
  ese intento y conservar la configuración para corregir el bloqueo.
- Nunca crear `.env.local`. Los secretos se obtienen de variables de entorno ya
  configuradas; la configuración solo guarda el nombre de la variable.
- La API key ingresada en Models vive solo en memoria durante esa ejecución.
  Si se proporciona, tiene prioridad sobre la variable configurada del proveedor.
- Las sesiones no guardan cabeceras HTTP ni valores de credenciales.

No habrá configuración ejecutable, evaluación de JavaScript ni comandos para
resolver claves. La política de carga automática de `.env`/`bunfig.toml` de Bun
debe quedar documentada y ser igual de explícita en desarrollo y en el binario.
Cambiarla respecto del mecanismo existente se propondrá antes de implementarlo.

### Contrato

Un proveedor contiene `id`, `name`, `kind`, `baseUrl`, `apiKeyEnv` opcional y una
lista de modelos. `kind` admite `llama.cpp` u `openai-compatible`; ambos usan el
cliente Chat Completions inicial, con las particularidades locales concentradas
en el módulo LLM.

Un modelo contiene `id` real del servidor, nombre visible, `contextWindow`,
`maxOutputTokens` y capacidades explícitas: `tools` y `images`. Contexto y
capacidades son datos configurados, no garantías inferidas del nombre.

### Proveedores precargados y configuración guiada

- Configuración nueva: llama.cpp en `http://127.0.0.1:8080/v1`, sin clave ni
  modelos inventados, y DeepSeek en `https://api.deepseek.com`, con
  `DEEPSEEK_API_KEY` como variable sugerida. El default sigue siendo llama.cpp.
- **Models → Proveedores / Nuevo proveedor** muestra primero esas dos opciones,
  con los valores personalizados existentes si ya están registradas. Las plantillas
  faltantes se pueden registrar al guardar; no se reinsertan en disco al leer JSON.
  Nuevo proveedor ofrece además una configuración manual para otro endpoint.
- Elegir abre un formulario con clave de sesión/variable, host, puerto y nombre.
  Guardar llama.cpp/DeepSeek consulta `/models` y abre un selector del catálogo
  obtenido para ese proveedor. La selección previa se mantiene hasta elegir modelo.
  Un HTTP401/error/lista vacía conserva el formulario y evita guardar la operación.
- Mostrar los nombres reales y tomar `context_window`/`input_modalities` cuando
  el catálogo los publica. Salida inicial: mínimo entre 2048, máximo reportado y
  contexto menos uno. Si solo hay IDs, usar contexto8192/salida2048 ajustables.
  Conservar las capacidades y límites de modelos ya configurados por el usuario.
- Tools de DeepSeek se habilitan según su contrato Chat Completions; imágenes
  según la metadata. Otros proveedores conservan tools desactivadas inicialmente.
  No inferir capacidades de nombres ni hardcodear una lista de modelos disponibles.
- Consulta cancelable con Ctrl+C, timeout y estado visible; sin requests de catálogo
  al iniciar. JSON/sesiones no contienen claves. [QA](qa/provider-presets.md).

Fuentes oficiales revisadas: [endpoint y autenticación](https://api-docs.deepseek.com/),
[catálogo y metadata](https://api-docs.deepseek.com/api/list-models/),
[Chat Completions/tools](https://api-docs.deepseek.com/api/create-chat-completion/).

Se pueden agregar, editar y quitar proveedores/modelos, seleccionar uno para la
sesión y guardar defaults. El selector muestra proveedor e ID del modelo para
evitar confundir modelos del mismo nombre en servidores distintos.

Al cambiar de modelo, verificar que pueda recibir las modalidades del historial
activo; si no, informar la incompatibilidad y permitir otra selección o una sesión
nueva. No eliminar adjuntos históricos silenciosamente para forzar el cambio.

Ejemplo ilustrativo: los paths y el modelo deben sustituirse por valores reales.
`local-coder` coincide con el alias del ejemplo de servidor de la sección 8.

```json
{
  "version": 1,
  "projects": [
    { "id": "s42-agent", "name": "s42-agent", "path": "/ruta/a/s42-agent" }
  ],
  "providers": [
    {
      "id": "llama.cpp",
      "name": "Local",
      "kind": "llama.cpp",
      "baseUrl": "http://127.0.0.1:8080/v1",
      "models": [
        {
          "id": "local-coder",
          "name": "Coder local",
          "contextWindow": 8192,
          "maxOutputTokens": 2048,
          "capabilities": { "tools": true, "images": false }
        }
      ]
    },
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "kind": "openai-compatible",
      "baseUrl": "https://api.deepseek.com",
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "models": []
    }
  ],
  "promptings": [],
  "defaults": {
    "projectId": "s42-agent",
    "providerId": "llama.cpp",
    "modelId": "local-coder"
  },
  "ui": { "vimMode": true, "color": "auto", "palette": "qbasic" }
}
```

La primera configuración crea los proveedores local y DeepSeek, sin inventar modelos.
Si `/models` devuelve uno, se puede ofrecer seleccionarlo; si devuelve varios,
el usuario elige. Si el endpoint no soporta descubrimiento, se registra el ID
manualmente. El default de proveedor es `llama.cpp` aun antes de elegir modelo.

### Transporte y errores

- POST a `{baseUrl}/chat/completions`, `stream: true`, mensajes y herramientas
  conforme al contrato del endpoint. Normalizar `/` sin duplicar `/v1`.
- Autenticación Bearer solo si se configuró `apiKeyEnv` y tiene un valor.
- Parser SSE incremental con CRLF/LF, líneas y JSON divididos entre chunks,
  múltiples eventos por chunk, UTF-8 incremental, eventos vacíos y `[DONE]`.
- Reconstruir tool calls por índice/ID y acumular argumentos hasta su cierre.
- Leer deltas `reasoning_content` (llama.cpp) o `reasoning` (vLLM), mostrarlos y
  conservar el campo recibido con el mensaje y el historial enviado al proveedor.
  [Servidor llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md),
  [Reasoning de vLLM](https://docs.vllm.ai/en/latest/features/reasoning_outputs/).
- Nunca ejecutar argumentos parciales ni JSON inválido.
- Conservar texto/razonamiento parcial y distinguir cancelación, desconexión y fin
  correcto. No persistir llamadas incompletas como llamadas ejecutables.
- Timeouts iniciales: conexión/primer evento hasta 120 s e inactividad del stream
  hasta 120 s, configurables para equipos locales lentos. No limitar por defecto
  la duración total mientras el servidor siga emitiendo datos.
- Informar 401, 404, 429, 5xx, modelo ausente y contexto excedido de forma accionable.
- Sin fallback cloud ni reintento automático de un turno con posibles efectos.
- Mostrar tokens/velocidad solo si el proveedor los reporta. Un dato ausente no
  equivale a cero; cualquier estimación se identifica como aproximada.

## 8. `llama.cpp` como flujo predeterminado

El usuario inicia un `llama-server` externo con un GGUF apto para coding y tool
calling. Ejemplo orientativo, no ejecutado por esta tarea:

```bash
llama-server -m /ruta/modelo.gguf --alias local-coder --host 127.0.0.1 --port 8080 -c 8192 --jinja
```

El modelo, su chat template, el tamaño de contexto y la versión del servidor
condicionan el tool calling. Activar `--jinja` no prueba que un GGUF específico
vaya a realizar una tarea de coding correctamente. No fijar un modelo por moda
ni exigir GPU para ejecutar el harness.

La validación local tiene tres niveles independientes:

1. Endpoint accesible y modelo disponible.
2. Streaming de texto y cancelación operativos.
3. Tool call real: leer un archivo fixture, editarlo y ejecutar su verificación.

Si el servidor no está disponible, la TUI sigue funcionando y permite corregir
el endpoint. Un modelo sin `tools` puede usarse para conversación, pero se indica
que no puede ejecutar coding autónomo. No convertir texto del modelo en comandos
mediante expresiones regulares como sustituto de tool calling.

El servidor puede tener modelos multimodales, pero eso requiere configuración
adicional del propio `llama.cpp`. No enviar una ruta local al servidor como si el
servidor remoto compartiera el filesystem del cliente.
[Servidor](https://github.com/ggml-org/llama.cpp/blob/42d958167a748f2c04b1f888e84e7a58f609ddcb/tools/server/README.md),
[function calling](https://github.com/ggml-org/llama.cpp/blob/42d958167a748f2c04b1f888e84e7a58f609ddcb/docs/function-calling.md).

## 9. Ciclo del agente y herramientas

Estados: `idle → requesting → streaming → executing-tools → requesting`, hasta
`completed`, `cancelled` o `failed`, y luego vuelta a `idle`. El resultado del
turno se conserva aunque la aplicación permita iniciar otro.

Un turno captura proyecto, sesión, proveedor y modelo de su pestaña. El usuario
puede editar un borrador y cambiar de pestaña mientras continúa; cada proyecto
admite un turno activo. Ctrl+C cancela solo el actual; Ctrl+Q aborta todos, espera
su cierre y guarda cada sesión. Completar en segundo plano no roba foco ni
reemplaza el borrador, historial o estado del proyecto visible.

### Herramientas iniciales

| Herramienta | Entrada esencial | Comportamiento |
| --- | --- | --- |
| `read` | path, offset y límite opcionales | Leer texto con límites e indicar si fue recortado. |
| `list` | path y glob opcional | Listar archivos y carpetas sin cargar todo el repositorio. |
| `search` | patrón de texto y path/glob | Búsqueda literal inicial, resultados con archivo y línea. |
| `write` | path y contenido | Crear o reemplazar contenido; informar el archivo afectado. |
| `edit` | path, texto anterior y nuevo | Reemplazo exacto único; cero o varias coincidencias devuelven error. |
| `shell` | comando y timeout opcional | Ejecutar mediante `Bun.spawn` con cwd explícito, stdout/stderr y exit code. |

`list/search` usan recorrido incremental con exclusiones iniciales de `.git`,
`node_modules`, `dist` y `out`. No depender de `rg` instalado para el funcionamiento
básico ni introducir un indexador. Las búsquedas complejas pueden ejecutarse con
`shell` si el proyecto tiene la herramienta adecuada.

`shell` usa el shell del usuario o el shell de la plataforma, registrado como
argumentos explícitos a `Bun.spawn`; no construir un comando envolvente mediante
concatenación de rutas. El texto del comando sigue teniendo efectos reales de
shell. En la primera versión no se incluyen programas interactivos que necesiten
tomar el control del terminal.

- Validar nombre de herramienta, esquema de argumentos e ID de llamada.
- Ejecutar las llamadas secuencialmente y devolver un resultado por ID.
- Una falla de herramienta vuelve al modelo como error, sin presentarse como
  éxito ni detener por defecto la posibilidad de que corrija el argumento.
- Límite inicial de 30 iteraciones con herramientas por turno, configurable;
  al agotarse, terminar con estado y motivo explícitos.
- Timeout de comando inicial: 120 s, configurable. Recortar salida enviada al
  modelo a 64 KiB por herramienta y conservar el indicador de recorte.
- Leer stdout y stderr concurrentemente para no bloquear el subproceso.
- Cancelar el HTTP, impedir nuevas llamadas y terminar procesos iniciados por
  el turno. Verificar también los descendientes según el sistema operativo;
  `proc.kill()` por sí solo no prueba limpieza de todo el árbol.
- No asumir que cancelar deshace archivos escritos ni comandos ya ejecutados.
- No repetir automáticamente tools pendientes después de reiniciar.

Las rutas relativas se resuelven contra el proyecto del turno. Las rutas
absolutas expresamente utilizadas permanecen visibles en los argumentos; no se
afirma aislamiento de filesystem. Las herramientas corren con los permisos del
usuario que abrió el agente. Sandbox y aprobaciones son propuestas de la sección
15, no componentes ocultos del MVP.

No hacer automáticamente pull, commit, push ni modificar Git en proyectos ajenos
salvo que sus instrucciones o la tarea lo indiquen. La regla Git del `AGENTS.md`
de **este repositorio** gobierna el desarrollo de s42-agent.

### Contexto

Incluir instrucciones aplicables, historial coherente, mensaje del usuario,
adjuntos y resultados de herramientas. No adjuntar recursivamente toda la carpeta.

Reservar `maxOutputTokens` dentro del contexto configurado. La estimación de
entrada sin tokenizador del modelo es aproximada (bytes de texto/4 más reserva
de 1024 tokens por imagen); prevalece el límite reportado
por el servidor. Recortar resultados de herramientas de forma explícita, mantener
pares tool call/result y nunca eliminar silenciosamente mensajes del usuario.
Cuando no alcance el contexto, informar y permitir `/new`; no llamar otro modelo
para resumir de manera automática en la primera versión.

## 10. Drag & drop y adjuntos

Una aplicación de terminal no recibe necesariamente eventos de drag & drop del
sistema operativo. Normalmente el emulador pega rutas. El soporte se define como
la conversión de esas rutas en adjuntos, y depende del terminal utilizado.

### Flujo

1. El usuario arrastra uno o varios archivos a la ventana del terminal.
2. El terminal inserta rutas como texto, idealmente con bracketed paste.
3. Si el bloque completo contiene rutas reconocibles a archivos existentes, se
   agregan al borrador y se muestran nombre, ruta y tamaño.
4. El usuario puede quitarlos y presiona Enter para enviar el mensaje.

No iniciar inferencia al soltar un archivo. Una ruta sin texto acompañante puede
adjuntarse y luego recibir una instrucción escrita.

Reconocer rutas POSIX con espacios escapados o comillas, rutas Windows con drive
o UNC, nombres Unicode y URLs `file://` con escapes válidos. El parser es de rutas,
no evalúa texto como shell. Un bloque de código o un mensaje que mencione un path
no se convierte indiscriminadamente en un adjunto.

Con marcadores de paste, funcionar en INSERT y NORMAL sin ejecutar movimientos
Vim. Si el terminal entrega caracteres sin marcadores, usar INSERT y reconocer
la línea de rutas al pulsar Enter: ese primer Enter adjunta; el siguiente envía.
No prometer detección automática fiable de un drop sin límites de pegado.

Alternativas en todos los terminales soportados: `/attach <ruta>` y Ctrl+F.
Un terminal que no entrega rutas debe usar esas alternativas.

### Contenido

- Código y texto UTF-8: enviar contenido con delimitador y nombre de archivo.
- Imágenes PNG/JPEG/WebP: enviar bytes codificados como data URL si el modelo y
  el endpoint tienen `images: true`; si no, mostrar incompatibilidad antes del envío.
- PDF, audio, video, archivos comprimidos y otros binarios: informar que no se
  extraen en esta versión; no enviarlos como texto ni afirmar haberlos leído.
- Carpetas: no adjuntar recursivamente; permitir elegir archivos individuales.
- Valores iniciales: hasta 10 archivos, 1 MiB por archivo de texto, 5 MiB por
  imagen y 10 MiB de payload agregado después de codificar. Mostrar el límite
  excedido y permitir quitar archivos; no recortar contenido en silencio.
- Verificar lectura al enviar. Si un archivo desapareció o cambió después del
  drop, informar y actualizar su previsualización antes de confirmar el envío.
- Persistir una copia del contenido enviado junto a la sesión; volver a abrirla
  no debe sustituir el adjunto histórico por una versión nueva del archivo.

Matriz de QA inicial: terminal Linux disponible con drop, Terminal/iTerm2 en
macOS y Windows Terminal. Anotar emulador, versión y formato de rutas observado;
solo declarar soportados los casos comprobados.

## 11. Sesiones y recuperación

- Identificador de sesión independiente del nombre del proyecto.
- Registro JSONL con eventos versionados, timestamp, ID, proyecto, selección
  LLM y mensajes canónicos de usuario/asistente/herramienta.
- Guardar mensajes finalizados, inicio/resultado de herramientas y resultado
  del turno; no escribir un evento de disco por token.
- Guardar borrador en cambios de sesión/proyecto y cierre normal. Conservar un
  mensaje parcial explícitamente marcado en cancelación o error.
- Un solo escritor serializado por sesión. Append real, sin reabrir un writer
  que reemplace el archivo. Persistir el inicio antes de ejecutar una herramienta.
- En recuperación, una herramienta iniciada sin resultado queda «interrumpida».
  Completar su representación para el contexto con ese estado, sin ejecutarla otra vez.
- Una última línea incompleta puede recuperarse conservando las anteriores.
  Corrupción en una línea completa intermedia se informa; no descartar el resto
  silenciosamente.
- `Bun.JSONL.parse()` puede devolver un prefijo válido sin lanzar ante errores
  posteriores; usar un recorrido que compruebe errores y límites de registro,
  por ejemplo `parseChunk`, además de validar el esquema del evento.
- Reanudar en `idle`, conservando historial, modelo y proyecto disponibles.
- No ofrecer escritura concurrente de la misma sesión desde dos instancias;
  detectar el caso y pedir abrir una nueva o usar la instancia existente.
- No enviar sesiones fuera del equipo salvo el contexto de una petición al
  proveedor que el usuario seleccionó.

La durabilidad garantiza registros completados según las escrituras verificadas;
no promete recuperar cada token ni resistir todo corte eléctrico. La política de
flush se verifica en las pruebas de interrupción.
[JSONL de Bun](https://bun.com/docs/runtime/jsonl).

## 12. Rapidez y estabilidad

Objetivos del producto. La demo tiene mediciones históricas en
[qa/tui-demo.md](qa/tui-demo.md). El harness final mide SSE, sesiones y arranque
en [QA integral](qa/final-validation.md); inferencia real se verifica aparte.

| Métrica | Objetivo | Medición |
| --- | --- | --- |
| Arranque del binario hasta primer frame | p95 ≤ 200 ms | 30 ejecuciones, sin conexión LLM ni carga del modelo; declarar caché del SO. |
| Tecla completa a frame visible | p95 ≤ 50 ms | 100 entradas con reloj monotónico y terminal de prueba. |
| Delta recibido a actualización | p95 ≤ 100 ms | SSE fixture y TUI; excluir latencia de red/inferencia. |
| Memoria en reposo | RSS ≤ 100 MiB | TUI iniciada con sesión nueva, sin subprocesos ni modelo. |
| Reanudación de sesión de 1.000 mensajes | ≤ 1 s | Fixture de hasta 10 MiB, layout y ventana visibles. |
| Repintados sin actividad | 0 frames | Observación de 10 s en estado idle. |

Registrar CPU, RAM, SO, Bun, tamaño del binario y fixture. Separar inicio del
proceso, primer frame, primer token e inferencia; no atribuir al harness la
velocidad del modelo. Si un objetivo no se cumple, reportar la medición antes de
agregar workers o una dependencia.

Pruebas de estabilidad: 50 ciclos de abrir/cancelar/cerrar con terminal restaurado;
sesión de 30 min con modelo fixture; desconexiones, archivos ausentes, disco no
escribible, resize durante streaming y cancelación de un comando con descendientes.

Evitar IO síncrono en el bucle de UI, crecimiento ilimitado de salida en memoria,
intervalos de repintado permanentes y reparsear toda la conversación por delta.
El historial durable puede crecer; el viewport y sus caches tienen límites.

## 13. Binarios y plataformas

El primer build será mínimo y verificable:

```bash
bun build ./index.ts --compile --outfile ./dist/s42-agent
```

Comando implementado en `bun run build`. `index.ts` es el único entrypoint del
harness persistente y la demo se conserva con --demo.
El artefacto histórico Linux x64 y sus mediciones están registrados en
[qa/tui-benchmark.json](qa/tui-benchmark.json).
Ese registro corresponde al hito inicial `c098d88`; las iteraciones posteriores
de UX se comprueban desde la fuente. No recompilar por rutina durante esta etapa.

En desarrollo, empezar por Linux x64, que es el entorno de este checkout. La
distribución objetivo incluye Linux x64/arm64, macOS x64/arm64 y Windows x64.
Bun 1.4.2 documenta un binario x64 con selección de instrucciones por runtime;
los sufijos baseline/modern se conservan como alias y no se necesitan para
elegir CPU. No prometer soporte de una
plataforma solo porque Bun puede cross-compilarla.

Cada target declarado soportado debe ejecutarse en ese SO/arquitectura, fuera del
checkout y sin Bun/Node instalados: inicio, configuración, proyecto, sesión,
streaming, una herramienta y cierre/restauración. El cross-build es evidencia de
compilación, no de operación.

Comparar build normal frente a `--minify --sourcemap --bytecode`; fijar los flags
por mediciones y corrección. Bun documenta ESM bytecode con `--compile` en su
versión actual. Evaluar `--smol` solo si la memoria lo justifica.

Assets estáticos deben importarse para embeberse; configuración y sesiones viven
fuera del binario. No usar rutas del checkout ni de `node_modules` en runtime.
No incluir GGUF, binario de `llama.cpp`, credenciales o valores privados de entorno
en el ejecutable. Registrar versión Bun, versión app, target y checksum del artefacto.
[Ejecutables](https://bun.com/docs/bundler/executables),
[bytecode](https://bun.com/docs/bundler/bytecode).

## 14. Estrategia de validación y orden de desarrollo

Tests con `bun:test` sobre comportamientos: parser de teclado/mouse/paste, Unicode,
clic/release, drag, clipping, foco, superposición, menús y modales,
acciones Vim, separación de proyectos, append/recuperación, SSE fragmentado,
tool calls, edición exacta, cancelación, adjuntos y selección de defaults.

Las integraciones reproducibles usan servidores HTTP fixture con `Bun.serve` y
repositorios temporales. Las pruebas con un GGUF real se identifican por separado
y documentan modelo, quantización, template, versión de servidor y resultado.
No llamar cobertura real a una suite omitida por falta de modelo.

La QA de input/render se puede automatizar con `Bun.Terminal`. Las secuencias de
mouse inyectadas prueban el parser y la UI, pero clic, rueda y arrastre con mouse
real también requieren un terminal gráfico. Arrastrar archivos desde el SO
requiere su propia prueba manual.
Usar un emulador de prueba solo como dependencia de desarrollo si hace falta
validar el estado de pantalla, sin añadirlo al runtime.

Orden y tareas en [phases/README.md](phases/README.md):

1. Componentes visuales QBasic, mouse y demo de viabilidad desde Bun.
2. TUI del harness sobre esos componentes: conversación, editor y eventos fixture.
3. Configuración, proyectos y sesiones.
4. Proveedores y streaming local.
5. Ciclo de coding y herramientas.
6. Vim, drag & drop y adjuntos completos.
7. QA integrada, rendimiento y binarios de distribución.

La primera demo debe comprobarse antes de conectar proveedores y herramientas;
el primer hito no es una CLI de texto ni el backend del agente.

Una fase se termina con evidencia de sus criterios, no solamente con un commit.
Las tareas de desarrollo permanecen pendientes en esta entrega documental.

## 15. Propuestas que requieren aprobación

Estas mejoras no forman parte de las fases de la primera versión y no se implementan como
efecto secundario:

- **Permisos y sandbox por herramienta:** reducir el alcance de filesystem,
  shell y red, y revisar comandos antes de ejecutarlos. El MVP corre con los
  permisos del usuario; registrar un proyecto no lo aísla.
- **Keychain del sistema:** almacenar credenciales con `Bun.secrets` cuando su
  estabilidad y dependencia de servicios del SO sean adecuadas. La documentación
  actual la marca experimental; inicialmente se usan variables de entorno.
- **Carga de entorno explícita:** desactivar autoload de `.env` y `bunfig.toml`
  del cwd en el binario para desacoplarlo de proyectos externos. Bun permite
  configurarlo al compilar; hay que decidirlo respetando el mecanismo existente.
- **Protocolos adicionales:** clientes nativos Anthropic/Google u otros, si los
  proveedores concretos que se quieran utilizar no ofrecen el contrato inicial.

[Secrets](https://bun.com/docs/runtime/secrets),
[autoload en ejecutables](https://bun.com/docs/bundler/executables).

## 16. Investigación de Bun y Pi

### Cobertura y límites de la revisión

Se consultaron el [índice oficial completo](https://bun.com/llms.txt) y su
[corpus de documentación](https://bun.com/llms-full.txt) el 2026-10-01. El índice
enumera **319 páginas** y las 319 estaban presentes en el corpus consultado:

| Familia | Páginas | Aplicación al proyecto |
| --- | ---: | --- |
| Runtime | 63 | IO, procesos, streams, texto, entorno y compatibilidad. |
| Package manager | 27 | Dependencias, lockfile, instalación reproducible y lifecycle. |
| Bundler | 13 | Ejecutables, targets, assets, minificación y bytecode. |
| Test runner | 13 | Fixtures, mocks, hooks, pruebas asíncronas y reportes. |
| Guides | 191 | Recetas de archivos, stdin, señales, procesos, tipos, builds y CI. |
| Proyecto Bun | 6 | Benchmarking, licencia y diferencias de plataforma. |
| Introducción, instalación, quickstart, TypeScript y feedback | 6 | Baseline del runtime y herramientas. |

SHA-256 del corpus obtenido:
`9d0810446ac194bc82f86dc021cd0c433582c1605928d3f5273db31f64481059`.

La revisión cubrió el inventario completo, descripciones y estructura por página,
y lectura técnica focalizada en las APIs que determinan este diseño. Esto no
certifica lectura línea por línea de todos los ejemplos ni de cada símbolo de la
referencia API, que es una fuente adicional al corpus. Cada implementación deberá
consultar su contrato concreto y comprobarlo en la versión fijada.

También se comprobó en Bun 1.4.2 la presencia de `Bun.Terminal`, `Bun.color`,
`Bun.stringWidth`, `Bun.wrapAnsi`, `Bun.stripANSI`, `Bun.markdown.render`,
`Bun.JSONL.parseChunk` y `Bun.Glob`. En una PTY se comprobó que
`process.stdin.setRawMode` está disponible; fuera de TTY no lo está. Estas pruebas
comprueban disponibilidad, no una TUI implementada ni soporte multiplataforma.

### Capacidades revisadas y selección

| Capacidad de Bun | Uso inicial o decisión |
| --- | --- |
| Runtime TS/ESM, tipos y resolución | Código del harness; verificar tipos por separado. |
| File IO, Glob, filesystem compatible | Archivos, búsqueda, configuración y almacenamiento. |
| Streams y Fetch | Consumo incremental del endpoint; no esperar el cuerpo completo. |
| Spawn, señales y Terminal | Tools cancelables y pruebas PTY; la TUI controla su propio stdin. |
| Color, stringWidth, wrapAnsi y stripANSI | Tema y layout sin paquetes de color/ancho. |
| Markdown | Render ANSI con callbacks; no incluir React para la TUI. |
| JSONL | Lectura de sesiones con comprobación explícita de errores. |
| Build, loaders, assets y bytecode | Distribución como binario y optimizaciones medidas. |
| Test runner, mocks y snapshots | Contratos y escenarios de recuperación. |
| Package manager, lockfile y lifecycle | Instalar con Bun y versionar un lock reproducible. |
| Debugger y benchmarking | Diagnóstico y mediciones cuando existan implementaciones. |
| Workers | Sin uso inicial; la API documenta partes experimentales. |
| SQLite, SQL, Redis y S3 | Sin uso inicial: archivos locales cubren el almacenamiento. |
| FFI, C compiler y Node-API | Sin uso inicial: evitar código nativo y toolchains extra. |
| Secrets | Propuesta pendiente; la API está marcada experimental. |
| HTTP server | Fixtures de pruebas; sin backend obligatorio del producto. |
| WebSockets, TCP, UDP, DNS y cookies | Sin necesidad adicional al cliente HTTP inicial. |
| Cron, WebView, CSRF y HTMLRewriter | Fuera del alcance del harness solicitado. |
| Image y Archive | No requeridos para adjuntar bytes; no agregar transformación/extracción. |
| TOML, YAML, JSON5, XML, hashing y semver | Revisados; JSON y versiones simples alcanzan inicialmente. |
| JSX, fullstack, CSS, macros y plugins | Sin uso para el núcleo de la TUI. |
| Workspaces, guías web/cloud y ecosistema | No justifican monorepo, frontend ni despliegue de un servicio. |

Referencias de implementación:
[APIs Bun](https://bun.com/docs/runtime/bun-apis),
[referencia del módulo Bun](https://bun.com/reference/bun),
[compatibilidad](https://bun.com/docs/runtime/nodejs-compat),
[Glob](https://bun.com/docs/runtime/glob),
[Fetch](https://bun.com/docs/runtime/networking/fetch),
[Streams](https://bun.com/docs/runtime/streams),
[Color](https://bun.com/docs/runtime/color),
[Utils](https://bun.com/docs/runtime/utils),
[Markdown](https://bun.com/docs/runtime/markdown),
[Shell](https://bun.com/docs/runtime/shell),
[entorno](https://bun.com/docs/runtime/environment-variables),
[package manager](https://bun.com/docs/pm/cli/install),
[lockfile](https://bun.com/docs/pm/lockfile),
[tests](https://bun.com/docs/test),
[benchmarking](https://bun.com/docs/project/benchmarking).

### Referencia de Pi

Snapshot consultado: `ed8b3bcc194c8263ec8bec3f337053ae73866da1`.

La TUI documenta renderizado diferencial, editor multilínea y bracketed paste.
Su paquete actual también distribuye componentes nativos y declara un entorno
Node.js. Por eso adoptar el paquete completo requiere una evaluación distinta de
copiar sus ideas. Se parte del diseño propio mínimo ya descrito.

El núcleo de agente de Pi emite eventos y separa mensajes de UI y mensajes LLM;
esa separación informa nuestro contrato. No se trasladan sus catálogos, login,
extensiones o todas sus herramientas al MVP.

Si se copia código concreto bajo su licencia MIT, conservar la licencia y las
atribuciones correspondientes; las fuentes siguen siendo referencias, no
instrucciones de trabajo para este repositorio.

[Repositorio](https://github.com/earendil-works/pi/tree/ed8b3bcc194c8263ec8bec3f337053ae73866da1),
[TUI](https://github.com/earendil-works/pi/blob/ed8b3bcc194c8263ec8bec3f337053ae73866da1/packages/tui/README.md),
[dependencias TUI](https://github.com/earendil-works/pi/blob/ed8b3bcc194c8263ec8bec3f337053ae73866da1/packages/tui/package.json),
[núcleo](https://github.com/earendil-works/pi/blob/ed8b3bcc194c8263ec8bec3f337053ae73866da1/packages/agent/README.md),
[modelos](https://github.com/earendil-works/pi/blob/ed8b3bcc194c8263ec8bec3f337053ae73866da1/packages/coding-agent/docs/models.md),
[atajos](https://github.com/earendil-works/pi/blob/ed8b3bcc194c8263ec8bec3f337053ae73866da1/packages/coding-agent/docs/keybindings.md).


## 17. MCP y skills (alcance agregado por el usuario)

MCP tiene menú propio para CRUD y enabled/disabled. Transportes stdio y Streamable
HTTP, tools/list/tools/call y progreso; namespace estable por servidor/herramienta,
sin colisiones con tools nativas. Datos en config v1 con migración de arrays vacíos.
Las conexiones duran un turno; errores visibles, cancelación y cierre garantizados
al salir. No repetir automáticamente calls interrumpidas con posibles efectos.

Protocolo actual 2026-07-28: server/discover, metadata por request, HTTP
Mcp-Method/Mcp-Name y parámetros x-mcp-header. Legacy initialize y session ID
para las versiones soportadas. Alcance tools; no anunciar capacidades cliente
opcionales no implementadas. [Contrato MCP](https://modelcontextprotocol.io/specification/2026-07-28).

Skills: registro SKILL.md global o por proyecto, enabled/disabled, YAML nativo,
catálogo de nombre/description y body bajo demanda mediante tool skill. Invocación
explícita /skill nombre prompt carga instrucciones antes del request. Se conserva
base directory para recursos relativos. No ejecutar scripts por instalar/cargar.
SKILL.md hasta 256 KiB; estimación de contexto incluye las instrucciones cargadas.

Buscador usa https://skills.sh/api/search con query/limit, contrato del CLI oficial
de Vercel. Resultados con nombre/origen/instalaciones/enlace. Instalación elegida
por el usuario: clonar repo GitHub con Git, copiar carpeta y assets/references/
scripts, conservar licencias y registrar origen. Orígenes sin repo identificable
se consultan por enlace y registro local. [Agent Skills](https://agentskills.io/specification),
[CLI oficial](https://github.com/vercel-labs/skills/blob/main/src/find.ts),
[YAML Bun](https://bun.sh/docs/runtime/yaml).

Distribución local de esta entrega: [manifest](qa/build-targets.json), Linux x64
[smoke](qa/binary-smoke.json) y comparación de flags en QA integral. Sin release
remota; cross-compilación no declara compatibilidad runtime.

## 18. Promptings reutilizables (alcance agregado por el usuario)

Biblioteca global en el JSON de configuración: `promptings: Prompting[]`, con
`Prompting = { id: string; name: string; text: string }`. Nombre y cuerpo no
vacíos, ID estable y único; configuraciones anteriores sin el campo usan `[]`.
El registro se guarda por el mecanismo atómico existente, sin archivos nuevos
de configuración ni separación artificial por proveedor/proyecto.

- **Promptings → Biblioteca**, Alt+T, /promptings y NORMAL Espacio+t abren el CRUD.
  **Guardar prompt actual** crea una plantilla desde el borrador. Formulario
  con nombre y editor multilínea; lectura/edición y eliminación desde el listado.
- Texto con `{{metavar_name}}`: letras ASCII, números y `_`, inicial letra o `_`;
  espacios dentro de las llaves permitidos. Otras expresiones con llaves se
  conservan como texto literal. Preguntar nombres únicos en orden de aparición.
- Cada valor tiene editor multilínea y permite vacío; Anterior/Siguiente conserva
  respuestas. Enter avanza/aplica, Shift+Enter inserta línea; Esc cancela sin
  modificar el borrador. El prompt fijo permanece visible durante los modales.
- Sustituir una sola vez y literalmente, sin evaluar código ni expandir los
  placeholders que vengan dentro de un valor. Repeticiones comparten respuesta.
  Guardar siempre la plantilla original; los valores resueltos pasan al draft y
  al historial existente de la sesión cuando se usan.
- **Cargar en el editor** deja revisar el texto resuelto, en INSERT y con foco
  en el prompt. **Ejecutar con modelo actual** usa la misma sesión/proyecto y
  pipeline de streaming/tools; envía el contenido como texto, incluidos prefijos
  de comando o ruta. Falta de modelo deja el texto completo para corregir la
  configuración. Turno activo bloquea reemplazo del borrador.

Implementación: `src/prompts.ts`, `src/ui/promptings.ts`, configuración y App.
[Fase09](phases/09-promptings.md), [QA](qa/promptings.md): tests fuente, payload
SSE de fixture y capturas tmux; sin pruebas adicionales de binarios o mouse físico.

## 19. Pestañas, organización y preparación open source

Las pestañas reutilizan los paneles fijos y los componentes existentes. Su estado
vive en `src/project-tab.ts`; `TabBar` maneja render, clipping, overflow y mouse.
App activa controles de la pestaña elegida; el loop recibe un contexto por turno.
No se crean procesos extra, un framework de ventanas nuevo ni dependencias de
runtime para habilitar proyectos simultáneos.

Licencia MIT en `LICENSE`, metadata de repositorio/homepage/issues en package.json
y documentación reproducible en README/CONTRIBUTING. Plantillas GitHub para bugs
y PR; CI Linux con Bun 1.4.2, install frozen, typecheck y tests fuente. No requiere
API keys ni un modelo activo. Mantener `private: true` para evitar publicación npm
incidental; este campo no controla la visibilidad de GitHub.

[Fase10](phases/10-project-tabs-and-open-source.md) y [QA](qa/project-tabs.md)
documentan concurrencia, aislamiento, restauración, controles y menús a 60×16.
[Publicación](PUBLISHING.md) describe los pasos externos: push, visibilidad,
CI remota y releases. Preparar estos archivos no realiza esos pasos ni demuestra
compatibilidad adicional por SO. No se crean nuevos binarios en esta iteración.
