# Fase 18 — Coding fiable, tabs y SQLite

Estado: Completada en fuente, Linux/Bun 1.4.2. Fecha: 2026-10-01.
Dependencias: 02–04, 10, 12, 15–17. Requisito: R33.

- [x] Diagnosticar fallo de Tetris con metadata real del servidor y catálogo anterior.
- [x] Detectar contexto/tools/visión de llama.cpp, respetando modelos manuales.
- [x] Pasar tools al LLM y orientar a implementar el archivo completo en disco.
- [x] Permitir escribir archivos grandes por partes mediante write append=true.
- [x] Identificar pestañas con P:/F: y animar cada proyecto activo incluso viendo archivos.
- [x] Actualizar E/S y promedio tok/s desde timings/usage durante streaming sin duplicación.
- [x] SQLite nativo global: configuración, historial, índice de sesiones, WAL/transacciones.
- [x] Migrar JSON/JSONL anteriores conservando originales y referencias al llavero.
- [x] Conservar locks, recuperación de proceso muerto y reparación de tool results.
- [x] Validar TUI/CLI con SQLite, reapertura y migración XDG desde index.ts real.
- [x] Ejecutar el prompt exacto con GLM-4.7-Flash y verificar el HTML en Chrome.
- [x] Actualizar README, AGENTS, SPECS, TOOLS, QA y CHANGELOG.

| Evidencia | Resultado |
| --- | --- |
| bun run typecheck | Correcto |
| bun test | 161 pass / 0 fail · 34 archivos · 19,11 s |
| tests/live-progress.test.ts | Tools/contexto reales, manual/fallback, uso antes de finalizar sin duplicación |
| tests/activity.test.ts | Tres proyectos activos animados con archivo visible; termina cada uno independientemente |
| tests/sqlite.test.ts | Migración/retry/corrupción/locks, crash real, reapertura TUI, index.ts PTY XDG y CLI con tools |
| CLI + GLM-4.7-Flash real | Exit 0, HTML 28.696 bytes, list + write, 3 requests, uso 13.536/7.425 |
| Chrome vía Bun.WebView | Inicio por clic nativo, AudioContext running, controles/líneas/pausa/reinicio y 3D CSS |

[QA detallada](../qa/reliable-coding-and-sqlite.md),
[metadata real](../qa/reliable-coding-live.json).
No se probó mouse/drop físicos ni ejecución Windows/macOS en esta fase.
No se modificó la configuración personal para QA ni se hicieron builds/push.
