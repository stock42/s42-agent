# Campaña comercial basada en la TUI real · 2026-10-01

Pedido: crear cinco imágenes comerciales nuevas en español y cinco en inglés,
usando las capturas finales como referencia. Resultado en
[assets/banners/s42-agent-real-tui-2026-10-01/](../../assets/banners/s42-agent-real-tui-2026-10-01/README.md).

## Entrega y procedencia

- Diez PNG RGB de 1254×1254: dos carruseles de cinco piezas, con una identidad
  común de azul QBasic, cian, fondo oscuro y titulares grandes.
- Historias: TUI QBasic, proyectos/archivos/WebServer, idiomas/temas,
  modelos/tools/MCP/skills/CLI y benchmark histórico.
- Generación y ediciones mediante `image_gen`; prompts finales, referencias y
  corrección de decimales en [prompts.json](../../assets/banners/s42-agent-real-tui-2026-10-01/prompts.json).
- Nueve JPEG reales usados como referencias, con sus hashes y procedencia en
  [manifest.json](../../assets/banners/s42-agent-real-tui-2026-10-01/manifest.json).
  La galería quedó registrada en bf666ca2fa8cc3a49effc484cc78c6b5f58f5e57;
  los commits fuente de ejecución constan en el manifiesto de screenshots.
- Composiciones publicitarias generadas: sus inserts reproducen las referencias
  de la TUI y pueden variar en detalles finos de texto. No son capturas sin editar
  ni evidencia nueva de ejecución. Los 35 JPEG originales permanecen intactos
  en [screenshots/](../../screenshots/README.md).
- La pieza de temas muestra cuatro referencias (QBasic, Forest, Nord y Dracula)
  y nombra las seis opciones disponibles. No se fabricaron capturas para Graphite
  o Gruvbox. El texto publicitario está localizado; el texto dentro de las
  referencias conserva el idioma capturado.
- Campañas anteriores conservadas. README EN/ES enlazan las piezas nuevas y
  mantienen la galería real separada. Cada serie incluye captions de publicación.

## Revisión visual

Se inspeccionaron las diez imágenes completas y sus referencias. Comprobados
titulares, nombres, acentos, URL del repositorio, numeración 01–05, márgenes,
jerarquía, contraste y legibilidad de textos comerciales.

Los inserts muestran menús/pestañas, números de línea, prompt fijo y paletas
de las capturas. El catálogo publicitado tiene doce nombres de tools reales:
read, write, edit, list, find, search, fetch, shell, internal_skill,
markdown_html, websocket y scrape. WebServer es una función de Tools en la TUI,
sin aumentar ese catálogo LLM a trece.

La primera salida del benchmark inglés conservó comas decimales. Se corrigió
con una edición puntual de image_gen: las cinco métricas tienen puntos,
conservando la coma de miles en `1,000 messages`. La salida final fue inspeccionada.

## Benchmark

Valores cotejados con el [JSON histórico](benchmark-s42-agent-0.1.0-linux-x64.json)
y la [metodología](final-validation.md):

| Métrica | Español | English |
| --- | --- | --- |
| Arranque p95 | 24,43 ms | 24.43 ms |
| Input p95 | 35,95 ms | 35.95 ms |
| SSE a frame p95 | 4,07 ms | 4.07 ms |
| RSS en reposo | 46,64 MiB | 46.64 MiB |
| Reanudar 1.000 mensajes | 42,07 ms | 42.07 ms |

Ambas piezas indican v0.1.0/Linux x64, 30 arranques, 100 inputs, 20 deltas SSE,
PTY/caché caliente, CPU/Ubuntu/Bun y exclusión de inferencia LLM/pintura del
emulador. No se ejecutó otro benchmark. Los tokens/tok/s visibles en la pieza
de herramientas pertenecen al chat capturado; no son cifras de esta tabla.

## Comprobaciones de archivos

- Los diez PNG decodifican completos con Pillow; tamaño y modo RGB correctos.
- Dimensiones, bytes y SHA-256 registrados con Bun. Los 35 hashes del manifiesto
  de screenshots coinciden; originales intactos.
- JSON de prompts/manifiestos parseados; diez registros, cinco por idioma,
  referencias existentes y cinco valores redondeados cotejados con el registro.
- 201 enlaces Markdown y src/href locales de ocho documentos (README EN/ES,
  galerías, QA, AGENTS y CHANGELOG) comprobados, sin rutas faltantes.
  `git diff --check` correcto.
- ZIP de entrega local en `out/marketing/s42-agent-real-tui-2026-10-01-es-en.zip`.
  Contenido comprobado: quince archivos, incluidos diez PNG, galerías/captions,
  prompts y manifiesto; CRC y diez hashes de imágenes correctos.

Pull previo correcto. Sin cambios de runtime, builds, suites funcionales,
benchmarks nuevos, push o anuncios enviados. Edición previa ajena de
final-validation.md conservada fuera del commit.
