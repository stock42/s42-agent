# Changelog

Registrar aquí los cambios realizados en s42-agent. Actualizar el archivo al
cierre de cada tarea e incluirlo en su commit.

## 2026-10-01

### Agregado

- `docs/SPECS.md`: alcance del harness TypeScript/Bun, TUI en color, proyectos,
  sesiones, atajos Vim, drag & drop, proveedores/modelos y `llama.cpp` por defecto.
- Contratos de streaming, herramientas, cancelación, recuperación, binarios y
  objetivos de rendimiento, distinguiendo diseño de implementación verificada.
- Investigación con fuentes oficiales de Bun, inventario de sus 319 páginas
  del corpus y referencias a snapshots de Pi y `llama.cpp`.
- `docs/phases/`: índice y siete fases con tareas, dependencias, escenarios de
  aceptación y espacio para registrar evidencia real.
- `AGENTS.md`: datos del proyecto, preferencias globales y regla de hacer
  `git pull` antes de cada tarea, actualizar este registro y hacer commit al cierre.
- Alternativa de estética QBasic compatible con el renderer ANSI y modos Vim;
  elección visual pendiente del usuario, sin implementar una TUI todavía.

### Estado

- Entrega documental; no se implementó el harness ni se modificó el scaffold.
- Se intentó `git pull`; el repositorio no tiene remoto ni upstream configurado.
  Esta tarea continúa localmente sin afirmar sincronización o publicación remota.

### Actualizado — UI QBasic y primer hito visual

- Confirmada la UI estilo QBasic con mouse y escritorio de ventanas TUI. La
  selección visual ya no está pendiente; Pi queda como referencia del agente.
- Agregados los contratos de componentes, foco, superposición, clipping, botones,
  títulos/cierre, menús desplegables, diálogos, clic/release, rueda y arrastre.
- La fase 00 pasa a ser `00-tui-viability.md`: demo Bun de componentes visuales,
  compilada y comprobada antes de integrar LLMs o herramientas de coding.
- La fase 01 reutiliza esa biblioteca para la conversación/editor del harness;
  los modos Vim respetan el foco de menús y diálogos.
- Actualizados AGENTS y criterios de validación para distinguir eventos mouse
  inyectados en PTY de la interacción con mouse real en un terminal gráfico.
- Este cambio de diseño no constituye una demo implementada ni una prueba de
  viabilidad completada. Se volvió a intentar `git pull`, sin remoto/upstream.

### Agregado — Demo QBasic desde index.ts

- `index.ts` raíz como punto de entrada: laboratorio TUI, ayuda/version y opciones
  sin color/mouse; error limpio si falta terminal interactivo.
- `src/ui/components/`: Window, Button, Input, SelectList y MenuBar con
  desplegable integrado; modal reutilizando Window. Desktop con foco, capas,
  cierre, captura de mouse y arrastre de títulos.
- Parser incremental de teclado, mouse SGR y paste; canvas con grafemas Unicode,
  clipping y renderer por filas modificadas. Paleta QBasic, estados por texto,
  cursor monocromo, resize y lifecycle con cleanup.
- Scripts Bun `dev`, `typecheck`, `test`, `build` y `bench:tui`; Bun/types 1.4.2,
  TypeScript 7.0.2 y lockfile. Cero dependencias de runtime.
- 17 tests de comportamiento/PTY, binario Linux x64 compilado y ejecutado desde
  `/tmp`; benchmark sobre una copia externa con PATH sin Bun/Node.
- README, specs, AGENTS y fase 00 actualizados. Evidencia en `docs/qa/`: capturas
  tmux, mediciones, hallazgos corregidos y límites de la validación.
- Medición final PTY: arranque p95 16,76 ms (30 muestras), input p95 35,93 ms
  (100), RSS 36,39 MiB, cero bytes en idle de 10 s y 50 ciclos de modales.
- Fase 00 En curso: quedan mouse físico y host sin Bun/Node. Proveedores,
  agente de coding y drag & drop del SO siguen pendientes.
- Tras configurar el remoto, se volvió a intentar `git pull`: el remoto aún no
  tiene ramas y `main` no tiene upstream. Trabajo y commit locales; sin push.

### Mejorado — Experiencia TUI como prioridad

- Registrada la prioridad del usuario: iterar sobre la TUI desde Bun; reservar
  builds, smoke y benchmarks de binarios para distribución o pedido explícito.
  Actualizados AGENTS, specs, README y fases para evitar compilación por rutina.
- Componentes conserva edición, selección y foco al volver; layout 60×16 con
  tres filas de lista y estado separado de los botones.
- Selección/reemplazo de texto mediante Ctrl+A, Shift+flechas/Home/End y arrastre,
  con grafemas Unicode y recuperación de contexto al ensanchar el input.
- Menús por hover o pulsar/arrastrar/soltar; accesos Alt únicos, ayuda Alt+Y desde un
  menú abierto, modales centrados y atajos contextuales en la barra inferior.
- Feedback correcto al arrastrar afuera de botones/cierre; release fuera del
  área visible cancela. Lista con PageUp/Down, indicadores de scroll y marco inerte.
- Corregido el orden de capas del escritorio vacío: su mensaje ya no tapa las
  opciones del menú Demo. Ventanas → Componentes permite recuperar el laboratorio.
- Retirados los atajos F1–F12 por colisiones con el SO; Escape abre/cierra menús,
  Ctrl+N cambia de ventana y Alt+Y abre ayuda. Actualizados CLI, ayuda y documentación.
- Once escenarios UX nuevos; 28 casos de fuente/componentes/PTY comprobados,
  typecheck y capturas tmux. Evidencia en `docs/qa/tui-ux.md`.
- No se ejecutaron builds ni benchmarks de binarios. Mouse físico pendiente.
  `git pull` intentado: `main` sigue sin upstream; commit local.

### Mejorado — Editor del proyecto y prompt fijo

- Retirados los corchetes decorativos del Input: borrado completo y cursor sobre
  el texto. Botones centrados sin marcadores de foco/presión combinados, estados
  por color/video inverso/tenue, cabeceras conectadas al marco y sombras de una celda.
- `index.ts` abre el editor central con el nombre de la carpeta/proyecto y un
  panel Prompt fijo abajo. No se cierran/arrastran; auxiliares y modales quedan
  dentro del editor y conservan visible el prompt.
- Componente TextArea compartido: edición multilínea, Unicode, selección, wrap,
  scroll y pegado sin envío. Enter/Enviar coloca una respuesta demo en el editor,
  limpia el prompt y devuelve el foco; Ctrl+J inserta una línea.
- Laboratorio conservado en Demo → Componentes. Contexto inicial desde cwd;
  registro de proyectos, LLMs y streaming siguen pendientes.
- Fase 01 En curso por pedido del usuario; specs, AGENTS y README actualizados.
  Evidencia en `docs/qa/workspace.md`: 36 pruebas desde fuente, typecheck y seis
  capturas tmux en 80×24 / 60×16 / 120×40. Mouse físico pendiente.
- Sin builds ni benchmarks de binarios. `git pull` intentado: `main` sigue sin
  upstream; trabajo y commit locales.

### Mejorado — Apariencia según las capturas de QBasic

- Paleta DOS propia en terminales que anuncian truecolor/24bit; fallback de 16
  colores ANSI y modos sin color conservados. Barra inferior turquesa.
- Marcos finos de una línea, títulos centrados en pestañas grises, Ayuda a la
  derecha y selección negra en los menús, sin el prefijo `>`.
- Editor del proyecto y Prompt fijo conservados; controles, mouse, foco y atajos
  sin teclas F mantienen su comportamiento.
- Typecheck, 38 pruebas desde fuente y cuatro capturas tmux con RGB comprobadas;
  evidencia en `docs/qa/qbasic-style.md`. Actualizados README, AGENTS, specs y fases.
- Sin builds ni benchmarks de binarios; mouse físico pendiente. `git pull`
  intentado: `main` sigue sin upstream; trabajo y commit locales.

### Mejorado — Shift+Enter para nueva línea

- Shift+Enter pasa a ser el atajo principal de nueva línea del Prompt; Enter y
  Enviar conservan el envío. Actualizados panel, ayuda CLI, README, specs y AGENTS.
- Teclado extendido Kitty/xterm con parser CSI-u/modifyOtherKeys incremental;
  atajos Ctrl/Alt, texto y navegación conservados, sin doble acción por release.
  Los modos se restablecen al salir. Ctrl+J queda como alternativa de compatibilidad.
- Typecheck y 40 pruebas correctas; Shift+Enter/Enter comprobados desde fuente
  en tmux 3.4. Evidencia y capturas en `docs/qa/shift-enter.md`.
- Sin builds de binarios. `git pull` intentado: `main` sin upstream; commit local.

### Corregido — Respuestas de solo lectura

- El panel central bloquea escritura, pegado, saltos y borrado; conserva foco,
  navegación, selección y scroll. El Prompt sigue siendo editable.
- Typecheck y pruebas de workspace/componentes; actualizado el contrato visual.
- `git pull` intentado: `main` sin upstream. Commit local, sin build de binarios.

### Agregado — Configuración, proyectos, sesiones y Models

- Inicio persistente desde `index.ts`; `--demo` conserva el laboratorio sin datos.
  CLI `--config`, `--project`, `--cwd`, `--session`, `--provider` y `--model`.
- Menús Proyectos, Models y sesiones, con formularios paginados que caben en
  60×16. Models configura ID, host, puerto, API key de sesión, variable de clave,
  contexto, límite de salida y capacidades explícitas. Aviso central sin modelo.
- Config JSON validada con temporal/rename; proyectos normalizados por carpeta.
  Sesiones JSONL, append serializado, lock por escritor, recuperación de última
  línea incompleta, herramientas interrumpidas y borradores separados.
- Typecheck y 13 casos de storage/workspace correctos. Fase 02 En curso;
  transporte y tools continúan en las fases siguientes. No hay inferencia real aún.
- `git pull` intentado sin upstream; commit local, sin build ni nuevas dependencias.

### Agregado — Streaming local y lectura de respuestas

- Cliente Chat Completions, descubrimiento `/models`, SSE incremental, deltas,
  tool calls intercaladas, timeout inicial/idle y cancelación HTTP.
- Enviar/Cancelar en Prompt, Ctrl+C cancela un turno activo; cierre guarda la
  sesión. Respuestas parciales y estado final conservados, sin reintentos automáticos.
- Markdown básico con callbacks Bun y caché por mensaje finalizado; append de
  deltas sin resetear el viewport elegido. El renderer conserva 30 frames/s e idle.
- Typecheck y 7 casos de transporte/storage correctos. Validación de proveedor
  real pendiente: usuario configura host/modelo en Models. No se descargaron modelos.
- `git pull` intentado sin upstream; commit local, sin build de binarios.
