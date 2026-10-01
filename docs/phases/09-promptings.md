# Fase 09 — Promptings y metavariables

Estado: **Completada**. Depende de 01–04. Requisito R20, solicitado por el usuario.

- [x] F09-01. Persistir biblioteca global `promptings` con id/nombre/texto;
  migrar configuraciones anteriores y rechazar registros inválidos sin sobrescribir.
- [x] F09-02. CRUD TUI desde Promptings → Biblioteca, Alt+T, /promptings y NORMAL Espacio+t;
  crear también desde el borrador actual, con nombre y texto multilínea.
- [x] F09-03. Extraer nombres únicos `{{metavar_name}}` por orden de aparición;
  reemplazar una sola vez, literalmente, conservando la plantilla original.
- [x] F09-04. Preguntar cada valor, permitir multilínea/vacío, navegar entre
  preguntas y cancelar sin modificar el borrador. Mantener prompt fijo visible.
- [x] F09-05. Cargar para revisar o ejecutar con modelo/proyecto/sesión actuales;
  conservar texto resuelto si falta modelo y bloquear reemplazo durante un turno.
- [x] F09-06. Validar fuente, persistencia, keyboard/mouse inyectado, Unicode,
  resize 80×24/60×16 y payload/SSE de fixture desde index.ts. Documentar y commit.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto |
| `bun test` | 96 tests / 19 archivos / 1085 assertions; cero fallas |
| `tests/promptings.test.ts` | Parser, migración, CRUD durable, cancelación, navegación, modelo ausente y entrypoint PTY |
| [QA](../qa/promptings.md) / [capturas tmux](../qa/promptings-captures.txt) | Biblioteca, editor y preguntas en 80×24 / 60×16; prompt visible |

QA usa config/proyectos temporales. El proveedor es un fixture local; este cambio
no incluye nueva inferencia real ni pruebas de binarios. Clic/release se inyectan;
las capturas de celdas de tmux no prueban mouse físico del emulador del usuario.
Pull intentado y fallido por main sin upstream; commit local sin push.

La [fase 10](10-project-tabs-and-open-source.md) mueve la biblioteca desde Archivo
al menú principal Promptings. La evidencia de arriba corresponde al cierre de
fase 09; la nueva organización se comprueba en la QA de fase 10.
