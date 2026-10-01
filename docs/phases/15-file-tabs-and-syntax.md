# Fase 15 — Archivos en pestañas y sintaxis

Estado: **Completada**. Depende de 10/12/13. Requisito R30.

- [x] F15-01. Abrir archivos desde el explorador en pestañas junto al proyecto,
  con título/ruta/lenguaje/tamaño y texto UTF-8 completo en solo lectura.
- [x] F15-02. Conservar prompt/chat/adjuntos/cwd/modelo, deduplicar ruta/proyecto,
  mantener scroll/selección y permitir cambio/cierre con teclado/mouse.
- [x] F15-03. Resaltar HTML/CSS/JavaScript/TypeScript, style/script embebidos,
  comentarios/strings/keywords/números y código incompleto sin dependencias.
- [x] F15-04. Adaptar paletas/monocromo/ES/EN/resize; enviar devuelve al chat y
  streaming en background no reemplaza la vista de archivo.
- [x] F15-05. Validar fuente y terminal, registrar QA/capturas y actualizar
  README/specs/AGENTS/CHANGELOG con commit local.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| `bun test` | 136 tests / 29 archivos, cero fallas. |
| `bun test tests/file-tabs.test.ts tests/syntax.test.ts` | 5 tests finales correctos, 126 assertions. |
| `tests/file-tabs.test.ts` | Texto >64 KiB, fuera del proyecto, deduplicación, scroll/selección, teclado/mouse, ES/EN, binario/errores, cierre y streams aislados. |
| `tests/syntax.test.ts` | Texto preservado y categorías, HTML con CSS/JS, Unicode y código incompleto sin ejecución. |
| [QA](../qa/file-tabs.md) | index.ts real en PTY/tmux, QBasic/Nord y 100×32/60×16. |

Vistas de archivo transitorias y de solo lectura. Resaltado léxico, no AST/LSP;
templates enteros como strings, sin gramática propia de regex/JSX. Lectura nativa
Bun; sin builds, mouse físico, otros SO ni publicación. Pull falló por main sin upstream.
