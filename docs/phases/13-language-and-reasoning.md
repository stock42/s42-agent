# Fase 13 — Idioma de la UI y visibilidad del razonamiento

Estado: **Completada**. Depende de 01–03 y 07–12. Requisitos R25/R26.

- [x] F13-01. Guardar ui.language es/en y ui.showReasoning booleano, migrando
  configuraciones anteriores a es/true sin sobrescribir JSON al cargar.
- [x] F13-02. Añadir Vista → Language, selección actual y cancelación; traducir
  textos propios de la TUI preservando contenido original y IDs de acciones.
- [x] F13-03. Calcular anchos/hit boxes con etiquetas traducidas y adaptar
  formularios de capacidades/scope a yes/project además de sí/proyecto.
- [x] F13-04. Añadir Ver razonamiento: on/off, historial y streaming en todas
  las pestañas; conservar reasoning en sesión/contexto y recuperar deltas al activar.
- [x] F13-05. Validar cambios durante turno, tool calling, cancelación, reapertura,
  fallo de guardado, UI compacta y ausencia de edición del chat.
- [x] F13-06. Actualizar documentación, CHANGELOG y commit local con archivos propios.
- [x] F13-07. Animar título durante turnos y mover estado de actividad al chat,
  conservando Prompt, ES/EN, razonamiento opcional y aislamiento por pestaña.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto |
| `bun test` | 117 tests / 24 archivos / 1519 assertions; cero fallas |
| tests/language-reasoning.test.ts | Config/migración, inglés CRUD, teclado/mouse, pestañas, streaming y recuperación |
| [QA](../qa/language-and-reasoning.md) / [capturas](../qa/language-reasoning-captures.txt) | index.ts en tmux 100×30/60×16; inspección visual y reapertura sin color |
| [Actividad del agente](../qa/agent-activity.md) | Typecheck; 129 tests / 26 archivos / 2111 assertions; 7 capturas de título/estado en 100×32, 80×24 y 60×16 |

SSE fixture; no inferencia real necesaria para validar preferencias de UI.
Mouse de tests inyectado; no prueba física de mouse/drop ni otros SO.
Sin builds ni publicación. Pull falló por main sin upstream; cierre local sin push.
