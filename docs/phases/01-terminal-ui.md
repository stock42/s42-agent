# Fase 01 — TUI del harness sobre los componentes QBasic

Estado: **Pendiente**. Dependencia: [demo de viabilidad 00](00-tui-viability.md).
Requisitos: R03, R04, R05, R15, R16. Contrato: SPECS §4, §5 y §12.

## Objetivo

Construir la interfaz del harness sobre la biblioteca visual ya probada: ventana
de conversación, editor y eventos fixture dentro del escritorio QBasic, sin
necesitar un modelo ni reemplazar los componentes por otra TUI.

## Tareas

- [ ] F01-01. Crear el entrypoint del harness y reutilizar terminal, renderer,
  input, foco y componentes de fase 00; conservar la demo como prueba de controles.
- [ ] F01-02. Componer menús Archivo/Proyectos/Modelos/Ventanas/Ayuda y la ventana
  principal, con contexto del proyecto/modelo/sesión y barra inferior de atajos.
- [ ] F01-03. Crear editor multilínea INSERT con cursor, borrado, Enter, Ctrl+J y pegado
  multilínea; evitar envíos producidos por caracteres dentro de un paste.
- [ ] F01-04. Integrar botones de enviar/cancelar, selectores y diálogos sobre los
  componentes existentes, con las mismas acciones por mouse y teclado.
- [ ] F01-05. Añadir coalescencia de streaming al renderer y layout de conversación;
  conservar clipping, filas modificadas y ausencia de frames idle de fase 00.
- [ ] F01-06. Mostrar Markdown básico con callbacks de Bun, mensajes finalizados
  cacheados y eventos fixture; evitar reparsear todo el historial por delta.
- [ ] F01-07. Implementar scroll de conversación con rueda/teclado, viewport
  independiente y seguimiento del streaming solo mientras esté al fondo.
- [ ] F01-08. Manejar resize, terminal pequeño, ausencia de TTY, color automático
  y `NO_COLOR`, con estados comprensibles por texto.
- [ ] F01-09. Probar cierre normal, Ctrl+C como entrada raw, SIGTERM y error
  controlado; conservar el estado anterior del terminal.
- [ ] F01-10. Compilar y repetir el smoke TUI del binario. Registrar evidencia,
  actualizar CHANGELOG y hacer el commit de cada tarea completada.

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
| — | — | Pendiente; no ejecutado. |

## Cierre

TUI del harness estilo QBasic usable con fixtures, mouse y teclado, limpieza del
terminal verificada y mismo comportamiento desde fuentes y binario. El subconjunto
Vim acordado se incorpora en fase 05 sin interceptar input de menús/modales.
