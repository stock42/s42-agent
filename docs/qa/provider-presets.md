# Proveedores precargados y catálogo guiado

Fecha: 2026-10-01. Fuente: index.ts, Bun1.4.2, Linux x64.

## Cambio

Models → Proveedores (Ctrl+B) y Nuevo proveedor ofrecen llama.cpp/DeepSeek con
endpoints preconfigurados; Nuevo proveedor también conserva la opción manual.
llama.cpp sigue siendo el default. DeepSeek sugiere DEEPSEEK_API_KEY o permite
una clave para la ejecución actual. Una clave explícita de sesión tiene prioridad.

Guardar consulta GET `/models` con Bearer si corresponde y abre la lista de ese
proveedor para elegir el modelo. No hay catálogo fijo ni conexiones al iniciar.
Errores de clave/conexión/lista vacía permanecen en el formulario, sin guardar
ese cambio. La selección anterior y el borrador se conservan hasta elegir.
Una configuración previa mantiene sus endpoints/modelos; los presets faltantes
se muestran como plantillas sin modificar el archivo hasta guardar.

Nombres/contexto/modalidades se toman de la metadata publicada. Salida inicial
2048 tokens, reducida si el límite remoto/contexto exige menos. Tools habilitadas
para DeepSeek según su API, desactivadas inicialmente para otros endpoints;
capacidades de modelos registrados por el usuario no se sobrescriben.

Referencias oficiales verificadas: [endpoint/autenticación](https://api-docs.deepseek.com/),
[models y metadata](https://api-docs.deepseek.com/api/list-models/),
[Chat Completions y tools](https://api-docs.deepseek.com/api/create-chat-completion/).

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| Typecheck / suite | `bun run typecheck` correcto; `bun test`: 91 tests, 18 archivos, cero fallas. |
| Tests del flujo | `tests/providers.test.ts`: JSON anterior, templates, endpoint editable, claves separadas, Bearer, nombres/contexto/modalidades, IDs duplicados, catálogo legacy, selección explícita y reapertura sin persistir la clave. |
| Errores/cierre | HTTP401 corregido en el mismo formulario; catálogo vacío/inválido; Ctrl+C cancela; un formulario cerrado no reabre resultados. |
| PTY desde index.ts | 60×16: ambos presets, formulario, key de fixture, catálogo HTTP y elección sin escribir ID; borrador/prompt visibles, config/sesión sin clave, salida0 y restauración. |
| tmux RGB | [Cinco capturas de texto](provider-presets-captures.txt), 80×24 y 60×16. Se revisaron colores/celdas mediante una reconstrucción visual; no son capturas de píxeles del emulador del usuario. Los modelos Alpha/Beta y la clave son fixtures locales. |
| DeepSeek remoto | No se consultó con autenticación real: DEEPSEEK_API_KEY no está configurada en el entorno. Documentación oficial + servidor fixture no demuestran inferencia real del proveedor. |
| Binarios | No se compilaron en esta tarea de UX. |

Entrada de teclado/mouse inyectada no sustituye una prueba física del terminal.
Git pull intentado al inicio: main sin upstream; commit local, sin push.
