# QA — Tools nativas, explorador y recursos

2026-10-01. Linux x64, Bun 1.4.2. Config/proyectos temporales; fuente index.ts.

Typecheck correcto. Suite: **111 pass / 0 fail**, 23 archivos, 1398 assertions. Tests HTTP con
Bun.serve verifican GET/POST/PUT/PATCH/DELETE/HEAD, headers, JSON nested,
URL-encoded, boundary multipart y texto; HTTP422 conserva body/failed.
Argumentos inválidos no producen requests. Stream abundante conserva JSON/UTF-8
y límite 64 KiB; timeout/cancelación cierran la request. Las regresiones de shell
siguen drenando stdout/stderr y terminando descendientes.

find busca fuera del cwd por nombre/glob, omite/permite dependencias, no entra en
un enlace cíclico, y respeta límite/cancelación. Explorador por teclado/mouse
inyectado: campo Buscar, ruta fuera del proyecto, resultados con ubicación,
preview read-only/adjuntos, cancelación, cierre y conservación del borrador.
Tamaño grande >170 columnas/>35 filas en 190×50; compactos mantienen resultados
clicables y prompt visible. Sort final por ruta/nombre.

CPU se valida con deltas conocidos; statfs con bloques reservados; VRAM con
CSV de dos GPUs y N/A/error. Refresh real obtuvo RAM/disco/CPU del host.
`nvidia-smi` falló realmente con **Driver/library version mismatch**; se muestra
VRAM N/D y ese motivo. No se presenta el fixture de VRAM como lectura física
exitosa. No se modificaron drivers ni se instaló una utilidad.

Tokens fixture: tool call con 10/5, length con 20/10 y recuperación con 30/15
acumulan **60 entrada / 30 salida**, 3 requests. Pestaña B sin usage conserva
N/D sin heredar A. Reabrir restaura ambos, sesiones anteriores siguen válidas.
Uso de requests incompletas se marca parcial. No se usa la estimación de contexto
como medición de tokens. Se solicita stream_options.include_usage.

## Modelo real

[Registro](native-tools-live.json). GLM-4.7-Flash en
`http://127.0.0.1:8080/v1`, sin cambiar su configuración. El prompt solicita find
de nota-demo.txt y fetch POST JSON contra Bun.serve temporal. Ejecutó ambas calls,
encontró el archivo y recibió HTTP200 con `{ok:true,source:"s42-native-fixture"}`.
El servidor confirmó método/body. Respuesta final confirma los resultados.
Dos requests LLM: **2520 entrada / 360 salida / 2880 total**, reportados por ese
proveedor real. No se extrapola la prueba breve a cualquier modelo/pedido.

## Terminal

[Capturas](native-tools-captures.txt) de index.ts en servidor tmux temporal,
reconstruidas en RGB e inspeccionadas a **190×50, 80×24 y 60×16**:

- Chat readonly, prompt fijo y recursos medidos; respuesta/uso SSE son fixture.
- Explorador ocupa el editor, Busca *.ts fuera del proyecto y muestra 12 rutas
  ordenadas. Al encoger conserva Buscar, resultados, Adjuntar y borrador visible.
- Recursos/tokens en una fila grande o dos compactas; VRAM N/D explícito.
- Escape devuelve chat/borrador; Ctrl+Q termina y limpia proceso/muestreo.

La primera captura tras resize inmediato recogía el reflow de tmux antes del
frame del agente. Se esperó el render completo antes de capturar nuevamente;
no se usa esa captura transitoria como evidencia del layout final.
Las métricas repintan únicamente filas cambiadas, con muestreo cada 2 s; la
prueba histórica idle 10 s pertenece al modo demo sin monitor.

Sin builds nuevos, QA de mouse/drop físico, Windows/macOS/arm64 ni publicación.
git pull falló por main sin upstream; cierre local sin push. Cambios ajenos en
CLAUDE.md y docs/qa/final-validation.md conservados fuera del commit.
