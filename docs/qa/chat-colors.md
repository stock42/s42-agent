# QA — Colores de autores en el chat

2026-10-01, Linux x64, Bun 1.4.2. Typecheck correcto; suite completa:
**131 pass / 0 fail**, 27 archivos, 2260 assertions.

`tests/chat-colors.test.ts` ejecuta App con SSE local controlado. Verifica estilos
de Vos/Agente en historial, deltas y estado del turno; textos que contienen
literalmente esos nombres conservan el estilo del cuerpo. Comprueba Unicode,
selección, solo lectura, resize 60×16/100×32, ES/EN y ocultar/recuperar reasoning.
Reabre el `index.ts` real en PTY con proyecto/config temporales: recibe etiquetas
You/Agent con códigos RGB amarillo/cian y verifica que la sesión no guarda ANSI.

`tests/palettes.test.ts` comprueba colores diferentes en seis paletas, RGB y
ANSI16; contraste de las etiquetas ≥4.5:1 en las cinco paletas oscuras. ANSI16
evita negrita porque algunos terminales la convierten en un tono brillante y
unifican normal/brillante. Sin color, conserva etiquetas en negrita, selección
inversa y controles deshabilitados atenuados. Renderer vuelve a cero bytes idle.

Inferencia simulada, sin builds ni pruebas en otros sistemas operativos. Pull
falló por main sin upstream; commit local. Cambios previos de CLAUDE.md y
docs/qa/final-validation.md preservados fuera del commit.
