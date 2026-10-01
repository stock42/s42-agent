# QA — Identidad, skills internas, Markdown y WebSocket

Fecha: 2026-10-01. Bun 1.4.2, Linux x64, TypeScript 7.0.2. Fuente, sin builds.

## Verificación funcional

`bun run typecheck` correcto. `bun test`: **124 pass, 0 fail**, 25 archivos,
1911 assertions. Siete tests nuevos en `tests/internal-tools.test.ts`:

- Catálogo de tres skills en el system prompt sin sus cuerpos; carga por nombre,
  nombre/tipo inválido y modelo sin tools. Cargar no crea/ejecuta scripts.
- Markdown desde texto/archivo, tabla/código/Unicode, título escapado, standalone,
  salida en subcarpeta con AGENTS, preview y archivo completo. Input inválido,
  archivo inexistente, UTF-8 inválido, >1 MiB y cancelación sin escritura.
- Preview >64 KiB conserva JSON parseable sin introducir caracteres replacement
  por cortar bytes UTF-8 intermedios; no garantiza que un
  fragmento HTML recortado cierre sus tags.
- WebSocket contra Bun.serve: header y subprotocolo negociados, mensaje JSON
  de texto Unicode, binario base64, cantidad recibida y cierre comprobado con
  pendingWebSockets=0. Tipos/scheme/cantidad inválidos fallan.
- Timeout/cancelación preservan mensajes parciales; cierre remoto temprano
  conserva código/razón; handshake rechazado falla. Sin conexiones pendientes.
- Frame grande devuelve limit/truncated, JSON válido y UTF-8 sin replacement.
- App con SSE fixture llama internal_skill/markdown_html/websocket; realmente
  guarda HTML y hace eco WS. Chat readonly muestra calls/resultados, persiste y
  reabre sin reejecutar. Catálogo llega a la última de once tools en 60×16,
  descripción ES/EN y borrador/prompt fijo visibles. La skill cargada devuelve
  Markdown legible para el chat, en vez de serializar su cuerpo en un JSON interno.

Las suites anteriores también verifican MCP/skills externas, recuperación por
length, llamadas y cancelación por pestaña, SSE/reasoning, menús, paletas y PTY.
Se conservaron los contratos y la configuración de extensiones externas.

Una ejecución intermedia de la suite tuvo una falla en el test existente
`cancelar shell mata también al descendiente de su grupo`, que consulta /proc
inmediatamente después de cancelar. Dos repeticiones aisladas y la ejecución
final de la suite completa pasaron (124/124). No se
modificaron shell.ts, process.ts ni esa prueba; la intermitencia observada queda
registrada, sin dar por diagnosticada su causa.

## Modelo real

[Registro](internal-skills-live.json) generado por
`bun run scripts/validate-internal-skills.ts` con config/proyecto temporales.
Endpoint existente `http://127.0.0.1:8080/v1`, modelo **GLM-4.7-Flash**.

Ejecutó las tres herramientas: cargó software-project, guardó informe.html
standalone (250 bytes, heading y párrafo) y envió/recibió S42_WS_VERIFIED desde
un servidor Bun WebSocket temporal. Se verificaron el archivo y el mensaje
observado por el servidor, además de los resultados entregados al modelo.
Dos requests de inferencia, **4589 entrada / 481 salida / 5070 total**,
reportados por el proveedor; duración total **5,126 s**. La respuesta final
identifica los tres resultados. No hubo herramientas fallidas.

Esta prueba funcional no compara contra el prompt anterior ni cuantifica
inteligencia; no extrapola rendimiento a otras tareas/modelos. La evaluación
A/B está propuesta en [investigación](../AGENT-INTELLIGENCE.md).

## Terminal

[Capturas de texto](internal-tools-captures.txt) del entrypoint index.ts en
servidor tmux temporal. Chat con tres tools nativas reales y SSE fixture,
catálogo completo navegable, contrato WebSocket en español e inglés; 100×32
con resize a 60×16, modal/scroll y borrador visibles sobre el prompt fijo.
Capturas inspeccionadas como celdas de texto; no captura de píxeles del
emulador del usuario ni prueba física de mouse/drag-and-drop.

## Límites

- create-pdf es una guía de composición; no se generó/revisó un PDF en esta QA.
  Markdown→HTML no imprime PDF: el renderizador de impresión es externo.
- WebSocket ws real validado en localhost; wss conserva TLS normal de Bun,
  sin fixture TLS ni validación de todos los protocolos de aplicaciones.
- Límite WS retiene hasta 64 KiB, pero no impide que Bun reciba un frame más
  grande antes del handler. No hay sockets persistentes entre calls.
- HTML convertido no se sanitiza, no agrega CSS ni copia assets.
- Sin dependencias nuevas, builds, autoaprendizaje/memoria episódica, QA física,
  runtime de otros SO ni publicación.
- git pull falló por main sin upstream. Trabajo local, sin cambiar remoto ni
  configurar seguimiento. CLAUDE.md y docs/qa/final-validation.md ajenos a la
  tarea se conservaron fuera del commit.
