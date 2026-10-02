# S42 Agent native tools

**English** · [Español](TOOLS.es.md) · [User guide](USAGE.md)

Current contract, 2026-10-01. One module per tool in `src/agent/tools/`.
`index.ts` registers schemas/handlers; `shared.ts` holds only types, validation,
traversal and common instructions. `src/agent/tools.ts` reexports the contract
for existing integrations. The catalog is visible in **Tools → Native tools**.

| Tool / module | Arguments | Result / limits |
| --- | --- | --- |
| `read` / read.ts | `path`; `offset=1`, `limit=200` | Numbered UTF-8; 1-based line offset within the first MiB. Reads up to 1 MiB; output up to 64 KiB with a truncation notice. |
| `write` / write.ts | `path`, `content`; `append=false` | Creates parents and creates/replaces text with Bun.write; append=true appends the fragment using Bun's included fs implementation. Returns the written path. |
| `edit` / edit.ts | `path`, `oldText`, `newText` | One unique literal replacement, up to 1 MiB. Zero/multiple matches or empty oldText: error without writing. |
| `list` / list.ts | `path="."`; optional `glob` | One level with `/` for folders; a glob traverses files. Up to 200 entries. |
| `find` / find.ts | `pattern`; `path="."`, `limit=200`, `includeIgnored=false` | Case-insensitive names or Bun glob. Absolute paths, counts and truncation. Maximum limit 1,000. |
| `search` / search.ts | `pattern`; `path="."`, `glob="**/*"` | Case-sensitive literal content. `file:line:text`; up to 100 matches, first MiB per file. Skips binary/invalid UTF-8. |
| `fetch` / fetch.ts | `url`; `method="GET"`, `headers`, `body`, `bodyType="json"`, `timeoutMs=30000` | HTTP/S through native fetch; JSON with final URL, status/statusText, headers, text body and truncated. Body up to 64 KiB. |
| `shell` / shell.ts | `command`; `timeoutMs=limits.shellTimeoutMs` (initially 120 s) | Bun Shell ($) in its own Bun subprocess with project cwd; stdout/stderr, exitCode, timedOut/cancelled/truncated. Drains both streams, retains up to 64 KiB per stream and truncates each output to 30,000 bytes. |
| `internal_skill` / internal_skill.ts | Optional `name` | Without a name, the internal catalog; with a name, software-project/debug-and-verify/create-pdf instructions. No script execution. |
| `markdown_html` / markdown_html.ts | Exactly one of `markdown` or `path`; optional `outputPath`, `standalone=false`, `title="S42 Agent"` | Bun.markdown.html; UTF-8 input up to 1 MiB. Complete HTML file or JSON with preview up to 64 KiB and truncated. |
| `websocket` / websocket.ts | `url`; optional `headers`, `protocols`, `messages`; `receiveCount=1` (maximum 100), `timeoutMs=10000` | ws/wss, one connection per call. Sends text, receives text/base64 binary, disconnects. JSON with partial results; maximum 64 KiB of received payload. |
| `scrape` / scrape.ts | `url`; `selector="body"`, `format="text"` or `"html"`, `timeoutMs=30000` | Bun.WebView: final URL, title, first matching CSS element's content and up to 25 links (text 100/href 500 characters), linkCount and truncated. Content up to 30,000 bytes; waits for the selector to exist. |

Tools receive a JSON object; unknown names/fields, invalid types and nonpositive
integers return errors. Relative paths use the turn's project; absolute paths
can point outside it. The global cwd does not change.
`list/search/find` initially skip `.git`, `node_modules`, `dist`, `out`; find accepts
`includeIgnored: true`. Incremental search does not follow links; inaccessible
or disappeared subfolders are skipped, and find reports their count.
The explorer uses the same search with includeIgnored=true and a 1,000 limit.

Everything runs in Bun: Bun.file/write, Bun.Glob.match, fetch, FormData,
URLSearchParams, AbortController, streams and Bun.spawn. `node:fs/promises`/path
are implementations included in Bun for directories/paths, as described in the
[file documentation](https://bun.sh/docs/runtime/file-io). There are no runtime
package dependencies or external find/rg/curl processes. Shell uses Bun's
interpreter; invoked external programs must be installed.
`src/system/command.ts` retains timeout, tree cancellation and bounded capture
in the parent; Bun Shell maintains its own buffer during execution. Very large
output can consume memory in that process. Internal argv is escaped; the tool's
command text is a Shell program. Bun Shell supports pipes/redirects/builtins but
not all Bash/cmd syntax: redirect stderr with `1>&2`; background `&` is unsupported.
For external-shell syntax, invoke that shell explicitly if installed.

## HTTP

GET by default; POST, PUT, PATCH, DELETE, HEAD, OPTIONS and methods accepted by
fetch. GET/HEAD with a body returns an error. Headers are a string → string map.
There is no host allowlist: any HTTP/S URL, including localhost, uses the process's
network and permissions. Fetch redirects are followed. Non-2xx HTTP preserves
status/body and marks failed; errors are not retried or hidden.

| bodyType | body | Content-Type |
| --- | --- | --- |
| `json` (default) | Any JSON value | application/json unless the caller specifies it. |
| `form` | Object with string fields | URLSearchParams: application/x-www-form-urlencoded unless an explicit header overrides it. |
| `multipart` | Object with string fields | FormData generates the boundary; manual Content-Type is ignored to avoid an invalid boundary. |
| `text` | String | Text, with optional caller-provided Content-Type. |

JSON POST:

```json
{"url":"http://127.0.0.1:3000/items","method":"POST","headers":{"X-Request-ID":"demo"},"body":{"name":"demo","active":true}}
```

Form PUT:

```json
{"url":"https://example.com/profile","method":"PUT","bodyType":"form","body":{"name":"César","city":"Buenos Aires"},"timeoutMs":5000}
```

Changing bodyType to multipart sends those fields as multipart/form-data.
This version supports text fields; no file-upload contract was added. Response
bodies are returned as text, even when the server returns JSON; the model can
interpret that text. Downloaded binaries are not automatically written to disk.
The JSON envelope can exceed 64 KiB through escaping and headers: the fetch limit
applies to the retained body without breaking JSON.
[Official fetch/headers/forms contract](https://bun.sh/docs/runtime/networking/fetch).

## Internal skills and Markdown

Internal skills live in `src/agent/skills/*/SKILL.md`, bundled through text imports.
`internal_skill` needs no configuration or external folder. The model sees
names/descriptions in the system prompt and loads bodies on demand. `skill`
remains reserved for enabled external skills; `/skill` invokes registered ones.

```json
{"name":"software-project"}
```

`markdown_html` converts with [Bun.markdown.html](https://bun.sh/docs/runtime/markdown).
It returns a fragment by default; standalone=true adds doctype, UTF-8 meta,
viewport and an escaped title. Tables/code/headings use Bun's renderer.

```json
{"markdown":"# Report\n\n**Generated with Bun**","outputPath":"docs/report.html","standalone":true,"title":"Report"}
```

Alternative: `{"path":"docs/report.md","outputPath":"docs/report.html"}`.
Saving creates parents and replaces the destination; returns path/bytes and
AGENTS.md instructions applicable to that destination. Without outputPath it
returns html/bytes/truncated; a truncated preview is not a complete document.
The byte limit preserves valid UTF-8 and parseable JSON. Saved HTML is not
truncated. It adds no CSS, assets or sanitization and does not create a PDF.
`create-pdf` explains how to use the HTML and installed Chrome/Chromium or another
renderer through shell, with output checks and visual-review limits.

## WebSocket

Uses [Bun's native client](https://bun.sh/docs/runtime/http/websockets).
Headers are a string/string map; protocols/messages are string arrays. Sending
JSON means sending serialized text. There is no host allowlist; ws/wss uses the
process's network and permissions, as fetch does.

```json
{"url":"ws://127.0.0.1:3000/echo","headers":{"Authorization":"Bearer example"},"protocols":["v1"],"messages":["{\"event\":\"ping\"}"],"receiveCount":1,"timeoutMs":5000}
```

Result: url, opened, selected subprotocol protocol, sent count, received and
reason. Each message contains type (text/binary), data (text/base64), original
bytes and truncated. Remote closure returns closeCode/closeReason/wasClean.
reason=received means success on reaching receiveCount. closed before that count,
timeout, cancelled, error or limit are failed and preserve partial results.
Completion/cancellation/failure removes timers/listeners and terminates the socket;
no connection remains for future calls. A remote close code is not reported when
the client finishes by receiving the expected count. The 64 KiB limit applies
to retained payload before JSON escaping or base64; it does not limit the frame
length already received by the WebSocket API.

## Execution and events

`execute(name, argumentsJSON, cwd, signal, shellTimeoutMs)` returns
`{output, failed, durationMs, exitCode?, truncated?}`. File/text output adds
applicable AGENTS instructions as before; HTTP and shell keep structured,
parseable output, as do Markdown/WebSocket. internal_skill loads its body as
readable Markdown and lists its catalog as JSON. The loop persists call/start/result
and displays them in chat.
Calls within a turn are sequential; projects can run separate turns. Cancellation
stops search/HTTP and the shell tree, prevents new calls and preserves completed
effects. There is no sandbox or implicit undo.

Tests: [native-tools](../tests/native-tools.test.ts),
[internal-tools](../tests/internal-tools.test.ts) and [agent](../tests/agent.test.ts).

## Rendered scraping

`fetch` returns the HTTP response; `scrape` loads the DOM with JavaScript through
[Bun.WebView](https://bun.com/docs/runtime/webview). HTTP(S) only, text or HTML;
the selector is data, without executing JavaScript supplied as an argument.
Selecting an element that appears after load allows waiting for dynamic content.
It does not guarantee network idle or that the whole site has finished.
Navigation resolves on load; HTTP errors with an error page are extracted as
DOM (use fetch for status/headers). Timeout and signal close the view, including
that tab's requests. Each call uses an ephemeral view; the shared browser remains
until entrypoint exit and closes in its finally.

System WebKit on macOS; installed Chrome, Chromium, Edge or Brave on Linux/Windows.
`BUN_CHROME_PATH` may point to the executable. Chrome starts headless with url:false,
without using the personal profile or downloading browsers. Experimental API
in Bun 1.4.2; Linux runtime verified, macOS/Windows pending.

```json
{"url":"https://example.com","selector":"main","format":"text","timeoutMs":30000}
```
