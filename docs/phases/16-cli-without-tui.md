# Fase 16 — CLI sin TUI

Estado: **Completada**. Depende de 02–04, 07, 08 y 11. Requisito R31.

- [x] F16-01. Activar el modo CLI con `--prompting`, sin TTY ni arranque de App,
  Desktop, raw mode, mouse o render. Mantener TUI/demo como arranque habitual.
- [x] F16-02. Soportar `--llm_server`, `--llm_port`, `--llm_apikey`, `--model`
  y `--reasoning on|off`; validar argumentos, usar config o catálogo y mantener
  overrides/credenciales en memoria.
- [x] F16-03. Reutilizar runTurn, instrucciones del proyecto, tools, MCP, skills,
  recuperación por etapas y sesiones. Cwd actual/--cwd o proyecto registrado;
  config/borradores/pestañas intactos, sesión nueva o --session explícita.
- [x] F16-04. Respuesta streaming por stdout; reasoning opcional, tools/resultados,
  avisos, sesión y tokens por stderr. Éxito/error 0/1, SIGINT/SIGTERM 130/143,
  parciales persistidos y locks liberados.
- [x] F16-05. Validar proceso real sin TTY, modelo local y regresión de la TUI.
  Actualizar README/specs/AGENTS/CHANGELOG y registrar evidencia.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| `bun test` | 142 tests / 30 archivos, cero fallas. |
| `bun test tests/cli.test.ts tests/app-terminal.test.ts` | 8 tests finales correctos, 125 assertions. |
| `tests/cli.test.ts` | Flags, URL/puerto/auth, literal multilínea, catálogo, read/write/shell, config/cwd/proyecto/skill, overrides, stdout/stderr, sesiones, etapas, errores y señales. |
| `tests/app-terminal.test.ts` | Entrypoint TUI en PTY sigue funcionando con providers, coding, cancelación, proyectos y explorer. |
| [QA](../qa/cli.md) | GLM-4.7-Flash real: read/read/edit/shell/read, suma corregida y bun test independiente correcto. |

API compatible con Chat Completions y tool calling del servidor; no iniciar ni
descargar modelos. Un ID no registrado usa contexto/salida 8192/2048 y tools;
config registrada conserva capacidades/límites. --reasoning afecta visibilidad,
no generación del modelo. Sin builds ni publicación; pull falló por main sin upstream.
