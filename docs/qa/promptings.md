# QA — Promptings reutilizables

Fecha: 2026-10-01. Bun 1.4.2, fuente desde `index.ts`, Linux x64.

## Comportamiento

- Biblioteca global en config.json: `promptings: [{ id, name, text }]`. Crear,
  leer/editar, borrar y guardar borrador actual desde Archivo. Alt+T y /promptings;
  binding configurable `promptings`, NORMAL Espacio+t. Sin nueva cabecera.
- `{{metavar_name}}` identifica una metavariable; nombres ASCII con letra o `_`
  inicial, luego letras/números/`_`, con espacios opcionales dentro de las llaves.
  Preguntas en orden de aparición, una por nombre distinto. Valores vacíos,
  Unicode y multilínea; Anterior conserva respuestas y Esc conserva el draft.
- Enter en Nombre pasa a Texto; Enter en Texto guarda; Shift+Enter inserta línea.
  En preguntas, Enter avanza o aplica la última; Shift+Enter agrega línea.
- Cargar pone el texto resuelto en INSERT con foco en el prompt y guarda el
  borrador; ejecutar envía ese texto a la sesión/modelo actuales. Ejecución
  explícita envía la plantilla como texto incluso si comienza con `/quit` o una
  ruta. Falta de modelo conserva el texto; un turno activo bloquea el reemplazo.
- Reemplazo literal, sin expansión recursiva: `$&`, `{{otra}}` y `__proto__`
  funcionan como valores/nombres. La plantilla guarda sus metavariables; los
  valores resueltos se conservan en borrador/historial conforme al flujo existente.

## Verificación ejecutada

`bun run typecheck`: correcto. `bun test`: **96 pass, 0 fail**, 19 archivos,
1085 assertions. Los cinco tests nuevos cubren:

1. Variables repetidas, espacios, nombres inválidos conservados como texto,
   reemplazo literal, Unicode/multilínea, vacío y error por valor faltante.
2. Migración de JSON anterior, endpoint existente conservado, registros inválidos
   e IDs duplicados rechazados y archivo malformado sin sobrescribir.
3. CRUD persistente y reapertura, guardar borrador, validación inline de nombre,
   Enter/Shift+Enter, clic/release en Anterior, cancelación y resize sin perder
   valores ni tapar el prompt; carga sin request, comando y binding NORMAL.
4. Turno activo conserva draft/preguntas; falta de modelo deja el prompt completo.
5. PTY real con index.ts: crear plantilla, guardar sin enviar, resolver Unicode
   y multilínea, ejecutar contra fixture SSE, recibir reasoning/respuesta,
   verificar payload exacto y plantilla original, resize, cierre limpio y
   reapertura de historial/biblioteca sin repetir requests.

La primera corrida de tests detectó que abrir la biblioteca sin ID seleccionado
resaltaba “Nuevo prompting” en lugar del primer guardado; corregido y suite verde.

[Capturas tmux](promptings-captures.txt): biblioteca, editor y preguntas 80×24;
valor multilínea y prompt cargado 60×16. Se inspeccionó una reconstrucción RGB de
esas celdas: marcos, botones, foco y campos quedan visibles sobre el chat, sin
superponer el prompt fijo. El primer intento de captura no llegó a las preguntas
al enviar Escape y Alt+T inmediatamente; repetir esperando el cierre del editor
produjo las capturas correctas. El test PTY automatizado también pasó.

Límites: fixture local, sin inferencia real adicional; interacción de mouse
inyectada, sin prueba física en el emulador del usuario. Sin builds ni cambios
en configuración personal. Pull fallido por main sin upstream; trabajo local.
