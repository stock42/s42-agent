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
