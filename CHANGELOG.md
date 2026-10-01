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
