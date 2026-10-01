# Experiencia TUI — iteración de UX

Fecha: 2026-10-01. Ejecución: `bun run dev` desde `index.ts`.
Registro de la iteración `068291c`; el layout/editor/prompt actual está en [workspace.md](workspace.md).
Esta iteración se concentra en interacción/render; binarios y benchmarks se
reservan para distribución o un pedido explícito del usuario.

## Correcciones y comportamiento

- Volver a Componentes enfoca la ventana existente: conserva edición, selección
  de lista y control enfocado, en vez de destruirla y reiniciarla.
- En 60×16 la lista presenta tres filas; estado y botones ocupan filas separadas.
- El input selecciona con Ctrl+A, Shift+flechas/Home/End o arrastre. Escribir,
  pegar, Delete o Backspace reemplaza la selección por grafemas completos.
  Al ensancharlo recupera el contexto que ahora cabe.
- El desplegable admite hover y pulsar/arrastrar/soltar desde una cabecera a una
  opción. Cambiar de cabecera con el menú abierto cambia el desplegable.
  Las opciones deshabilitadas no ejecutan acciones.
- Escape abre/cierra menús; Ctrl+N cambia de ventana y Alt+Y abre ayuda incluso
  con un menú abierto. Accesos Alt+A/V/D y Ayuda identificados por color/subrayado.
  No hay acciones asignadas a F1–F12. La barra inferior muestra atajos del contexto.
- Corregida la captura aportada por el usuario: con todas las ventanas cerradas,
  el mensaje de recuperación se dibuja detrás de los desplegables. Demo conserva
  completas sus opciones y Ventanas → Componentes recupera el laboratorio.
- Botón y `[X]` dejan de verse presionados al mover afuera, recuperan ese estado
  al volver y activan solamente al soltar dentro de su área visible.
- Modales centrados al abrir; conservan bloqueo de input y restauración de foco.
- PageUp/Down recorren páginas de la lista. Su marco indica ↑/↓ cuando hay más
  contenido, y pulsar el marco no cambia la selección.
- Selección/cursor visibles en monocromo; hover repetido sobre la misma opción
  no solicita un frame nuevo ni atraviesa hacia controles de otra ventana.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| Casos de componentes/parser/UX | 23 casos correctos; 11 escenarios de UX, incluidos el escritorio vacío con menú abierto y los atajos sin teclas F. |
| `bun test tests/terminal.test.ts` | Cinco casos correctos sobre fuente Bun: edición/selección, conservación al volver, ayuda desde menú, ventanas, Unicode, resize, monocromo, idle y cleanup. |
| tmux desde fuente | [Capturas reales de texto](tui-ux-captures.txt): menú Demo sobre escritorio vacío, recuperación de Componentes, ayuda y edición/layout 60×16. |
| Compilación/benchmark | No ejecutados en esta iteración. El registro anterior corresponde a `c098d88`. |

El escenario PTY inicialmente esperaba un frame después de abrir/cerrar un menú
en un solo bloque de bytes y volver exactamente a la misma pantalla. El renderer
no debe emitir bytes en ese caso. Se separaron las acciones como interacción de
usuario: esperar el menú visible y luego Enter para comprobar la edición al volver.

Hover usa el modo de movimiento por celda `1003` y coordenadas SGR `1006`, según
el [contrato oficial de xterm](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking).
Se desactiva al salir. El movimiento sin cambios visibles se descarta antes del
repintado; no hay animación o polling periódico.

## Límite de la evidencia

Estos recorridos usan eventos de teclado/mouse inyectados en PTY/tmux. La
comprobación con mouse físico en el emulador del usuario sigue pendiente; no se
declara una experiencia perfecta solo por pasar los tests. Vim, drag & drop de
archivos del SO y las pantallas del agente se desarrollan en sus propias fases.
