# Anuncio de S42 Agent

Textos preparados para publicar **después** de que el repositorio sea público,
se haya subido el commit aprobado y se verifique el enlace sin autenticación.
Son borradores: esta preparación no envía publicaciones ni mensajes.

Repositorio: https://github.com/stock42/s42-agent

## LinkedIn · Español

S42 Agent: un agente de coding con alma de QBasic.

Quería una herramienta simple, rápida y con una interfaz que diera ganas de
usar. Una terminal con ventanas, menús, mouse y atajos inspirados en Vim.
Con un proyecto abierto, sus archivos a mano y un lugar claro para hablar con
el agente.

S42 Agent está desarrollado con TypeScript y Bun, es open source y tiene
licencia MIT.

Incluye:

- Proyectos en pestañas que pueden trabajar en paralelo.
- Explorador de archivos, números de línea y colores para HTML, CSS, JavaScript y TypeScript.
- WebServer del proyecto para abrir y probar HTML/CSS/JS en el navegador.
- llama.cpp por defecto, DeepSeek y proveedores compatibles configurables.
- 12 tools nativas para archivos, búsqueda, HTTP, comandos, Markdown,
  WebSocket y scraping.
- MCP, skills internas/externas y búsqueda en skills.sh.
- Biblioteca de promptings con {{metavariables}}.
- Español/inglés, seis temas y tokens visibles.
- SQLite para configuración e historial.
- CLI para ejecutar el mismo agente sin cargar la TUI.

Esta primera versión es una preview con código fuente e instaladores de un
comando. Incluye binarios x64 y ARM64 para Windows, Linux y macOS: Linux x64
ya tiene validación local y pruebas con un modelo real; la ejecución en los
otros destinos sigue pendiente.

Building with Codex & GPT-6.1 Sol.

Si te interesa el coding con modelos locales, las terminales con personalidad
o aportar a un agente pequeño hecho con Bun, te invito a probarlo.

Código, inicio rápido y documentación:
https://github.com/stock42/s42-agent

#S42Agent #Bun #OpenSource #LocalLLM #CodingAgent

Imagen recomendada: [01 · Alma de QBasic](../../assets/banners/s42-agent-real-tui-2026-10-01/es/01-alma-qbasic.png).
También se puede adjuntar el carrusel completo en el orden indicado más abajo.

## LinkedIn · English

Introducing S42 Agent: a coding agent with the soul of QBasic.

A terminal with windows, menus, mouse support and Vim-inspired shortcuts.
Your projects, files and conversations in one workspace — with a local model
if that's how you want to work.

Built with TypeScript and Bun. Open source. MIT licensed.

S42 Agent includes concurrent project tabs, a file explorer, HTML/CSS/JS/TS
syntax colors and line numbers, a project WebServer for browser previews,
llama.cpp and DeepSeek presets, twelve native tools, MCP,
internal/external skills and a skills.sh finder.

It also has reusable prompts with {{variables}}, Spanish/English, six themes,
native SQLite persistence and a headless CLI using the same agent loop.

This first preview includes source, one-command installers and x64/ARM64
binaries for Windows, Linux and macOS. Linux x64 has local runtime validation
and real-model testing; execution on the other targets remains pending.

Building with Codex & GPT-6.1 Sol.

If you enjoy local LLMs, terminal interfaces or small Bun projects, I'd love
your feedback and contributions.

Code and quickstart:
https://github.com/stock42/s42-agent

#S42Agent #Bun #OpenSource #LocalLLM #CodingAgent

Recommended image: [01 · QBasic soul](../../assets/banners/s42-agent-real-tui-2026-10-01/en/01-qbasic-soul.png).
The English campaign has five matching images and captions linked below.

## Anuncio corto · Español

S42 Agent: coding con alma de QBasic. Ventanas, mouse, proyectos en pestañas y WebServer. llama.cpp, 12 tools, MCP, skills y CLI. Dos idiomas, seis temas. Bun + MIT. Preview con fuente y binarios.
https://github.com/stock42/s42-agent

## Anuncio corto · English

S42 Agent: coding with the soul of QBasic. Windows, mouse, project tabs and web previews. Local LLMs, 12 tools, MCP, skills and CLI. Two languages, six themes. Bun + MIT. Source and binary preview.
https://github.com/stock42/s42-agent

## Publicación dedicada al benchmark · Español

Un agente de terminal también tiene que sentirse rápido.

El benchmark registrado de S42 Agent v0.1.0 en Linux x64 reporta:

- Arranque p95: 24,43 ms.
- Input p95: 35,95 ms.
- Delta SSE a frame p95: 4,07 ms.
- RSS en reposo: 46,64 MiB.
- Reanudar una sesión de 1.000 mensajes: 42,07 ms.

Se midieron 30 arranques, 100 entradas y 20 deltas SSE. Es una medición
histórica del binario registrado, con caché caliente y bytes recibidos en PTY.
No incluye inferencia del LLM ni pintura del emulador gráfico, ni es un
benchmark nuevo del código actual.

El método y el registro están en docs/qa/final-validation.md y su JSON enlazado.

Código y documentación:
https://github.com/stock42/s42-agent

Imagen: [05 · Benchmark](../../assets/banners/s42-agent-real-tui-2026-10-01/es/05-benchmark.png).

## Orden del carrusel y pies de imagen

1. [01 · El futuro del coding. Con alma de QBasic.](../../assets/banners/s42-agent-real-tui-2026-10-01/es/01-alma-qbasic.png)
   — Ventanas, mouse, menús y atajos Vim en una TUI escrita con Bun.
2. [02 · De la idea al navegador.](../../assets/banners/s42-agent-real-tui-2026-10-01/es/02-proyectos-y-web.png)
   — Pestañas, archivos y WebServer para probar tu proyecto en el navegador.
3. [03 · Tu idioma. Tu estilo.](../../assets/banners/s42-agent-real-tui-2026-10-01/es/03-idiomas-y-temas.png)
   — Español/inglés y seis temas; Enter envía, Shift+Enter agrega una línea.
4. [04 · Elegí tu modelo. Dale herramientas.](../../assets/banners/s42-agent-real-tui-2026-10-01/es/04-modelos-y-herramientas.png)
   — llama.cpp, DeepSeek, tools, MCP, skills, metavariables y CLI.
5. [05 · Rápido. Y con números.](../../assets/banners/s42-agent-real-tui-2026-10-01/es/05-benchmark.png)
   — Benchmark histórico con versión, host y método visibles.

English carousel: [images 01→05 and captions](../../assets/banners/s42-agent-real-tui-2026-10-01/en/README.md).

PNG de 1254 × 1254 px. Son composiciones comerciales generadas con referencias
de la TUI real; los originales están en [screenshots](../../screenshots/README.md).
[Textos, prompts y procedencia](../../assets/banners/s42-agent-real-tui-2026-10-01/README.md).

## Datos para GitHub

[github-metadata.json](github-metadata.json) contiene descripción, topics,
homepage y los datos propuestos de la primera prerelease. No es un archivo
que GitHub aplique automáticamente; se usan al editar el repositorio.

[Notas de versión](../releases/v0.1.0.md) ·
[Procedimiento de publicación](../PUBLISHING.md).

Portada horizontal del enlace de GitHub: [social-preview.jpg](../../assets/github/social-preview.jpg).
Es una pieza adicional al carrusel, en inglés, con master PNG y prompt conservados.
