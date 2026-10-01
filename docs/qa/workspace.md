# UI del proyecto y prompt fijo

Fecha: 2026-10-01. Snapshot del layout: `e56056c`.
Fuente: `index.ts` → `src/ui/workspace.ts`.
La apariencia posterior se registra en [qbasic-style.md](qbasic-style.md).
Alcance: pedido visual del usuario, editor con proyecto y prompt permanente.
La respuesta es una **demostración explícita**, sin requests LLM ni escrituras de
archivos/proyectos. El registro de múltiples proyectos sigue en fase 02.

## Resultado

- El input del laboratorio no agrega `[`/`]`; se puede borrar completamente.
  Los corchetes escritos por el usuario se tratan como texto editable normal.
- Botones con etiquetas centradas `< Enviar >` / `< Aceptar >`, estados por
  color/video inverso y deshabilitado tenue en monocromo. Sin los marcadores
  combinados `[>…<]`, `[+…+]` y `[-…-]` de la captura inicial.
- Cabeceras conectadas al marco con sus esquinas; títulos centrados y sombras
  de una celda solamente en ventanas flotantes.
- Editor central titulado con el nombre de la carpeta/proyecto. Prompt fijo
  abajo, enfocado inicialmente. Ambos paneles ocupan el área útil y no se cierran
  ni se arrastran; auxiliares/modales se limitan al editor.
- Enter o Enviar muestra la respuesta demo en el editor y devuelve el foco al
  prompt vacío. Ctrl+J agrega una línea; el paste multilínea nunca envía.
- `TextArea` compartido para prompt/editor: edición por grafemas, selección,
  wrap, clic/arrastre, scroll por rueda/teclado y resize. El scroll no vuelve
  solo al cursor; un movimiento/edición vuelve a mostrarlo. Resize conserva
  visible el cursor de edición, o el viewport elegido si se desplazó con rueda.
- El laboratorio sigue accesible en Demo → Componentes. Cerrar auxiliares
  conserva respuesta y borrador. Sus controles también caben en 60×16.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| Componentes/parser/UX/workspace | 31 casos correctos; ocho escenarios nuevos para los defectos visuales y contratos del layout/prompt. |
| `bun test tests/terminal.test.ts` | Cinco casos correctos desde Bun: prompt pegado sin envío, botón Enviar, respuesta en editor, laboratorio, edición/foco, ayuda, resize, monocromo, idle y cleanup. |
| tmux | [Seis capturas reales de texto](workspace-captures.txt): inicial/respuesta 80×24, input vacío sin corchetes, laboratorio 60×16, cierre del auxiliar sin pérdida del borrador y modal 120×40. |
| Build/benchmark de binarios | No ejecutados. |

Las primeras comprobaciones de los controles existentes fallaron porque todavía
esperaban los marcadores visuales retirados y el desplazamiento de una celda del
input con corchetes. Se actualizaron sus expectativas para verificar el estado
visible y la selección sobre el nuevo campo, manteniendo los contratos de
activación/cancelación, Unicode y foco. No se omitieron casos.

## Pendiente

Mouse físico en el emulador del usuario; estas pruebas usan eventos inyectados
en PTY/tmux. Streaming/Markdown, proveedor real, cancelación de turnos, proyectos
persistentes y adjuntos siguen en sus fases. Esta evidencia no declara una
experiencia perfecta ni operación de un modelo real.
