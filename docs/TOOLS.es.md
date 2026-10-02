# Tools nativas de S42 Agent

[English](TOOLS.md) · **Español** · [Manual de uso](USAGE.es.md)

Contrato vigente, 2026-10-02. Un módulo por herramienta en `src/agent/tools/`.
`index.ts` registra sus schemas/handlers; `shared.ts` conserva únicamente tipos,
validación, recorrido e instrucciones comunes. `src/agent/tools.ts` reexporta
el contrato para integraciones existentes. Catálogo visible en **Tools → Nativas**.

| Tool / módulo | Argumentos | Resultado |
| --- | --- | --- |
| `read` / read.ts | `path`; `offset=1`, `limit` opcional | Texto UTF-8 completo numerado. offset/limit seleccionan un rango pedido; sin limit lee hasta el final. |
| `write` / write.ts | `path`, `content`; `append=false` | Crea padres y crea/reemplaza texto mediante Bun.write; append=true agrega el fragmento al final con fs incluido en Bun. Devuelve ruta escrita. |
| `edit` / edit.ts | `path`, `oldText`, `newText` | Reemplazo literal único en el archivo completo. Cero/múltiples coincidencias o oldText vacío: error sin escribir. |
| `list` / list.ts | `path="."`; `glob` opcional | Todas las entradas; `/` para carpetas. Un glob recorre los archivos. |
| `find` / find.ts | `pattern`; `path="."`, `limit` opcional, `includeIgnored=false` | Todas las coincidencias por nombre o glob Bun, con rutas absolutas y conteos. limit solo selecciona la cantidad pedida explícitamente, sin techo agregado. |
| `search` / search.ts | `pattern`; `path="."`, `glob="**/*"` | Contenido literal sensible a mayúsculas en un archivo o recursivamente en una carpeta; pattern no es regex. Todas las coincidencias `archivo:línea:texto` o resultado explícito sin coincidencias; omite binarios/UTF-8 inválido. glob filtra el nombre cuando path es un archivo. |
| `fetch` / fetch.ts | `url`; `method="GET"`, `headers`, `body`, `bodyType="json"` | HTTP/S con fetch nativo; URL final, status/statusText, headers y body texto completo, sin timeout del harness. |
| `shell` / shell.ts | `command` | Bun Shell ($) en subproceso Bun propio con cwd del proyecto. Muestra stdout/stderr en vivo en el chat del proyecto; devuelve salida completa, exitCode y cancelled al salir. Espera finalización o cancelación, sin timeout. |
| `internal_skill` / internal_skill.ts | `name` opcional | Sin nombre, catálogo de internas; con nombre, instrucciones software-project/debug-and-verify/create-pdf. Sin ejecución de scripts. |
| `markdown_html` / markdown_html.ts | Exactamente uno: `markdown` o `path`; `outputPath`, `standalone=false`, `title="S42 Agent"` opcionales | Bun.markdown.html sobre el input completo. Guarda el HTML o lo devuelve íntegro como JSON. |
| `websocket` / websocket.ts | `url`; `headers`, `protocols`, `messages` opcionales; `receiveCount=1` | ws/wss, una conexión por call. Recibe la cantidad pedida sin techo agregado, con textos/binarios base64 completos. Espera respuestas, cierre remoto o cancelación. |
| `scrape` / scrape.ts | `url`; `selector="body"`, `format="text"` o `"html"` | Bun.WebView: URL final, título, contenido completo del primer elemento CSS y todos sus enlaces, sin recortar textos/hrefs. Espera el selector o cancelación. |

Las tools reciben un objeto JSON; nombres/campos desconocidos, tipos inválidos
y enteros no positivos devuelven error. Rutas relativas usan el proyecto del
turno; rutas absolutas pueden apuntar fuera de él. No cambia el cwd global.
`list/search/find` omiten `.git`, `node_modules`, `dist`, `out` inicialmente;
find admite `includeIgnored: true`. Búsqueda incremental sin seguir enlaces;
subcarpetas inaccesibles/desaparecidas se omiten, y find reporta su cantidad.
El explorador usa la misma búsqueda con includeIgnored=true, sin tope de resultados.

Todo corre dentro de Bun: Bun.file/write, Bun.Glob.match, fetch, FormData,
URLSearchParams, AbortController, streams y Bun.spawn. `node:fs/promises`/path
son implementaciones incluidas en Bun para directorios/paths, según la
[documentación de archivos](https://bun.sh/docs/runtime/file-io). No hay
dependencias de runtime ni procesos externos find/rg/curl. Shell usa el intérprete de Bun; los programas externos invocados deben estar
instalados. `src/system/command.ts` conserva cancelación del árbol y captura
completa de stdout/stderr, sin timeout ni recortes.
Argv internos se escapan; el texto command de la tool es un programa Shell.
Bun Shell admite pipes/redirecciones/builtins, pero no toda la sintaxis Bash/cmd:
redirigir stderr con `1>&2`; background `&` no está soportado. Para sintaxis de
un shell externo, invocarlo explícitamente si está instalado.
Los verificadores deben cerrar timers, sockets y otros recursos al terminar sus
comprobaciones; los mocks de código de navegador deben reemplazar o limpiar los
timers de animación/audio. Imprimir un resultado no finaliza un comando cuyo
proceso sigue vivo. La TUI muestra la salida recibida inmediatamente; Ctrl+C
cancela y conserva la salida parcial.

El harness no impone cuotas de pasos, tiempo, tamaño de archivo, cantidad de
adjuntos o payloads. Ctrl+C cancela el trabajo. Se conservan validación de
argumentos/formatos y los errores reales del proveedor, sistema operativo o runtime.

## HTTP

GET por defecto; POST, PUT, PATCH, DELETE, HEAD, OPTIONS y métodos que fetch
admita. GET/HEAD con body devuelve error. Headers es un mapa string → string.
No hay lista de hosts permitidos: cualquier URL HTTP/S, incluyendo localhost,
usa los permisos/red del proceso. Se siguen redirects de fetch. HTTP no-2xx
conserva status/body y marca failed; no se reintenta ni oculta el error.

| bodyType | body | Content-Type |
| --- | --- | --- |
| `json` (default) | Cualquier valor JSON | application/json si el caller no lo indicó. |
| `form` | Objeto con campos string | URLSearchParams: application/x-www-form-urlencoded, salvo header explícito. |
| `multipart` | Objeto con campos string | FormData genera boundary; se ignora Content-Type manual para evitar un boundary inválido. |
| `text` | String | Texto, con Content-Type opcional del caller. |

JSON POST:

```json
{"url":"http://127.0.0.1:3000/items","method":"POST","headers":{"X-Request-ID":"demo"},"body":{"name":"demo","active":true}}
```

Formulario PUT:

```json
{"url":"https://example.com/profile","method":"PUT","bodyType":"form","body":{"name":"César","city":"Buenos Aires"}}
```

Cambiar bodyType a multipart envía esos campos como multipart/form-data. Esta
versión admite campos de texto; no se añadió un contrato de upload de archivos.
Body de respuesta se devuelve como texto, incluso si el servidor devuelve JSON;
el modelo puede interpretar ese texto. Binarios descargados no se escriben
automáticamente a disco. El body se conserva completo y el JSON queda parseable.
[Contrato oficial de fetch/headers/forms](https://bun.sh/docs/runtime/networking/fetch).

## Skills internas y Markdown

Las internas residen en `src/agent/skills/*/SKILL.md`, incluidas por imports de
texto. `internal_skill` no requiere config ni carpeta externa. El modelo ve
nombres/descripciones en el system prompt, y carga el cuerpo bajo demanda.
`skill` sigue reservada para skills externas habilitadas; `/skill` invoca las
externas registradas.

```json
{"name":"software-project"}
```

`markdown_html` convierte con [Bun.markdown.html](https://bun.sh/docs/runtime/markdown).
Por defecto devuelve un fragmento; standalone=true agrega doctype, meta UTF-8,
viewport y título escapado. Tablas/code/headings usan el renderer de Bun.

```json
{"markdown":"# Informe\n\n**Generado con Bun**","outputPath":"docs/informe.html","standalone":true,"title":"Informe"}
```

Alternativa: `{"path":"docs/informe.md","outputPath":"docs/informe.html"}`.
Guardar crea padres y reemplaza el destino; devuelve path/bytes y AGENTS.md
aplicable al destino. Sin outputPath devuelve html/bytes/truncated con el HTML
completo y truncated=false; al guardar también conserva el documento íntegro.
No agrega CSS, assets ni sanitización; no crea un PDF. `create-pdf` enseña a
usar ese HTML y un Chrome/Chromium u otro renderizador ya instalado mediante
shell, con comprobación de salida y límites de revisión visual.

## WebSocket

Utiliza el [cliente nativo de Bun](https://bun.sh/docs/runtime/http/websockets).
Headers es un mapa string/string; protocols/messages son arrays de strings.
Enviar JSON consiste en un mensaje de texto serializado. No hay allowlist de
hosts; ws/wss usa la red y permisos del proceso, como fetch.

```json
{"url":"ws://127.0.0.1:3000/echo","headers":{"Authorization":"Bearer ejemplo"},"protocols":["v1"],"messages":["{\"event\":\"ping\"}"],"receiveCount":1}
```

Resultado: url, opened, subprotocolo elegido protocol, cantidad sent, received y
reason. Cada mensaje incluye type (text/binary), data (texto/base64), bytes
originales y truncated. En cierre remoto devuelve closeCode/closeReason/wasClean.
reason=received es éxito al alcanzar receiveCount. closed antes de alcanzar la
cantidad, cancelled o error son failed; conservan el parcial.
Al completar/cancelar/fallar se retiran listeners y se termina el socket;
no queda una conexión disponible para futuras calls. No se reporta un código
de cierre remoto cuando el cliente finaliza por recibir la cantidad esperada.
Los payloads se conservan completos, sin cuota de bytes.

## Ejecución y eventos

`execute(name, argumentsJSON, cwd, signal)` devuelve
`{output, failed, durationMs, exitCode?, truncated?}`. Archivo/texto añade las
instrucciones AGENTS aplicables como antes; HTTP y shell mantienen salida
estructurada parseable, al igual que Markdown/WebSocket. internal_skill carga
el cuerpo como Markdown legible y lista el catálogo como JSON. El loop persiste
call/start/result y lo muestra en chat.
Las llamadas de un turno son secuenciales; los proyectos pueden ejecutar turnos
distintos. Cancelar detiene búsqueda/HTTP y el árbol de shell, impide nuevas
llamadas y conserva efectos ya realizados. No hay sandbox ni undo implícito.

Pruebas: [native-tools](../tests/native-tools.test.ts),
[internal-tools](../tests/internal-tools.test.ts) y [agent](../tests/agent.test.ts).

## Scraping renderizado

`fetch` devuelve la respuesta HTTP; `scrape` carga el DOM con JavaScript en
[Bun.WebView](https://bun.com/docs/runtime/webview). Solo HTTP(S), formato texto
o HTML; selector como dato, sin ejecutar JavaScript provisto como argumento.
Seleccionar un elemento que aparece después de la carga permite esperar contenido
dinámico. No garantiza network idle ni que todo el sitio haya finalizado.
Navegación resuelve en load; errores HTTP con una página de error se extraen como
DOM (para status/headers usar fetch). La cancelación cierra la vista, incluidos
los requests de esa pestaña. Cada call usa una vista efímera; el browser compartido
permanece hasta salir del entrypoint y se cierra en su finally.

WebKit del SO en macOS; Chrome, Chromium, Edge o Brave instalado en Linux/Windows.
`BUN_CHROME_PATH` puede apuntar al ejecutable. Chrome inicia headless con url:false,
sin conectarse al perfil personal ni descargar navegadores. API experimental en
Bun 1.4.2; runtime Linux comprobado, macOS/Windows pendientes.

```json
{"url":"https://example.com","selector":"main","format":"text"}
```
