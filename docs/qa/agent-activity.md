# QA — Actividad del agente en el título y chat

2026-10-01. Linux x64, Bun 1.4.2, index.ts desde fuente. Typecheck correcto;
suite completa: **129 pass / 0 fail**, 26 archivos, 2111 assertions.

El título conserva el nombre del proyecto y anima un sufijo ASCII cada 200 ms
durante el turno. Estado en una fila reservada dentro del chat, fuera del scroll;
Prompt conserva modo/borrador/tokens/adjuntos/hint sin estados del LLM activo.
Reasoning del proveedor mantiene su control Vista on/off; la actividad puede
mostrarse aunque ese contenido esté oculto. No agrega texto ficticio al historial.

tests/activity.test.ts verifica espera sin ningún delta, frames diferentes,
conservación de borrador/foco/scroll, ES/EN y razonamiento oculto; dos proyectos
activos, pestaña idle, títulos Unicode largos con indicador visible, tamaños
60×16/80×24/120×40, fin/cancelación/desconexión/cierre y cero invalidaciones de
animación tras quedar idle. Indicadores no persistidos. El test existente de
reasoning comprueba además «Agente: Ejecutando shell…» dentro del chat durante
un comando real y su ausencia en Prompt.

[Siete capturas tmux](agent-activity-captures.txt), proyecto/config temporales,
paleta Green: dos frames distintos del título antes del primer delta, reasoning
recibido, resize 80×24 y 60×16, respuesta en streaming y fin. Se inspeccionaron
posición, cambio del indicador, conservación de borrador, estado en chat,
tokens/recursos y desaparición de actividad al terminar. Servidor SSE fixture
controlado; los textos no son inferencia real ni medición de velocidad.

La primera versión del fixture de error asumía que el cliente recibiría el
mensaje del error del servidor; fetch informa una desconexión de socket. Se
ajustó a cierre de stream sin finish_reason/DONE para comprobar el fallo de
protocolo y la limpieza de actividad con un error determinista del cliente.

Sin builds, mouse/drop físico, pruebas en otros SO ni push. Pull falló por main
sin upstream. Archivos ajenos CLAUDE.md y docs/qa/final-validation.md preservados.
