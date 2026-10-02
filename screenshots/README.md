# S42 Agent — real screenshot gallery

**35 original screenshots: 28 new captures and 7 preserved from earlier QA.**
Click a thumbnail to open the full-size JPEG. [English README](../README.md) ·
[README en español](../README.es.md) · [Capture manifest](manifest.json).

These are real executions of the root `index.ts`, not UI mockups. Bun.Terminal
runs the agent in a PTY; xterm.js displays its original ANSI output in Chrome.
The browser viewport images are saved unchanged: no generated pixels, overlays,
retouching or cropping. They are terminal-emulator captures, not native desktop
window screenshots.

New captures 08–35 use source commit `494b9f34293448594ef02be3ef1c649db75423a5`,
Bun 1.4.2 and a temporary SQLite configuration on Linux x64. The “Web Playground”
project and three prompting templates are sample input data for this tour,
not preinstalled projects or templates. Personal configuration and credentials
were not used.

Screenshots 08 and 10 show **GLM-4.7-Flash on local llama.cpp**, with a real `read`
call and completed answer. Token counts and tok/s belong to that one run;
these screenshots are not a benchmark or evidence of a completed coding task.
Screenshot 27 shows the actual skills.sh results for `pdf`; no skill was installed.
MCP and skill registration images show real configuration forms, not a connected
MCP server or an installed external skill.

## The workspace and agent

<table>
  <tr>
    <td><a href="08-live-agent-activity.jpg"><img src="08-live-agent-activity.jpg" alt="Live agent activity in the project tab and chat" width="440"></a><br><strong>Live agent activity in the project tab and chat</strong></td>
    <td><a href="10-live-tool-chat.jpg"><img src="10-live-tool-chat.jpg" alt="Real read tool call, response and token metrics" width="440"></a><br><strong>Real read tool call, response and token metrics</strong></td>
  </tr>
  <tr>
    <td><a href="16-qbasic-typescript.jpg"><img src="16-qbasic-typescript.jpg" alt="QBasic · TypeScript, line numbers and P:/F: tabs" width="440"></a><br><strong>QBasic · TypeScript, line numbers and P:/F: tabs</strong></td>
    <td><a href="20-dracula-typescript.jpg"><img src="20-dracula-typescript.jpg" alt="Dracula · TypeScript" width="440"></a><br><strong>Dracula · TypeScript</strong></td>
  </tr>
</table>

## Files and browser preview

<table>
  <tr>
    <td><a href="14-project-explorer.jpg"><img src="14-project-explorer.jpg" alt="Browse the current repository" width="440"></a><br><strong>Browse the current repository</strong></td>
    <td><a href="15-file-search.jpg"><img src="15-file-search.jpg" alt="Find text-area.ts by filename" width="440"></a><br><strong>Find text-area.ts by filename</strong></td>
  </tr>
  <tr>
    <td><a href="06-webserver.jpg"><img src="06-webserver.jpg" alt="WebServer running for a project" width="440"></a><br><strong>WebServer running for a project</strong></td>
    <td><a href="07-browser-preview.jpg"><img src="07-browser-preview.jpg" alt="HTML, CSS, JavaScript and SVG in the browser" width="440"></a><br><strong>HTML, CSS, JavaScript and SVG in the browser</strong></td>
  </tr>
</table>

## Reusable promptings

<table>
  <tr>
    <td><a href="11-prompting-library.jpg"><img src="11-prompting-library.jpg" alt="Reusable prompting library" width="440"></a><br><strong>Reusable prompting library</strong></td>
    <td><a href="12-prompting-variables.jpg"><img src="12-prompting-variables.jpg" alt="Fill a prompting metavariable" width="440"></a><br><strong>Fill a prompting metavariable</strong></td>
  </tr>
  <tr>
    <td><a href="13-prompting-editor.jpg"><img src="13-prompting-editor.jpg" alt="Edit a template with {{variables}}" width="440"></a><br><strong>Edit a template with {{variables}}</strong></td>
  </tr>
</table>

## Projects, models and extensions

<table>
  <tr>
    <td><a href="29-project-configuration.jpg"><img src="29-project-configuration.jpg" alt="Project configuration · Name and Folder" width="440"></a><br><strong>Project configuration · Name and Folder</strong></td>
    <td><a href="09-provider-presets.jpg"><img src="09-provider-presets.jpg" alt="llama.cpp and DeepSeek provider presets" width="440"></a><br><strong>llama.cpp and DeepSeek provider presets</strong></td>
  </tr>
  <tr>
    <td><a href="30-model-configuration.jpg"><img src="30-model-configuration.jpg" alt="Model configuration · ID, name and host" width="440"></a><br><strong>Model configuration · ID, name and host</strong></td>
    <td><a href="22-tools-menu.jpg"><img src="22-tools-menu.jpg" alt="Tools menu · WebServer, native tools, MCP and skills" width="440"></a><br><strong>Tools menu · WebServer, native tools, MCP and skills</strong></td>
  </tr>
  <tr>
    <td><a href="23-native-tools.jpg"><img src="23-native-tools.jpg" alt="Native file, HTTP and shell tools" width="440"></a><br><strong>Native file, HTTP and shell tools</strong></td>
    <td><a href="24-native-web-tools.jpg"><img src="24-native-web-tools.jpg" alt="Internal skills, Markdown, WebSocket and scraping" width="440"></a><br><strong>Internal skills, Markdown, WebSocket and scraping</strong></td>
  </tr>
  <tr>
    <td><a href="25-mcp-stdio-configuration.jpg"><img src="25-mcp-stdio-configuration.jpg" alt="MCP stdio configuration form" width="440"></a><br><strong>MCP stdio configuration form</strong></td>
    <td><a href="26-skills-search.jpg"><img src="26-skills-search.jpg" alt="Search form · https://skills.sh" width="440"></a><br><strong>Search form · https://skills.sh</strong></td>
  </tr>
  <tr>
    <td><a href="27-skills-search-results.jpg"><img src="27-skills-search-results.jpg" alt="Live results from skills.sh" width="440"></a><br><strong>Live results from skills.sh</strong></td>
    <td><a href="28-skill-registration.jpg"><img src="28-skill-registration.jpg" alt="Register a real SKILL.md path" width="440"></a><br><strong>Register a real SKILL.md path</strong></td>
  </tr>
</table>

## Six color themes

<table>
  <tr>
    <td><a href="16-qbasic-typescript.jpg"><img src="16-qbasic-typescript.jpg" alt="QBasic · TypeScript, line numbers and P:/F: tabs" width="440"></a><br><strong>QBasic · TypeScript, line numbers and P:/F: tabs</strong></td>
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

## English and Spanish

<table>
  <tr>
    <td><a href="31-language-selection.jpg"><img src="31-language-selection.jpg" alt="English and Spanish language selector" width="440"></a><br><strong>English and Spanish language selector</strong></td>
    <td><a href="32-spanish-gruvbox.jpg"><img src="32-spanish-gruvbox.jpg" alt="Spanish UI · Gruvbox" width="440"></a><br><strong>Spanish UI · Gruvbox</strong></td>
  </tr>
  <tr>
    <td><a href="33-about-spanish.jpg"><img src="33-about-spanish.jpg" alt="About · Spanish · Gruvbox" width="440"></a><br><strong>About · Spanish · Gruvbox</strong></td>
    <td><a href="34-theme-selector-spanish.jpg"><img src="34-theme-selector-spanish.jpg" alt="Six themes · Spanish selector" width="440"></a><br><strong>Six themes · Spanish selector</strong></td>
  </tr>
  <tr>
    <td><a href="35-keyboard-help-spanish.jpg"><img src="35-keyboard-help-spanish.jpg" alt="Keyboard help · Spanish · QBasic" width="440"></a><br><strong>Keyboard help · Spanish · QBasic</strong></td>
  </tr>
</table>

## Preserved earlier captures

Files 01–05 preserve the original line-number captures; files 06–07 preserve
an earlier WebServer/browser run. The JPEGs here remain byte-identical to those
captures. Duplicate image directories and internal QA reports are archived
locally outside Git. Older images may show an earlier menu or tab presentation.

<table>
  <tr>
    <td><a href="01-qbasic-chat.jpg"><img src="01-qbasic-chat.jpg" alt="Local-model chat · QBasic" width="440"></a><br><strong>Local-model chat · QBasic</strong></td>
    <td><a href="02-file-explorer.jpg"><img src="02-file-explorer.jpg" alt="File explorer · original capture" width="440"></a><br><strong>File explorer · original capture</strong></td>
  </tr>
  <tr>
    <td><a href="03-typescript-file.jpg"><img src="03-typescript-file.jpg" alt="Numbered TypeScript · original capture" width="440"></a><br><strong>Numbered TypeScript · original capture</strong></td>
    <td><a href="04-color-themes.jpg"><img src="04-color-themes.jpg" alt="Theme selector · original capture" width="440"></a><br><strong>Theme selector · original capture</strong></td>
  </tr>
  <tr>
    <td><a href="05-about-nord.jpg"><img src="05-about-nord.jpg" alt="About · English · Nord" width="440"></a><br><strong>About · English · Nord</strong></td>
  </tr>
</table>

## Capture details

- JPEG viewport sizes: 1680×841 for new captures; original images retain their dimensions.
- Emulator: xterm.js 6.0.0 with fit addon 0.11.0, DejaVu Sans Mono 16 px, line height 1.1.
- Keyboard and mouse interactions use the running TUI's menus, forms and file explorer.
- All six palettes and both UI languages were selected through the TUI.
- The agent closed normally with exit code 0; the temporary capture server was stopped.
- [manifest.json](manifest.json) records every file's dimensions, bytes, SHA-256 and source batch.

No binary builds, new benchmarks or Windows/macOS runtime validation were performed.
