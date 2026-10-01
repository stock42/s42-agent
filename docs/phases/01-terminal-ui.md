# Fase 01 — TUI, editor y ciclo de vida del terminal

Estado: **Pendiente**. Dependencia: [00](00-bun-foundation.md).
Requisitos: R03, R04, R05. Contrato: SPECS §4, §5 y §12.

## Objetivo

Construir una TUI pequeña con conversación fixture, editor multilínea y colores,
sin necesitar un modelo para validar el input, render y cierre.

## Tareas

- [ ] F01-01. Implementar detección TTY, raw mode, pantalla alternativa, cursor,
  bracketed paste y dimensiones. Centralizar el cleanup idempotente.
- [ ] F01-02. Implementar el parser de entrada incremental, incluyendo UTF-8,
  flechas, secuencias CSI y Escape aislado. No perder secuencias entre chunks.
- [ ] F01-03. Crear editor INSERT con cursor, borrado, Enter, Ctrl+J y pegado
  multilínea; evitar envíos producidos por caracteres dentro de un paste.
- [ ] F01-04. Construir las cuatro regiones de SPECS §5 y un tema semántico
  centralizado, dejando la paleta separada de layout, input y agente. Concretar
  la dirección visual elegida por el usuario: QBasic o apariencia minimalista.
- [ ] F01-05. Renderizar filas modificadas con coalescencia de streaming,
  `Bun.stringWidth` y `Bun.wrapAnsi`. No emitir frames en reposo.
- [ ] F01-06. Mostrar Markdown básico con callbacks de Bun, mensajes finalizados
  cacheados y eventos fixture; evitar reparsear todo el historial por delta.
- [ ] F01-07. Implementar scroll de conversación y un selector reutilizable para
  listas cortas, sin desarrollar un framework genérico de componentes.
- [ ] F01-08. Manejar resize, terminal pequeño, ausencia de TTY, color automático
  y `NO_COLOR`, con estados comprensibles por texto.
- [ ] F01-09. Probar cierre normal, Ctrl+C como entrada raw, SIGTERM y error
  controlado; conservar el estado anterior del terminal.
- [ ] F01-10. Compilar y repetir el smoke TUI del binario. Registrar evidencia,
  actualizar CHANGELOG y hacer el commit de cada tarea completada.

## Escenarios de aceptación

1. En 80×24, escribir `áéí 😀 漢字`, editar, insertar líneas y pegar 30 líneas:
   el cursor y el ancho coinciden, y el pegado no envía mensajes.
2. Reproducir entradas con Escape, CSI y UTF-8 cortados en varios chunks; producen
   las mismas acciones que las secuencias completas.
3. Generar deltas fixture mientras se desplaza el historial. Si el usuario subió,
   el viewport conserva su posición; al volver al fondo retoma el seguimiento.
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

TUI usable con fixtures, limpieza del terminal verificada y mismo comportamiento
desde fuentes y desde el binario. Vim completo se incorpora en fase 05.
