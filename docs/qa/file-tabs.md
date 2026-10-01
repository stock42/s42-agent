# QA — Pestañas de archivos y resaltado

2026-10-01, Linux x64, Bun 1.4.2. Typecheck correcto, suite completa:
**136 pass / 0 fail**, 29 archivos. Después del ajuste final de cabecera y mouse,
la suite de archivos/sintaxis pasó sus 5 tests y 126 assertions.

`tests/file-tabs.test.ts` abre desde el explorador, ocupa el panel central y
empieza en la primera línea. Lee HTML UTF-8 completo >64 KiB, conserva chat,
borrador, adjuntos y cwd; cambia por clic/Alt/teclado, deduplica y conserva scroll.
Selección sigue visible y edición no modifica la vista/disco. ES/EN, 60×16,
100×32, archivo externo, binario, ruta inexistente/directorio, cierre de archivos
con proyecto ocupado y cierre del proyecto verificados. Un SSE controlado confirma
que enviar vuelve al chat y deltas en background no reemplazan una vista activa.

El test PTY ejecuta `index.ts`: Ctrl+E, abrir HTML, colores RGB de keywords,
resize, alternar chat/archivo, Ctrl+W y restauración del terminal al salir.
`tests/syntax.test.ts` preserva el texto original, incluidas strings,
Unicode/código incompleto, comentarios multilineales y HTML con CSS/JavaScript.
Las pruebas de paletas cubren también los nuevos roles semánticos/contraste.

[Cuatro capturas tmux](file-tabs-captures.txt), [ANSI/RGB originales](file-tabs-captures.json):
QBasic y Nord en 100×32, archivo en 60×16 y regreso al proyecto con borrador.
Capturas reconstruidas visualmente desde ANSI e inspeccionadas: título centrado,
pestaña de archivo activa, contexto, tags/atributos/strings/propiedades/keywords
con colores distintos, Prompt/tokens/recursos visibles y cierre sin perder draft.
La captura compacta solo muestra las líneas que caben; el resto tiene scroll.

Se consultó el contrato oficial de [Bun.file/arrayBuffer](https://bun.sh/docs/runtime/file-io).
Lectura completa nativa, sin modificar archivos ni ejecutar HTML/JS. Resaltado
léxico propio, calculado al abrir, sin AST/LSP; templates como strings y sin
gramática específica para regex/JSX. Las vistas duran esta ejecución y no se
agregan a config.workspace ni a la sesión del modelo como adjuntos automáticos.

El primer fixture PTY reutilizaba texto anterior para detectar el regreso al chat;
el renderer podía combinar cambios antes del repintado. Se corrigió el fixture
para esperar output nuevo por transición. La primera captura heredó NO_COLOR del
entorno; se repitió explícitamente sin NO_COLOR y con COLORTERM=truecolor.

Sin builds, inferencia real, mouse físico ni ejecución en otros SO. Pull falló
por main sin upstream; commit local, sin push. Cambios previos de CLAUDE.md y
docs/qa/final-validation.md conservados fuera del commit.
