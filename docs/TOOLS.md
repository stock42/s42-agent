# S42 Agent native tools

**English** · [Español](TOOLS.es.md) · [User guide](USAGE.md)

Current contract, 2026-10-03. One module per tool in `src/agent/tools/`.
`index.ts` registers schemas/handlers; `shared.ts` holds only types, validation,
traversal and common instructions. `src/agent/tools.ts` reexports the contract
for existing integrations. The catalog is visible in **Tools → Native tools**.

| Tool / module | Arguments | Result |
| --- | --- | --- |
| `read` / read.ts | `path`; `offset=1`, optional `limit` | Complete numbered UTF-8. offset/limit select a requested line range; without limit it reads to the end. |
| `write` / write.ts | `path`, `content`; `append=false` | Creates parents and creates/replaces text with Bun.write; append=true appends the fragment using Bun's included fs implementation. Returns the written path. |
| `edit` / edit.ts | `path`, `oldText`, `newText` | One unique literal replacement in the complete file. Zero/multiple matches or empty oldText: error without writing. |
| `list` / list.ts | `path="."`; optional `glob` | All entries, with `/` for folders. A glob traverses files. |
| `find` / find.ts | `pattern`; `path="."`, optional `limit`, `includeIgnored=false` | All matches by name or Bun glob, absolute paths and counts. limit only selects an explicitly requested count, with no added ceiling. |
| `search` / search.ts | `pattern`; `path="."`, `glob="**/*"` | Case-sensitive literal content in a file or recursively in a directory; pattern is not a regex. All `file:line:text` matches or an explicit no-match result; skips binary/invalid UTF-8. glob filters the file name when path is a file. |
| `fetch` / fetch.ts | `url`; `method="GET"`, `headers`, `body`, `bodyType="json"` | HTTP/S through native fetch; final URL, status/statusText, headers and complete text body, with no harness timeout. |
| `shell` / shell.ts | `command` | Bun Shell ($) in its own Bun subprocess with project cwd. Streams stdout/stderr to the project's chat; returns complete output, exitCode and cancelled at exit. Waits for completion or cancellation, without a timeout. |
| `internal_skill` / internal_skill.ts | Optional `name` | Without a name, the internal catalog; with a name, software-project/debug-and-verify/create-pdf instructions. No script execution. |
| `markdown_html` / markdown_html.ts | Exactly one of `markdown` or `path`; optional `outputPath`, `standalone=false`, `title="S42 Agent"` | Bun.markdown.html on complete input. Saves HTML or returns it in full as JSON. |
| `websocket` / websocket.ts | `url`; optional `headers`, `protocols`, `messages`; `receiveCount=1` | ws/wss, one connection per call. Receives the requested count without an added ceiling, with complete text/base64 binary. Waits for replies, remote closure or cancellation. |
| `scrape` / scrape.ts | `url`; `selector="body"`, `format="text"` or `"html"` | Bun.WebView: final URL, title, complete first matching CSS element and all its links, without clipping text/hrefs. Waits for the selector or cancellation. |
| `session_history` / session_history.ts | Optional: `query`, `role`, `offset=1`, `limit` | Original messages from the turn's session, including compacted history. Case-insensitive literal search over the full JSON, user/assistant/tool role filter and matching messages starting at offset. Returns complete messages and original 1-based indexes; without limit returns all matches. |
| `task_plan` / task_plan.ts | `objective`, `steps`; `mode="execution"` or `"planning"` | Persists UUID task/request/verification IDs in TODO.md. Each step has title, criterion, verification; optional id, description and dependency IDs. Each verification has kind (command/review/browser), description, required, paths, and command for a command check. Planning mode does not authorize execution. |
| `task_update` / task_update.ts | `id`; optional status (pending/doing/done), result, blocked, acceptanceEvidence | Updates the active request's card. Done requires existing successful evidence IDs and current required checks; a blocker leaves it open. Cannot manufacture human approval. |
| `task_verify` / task_verify.ts | `taskId`, `verificationId`; optional `evidence` call/run IDs for review | Runs the previously planned command through the shared runner or records review of existing results. Stores real exit/output/cancellation and file fingerprints; retains failed runs. Does not complete the card. |

Execution in TUI/CLI requires task_plan before native write/edit, arbitrary shell,
saved Markdown, HTTP mutations or WebSocket sends. Read tools do not create a
card per call. Before finalizing, the loop returns concrete incomplete tasks,
checks or required project closeout to the model. A blocked task stays open;
CLI returns **2** for a blocked task, **0** for completion or guidance/planning.
Task data/events survive JSONL/SQLite reopen and context compaction. TODO.md
remains the content source; its unknown text is preserved and external card
collisions are explicit. Native file edits retain before/after snapshots; shell
or external changes have unknown attribution. Git closeout actions and the
visual board are added in the following implementation stages.

Tools receive a JSON object; unknown names/fields, invalid types and nonpositive
integers return errors. Relative paths use the turn's project; absolute paths
can point outside it. The global cwd does not change.
`list/search/find` initially skip `.git`, `node_modules`, `dist`, `out`; find accepts
`includeIgnored: true`. Incremental search does not follow links; inaccessible
or disappeared subfolders are skipped, and find reports their count.
The explorer uses the same search with includeIgnored=true, without a result ceiling.

Everything runs in Bun: Bun.file/write, Bun.Glob.match, fetch, FormData,
URLSearchParams, AbortController, streams and Bun.spawn. `node:fs/promises`/path
are implementations included in Bun for directories/paths, as described in the
[file documentation](https://bun.sh/docs/runtime/file-io). There are no runtime
package dependencies or external find/rg/curl processes. Shell uses Bun's
interpreter; invoked external programs must be installed.
`src/system/command.ts` retains tree cancellation and complete stdout/stderr
capture, without timeouts or clipping. Internal argv is escaped; the tool's
command text is a Shell program. Bun Shell supports pipes/redirects/builtins but
not all Bash/cmd syntax: redirect stderr with `1>&2`; background `&` is unsupported.
For external-shell syntax, invoke that shell explicitly if installed.
Verification scripts must close timers, sockets and other handles after their
checks; browser-code mocks must stub or clean up animation/audio timers. Printing
a result does not complete a command while its process remains alive. The TUI
shows the received output immediately; Ctrl+C cancels and retains partial output.

The harness imposes no step, time, file-size, attachment-count or payload quotas.
Ctrl+C cancels work. Argument/format validation and actual provider, operating
system or runtime errors remain.

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
{"url":"https://example.com/profile","method":"PUT","bodyType":"form","body":{"name":"César","city":"Buenos Aires"}}
```

Changing bodyType to multipart sends those fields as multipart/form-data.
This version supports text fields; no file-upload contract was added. Response
bodies are returned as text, even when the server returns JSON; the model can
interpret that text. Downloaded binaries are not automatically written to disk.
The body is retained in full and the JSON envelope stays parseable.
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
returns html/bytes/truncated with the complete HTML and truncated=false. Saved
HTML is also complete. It adds no CSS, assets or sanitization and does not create a PDF.
`create-pdf` explains how to use the HTML and installed Chrome/Chromium or another
renderer through shell, with output checks and visual-review limits.

## WebSocket

Uses [Bun's native client](https://bun.sh/docs/runtime/http/websockets).
Headers are a string/string map; protocols/messages are string arrays. Sending
JSON means sending serialized text. There is no host allowlist; ws/wss uses the
process's network and permissions, as fetch does.

```json
{"url":"ws://127.0.0.1:3000/echo","headers":{"Authorization":"Bearer example"},"protocols":["v1"],"messages":["{\"event\":\"ping\"}"],"receiveCount":1}
```

Result: url, opened, selected subprotocol protocol, sent count, received and
reason. Each message contains type (text/binary), data (text/base64), original
bytes and truncated. Remote closure returns closeCode/closeReason/wasClean.
reason=received means success on reaching receiveCount. closed before that count,
cancelled or error are failed and preserve partial results.
Completion/cancellation/failure removes listeners and terminates the socket;
no connection remains for future calls. A remote close code is not reported when
the client finishes by receiving the expected count. Payloads are retained in
full without a byte quota.

## Execution and events

`execute(name, argumentsJSON, cwd, signal)` returns
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

For website summaries, the agent should use `scrape`; `fetch` handles APIs, HTTP
responses, status and headers. The prompt and tool descriptions direct the model
to use these tools instead of `curl`/`wget`, except for an evidenced need or an
explicit request. Shell remains available; this is model guidance, not command
blocking.

Saving or converting an answer reuses its content and sources. Building HTML from
a CSV requires reading that CSV. If compaction omitted details, the agent can
recover them with `session_history`, for example
`{"query":"infobae.com","role":"tool"}`, before requesting the website again.
The tool receives only the original history of the turn's session, preceding the
current call group; it does not open other sessions or change history.
Regression coverage: [session history and follow-up conversions](../tests/session-history.test.ts).

`fetch` returns the HTTP response; `scrape` loads the DOM with JavaScript through
[Bun.WebView](https://bun.com/docs/runtime/webview). HTTP(S) only, text or HTML;
the selector is data, without executing JavaScript supplied as an argument.
Selecting an element that appears after load allows waiting for dynamic content.
It does not guarantee network idle or that the whole site has finished.
Navigation resolves on load; HTTP errors with an error page are extracted as
DOM (use fetch for status/headers). Cancellation closes the view, including
that tab's requests. Each call uses an ephemeral view; the shared browser remains
until entrypoint exit and closes in its finally.

System WebKit on macOS; installed Chrome, Chromium, Edge or Brave on Linux/Windows.
`BUN_CHROME_PATH` may point to the executable. Chrome starts headless with url:false,
without using the personal profile or downloading browsers. Experimental API
in Bun 1.4.2; Linux runtime verified, macOS/Windows pending.

```json
{"url":"https://example.com","selector":"main","format":"text"}
```
