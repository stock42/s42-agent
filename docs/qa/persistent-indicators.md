# QA — Indicadores persistentes

2026-10-01. Linux x64, Bun 1.4.2. Config/proyectos temporales; index.ts desde fuente.

Typecheck correcto. Suite completa: **127 pass / 0 fail**, 25 archivos,
1980 assertions. Sin builds ni push. Pull falló: main sin upstream.

- Prompt sin Enviar/Cancelar: Enter envía, Shift+Enter inserta línea, Ctrl+C
  cancela. Borrador usa todo el ancho bajo E/S y tok/s, sin cubrir contadores.
- CPU %, capacidades usadas/totales, columnas ajustadas sin recortar recursos.
  Vista alterna CPU/RAM/Disco/VRAM por teclado y mouse inyectado, sin modal de
  datos; cambio persistido ES/EN. Fallo de guardado conserva preferencias/UI.
- Config anterior habilita los cuatro sin reescribir el archivo. Config inválida
  se rechaza sin sobrescribir. Sesiones anteriores sin timing muestran N/D.
- Tokens siempre visibles, incluso con los cuatro recursos apagados. Conteos
  grandes caben en 60×16; valores exactos permanecen en la sesión.
- Fixture de calls/length conserva 60 entrada/30 salida y timing por turno;
  pestaña sin usage muestra N/D. Reapertura restaura E/S y tok/s por pestaña.
  Tests verifican tasa con duraciones conocidas, uso ausente y salida cero real.

## Terminal

[Seis capturas de tmux](persistent-indicators-captures.txt): 100×32, 80×24,
60×16, CPU oculto, explorador abierto y adjunto en 60×16. Fuente index.ts,
recursos reales del host; respuesta y 1200/120 tokens proceden de un SSE fixture
local con 400 ms de demora. Su tasa no es un benchmark del modelo.
Se inspeccionaron distribución, márgenes, tokens a la derecha, recursos completos,
prompt/foco, estado y adjuntos separados. Explorador queda sobre el editor.

Capturas iniciales tras resize recogieron el reflow viejo de tmux antes del
frame nuevo. Se esperó el repintado completo; no son evidencia del layout final.
No se validó mouse/drop físico ni runtime de Windows/macOS. Sin tocar config
personal, drivers, servicios del usuario ni los archivos ajenos ya modificados.
VRAM real sigue N/D por contador no disponible; no se sustituye por cero.

## LLM real

[Registro](persistent-indicators-live.json): App.submit con GLM-4.7-Flash en
http://127.0.0.1:8080/v1. Una request reportó **151 entrada / 92 salida**,
881,179 ms medidos, **104,4 tok/s observados**. Resultado guardado en sesión.
La UI usa salida reportada/tiempo de sus requests, incluyendo red y primer
token; excluye tools/MCP. No representa velocidad pura de decode del servidor
ni se extrapola esta prueba breve a otros pedidos/proveedores.

Los contadores se actualizan cuando el proveedor entrega usage, normalmente al
final de cada request. No se cuentan deltas/caracteres ni se inventa un contador
en vivo si el proveedor no informa uso. N/D sin uso/timing; parcial si falta E/S.

## Etiqueta del promedio de tokens por segundo

2026-10-01. Indicador explícito `Tokens E/S 1200/120 · Prom. … tok/s`
(`Avg.` en inglés), arriba a la derecha de Prompt. Cálculo observado conservado:
salida reportada / duración de sus requests, incluyendo red y primer token;
excluye tools. Se actualiza al recibir usage al finalizar la request. Sin timing
o salida reportada muestra `Prom. N/D tok/s`.

Typecheck y **23 tests / 4 archivos / 499 assertions** correctos. Se verificó
el promedio ponderado de requests con tasas distintas (10/1 s + 60/3 s =
17,5 tok/s), contadores grandes y parcial sin recortar el promedio/marco a
60 columnas, ES/EN, recursos ocultos, borrador, archivos y demo.

[Seis capturas nuevas de tmux](average-tokens-captures.txt) desde index.ts:
ES y EN a 100×32 antes y después de la respuesta, y resize a 60×16 con borrador
Unicode intacto. EN sin color ni recursos. Respuesta/1200 entrada/120 salida
de SSE fixture con 400 ms de espera; promedio numérico completo visible en las
cuatro capturas posteriores. No es una medición de velocidad de un modelo real.
Sin builds ni push; config/proyecto temporales y pull fallido por main sin upstream.
