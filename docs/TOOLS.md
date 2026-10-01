# Tools nativas de S42 Agent

Contrato vigente, 2026-10-01. Un módulo por herramienta en `src/agent/tools/`.
`index.ts` registra sus schemas/handlers; `shared.ts` conserva únicamente tipos,
validación, recorrido e instrucciones comunes. `src/agent/tools.ts` reexporta
el contrato para integraciones existentes. Catálogo visible en **Tools → Nativas**.

| Tool / módulo | Argumentos | Resultado / límites |
| --- | --- | --- |
| `read` / read.ts | `path`; `offset=1`, `limit=200` | UTF-8 numerado; offset en líneas desde 1 dentro del primer MiB. Lectura hasta 1 MiB y salida hasta 64 KiB con aviso de recorte. |
| `write` / write.ts | `path`, `content` | Crea padres y crea/reemplaza texto mediante Bun.write. Devuelve ruta escrita. |
| `edit` / edit.ts | `path`, `oldText`, `newText` | Reemplazo literal único, hasta 1 MiB. Cero/múltiples coincidencias o oldText vacío: error sin escribir. |
| `list` / list.ts | `path="."`; `glob` opcional | Un nivel con carpetas `/`; con glob recorre archivos. Hasta 200 entradas. |
| `find` / find.ts | `pattern`; `path="."`, `limit=200`, `includeIgnored=false` | Nombres sin distinguir mayúsculas o glob Bun. Rutas absolutas, conteos y recorte. Límite máximo 1.000. |
| `search` / search.ts | `pattern`; `path="."`, `glob="**/*"` | Contenido literal sensible a mayúsculas. `archivo:línea:texto`; hasta 100 coincidencias, primer MiB por archivo. Omite binarios/UTF-8 inválido. |
| `fetch` / fetch.ts | `url`; `method="GET"`, `headers`, `body`, `bodyType="json"`, `timeoutMs=30000` | HTTP/S con fetch nativo; JSON con URL final, status/statusText, headers, body texto y truncated. Body hasta 64 KiB. |
| `shell` / shell.ts | `command`; `timeoutMs=limits.shellTimeoutMs` (120 s inicial) | Bun.spawn con cwd del proyecto; stdout/stderr, exitCode, timedOut/cancelled/truncated. Drena ambos streams, conserva hasta 64 KiB por stream y recorta cada salida a 30.000 bytes. |

Las tools reciben un objeto JSON; nombres/campos desconocidos, tipos inválidos
y enteros no positivos devuelven error. Rutas relativas usan el proyecto del
turno; rutas absolutas pueden apuntar fuera de él. No cambia el cwd global.
`list/search/find` omiten `.git`, `node_modules`, `dist`, `out` inicialmente;
find admite `includeIgnored: true`. Búsqueda incremental sin seguir enlaces;
subcarpetas inaccesibles/desaparecidas se omiten, y find reporta su cantidad.
El explorador usa la misma búsqueda con includeIgnored=true y límite 1.000.

Todo corre dentro de Bun: Bun.file/write, Bun.Glob.match, fetch, FormData,
URLSearchParams, AbortController, streams y Bun.spawn. `node:fs/promises`/path
son implementaciones incluidas en Bun para directorios/paths, según la
[documentación de archivos](https://bun.sh/docs/runtime/file-io). No hay
dependencias de runtime ni procesos externos find/rg/curl. Shell requiere el
shell del SO y los programas que el comando del usuario invoque.

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
{"url":"https://example.com/profile","method":"PUT","bodyType":"form","body":{"name":"César","city":"Buenos Aires"},"timeoutMs":5000}
```

Cambiar bodyType a multipart envía esos campos como multipart/form-data. Esta
versión admite campos de texto; no se añadió un contrato de upload de archivos.
Body de respuesta se devuelve como texto, incluso si el servidor devuelve JSON;
el modelo puede interpretar ese texto. Binarios descargados no se escriben
automáticamente a disco. El sobre JSON puede superar 64 KiB por escaping y
headers: el límite de fetch corresponde al body retenido, sin romper el JSON.
[Contrato oficial de fetch/headers/forms](https://bun.sh/docs/runtime/networking/fetch).

## Ejecución y eventos

`execute(name, argumentsJSON, cwd, signal, shellTimeoutMs)` devuelve
`{output, failed, durationMs, exitCode?, truncated?}`. Archivo/texto añade las
instrucciones AGENTS aplicables como antes; HTTP y shell mantienen salida
estructurada parseable. El loop persiste call/start/result y lo muestra en chat.
Las llamadas de un turno son secuenciales; los proyectos pueden ejecutar turnos
distintos. Cancelar detiene búsqueda/HTTP y el árbol de shell, impide nuevas
llamadas y conserva efectos ya realizados. No hay sandbox ni undo implícito.

Pruebas: `tests/native-tools.test.ts`, `tests/agent.test.ts` y
[QA con GLM real y TUI](qa/native-tools.md).
