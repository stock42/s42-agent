# Fase 01 — TUI del harness sobre los componentes QBasic

Estado: **En curso**. Dependencia: [demo de viabilidad 00](00-tui-viability.md).
Layout adelantado a pedido del usuario, con mouse físico de fase 00 aún pendiente.
Requisitos: R03, R04, R05, R15, R16. Contrato: SPECS §4, §5 y §12.

## Objetivo

Construir la interfaz del harness sobre la biblioteca visual ya probada: editor
central con el nombre del proyecto, prompt fijo abajo y respuestas fixture dentro
del escritorio QBasic, sin necesitar un modelo ni reemplazar los componentes por
otra TUI.

## Tareas

- [x] F01-01. Reutilizar `index.ts` como entrypoint del harness, terminal, renderer,
  input, foco y componentes de fase 00; conservar la demo como prueba de controles.
- [x] F01-02. Componer menús Archivo/Projects/Models/Promptings/Tools/Vista/Ayuda y la ventana
  principal, con contexto del proyecto/modelo/sesión y barra inferior de atajos.
- [x] F01-03. Crear editor multilínea INSERT con cursor, borrado, Enter, Shift+Enter y pegado
  multilínea; evitar envíos producidos por caracteres dentro de un paste.
  Ctrl+J conservado como alternativa de compatibilidad.
- [x] F01-04. Integrar botones de enviar/cancelar, selectores y diálogos sobre los
  componentes existentes, con las mismas acciones por mouse y teclado.
- [x] F01-05. Añadir coalescencia de streaming al renderer y layout de conversación;
  conservar clipping, filas modificadas y ausencia de frames idle de fase 00.
- [x] F01-06. Mostrar Markdown básico con callbacks de Bun, mensajes finalizados
  cacheados y eventos fixture; evitar reparsear todo el historial por delta.
- [x] F01-07. Implementar scroll de conversación con rueda/teclado, viewport
  independiente y seguimiento del streaming solo mientras esté al fondo.
- [x] F01-08. Manejar resize, terminal pequeño, ausencia de TTY, color automático
  y `NO_COLOR`, con estados comprensibles por texto.
- [x] F01-09. Probar cierre normal, Ctrl+C como entrada raw, SIGTERM y error
  controlado; conservar el estado anterior del terminal.
- [x] F01-10. Repetir el flujo TUI desde Bun y revisar su experiencia. Registrar evidencia,
  actualizar CHANGELOG y hacer el commit de cada tarea completada.
- [x] F01-11. Integrar explorador fuera del proyecto, padre/raíz/ruta escrita,
  preview de solo lectura y picker modal con prompt visible en 60×16.
- [x] F01-12. Configurar paletas clásica QBasic, escala de grises y verdes,
  selección por teclado/mouse, aplicación en vivo y persistencia sin perder foco,
  sesión o borrador; conservar RGB/ANSI16 y modo sin color.

## Escenarios de aceptación

1. En 80×24, escribir `áéí 😀 漢字`, editar, insertar líneas y pegar 30 líneas:
   el cursor y el ancho coinciden, y el pegado no envía mensajes. Verificar foco
   por clic y Tab, sin enviar accidentalmente al cerrar un menú.
2. Reproducir entradas con Escape, CSI y UTF-8 cortados en varios chunks; producen
   las mismas acciones que las secuencias completas.
3. Generar deltas fixture mientras se desplaza el historial. Si el usuario subió,
   el viewport conserva su posición; al volver al fondo retoma el seguimiento.
   Probar rueda con un diálogo delante: no desplaza la conversación oculta.
4. Redimensionar 80×24 → 60×16 → 120×40 durante streaming. Editor y estado quedan
   accesibles, sin filas residuales ni excepciones.
5. Repetir sin color y con un terminal no TTY. No aparecen escapes en el error
   no interactivo. En `TERM=dumb` se explica la necesidad del terminal ANSI.
6. Cerrar por las cuatro vías controlables y verificar cursor, echo y raw mode
   del shell posterior. No prometer recuperación ante SIGKILL.
7. Observar 10 s idle sin repintados y comprobar que los deltas se agrupan en
   hasta 30 frames/s. Medir, sin asumir rendimiento por usar Bun.

Las pruebas automáticas pueden usar `Bun.Terminal`; la inspección de una pantalla
real complementa los tests de secuencias ANSI.

## Evidencia

| Tarea/caso | Comando o captura | Resultado, terminal y versión |
| --- | --- | --- |
| Layout/edición/resize | [QA del layout](../qa/workspace.md), [capturas](../qa/workspace-captures.txt) | Editor con proyecto, prompt fijo, respuesta demo, componentes reutilizados y tamaños 80×24 / 60×16 / 120×40. |
| Apariencia QBasic | [QA actual](../qa/qbasic-style.md), [capturas](../qa/qbasic-style-captures.txt) | Paleta DOS RGB/fallback ANSI, marcos finos, pestañas grises, Ayuda a la derecha y barra turquesa. Prompt visible con modal en 60×16. |
| Shift+Enter | [QA del teclado](../qa/shift-enter.md), [capturas](../qa/shift-enter-captures.txt) | Nueva línea sin envío y Enter para enviar. CSI-u/modifyOtherKeys fragmentados, atajos y cleanup conservados. |
| Fuente Bun | `bun run typecheck`, `bun test` | 40 casos: input limpio, edición, envío, foco, scroll, restricciones de paneles, teclado extendido, color, monocromo y cleanup. Sin build de binarios. |
| Agente fuente | `bun test tests/app-terminal.test.ts tests/llm.test.ts` | Models y contexto de sesión, streaming, cancelación y recuperación fixture. Markdown básico con callbacks Bun. Mouse físico pendiente; modelo real comprobado en QA integral. |
| Explorador y eventos | [QA actual](../qa/explorer-and-reasoning.md) | Carpeta hermana, raíz, preview, modales anidados, 60×16 y chat progresivo desde index.ts/PTY/tmux. |
| Paletas configurables | [QA de paletas](../qa/color-palettes.md), [capturas tmux](../qa/color-palettes-captures.txt) | Cambio en vivo, configuración anterior, reinicio, contraste de controles, fallback ANSI16 y NO_COLOR; selector sobre el prompt en 60×16. |

## Cierre

TUI del harness estilo QBasic usable con fixtures, mouse y teclado, limpieza del
terminal verificada desde la fuente. La equivalencia del binario se verifica en
distribución. El subconjunto
Vim acordado se incorpora en fase 05 sin interceptar input de menús/modales.

La organización actual de menús y pestañas se completa en
[fase 10](10-project-tabs-and-open-source.md); sus capturas verifican el nuevo layout.
