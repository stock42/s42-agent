# Fase 14 — Identidad, skills internas y tools de documentos/servicios

Estado: **Completada**. Depende de 04/08/12/13. Requisitos R27/R28/R29.

- [x] F14-01. Buscar papers primarios sobre loops de agentes, interfaz de tools,
  feedback y utilidad real de skills; documentar resultados, límites e inferencias.
- [x] F14-02. Separar el prompt inicial del loop: identidad S42, procedimiento
  breve, instrucciones del proyecto y distinción de trabajo ejecutado/sugerido.
- [x] F14-03. Crear src/agent/skills con software-project, debug-and-verify y
  create-pdf; guías breves, incluidas como texto y catálogo de metadatos.
- [x] F14-04. Implementar internal_skill: listado y carga progresiva; conservar
  skills externas/configuración sin ejecución automática de scripts.
- [x] F14-05. Implementar markdown_html nativa Bun con texto/archivo, salida
  HTML opcional, límites UTF-8/JSON y fragmento/documento standalone.
- [x] F14-06. Implementar websocket nativa Bun con ws/wss, headers/protocolos,
  envío/recepción, binarios base64, límites, timeout/cancelación y limpieza.
- [x] F14-07. Integrar catálogo ES/EN, loop y chat persistente; verificar fuente,
  servidor/modelo real y terminal, actualizar documentación/CHANGELOG y commit local.

| Evidencia | Resultado |
| --- | --- |
| [Papers y decisiones](../AGENT-INTELLIGENCE.md) | Ocho trabajos; aplicados y propuestas futuras separados. |
| `bun run typecheck` | Correcto. |
| `bun test` | 124 tests / 25 archivos / 1911 assertions; cero fallas. |
| `tests/internal-tools.test.ts` | Siete escenarios: descubrimiento/carga, HTML/errores/Unicode, WebSocket/cleanup/errores/cancelación/límites y App/persistencia/catálogo bilingüe. |
| [GLM real](../qa/internal-skills-live.json) | Tres tools correctas; 2 requests, 4589 entrada / 481 salida, 5,126 s. |
| [QA](../qa/internal-skills.md) | Contratos y pruebas funcionales, límites concretos. |
| [Terminal](../qa/internal-tools-captures.txt) | index.ts en tmux: chat/tools, catálogo y contrato ES/EN; 100×32 y 60×16. |

PDF se entrega como skill de composición, no como una API nativa inexistente.
Esta fase no genera un PDF ni valida su layout. La prueba de modelo no mide
mejora de inteligencia: evaluación A/B, memoria/compactación y herramientas
adicionales quedan propuestas para aprobación, no tareas abiertas de esta fase.
Sin builds nuevos, mouse/drop físicos, otros SO ni publicación. Pull fallido
por main sin upstream; cierre local sin push.
