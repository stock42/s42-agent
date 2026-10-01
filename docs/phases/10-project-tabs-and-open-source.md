# Fase 10 — Pestañas, menús y preparación open source

Estado: **Completada**. Depende de 01–04 y 09. Requisitos R06, R12 y R21.

- [x] F10-01. Retirar Componentes y acciones de prueba del harness; conservar
  el laboratorio mediante `--demo`. Organizar Archivo, Projects, Models,
  Promptings, Tools, Vista y Ayuda; mostrar la cabecera completa en 60 columnas.
- [x] F10-02. Dar a Promptings su menú principal: biblioteca, nuevo y guardar
  borrador. Agrupar MCP/Skills bajo Tools y preferencias visuales bajo Vista.
- [x] F10-03. Crear una pestaña por proyecto con sesión, modelo, borrador,
  adjuntos, modo Vim, foco/scroll y controles propios; activar por mouse,
  Alt+←/→ y Alt+1…9. Añadir cierre, apertura y overflow horizontal.
- [x] F10-04. Ejecutar turnos simultáneos por proyecto con cwd, reasoning,
  tools, resultados y cancelación aislados. Completar en segundo plano conserva
  el foco y el borrador del proyecto visible; Ctrl+Q cancela/cierra todos.
- [x] F10-05. Guardar pestañas y proyecto activo; restaurar sesiones sin repetir
  efectos. Cerrar libera locks sin eliminar proyectos; proteger cierre/cambio
  de sesión durante su turno. Liberar sesiones si falla la restauración inicial.
- [x] F10-06. Agregar MIT, metadata pública, CONTRIBUTING, plantillas GitHub y
  CI fuente Bun. Actualizar README, SPECS, AGENTS y CHANGELOG; conservar archivos
  ajenos. Documentar publicación como paso externo.
- [x] F10-07. Validar typecheck, suite, PTY real desde index.ts, fixture SSE
  concurrente, resize 80×24/60×16 y captura visual de menús/pestañas; commit local.

| Evidencia | Resultado |
| --- | --- |
| `bun install --frozen-lockfile` | Correcto; sin cambios al lock ni nuevas dependencias de runtime |
| `bun run typecheck` | Correcto |
| `bun test` | 101 tests / 20 archivos / 1167 assertions; cero fallas |
| `tests/tabs.test.ts` | 5 casos: aislamiento/concurrencia, restauración/locks, overflow y entrypoint PTY |
| [QA](../qa/project-tabs.md) / [capturas](../qa/project-tabs-captures.txt) | Cabecera completa, Promptings/Tools/Vista, dos y ocho proyectos, prompt visible |
| [Publicación](../PUBLISHING.md) | Preparación MIT y pasos externos explícitos |
| Exportación limpia del índice | Install frozen, typecheck y CLI help correctos; YAML, metadata y enlaces locales revisados |

Sin builds nuevos, nueva inferencia real, mouse/drop físicos ni ejecución remota
de CI. Pull intentado y fallido por main sin upstream; commit local, sin push.
