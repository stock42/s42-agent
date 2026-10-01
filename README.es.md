# S42 Agent

**Un agente de coding con alma de QBasic.**

Desarrollado con TypeScript y Bun. Una terminal con ventanas, mouse, proyectos
en pestañas y soporte para modelos locales. Open source bajo [licencia MIT](LICENSE).

[English](README.md) · [Manual de uso](docs/USAGE.es.md) ·
[Tools](docs/TOOLS.md) · [Contribuir](CONTRIBUTING.es.md)

<img src="screenshots/32-spanish-gruvbox.jpg" alt="S42 Agent ejecutándose: pestañas de proyecto y archivo, TypeScript con números de línea, sintaxis coloreada y prompt fijo" width="960">

*Ejecución real de `index.ts` en una PTY de Bun, mostrada por xterm.js en Chrome.
[Galería y detalles de captura](screenshots/README.md).*

## Qué tiene de especial

El escritorio clásico de QBasic llevado al coding con IA: menús, ventanas con
título, navegación por teclado y un prompt siempre visible mientras el agente
trabaja. Cada proyecto conserva su conversación, archivos, modelo y herramientas.

- **TUI estilo QBasic:** mouse, ventanas auxiliares movibles y atajos inspirados en Vim.
- **Varios proyectos a la vez:** sesiones y borradores independientes, actividad visible en cada pestaña.
- **Explorador de archivos:** cualquier carpeta, búsqueda por nombre/glob, adjuntos y colores para HTML/CSS/JS/TS con números de línea. El chat también tiene un margen numerado.
- **Preview web:** Tools → WebServer sirve el proyecto con Bun, puerto configurable y apertura del navegador.
- **Modelos locales y remotos:** llama.cpp por defecto, DeepSeek precargado y endpoints compatibles.
- **12 herramientas nativas:** leer, escribir, editar, buscar, HTTP, comandos, Markdown, WebSocket y scraping.
- **MCP y skills:** servidores stdio/HTTP, enabled/disabled, guías internas, skills externas y búsqueda en skills.sh.
- **Biblioteca de promptings:** plantillas con `{{metavariables}}` y formulario para completar sus valores.
- **Español o inglés y seis temas:** QBasic, Grafito, Bosque, Nord, Dracula y Gruvbox.
- **Actividad visible:** streaming, tools, tokens de entrada/salida y promedio tok/s; indicadores CPU/RAM/disco/VRAM configurables.
- **SQLite y llavero del SO:** configuración global e historial persistentes; las API keys se guardan aparte.
- **CLI sin TUI:** el mismo agente para pruebas y automatizaciones desde la command line.

El harness no tiene dependencias externas de paquetes de runtime. El servidor
LLM, sus modelos y los programas usados por shell/MCP se configuran aparte.

## Capturas reales

Un recorrido por el agente en ejecución. Cada imagen abre el original; las **35 capturas** están en la [galería completa](screenshots/README.md).

<table>
  <tr>
    <td><a href="screenshots/10-live-tool-chat.jpg"><img src="screenshots/10-live-tool-chat.jpg" alt="Modelo real, tools y métricas de tokens" width="440"></a><br><strong>Modelo real, tools y métricas de tokens</strong></td>
    <td><a href="screenshots/14-project-explorer.jpg"><img src="screenshots/14-project-explorer.jpg" alt="Explorador y búsqueda de archivos" width="440"></a><br><strong>Explorador y búsqueda de archivos</strong></td>
  </tr>
  <tr>
    <td><a href="screenshots/12-prompting-variables.jpg"><img src="screenshots/12-prompting-variables.jpg" alt="Promptings con {{metavariables}}" width="440"></a><br><strong>Promptings con {{metavariables}}</strong></td>
    <td><a href="screenshots/09-provider-presets.jpg"><img src="screenshots/09-provider-presets.jpg" alt="llama.cpp y DeepSeek precargados" width="440"></a><br><strong>llama.cpp y DeepSeek precargados</strong></td>
  </tr>
  <tr>
    <td><a href="screenshots/06-webserver.jpg"><img src="screenshots/06-webserver.jpg" alt="WebServer del proyecto" width="440"></a><br><strong>WebServer del proyecto</strong></td>
    <td><a href="screenshots/27-skills-search-results.jpg"><img src="screenshots/27-skills-search-results.jpg" alt="Resultados reales de skills.sh" width="440"></a><br><strong>Resultados reales de skills.sh</strong></td>
  </tr>
</table>

Las plantillas y Web Playground son ejemplos para las capturas. El chat usa un modelo local real; las imágenes del WebServer provienen de su QA en navegador.

<details>
<summary>Ver las seis paletas</summary>

<table>
  <tr>
    <td><a href="screenshots/16-qbasic-typescript.jpg"><img src="screenshots/16-qbasic-typescript.jpg" alt="QBasic" width="440"></a><br><strong>QBasic</strong></td>
    <td><a href="screenshots/17-graphite-typescript.jpg"><img src="screenshots/17-graphite-typescript.jpg" alt="Graphite" width="440"></a><br><strong>Graphite</strong></td>
  </tr>
  <tr>
    <td><a href="screenshots/18-forest-typescript.jpg"><img src="screenshots/18-forest-typescript.jpg" alt="Forest" width="440"></a><br><strong>Forest</strong></td>
    <td><a href="screenshots/19-nord-typescript.jpg"><img src="screenshots/19-nord-typescript.jpg" alt="Nord" width="440"></a><br><strong>Nord</strong></td>
  </tr>
  <tr>
    <td><a href="screenshots/20-dracula-typescript.jpg"><img src="screenshots/20-dracula-typescript.jpg" alt="Dracula" width="440"></a><br><strong>Dracula</strong></td>
    <td><a href="screenshots/21-gruvbox-typescript.jpg"><img src="screenshots/21-gruvbox-typescript.jpg" alt="Gruvbox" width="440"></a><br><strong>Gruvbox</strong></td>
  </tr>
</table>

</details>

## Empezar

Necesitás **Bun 1.4.2** y un terminal ANSI de al menos **60×16** celdas;
se recomienda 80×24 o más.

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

1. **Projects → Agregar proyecto:** Nombre/Name y Carpeta/Folder.
2. **Models → Proveedores:** configurá llama.cpp, DeepSeek u otro endpoint;
   consultá el catálogo y elegí el modelo.
3. Escribí en **Prompt**. **Enter** envía; **Shift+Enter** agrega una línea.
4. Seguí la respuesta y las tools en el chat. **Ctrl+C** cancela el turno activo.

El modelo y la configuración se recuerdan aunque abras el agente desde otra
carpeta. **Vista → Language** cambia el idioma; **Vista → Paleta de colores**
cambia el tema.

### Modelo local

Iniciá tu servidor llama.cpp con un GGUF disponible:

```bash
llama-server -m /ruta/modelo.gguf --host 127.0.0.1 --port 8080 --alias local-coder --jinja
```

Elegí `local-coder` en Models. Para usar herramientas, el modelo y su template
deben soportar tool calling. El agente descubre capacidades mediante `/props`.

### Sin interfaz

```bash
bun run index.ts \
  --cwd /ruta/proyecto \
  --llm_server http://127.0.0.1 \
  --llm_port 8080 \
  --prompting "Desarrollá un Tetris en un solo archivo HTML con sonido" \
  --reasoning off
```

También acepta `--model`, `--llm_apikey` y `--session`. La respuesta llega por
stdout; tools, errores, ID de sesión y uso por stderr. `--reasoning` controla
la visibilidad del razonamiento emitido por el proveedor. Todos los argumentos:
`bun run index.ts --help`.

### Probar un proyecto web

En **Tools → WebServer**, elegí el puerto (inicial `3000`) y **Iniciar**, o
presioná Enter en el campo. Sirve la carpeta del proyecto activo en
`http://127.0.0.1:PUERTO/` y abre el navegador predeterminado. Si estás viendo un
archivo dentro del proyecto, lo abre directamente; si no, abre `index.html` o
un listado de archivos. HTML, CSS, JavaScript, imágenes y otros archivos
estáticos conservan su tipo MIME. Refrescá el navegador para ver cambios.

El mismo menú permite **Detener** y **Abrir navegador**. Podés tener un servidor
por proyecto en distintos puertos. Cerrar el diálogo lo deja funcionando; cerrar
la pestaña del proyecto o salir del agente lo detiene. Es una preview estática,
sin bundler ni backend de aplicación.

## Herramientas

`read`, `write`, `edit`, `list`, `find`, `search`, `fetch`, `shell`,
`internal_skill`, `markdown_html`, `websocket` y `scrape`.

Usan APIs de Bun: Shell, Markdown, WebSocket y WebView, entre otras. Las
herramientas tienen los permisos de tu usuario y efectos reales; no hay sandbox.
El agente lee las instrucciones AGENTS.md del proyecto.

**Tools → MCP** administra servidores de herramientas. **Tools → Skills**
administra guías y busca en [skills.sh](https://skills.sh). Scraping requiere
un navegador instalado en Linux/Windows; crear PDF requiere un renderizador.
MCP implementa tools; resources/prompts, OAuth, sampling y elicitation no están
implementados. [Contratos y límites](docs/TOOLS.md).

## Benchmark registrado

Resultados históricos del binario v0.1.0 en Linux x64:

| Medición | Resultado |
| --- | --- |
| Arranque p95 | 24,43 ms |
| Input p95 | 35,95 ms |
| Delta SSE a frame p95 | 4,07 ms |
| RSS en reposo | 46,64 MiB |
| Reanudar 1.000 mensajes | 42,07 ms |

Caché del SO caliente y recepción de bytes en PTY; excluye pintura del emulador
e inferencia LLM. No es un benchmark nuevo de la fuente actual.
[Método](docs/qa/final-validation.md) · [Registro](docs/qa/benchmark-s42-agent-0.1.0-linux-x64.json).

## Estado y desarrollo

**v0.1.0 es una preview desde código fuente.** Linux x64 cuenta con validación
local, PTY y modelo real. Hay cross-builds de Windows/macOS/Linux arm64; faltan
pruebas de runtime en esos destinos y cobertura física de mouse/drop en
terminales. Este lanzamiento no incluye nuevos binarios descargables.

```bash
bun run typecheck
bun test
bun run index.ts --demo
```

El build del host es opcional: `bun run build`. El binario contiene Bun,
pero el servidor LLM y los comandos externos siguen siendo independientes.

[Manual completo](docs/USAGE.es.md) · [QA actual](docs/qa/reliable-coding-and-sqlite.md) ·
[Validación de publicación](docs/qa/publication-readiness.md) ·
[Notas v0.1.0](docs/releases/v0.1.0.md) · [Material del anuncio](docs/launch/ANNOUNCEMENTS.md) ·
[CHANGELOG](CHANGELOG.md).

## Imágenes promocionales

Cinco nuevas composiciones comerciales generadas a partir de las capturas finales,
con versiones en español e inglés. Los originales siguen en la galería de capturas
anterior. El benchmark muestra resultados históricos de v0.1.0 Linux x64;
excluye inferencia LLM y pintura del emulador.
[Campaña en español y captions](assets/banners/s42-agent-real-tui-2026-10-01/es/README.md) ·
[Ambos idiomas y fuentes](assets/banners/s42-agent-real-tui-2026-10-01/README.md).

<table>
  <tr>
    <td><a href="assets/banners/s42-agent-real-tui-2026-10-01/es/01-alma-qbasic.png"><img src="assets/banners/s42-agent-real-tui-2026-10-01/es/01-alma-qbasic.png" alt="Alma de QBasic" width="260"></a><br><strong>Alma de QBasic</strong></td>
    <td><a href="assets/banners/s42-agent-real-tui-2026-10-01/es/02-proyectos-y-web.png"><img src="assets/banners/s42-agent-real-tui-2026-10-01/es/02-proyectos-y-web.png" alt="Proyectos y preview web" width="260"></a><br><strong>Proyectos y preview web</strong></td>
    <td><a href="assets/banners/s42-agent-real-tui-2026-10-01/es/03-idiomas-y-temas.png"><img src="assets/banners/s42-agent-real-tui-2026-10-01/es/03-idiomas-y-temas.png" alt="Idiomas y temas" width="260"></a><br><strong>Idiomas y temas</strong></td>
  </tr>
  <tr>
    <td><a href="assets/banners/s42-agent-real-tui-2026-10-01/es/04-modelos-y-herramientas.png"><img src="assets/banners/s42-agent-real-tui-2026-10-01/es/04-modelos-y-herramientas.png" alt="Modelos y herramientas" width="260"></a><br><strong>Modelos y herramientas</strong></td>
    <td><a href="assets/banners/s42-agent-real-tui-2026-10-01/es/05-benchmark.png"><img src="assets/banners/s42-agent-real-tui-2026-10-01/es/05-benchmark.png" alt="Benchmark histórico v0.1.0" width="260"></a><br><strong>Benchmark histórico v0.1.0</strong></td>
  </tr>
</table>

## Autoría

Creado por [César Casas](https://www.linkedin.com/in/cesarcasas/) · Stock42.
**Building with Codex & GPT-6.1 Sol.**

Inspirado en la experiencia de QBasic y en [Pi](https://github.com/earendil-works/pi)
como referencia arquitectónica. S42 Agent es un proyecto independiente.

Contribuciones y reportes reproducibles son bienvenidos.
[CONTRIBUTING.es.md](CONTRIBUTING.es.md) · [MIT](LICENSE).
