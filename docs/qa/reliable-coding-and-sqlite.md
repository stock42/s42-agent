# QA — Coding fiable, pestañas y SQLite

2026-10-01 · Linux x64 · Bun 1.4.2 · ejecución desde index.ts.

## Diagnóstico y corrección

El catálogo local guardaba GLM-4.7-Flash con tools=false, contexto 8192 y salida 2048.
El core omitía herramientas y su identidad decía explícitamente que no podía
actuar. El modelo devolvía HTML al chat; su salida se truncaba y las etapas podían
superar el contexto estimado o finalizar con un scaffold.

El servidor activo en 127.0.0.1:8080 informó /props con n_ctx 128768 y
supports_tools/supports_tool_calls=true. Ahora el harness consulta esa metadata
al descubrir/enviar: habilita herramientas disponibles y ajusta el contexto real,
con hasta 8192 de salida y como máximo un cuarto del contexto. Las ediciones
manuales conservan sus valores. Sin /props disponible no inventa metadata.
El prompt pide completar funcionalidad en disco y write admite append=true para
archivos grandes. Las llamadas truncadas siguen sin ejecutarse.

## Modelo real

Prompt exacto, sin instrucciones adicionales:

> crea un juego de tetris en html, css, js en un solo archivo llamado tetris-s42-agent.html, que sea 3D y tenga sonido

CLI sin TUI con configuración temporal que reproduce el catálogo anterior,
GLM-4.7-Flash real, --reasoning off y carpeta temporal. Exit 0: el agente ejecutó
list y write, creó tetris-s42-agent.html de 28.696 bytes y terminó en 3 requests;
13.536 tokens entrada/7.425 salida, promedio 41.3 tok/s observado en esa ejecución.
Metadata y hash en [reliable-coding-live.json](reliable-coding-live.json).

Validación independiente con Bun.WebView/Chrome del archivo generado, servido
por HTTP local, sin editarlo: 200 celdas, inicio, mover, rotar, gravedad,
fijación de pieza, eliminación de líneas/puntuación, pausa/reanudación,
game over/reinicio. Clic nativo sobre Comenzar a 1280×900 activó AudioContext
running; se observaron 14 inicios de oscilador durante los checks. Eventos de
teclado de los escenarios funcionales se inyectaron en el DOM; no es prueba de
teclado físico ni de sonido escuchado por una persona. Sin errores JS durante
estos checks. Screenshot inspeccionada: tablero con perspectiva 3D CSS y panel
lateral; hay solapamiento visual parcial entre tablero y ayuda de controles.
Esta muestra comprueba que el harness produce un juego ejecutable; no prueba
calidad perfecta de cualquier juego/modelo ni cubre todas las variantes de Tetris.

## TUI y tokens

- P:nombre y F:archivo se distinguen en barra; navegación/cierre/overflow 60×16
  y sintaxis conservan comportamiento en tests con index.ts PTY.
- Tres proyectos procesan sin deltas mientras se ve file.ts. Los tres indicadores
  cambian cada 200 ms; terminar uno no detiene los otros. Archivo/draft intactos.
- Captura real de SSE llama.cpp confirma timings_per_token con cache_n/prompt_n/
  predicted_n por token. Fixture comprueba contador 5→15 antes del final,
  promedio disponible durante la request, total final 15 y una sola request.
  Uso estándar tiene prioridad; no contar caracteres/chunks ni guardar cada token.
- El promedio incluye espera/red desde inicio de request, excluye tools y combina
  requests terminadas con el snapshot activo. Otros servidores actualizan a la
  frecuencia de uso que reportan.

## SQLite

- Configuración/historial globales en agent.sqlite; --config .json mantiene
  compatibilidad. JSON versionado en settings; sesiones/eventos indexados.
- Importación en una transacción, conserva JSON/JSONL byte a byte y referencias
  de credenciales. Reiniciar no duplica logs; defaults y borradores recuperados.
- Lock legacy vivo y registro completo corrupto abortan antes de confirmar:
  settings sin config y cero eventos. Corregir/reintentar funciona.
- Último registro incompleto se omite con aviso; archivo original conservado.
- Dos proyectos escriben separados, la misma sesión rechaza otro escritor.
- Proceso Bun real guarda assistant/call/start en SQLite, se mata y se reabre:
  eventos confirmados conservados, lock muerto recuperado, tool no reejecutada.
- index.ts real en PTY, XDG temporal y rutas por defecto: migra, muestra el modelo
  y draft anteriores, guarda el nuevo draft y restaura cursor al salir.
- CLI real sin TTY usa SQLite, ejecuta write, devuelve 0, informa ID reanudable,
  conserva config y guarda mensajes/results/turn completed.

## Comandos y límites

- bun run typecheck: correcto.
- bun test: **161 pass / 0 fail**, 2.824 assertions, 34 archivos, 19,11 s.
- Revisión focalizada final: 19 pass / 0 fail (live progress, recuperación, CLI y SQLite).
- Sin builds; sin config/llavero personal alterados para pruebas; sin push.
- git pull falló: main no tiene upstream. No se modificó seguimiento/remoto.
- docs/qa/final-validation.md tenía cambios previos del usuario y fue preservado.
