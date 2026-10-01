# QA — Galería de capturas reales y README

Fecha: 2026-10-01. Bun 1.4.2, Linux x64, Chrome.
Fuente de las nuevas capturas: `494b9f34293448594ef02be3ef1c649db75423a5`.
Tarea de documentación y assets; sin cambios de código del harness.

## Entrega

- [screenshots/README.md](../../screenshots/README.md): galería por funciones,
  archivos/browser, promptings, configuración, seis temas e idiomas.
- [manifest.json](../../screenshots/manifest.json): 35 JPEG, dimensiones, bytes,
  SHA-256 y procedencia por lote. Total: 4.821.961 bytes de imágenes.
- 28 nuevas capturas 08–35; 7 copias idénticas de QA previa. Los originales en
  assets/screenshots/2026-10-01/ y docs/qa/assets/webserver/ quedan intactos.
- README EN/ES: portada real actual, seis miniaturas de funciones, paletas
  desplegables y las cinco imágenes de campaña en su idioma. Las ilustraciones
  tienen una sección separada y el benchmark conserva su alcance histórico.

## Método de captura

`index.ts` real ejecutado en Bun.Terminal, configuración SQLite temporal y
dos proyectos de ejemplo. WebSocket local transmite bytes ANSI e input entre
la PTY y xterm.js 6.0.0/fit addon 0.11.0 en Chrome. DejaVu Sans Mono 16 px,
line height 1.1. Viewport normal del navegador, sin override de tamaño.

Los JPEG se guardan tal como los devuelve Computer Use: sin recortes, retoques,
montajes ni generación de píxeles. Son capturas de un emulador de terminal
mostrado en el navegador, no de una ventana nativa del escritorio.
Cada imagen se inspeccionó en la salida de captura antes de incluirla.

Los formularios se abrieron mediante menús/teclado y el archivo TypeScript se
abrió con doble clic en el explorador. Las seis paletas y ambos idiomas se
cambiaron desde Vista/View. No se usó la configuración personal ni sus secretos.
Las tres plantillas y Web Playground son datos de entrada para las capturas;
no se agregaron como defaults del producto.

## Modelo y catálogo reales

GLM-4.7-Flash de llama.cpp en `http://127.0.0.1:8080/v1`, sin fixture.
Sesión: `6fdbe77f-2d35-4a60-bec4-307f03a358e5`.

Pedido: leer README.md mediante `read`, explicar brevemente el proyecto web
en inglés y su preview, sin modificar archivos ni ejecutar comandos.
Se observó la animación/estado activo (08), `read` con argumentos/resultados y
respuesta completada (10). SQLite registra tool-start, tool-result correcto
y turno completed: 2 requests, 4481 tokens de entrada, 277 de salida y
18294,04 ms acumulados de generación; la UI muestra 15,1 tok/s.
Es evidencia de esa interacción de lectura, no un benchmark ni una tarea de
coding completa.

Tools → Skills → Buscar consultó directamente skills.sh con `pdf`. La captura
27 conserva los resultados que devolvió el catálogo. No se instaló ninguna
skill. MCP stdio y registro de SKILL.md se capturaron como formularios; no se
presentan como conexión MCP ni instalación externas exitosas.

## Validación de entrega

- `bun run typecheck`: correcto.
- Los 35 JPEG se decodifican, sus dimensiones/bytes/hash coinciden con el
  manifiesto y las siete copias son idénticas a los originales.
- 232 referencias locales de README EN/ES, galería, QA, AGENTS y CHANGELOG
  comprobadas; ningún destino inexistente. Los 10 PNG promocionales anteriores
  se decodifican y conservan 1254×1254 px.
- Preview local de Markdown con Bun y estilos de lectura: revisión visual de
  portadas, galería y campañas EN/ES. Los dos README cargan sus 18 imágenes;
  la galería carga 37 miniaturas de 35 originales únicos. Sin overflow horizontal
  en el viewport normal. Es revisión local, no render remoto de GitHub.
- Cierre normal de index.ts: exit 0. Driver PTY y servidor de preview detenidos.
  Evidencia local en out/qa/screenshot-gallery/ (ignorado): driver como .ts.txt,
  ANSI original, resumen de eventos SQLite y vistas renderizadas de los README.

Sin builds, nueva suite de runtime, benchmarks nuevos, publicación externa ni
validación Windows/macOS en esta tarea. La edición ajena de final-validation.md
queda fuera del commit. Git pull --ff-only: Already up to date.
