# S42 Agent — galería de capturas reales

[English](README.md) · **Español**

**35 capturas originales: 28 nuevas y 7 conservadas de QA anterior.**
Hacé clic en una miniatura para abrir el JPEG completo. [README en español](../README.es.md) ·
[README en inglés](../README.md) · [Manifiesto de capturas](manifest.json).

Son ejecuciones reales del `index.ts` raíz. Bun.Terminal ejecuta el agente en
una PTY; xterm.js muestra su salida ANSI original en Chrome. Las imágenes del
viewport se conservan sin modificar: sin píxeles generados, superposiciones,
retoques ni recortes. Son capturas del emulador de terminal, no de ventanas
nativas del escritorio.

Las capturas nuevas 08–35 usan el commit `494b9f34293448594ef02be3ef1c649db75423a5`,
Bun 1.4.2 y configuración SQLite temporal en Linux x64. El proyecto “Web Playground”
y las tres plantillas de promptings son datos de ejemplo de este recorrido;
no vienen preinstalados. No se usaron configuración ni credenciales personales.

Las capturas 08 y 10 muestran **GLM-4.7-Flash en llama.cpp local**, una llamada
real a `read` y la respuesta completada. Tokens y tok/s corresponden a esa
ejecución; no constituyen un benchmark ni prueban una tarea de coding terminada.
La captura 27 muestra resultados reales de skills.sh para `pdf`; no se instaló
ninguna skill. Las imágenes de MCP y registro de skills muestran formularios
reales de configuración; no prueban conexión MCP ni una skill externa instalada.

## Espacio de trabajo y agente

<table>
  <tr>
    <td><a href="08-live-agent-activity.jpg"><img src="08-live-agent-activity.jpg" alt="Actividad real del agente en pestaña y chat" width="440"></a><br><strong>Actividad real del agente en pestaña y chat</strong></td>
    <td><a href="10-live-tool-chat.jpg"><img src="10-live-tool-chat.jpg" alt="Llamada real a read, respuesta y métricas de tokens" width="440"></a><br><strong>Llamada real a read, respuesta y métricas de tokens</strong></td>
  </tr>
  <tr>
    <td><a href="16-qbasic-typescript.jpg"><img src="16-qbasic-typescript.jpg" alt="QBasic · TypeScript, números de línea y pestañas P:/F:" width="440"></a><br><strong>QBasic · TypeScript, números de línea y pestañas P:/F:</strong></td>
    <td><a href="20-dracula-typescript.jpg"><img src="20-dracula-typescript.jpg" alt="Dracula · TypeScript" width="440"></a><br><strong>Dracula · TypeScript</strong></td>
  </tr>
</table>

## Archivos y preview en navegador

<table>
  <tr>
    <td><a href="14-project-explorer.jpg"><img src="14-project-explorer.jpg" alt="Explorar el repositorio actual" width="440"></a><br><strong>Explorar el repositorio actual</strong></td>
    <td><a href="15-file-search.jpg"><img src="15-file-search.jpg" alt="Buscar text-area.ts por nombre" width="440"></a><br><strong>Buscar text-area.ts por nombre</strong></td>
  </tr>
  <tr>
    <td><a href="06-webserver.jpg"><img src="06-webserver.jpg" alt="WebServer de proyecto en ejecución" width="440"></a><br><strong>WebServer de proyecto en ejecución</strong></td>
    <td><a href="07-browser-preview.jpg"><img src="07-browser-preview.jpg" alt="HTML, CSS, JavaScript y SVG en el navegador" width="440"></a><br><strong>HTML, CSS, JavaScript y SVG en el navegador</strong></td>
  </tr>
</table>

## Promptings reutilizables

<table>
  <tr>
    <td><a href="11-prompting-library.jpg"><img src="11-prompting-library.jpg" alt="Biblioteca de promptings reutilizables" width="440"></a><br><strong>Biblioteca de promptings reutilizables</strong></td>
    <td><a href="12-prompting-variables.jpg"><img src="12-prompting-variables.jpg" alt="Completar una metavariable de prompting" width="440"></a><br><strong>Completar una metavariable de prompting</strong></td>
  </tr>
  <tr>
    <td><a href="13-prompting-editor.jpg"><img src="13-prompting-editor.jpg" alt="Editar una plantilla con {{variables}}" width="440"></a><br><strong>Editar una plantilla con {{variables}}</strong></td>
  </tr>
</table>

## Proyectos, modelos y extensiones

<table>
  <tr>
    <td><a href="29-project-configuration.jpg"><img src="29-project-configuration.jpg" alt="Configuración de proyecto · Nombre y Carpeta" width="440"></a><br><strong>Configuración de proyecto · Nombre y Carpeta</strong></td>
    <td><a href="09-provider-presets.jpg"><img src="09-provider-presets.jpg" alt="Presets de proveedores llama.cpp y DeepSeek" width="440"></a><br><strong>Presets de proveedores llama.cpp y DeepSeek</strong></td>
  </tr>
  <tr>
    <td><a href="30-model-configuration.jpg"><img src="30-model-configuration.jpg" alt="Configuración de modelo · ID, nombre y host" width="440"></a><br><strong>Configuración de modelo · ID, nombre y host</strong></td>
    <td><a href="22-tools-menu.jpg"><img src="22-tools-menu.jpg" alt="Menú Tools · WebServer, tools nativas, MCP y skills" width="440"></a><br><strong>Menú Tools · WebServer, tools nativas, MCP y skills</strong></td>
  </tr>
  <tr>
    <td><a href="23-native-tools.jpg"><img src="23-native-tools.jpg" alt="Tools nativas de archivos, HTTP y shell" width="440"></a><br><strong>Tools nativas de archivos, HTTP y shell</strong></td>
    <td><a href="24-native-web-tools.jpg"><img src="24-native-web-tools.jpg" alt="Skills internas, Markdown, WebSocket y scraping" width="440"></a><br><strong>Skills internas, Markdown, WebSocket y scraping</strong></td>
  </tr>
  <tr>
    <td><a href="25-mcp-stdio-configuration.jpg"><img src="25-mcp-stdio-configuration.jpg" alt="Formulario de configuración MCP stdio" width="440"></a><br><strong>Formulario de configuración MCP stdio</strong></td>
    <td><a href="26-skills-search.jpg"><img src="26-skills-search.jpg" alt="Formulario de búsqueda · https://skills.sh" width="440"></a><br><strong>Formulario de búsqueda · https://skills.sh</strong></td>
  </tr>
  <tr>
    <td><a href="27-skills-search-results.jpg"><img src="27-skills-search-results.jpg" alt="Resultados reales de skills.sh" width="440"></a><br><strong>Resultados reales de skills.sh</strong></td>
    <td><a href="28-skill-registration.jpg"><img src="28-skill-registration.jpg" alt="Registrar una ruta real a SKILL.md" width="440"></a><br><strong>Registrar una ruta real a SKILL.md</strong></td>
  </tr>
</table>

## Seis paletas de colores

<table>
  <tr>
    <td><a href="16-qbasic-typescript.jpg"><img src="16-qbasic-typescript.jpg" alt="QBasic · TypeScript, números de línea y pestañas P:/F:" width="440"></a><br><strong>QBasic · TypeScript, números de línea y pestañas P:/F:</strong></td>
    <td><a href="17-graphite-typescript.jpg"><img src="17-graphite-typescript.jpg" alt="Graphite · TypeScript" width="440"></a><br><strong>Graphite · TypeScript</strong></td>
  </tr>
  <tr>
    <td><a href="18-forest-typescript.jpg"><img src="18-forest-typescript.jpg" alt="Forest · TypeScript" width="440"></a><br><strong>Forest · TypeScript</strong></td>
    <td><a href="19-nord-typescript.jpg"><img src="19-nord-typescript.jpg" alt="Nord · TypeScript" width="440"></a><br><strong>Nord · TypeScript</strong></td>
  </tr>
  <tr>
    <td><a href="20-dracula-typescript.jpg"><img src="20-dracula-typescript.jpg" alt="Dracula · TypeScript" width="440"></a><br><strong>Dracula · TypeScript</strong></td>
    <td><a href="21-gruvbox-typescript.jpg"><img src="21-gruvbox-typescript.jpg" alt="Gruvbox · TypeScript" width="440"></a><br><strong>Gruvbox · TypeScript</strong></td>
  </tr>
</table>

## Español e inglés

<table>
  <tr>
    <td><a href="31-language-selection.jpg"><img src="31-language-selection.jpg" alt="Selector de idioma español/inglés" width="440"></a><br><strong>Selector de idioma español/inglés</strong></td>
    <td><a href="32-spanish-gruvbox.jpg"><img src="32-spanish-gruvbox.jpg" alt="UI en español · Gruvbox" width="440"></a><br><strong>UI en español · Gruvbox</strong></td>
  </tr>
  <tr>
    <td><a href="33-about-spanish.jpg"><img src="33-about-spanish.jpg" alt="About · Español · Gruvbox" width="440"></a><br><strong>About · Español · Gruvbox</strong></td>
    <td><a href="34-theme-selector-spanish.jpg"><img src="34-theme-selector-spanish.jpg" alt="Seis paletas · Selector en español" width="440"></a><br><strong>Seis paletas · Selector en español</strong></td>
  </tr>
  <tr>
    <td><a href="35-keyboard-help-spanish.jpg"><img src="35-keyboard-help-spanish.jpg" alt="Ayuda de teclado · Español · QBasic" width="440"></a><br><strong>Ayuda de teclado · Español · QBasic</strong></td>
  </tr>
</table>

## Capturas anteriores conservadas

Los archivos 01–05 conservan las capturas originales de números de línea;
06–07 conservan una ejecución anterior de WebServer/navegador. Estos JPEG son
idénticos byte por byte a los originales. Las carpetas de imágenes duplicadas
y los informes internos de QA están archivados localmente fuera de Git. Las
imágenes anteriores pueden mostrar una presentación previa de menús o pestañas.

<table>
  <tr>
    <td><a href="01-qbasic-chat.jpg"><img src="01-qbasic-chat.jpg" alt="Chat con modelo local · QBasic" width="440"></a><br><strong>Chat con modelo local · QBasic</strong></td>
    <td><a href="02-file-explorer.jpg"><img src="02-file-explorer.jpg" alt="Explorador de archivos · Captura original" width="440"></a><br><strong>Explorador de archivos · Captura original</strong></td>
  </tr>
  <tr>
    <td><a href="03-typescript-file.jpg"><img src="03-typescript-file.jpg" alt="TypeScript numerado · Captura original" width="440"></a><br><strong>TypeScript numerado · Captura original</strong></td>
    <td><a href="04-color-themes.jpg"><img src="04-color-themes.jpg" alt="Selector de paleta · Captura original" width="440"></a><br><strong>Selector de paleta · Captura original</strong></td>
  </tr>
  <tr>
    <td><a href="05-about-nord.jpg"><img src="05-about-nord.jpg" alt="About · Inglés · Nord" width="440"></a><br><strong>About · Inglés · Nord</strong></td>
  </tr>
</table>

## Detalles de captura

- Dimensiones JPEG del viewport: 1680×841 en capturas nuevas; las anteriores conservan sus dimensiones.
- Emulador: xterm.js 6.0.0 con fit addon 0.11.0, DejaVu Sans Mono 16 px, alto de línea 1.1.
- Las interacciones de teclado/mouse usan los menús, formularios y explorador de la TUI en ejecución.
- Las seis paletas y ambos idiomas se seleccionaron desde la TUI.
- El agente cerró normalmente con código 0 y se detuvo el servidor temporal de capturas.
- [manifest.json](manifest.json) registra dimensiones, bytes, SHA-256 y lote de origen de cada archivo.

La captura no incluyó builds de binarios, benchmarks nuevos ni validación de runtime Windows/macOS.
