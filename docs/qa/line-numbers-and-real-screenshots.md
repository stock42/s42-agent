# Números de línea y capturas reales — 2026-10-01

Pedido aprobado: capturar la TUI ejecutándose y agregar números de línea en el
chat y las vistas de archivos. Los archivos continúan en solo lectura.

## Implementación

- `TextArea` numera líneas lógicas desde 1 en un margen independiente del texto.
  Las continuaciones por wrap dejan el número vacío. El ancho crece con los
  dígitos y desaparece si el área es demasiado angosta para margen y contenido.
- El layout, caret y hit testing del mouse descuentan ese margen. Unicode,
  selección, scroll, streaming, resize y colores de sintaxis siguen operando
  sobre el texto original. No se agregan números a archivos, mensajes o sesiones.
- Chat de cada proyecto, editor del workspace/demo y vistas de archivos tienen
  numeración; Prompt no. Estilo semántico en seis paletas y atenuado sin color.

## Validación

- `bun run typecheck`: correcto.
- `bun test`: **167 pass / 0 fail**, 2888 assertions, 35 archivos, 19.13 s.
- Seis casos nuevos en `tests/line-numbers.test.ts`: Unicode/wrap, selección con
  mouse y solo lectura, scroll/99→100/resize angosto, edición/undo del componente,
  integración chat/archivo/prompt y seis paletas/monocromo/idle.
- Fuente compartida del TextArea comprobada junto a la suite existente de PTY,
  pestañas, sintaxis, streaming, actividad, mouse, persistencia y proveedores.

## Ejecución visual

`index.ts --config <SQLite temporal> --project s42` ejecutado desde el checkout
en Bun.Terminal PTY. Un visor temporal xterm.js 6.0.0 / addon-fit 0.11.0 reenvía
ANSI y entrada de teclado/mouse mediante WebSocket local. Capturas tomadas por
Computer Use en Chrome; no se reconstruyó la interfaz en HTML.

Configuración aislada: inglés, dos proyectos reales (repositorio y componentes),
QBasic y cambio a Nord. La configuración personal no se modificó. El modelo
GLM-4.7-Flash del llama.cpp local emitió una respuesta tras ejecutar lecturas
reales y otra presentación breve sin herramientas. Se comprobó actividad,
respuesta en chat, contadores y promedio tok/s, navegación del explorador,
apertura de text-area.ts con P:/F:, cambio de tema y apertura/cierre de About.

[Cinco JPEG originales y manifiesto](../../assets/screenshots/2026-10-01/README.md),
1680×897 px, sin edición, overlays o generación de imágenes. README EN/ES usa
ahora una captura real en su portada. La conversación del modelo y las métricas
son evidencia de esta ejecución, no un nuevo benchmark de rendimiento.

Límite de la evidencia: captura de emulador de terminal en Chrome, no de la
ventana de terminal nativa del escritorio. No prueba runtime Windows/macOS ni
drag-and-drop físico del SO. Sin builds ni publicación externa en esta tarea.
La edición ajena de `docs/qa/final-validation.md` quedó fuera del commit.
