# QA — Modo CLI sin TUI

2026-10-01. Linux x64, Bun 1.4.2, index.ts desde fuente.
Config/proyectos temporales; sin tocar config personal, servidor ni modelos.

## Validación automatizada

- `bun run typecheck`: correcto.
- `bun test`: **142 pass / 0 fail**, 30 archivos, 2667 assertions en la corrida
  completa. Pruebas CLI/TUI focalizadas finales también verificadas tras ampliar
  los escenarios de skill y override de servidor: **8 pass / 0 fail**,
  dos archivos y 125 assertions.
- `tests/cli.test.ts` ejecuta index.ts como proceso con stdin ignorado y
  stdout/stderr pipes, TERM=dumb. Respuesta exacta por stdout, ninguna secuencia
  de render/mouse/raw mode. TUI sin prompting continúa exigiendo terminal.
- Host/URL/puerto y API key explícita o por variable de config; catálogo real
  de un servidor fixture y modelo explícito sin GET /models. Literal multilínea
  y Unicode; `--prompting=--help` no activa ayuda. Valores inválidos fallan.
- Fixture read/write/shell produce un archivo y ejecuta Bun en el cwd solicitado.
  Respuesta/tools/resultados/uso separados; reasoning off no se imprime pero se
  conserva en sesión. Reapertura conserva contexto y no repite tools previas.
- Proyecto registrado, metadata/capacidades y skill por scope se conservan.
  Cambiar el endpoint usa catálogo nuevo y no hereda modelo/clave del anterior.
  Config permanece idéntica; ejecución con config ausente no crea ese archivo.
- HTTP 401 devuelve 1, registra fallo y libera lock. SIGINT devuelve 130 y
  SIGTERM 143; ambos conservan respuesta/reasoning parciales y liberan locks.
- length continúa en etapas, conserva parciales y oculta S42_CONTINUE en stdout.
- Suite existente incluye TUI real en PTY, menús, providers, tools, sesiones,
  paletas, archivos, MCP y skills. No hubo builds ni pruebas de otros SO.

La primera ampliación del fixture de skill no usaba una carpeta con el mismo
nombre que el frontmatter; se corrigió el fixture para cumplir el contrato ya
existente de SKILL.md. No se modificó ese contrato.

## Modelo real

[Registro completo](cli-live.json). Proceso real `bun index.ts` con
`--llm_server http://127.0.0.1 --llm_port 8080 --prompting … --reasoning off`;
sin --model ni registro previo, con catálogo GLM-4.7-Flash en `/v1/models`.
stdin ignorado, stdout/stderr pipes, TERM=dumb. No App ni terminal interactivo.

Se pidió corregir una función que restaba en lugar de sumar, leyendo código y
test sin cambiar el test. Modelo ejecutó **read, read, edit, shell, read**;
el archivo pasó de `a - b` a `a + b`. `bun test` ejecutado por el agente y una
verificación independiente terminaron con **1 pass / 0 fail**, salida 0.
Test original intacto, lock liberado y config no creada.

Cinco requests: **12158 entrada / 450 salida**, **36,5 tok/s observados**,
aproximadamente **12,4 s** de ejecución total. El promedio usa tokens reportados /
duración de requests e incluye red/primer token, excluye tools. No es velocidad
pura de decode ni evidencia de rendimiento general. stdout contiene la respuesta
final; stderr contiene ejecución/resultados y métricas. Reasoning está guardado
en eventos y oculto en consola.

Sin publicación ni push. Git pull falló porque main no tiene upstream. Trabajo
ajeno en docs/qa/final-validation.md y CLAUDE.md conservado fuera de la tarea.
