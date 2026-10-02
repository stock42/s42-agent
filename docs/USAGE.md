# S42 Agent user guide

**English** · [Español](USAGE.es.md) · [Project overview](../README.md)

A small, fast and stable coding agent written in **TypeScript/Bun**, with mouse
support, colors and no external runtime package dependencies. The conversation
is read-only and the prompt stays visible. Each project has its own tab and can
keep working while you use another one.

## Getting started

Running the source requires **Bun 1.4.2**. The TUI needs an ANSI terminal of at
least **60×16** cells; 80×24 is recommended. Configure your LLM server separately.
See [installation](../README.md#installation) for compiled binaries and
[Bun setup](../README.md#run-from-source) for the source environment.

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

The UI starts in Spanish. **Vista → Language → English** switches it to English.

1. Register a project in **Projects → Add project**: just **Name** and **Folder**.
   **Browse** lets you choose the folder with the mouse or keyboard.
2. Open **Models → Providers** and choose **llama.cpp** or **DeepSeek**. Complete
   its settings, query the catalog and select a model.
3. Write in **Prompt**. **Enter** sends; **Shift+Enter** inserts a line.
4. Responses, received reasoning and tool calls/results appear in the project's
   chat. **Ctrl+C** cancels its turn.

```bash
bun run index.ts --cwd /path/to/project
bun run index.ts --project name
bun run index.ts --config /path/to/agent.sqlite
bun run index.ts --help
```

## Command line without the TUI

`--prompting` enables the CLI with the same loop, project instructions, native
tools, MCP, skills and staged recovery as the TUI. It works without an interactive
terminal and lets you redirect results to compare runs.

```bash
bun run index.ts \
  --cwd /path/to/project \
  --llm_server http://127.0.0.1 \
  --llm_port 8080 \
  --prompting "Build a Tetris game in a single HTML file" \
  --reasoning off \
  > response.md 2> execution.log
```

| Argument | Behavior |
| --- | --- |
| `--prompting "text"` | Runs one turn and exits; accepts multiline text. |
| `--llm_server host_or_url` | HTTP/HTTPS host or base URL. A host without a path uses `/v1`; a URL with a path keeps it. |
| `--llm_port port` | Overrides the port; integer from 1 to 65535. |
| `--llm_apikey "key"` | Bearer credential for this run, kept in memory; optional for unauthenticated llama.cpp. |
| `--model id` | Explicit ID. llama.cpp queries `/props` for actual context/tool capabilities; manually edited models keep their settings. Without output metadata, the server decides; token capacities are not guessed. |
| `--reasoning on\|off` | Shows/hides received reasoning on stderr. Defaults to the configuration preference; does not change how the model reasons. |
| `--cwd folder` / `--project name_or_id` | Working folder or registered project; without either, uses the current folder. |
| `--provider id`, `--config file` | Select an existing provider and configuration. |
| `--session id` | Continues a session for that folder/project; creates a new one by default. |

Arguments also accept `--option=value`. Without `--model`, the agent uses the
session/project selection or the first registered/available model in `/models`.
Discovered models enable tools; the server must support tool calling.
Changing the endpoint through flags queries its catalog and uses the explicit
key while preserving saved configuration. An explicit model ID does not require
`/models`. Without overrides, the agent uses llama.cpp or the configured provider
and its existing keychain/environment credential. Changing the endpoint also
discards the previous secret reference; `--llm_apikey` remains an in-memory override.

**stdout** receives the streamed response. **stderr** receives reasoning when
enabled, tool execution/results, warnings, session location and I/O tokens with
average tok/s. Events, partial responses and reasoning are saved in the usual
sessions. The CLI does not change configuration, the project registry, TUI tabs
or drafts; an unregistered folder uses a stable ID. To reopen a run with a
temporary endpoint, repeat its flags.

Exit codes: **0** completed, **1** error, **130** cancelled with Ctrl+C (SIGINT),
**143** SIGTERM. Cancellation releases the session and preserves completed
effects. Without `--prompting`, the usual TUI startup remains active.

## Menus

| Menu | Contents |
| --- | --- |
| File | File explorer, attachments and exit. |
| Projects | Open/add/edit/remove projects, sessions and tabs. |
| Models | Providers, catalog, model selection/settings and defaults. |
| Promptings | Library, new template and save current prompt. |
| Tools | Project WebServer, native catalog, MCP management/activation, Skills and skills.sh search. |
| View | Responses/prompt, CPU/RAM/disk/VRAM indicators, focus, auxiliary windows, palettes, language, reasoning and Vim mode. |
| Help | Shortcuts, mouse, commands and About with author, MIT and version. |

The agent opens this workspace directly. Run the component laboratory separately
with `bun run index.ts --demo`.

## Projects and tabs

**Projects → Open project**, **Ctrl+P** or **+** in the tab bar opens another tab.
Choosing an already open project returns to its tab. There is one tab per project,
with independent conversation/session, draft, attachments, model, Vim mode and
reading position. The central editor displays the project name.

- Switch with a click, **Alt+←/→** or **Alt+1…9**. Tab-bar arrows and the wheel
  let you reach tabs that do not fit in the terminal.
- `P:name` identifies projects and `F:file` identifies files. Each active project
  animates its `| / - \` indicator even while you view another project or file.
  You can send a prompt in another project; each turn retains its own model,
  folder and session in the background.
- The project title animates during its turn, even before the first text arrives.
  The chat shows “Agent: Reasoning…”, “Responding…” or the running tool in its
  own status row. Prompt keeps the draft, token counts and newline hint. Completion,
  cancellation or failure stops the animation; switching tabs shows that project's
  activity.
- **Ctrl+C** interrupts only the active project. If others are working, Ctrl+C
  from an idle tab does not close the program.
- **×**, **Ctrl+W** or **Projects → Close tab** saves the draft and releases its
  session. Cancel an active turn before closing that tab. Ctrl+W on a dialog or
  auxiliary window closes that window.
- **New session** and **Sessions** change the current tab's history. That project
  must be idle; other projects can keep responding.
- Project tabs and the active project are restored at startup. Closing all tabs
  leaves an empty workspace while preserving the registry, folders and histories.
- **Ctrl+Q** cancels all project turns, saves drafts and exits.

## Providers and models

| Preset provider | Initial endpoint | Credential |
| --- | --- | --- |
| llama.cpp — default | `http://127.0.0.1:8080/v1` | No key initially. |
| DeepSeek | `https://api.deepseek.com` | OS keychain or `DEEPSEEK_API_KEY`. |

**Models → Providers** lets you edit the host, port and credential. Saving a preset
queries `/models` and opens the catalog for model selection. Connection or
authentication errors stay in the form. The catalog is queried by that action;
there are no startup requests and model IDs are not invented.

**New provider** offers presets and **Other provider** for Chat Completions-compatible
endpoints. **API key · keychain** stores the key through
[Bun.secrets](https://bun.com/docs/runtime/secrets) in the OS credential store;
**API key variable** keeps the environment alternative. Keys are masked; when
editing, **Saved · blank keeps it** means an empty field reuses the saved key.
Configuration stores only its reference; sessions do not store keys.
On Linux, GNOME Keyring, KWallet or another Secret Service must be available and
unlocked; the form reports failures. No `.env.local` files are created.

**Configure model** accepts ID/name, endpoint/port, credential
and `Tools / images` capabilities (`yes/no`, `no/no` or `yes/yes`). Enable
tools only when the model and chat template support them. Configured values
survive catalog rediscovery. DeepSeek uses the
[official models API](https://api-docs.deepseek.com/api/list-models/).

Selecting a model automatically remembers it in the session, project and global
default for new projects. Each tab retains its selection. An older configuration
with a single registered local model recovers it without network access; several
models without a valid selection leave the selector open. History containing
images requires a model that accepts them or a new session. Without a selected
model, the chat reports this and preserves the draft.

### llama.cpp server

The agent does not download models or start the server. For an available GGUF:

```bash
llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080 --alias local-coder --jinja
```

Choose `local-coder` in the catalog and configure your server's limits. Tool
calling requires a compatible template; consult the
[official llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

## Promptings with metavariables

**Promptings → Library**, **Alt+T** or `/promptings` opens template management.
Each prompting has a name and multiline text; **Save current prompt** uses the
draft as its initial text. The library is global and available to all projects.

```text
Review {{file}} in {{language}}.
Use this context:
{{context}}
Include {{file}} in the summary.
```

Choose **Load in editor** to review or **Run with current model** to send. The
TUI asks once for each distinct variable name, in order of appearance.
**Previous/Next** retain answers; **Enter** advances/applies, **Shift+Enter**
inserts a line and **Esc** cancels without changing the draft.

Names use ASCII letters, numbers and `_`, starting with a letter or `_`;
`{{ file }}` is also accepted. Values can be empty, Unicode or multiline.
Substitution is literal and single-pass: `$&` and `{{other}}` inside a value
are preserved. Templates retain their metavariables; resolved text goes into
the usual draft/history. In the editor, Enter in Name moves to Text and Enter
in Text saves.

## Files, chat and tools

**File → File explorer** or **Ctrl+E** lets you navigate to parents, roots and typed
paths, including outside the project. Enter/double-click opens folders or files
in a **tab beside the project**, using the entire central panel. Its title is
the filename; the header shows language, size and path. The project's Prompt
stays visible. HTML, CSS, JavaScript and TypeScript have syntax highlighting,
including CSS/JS inside HTML. Other text has no syntax colors; binary files show
a notice.

The view loads complete UTF-8 text in read-only mode, with selection, scrolling,
arrows, wheel and Vim navigation. Reopening a file returns to its tab and preserves
scroll. Click, **Alt+←/→** and **Alt+1…9** navigate projects and files; **Ctrl+W**
or **×** closes the file and returns to chat without closing the project.
**View → Responses** also returns to chat. Sending a prompt returns the panel to
chat; a background response does not replace the file you are reading. Opening
or attaching external files does not change the tools' cwd. File tabs last for
this run; project tabs are restored after restart.

Chat and files include line numbers in a separate gutter. They refer to original
lines: a long line wrapping across rows does not repeat its number. The gutter
adapts to scrolling and content size without changing file text or messages sent
to the model. Prompt has no line numbers.

The explorer uses the available chat area, adapts to resize and keeps the prompt
visible. Type a search path at the top (a disk root is allowed), a name or glob
such as `*.ts` below, then select **Search** or press Enter in that field. It scans
subfolders, including hidden and dependency folders, and returns all matching
files with locations. **Cancel** stops the search. Open and Attach work on results;
**Go** resumes navigation. Searches do not follow links and report inaccessible
folder counts.

Pasting or dragging paths prepares attachments. **Ctrl+F** or `/attach path`
lets you review, add or remove them. Without bracketed paste, the first Enter
recognizes existing paths and attaches them; the next sends. Code blocks remain
text. Complete UTF-8 text and PNG/JPEG/WebP images are supported when the model
accepts images. The agent imposes no attachment size/count quotas. If an attachment
changes, review its updated version before sending again. History retains what
was sent.

Native tools are **read/write/edit/list/find/search/fetch/shell**, with one file
per tool in `src/agent/tools/` and a catalog in **Tools → Native tools · catalog**. The catalog
also includes `internal_skill`, `markdown_html` and `websocket`: on-demand internal
guides, Markdown→HTML conversion and ws/wss tests with headers, messages
and cancellation.
`find` searches names/globs; `search` searches content. `fetch` supports HTTP
methods, headers and JSON, URL-encoded form, multipart or text bodies. Edit
requires one unique exact match; shell returns stdout/stderr, duration and exit
code. Commands use [Bun Shell](https://bun.com/docs/runtime/shell), including Git
for skill installation and nvidia-smi for metrics. Pipes, redirects and builtins
do not require external Bash/cmd; syntax follows Bun (for example `1>&2`, without
background commands using `&`). Tree cancellation remains active, without timeouts.

**scrape** uses [Bun.WebView](https://bun.com/docs/runtime/webview) for rendered
pages, including JavaScript, CSS selectors, text/HTML and links. macOS uses system
WebKit; Linux/Windows need installed Chrome, Chromium, Edge or Brave. It also
accepts `BUN_CHROME_PATH`. There are no automatic downloads; the browser starts
when the tool is used and closes on exit. [Contract](TOOLS.md).
Project and subfolder AGENTS instructions are read. Tools have the user's
permissions and real effects; there is no sandbox. Cancellation does not undo
changes or automatically rerun interrupted tools when reopening.
[Contracts and examples for each tool](TOOLS.md).

**Prompt** always shows **input/output tokens (I/O) and average tok/s** at the top
right, for example `Tokens I/O 1200/120 · Avg. 28.5 tok/s` (`Prom.` in Spanish).
There is no Send button: **Enter sends**, Shift+Enter inserts a line and Ctrl+C
cancels. The draft uses the full width below the counters. Per-turn/tab tokens
include all requests, tools and continuations and are saved at completion.
Counters update when the provider reports usage: llama.cpp sends per-token timings
and the average changes during generation from the first token. Other endpoints
depend on their usage-report frequency. Characters and SSE deltas are not counted
as tokens. Incomplete count → partial; missing data → **N/A**. Large quantities
are abbreviated (`k`, `M`, etc.); sessions retain exact figures. Tok/s is the
observed average: reported output divided by time spent on requests with reported
output, including network/first-token time and excluding tools.

The bottom bar shows **CPU: % · RAM: used/total · Disk: used/total · VRAM: used/total**,
in GiB/MiB (`G`/`M`). It uses as many rows as needed without covering Prompt.
**View → CPU/RAM/Disk/VRAM: on/off** configures each indicator and saves
`ui.resources`. Tokens stay visible even when all resources are hidden; there
is no option to hide them. CPU/RAM/disk use Bun's included APIs with samples
every 2 seconds. Disk refers to the project's volume. VRAM uses Linux DRM counters
or installed `nvidia-smi` through Bun Shell. If the OS/driver does not report
VRAM, the UI shows N/A; it does not install drivers or programs. Integrated GPUs
may not have a dedicated-memory counter.

Chat shows reasoning when the provider emits `reasoning_content` or `reasoning`
and **View → Show reasoning** is **on** (default). **off** hides it in history
and during streaming; turning it back **on** reveals the received content. Sessions
retain it and tools stay visible. Chat displays partial tool-call arguments,
execution and results, and executes only complete calls. Selection, scrolling
and reading remain available.

If the model reaches its output limit, the agent preserves the partial response
and asks it to split the request into smaller stages. Each stage appears in
chat; subsequent stages are requested while the model indicates pending work.
Session and model are preserved; completed tools are not automatically
rerun and truncated calls are discarded. **Ctrl+C** cancels the active stage.
Continuations and tools have no step ceilings or harness timeouts.
Actual HTTP errors and disconnections are reported without
retrying the turn.

### MCP

**Tools → MCP** or **Alt+C** lists, adds, edits, unregisters, enables/disables and
tests servers. Stdio settings: name, command, JSON args, optional cwd and environment
variable references. HTTP: name, URL and optional API-key variable. Enabled tools
load per turn; connections, calls, results and errors appear in the originating
project's chat.

MCP stdio requires the server command to be installed. Tools and protocol
negotiation are supported; sampling, elicitation, OAuth and resources/prompts
are not implemented.

### Skills

The agent includes `software-project`, `debug-and-verify` and `create-pdf` in
`src/agent/skills/`. The initial prompt presents only names/descriptions; the model
uses `internal_skill` to load a relevant guide. Loading does not execute scripts.
PDF combines Bun's native HTML with an installed renderer such as Chrome/Chromium;
Bun does not print PDFs by itself.

Internal guides coexist with configurable external skills:

**Tools → Skills** or **Alt+S** registers folders/SKILL.md globally or per project,
lets you read, enable/disable or unregister them. The model receives a short
catalog and loads the body through the skill tool. `/skill name request` explicitly
invokes its instructions.

**Search skills.sh** displays names, sources and install counts and installs from
GitHub for a project or globally. Search queries [https://skills.sh](https://skills.sh)
directly through its catalog API; an LLM does not invent results. Installation
requires Git and preserves folders, resources and licenses. npm/npx/Node are not
required. Installing or loading instructions does not execute scripts; unregistering
preserves files.

## Keyboard and appearance

| Action | Shortcut |
| --- | --- |
| Send / new line | Enter / Shift+Enter; Ctrl+J as an alternative. |
| Project / model / provider / session | Ctrl+P / Ctrl+O / Ctrl+B / Ctrl+R. |
| Previous/next tab / direct selection | Alt+←/→ / Alt+1…9. |
| Attachments / explorer | Ctrl+F / Ctrl+E. |
| Promptings / MCP / Skills | Alt+T / Alt+C / Alt+S. |
| Change panel / focus | Ctrl+N / Tab or Shift+Tab; also click. |
| Menu / help | Esc from NORMAL / Alt+Y. |
| Close tab or auxiliary window / exit | Ctrl+W / Ctrl+Q. |

Vim starts in **INSERT**. Esc switches to NORMAL; in Prompt: `h/j/k/l`, `w/b`,
`0/$`, `i/a/I/A`, `x`, `dd`, `u`. In chat: `j/k`, Ctrl+D/U and `gg/G` scroll.
Space followed by `p/m/s/e/f/c/k/t/?` opens project/model/session/explorer/
attachments/MCP/Skills/Promptings/help. Menus and dialogs take priority over Vim.
No actions are assigned to F1–F12.

**View → Color palette** changes the palette live and saves the selection:

| Palette | Appearance |
| --- | --- |
| Classic · QBasic | DOS blue and gray bars; default. |
| Dark · Graphite | Neutral grays, charcoal background, dark surfaces and silver selection. |
| Green · Forest | Deep green background, soft text and mint accents. |
| [Nord · Arctic](https://www.nordtheme.com/docs/colors-and-palettes/) | Slate blue, cool text and cyan accents. |
| [Dracula · Purple](https://draculatheme.com/contribute) | Blue graphite, light text and violet accents. |
| [Gruvbox · Warm retro](https://github.com/morhetz/gruvbox) | Warm grays, cream text and amber accents. |

Menus, dialogs, borders, focus and selection use colors by role; switching palettes
preserves tabs, draft and session. IDs `grayscale` and `green` keep working with
older configuration. The three newer palettes adapt their original colors to
the QBasic desktop.

Chat distinguishes **You** and **Agent** labels with their own colors: yellow and
cyan in QBasic, adapted shades in other palettes. The body keeps its reading
color; without color, labels remain bold.

**View → Toggle Vim** configures the mode. `NO_COLOR`, `--no-color`
and `--no-mouse` are respected; RGB uses `COLORTERM=truecolor`, with ANSI16 fallback
for other terminals. Rendering updates changed rows; metrics sample every 2 s
and only rows with changed content are emitted. The demo renders on demand
without resource sampling.

**View → Language** chooses **Español** or **English** live. It translates menus,
buttons, forms, help, states, indicators and harness titles; project names, files,
prompts and responses keep their content. The change applies to all tabs, even
during a turn. Preferences `ui.language` (`es`/`en`) and `ui.showReasoning` are
saved and restored at startup; older configuration defaults to Spanish with
reasoning on. In Spanish, the menu is **Vista** and the option is
**Ver razonamiento: on/off**.

**Help → About** presents the agent's QBasic spirit, coding tools, project tabs,
promptings, MCP, skills and model selection. It includes Bun portability to
Windows, Linux and macOS, authorship, MIT and
[César Casas' LinkedIn](https://www.linkedin.com/in/cesarcasas/). `Version` comes
from package.json, as does `--version`. Available in Spanish and English with
scrolling, keyboard/mouse closing and the fixed prompt visible.

Commands: `/help`, `/projects`, `/models`, `/providers`, `/sessions`, `/files`,
`/new`, `/promptings`, `/mcp`, `/skills`, `/skill name request`, `/attach path`,
`/detach`, `/quit`. Tab completes commands and `/attach` paths with a unique candidate.

## Configuration and persistence

Configuration and history use **Bun-native SQLite**, without a server or dependencies:

| OS | Global database |
| --- | --- |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/s42-agent/agent.sqlite` |
| macOS | `~/Library/Application Support/s42-agent/agent.sqlite` |
| Windows | `%APPDATA%/s42-agent/agent.sqlite` (fallback `~/AppData/Roaming`) |

First opening automatically imports previous `config.json` and JSONL sessions
(XDG_STATE_HOME on Linux, LOCALAPPDATA on Windows). It preserves originals, models,
keychain references, history and drafts. A running legacy instance or corruption
in a complete record reports a problem and prevents migration from committing;
you can correct it and retry.

`--config /path/to/agent.sqlite` selects another database; `.db` and `.sqlite3`
work too. `--config /path/to/config.json` keeps the older format with `sessions/`
beside the JSON. The project folder does not change global storage.

The database stores projects/providers/models, MCP/Skills/Promptings, defaults,
tabs, preferences and per-session events. WAL allows reading while other projects
save events; each session keeps its single-writer lock. Not every token is persisted:
the result of each request and turn is saved. API keys remain in **Bun.secrets**;
the database stores references only. `--provider`, `--model` and `--session`
allow explicit startup selections.

Optional bindings for known actions, with collisions rejected:

```json
"ui": {
  "vimMode": true,
  "color": "auto",
  "palette": "qbasic",
  "language": "es",
  "showReasoning": true,
  "resources": { "cpu": true, "ram": true, "disk": true, "gpu": true },
  "bindings": {
    "global": { "projects": "ctrl+g" },
    "normal": { "projects": "leader+g" }
  }
}
```

Actions: `projects`, `models`, `providers`, `sessions`, `attachments`, `explorer`,
`mcp`, `skills`, `promptings`, `help`. Editing/focus/lifecycle shortcuts remain
reserved. The agent imposes no step, stage, time, payload, file, attachment or
undo-history quotas. Legacy `limits` fields are removed when loading v1
configuration and cannot reactivate old cutoffs.
The provider validates context; requests are not rejected by a local estimate
and no fixed share of context is reserved for the response.
llama.cpp detects context/tools/vision through `/props` during discovery and
requests. It repairs older “no tools” catalogs when the server template supports
tools. llama.cpp determines its own output; the harness does not send `max_tokens`
for automatic local models. Remote providers refresh their automatic catalog
when a turn starts: the full advertised output maximum is used, with no extra
harness ceiling. Without output metadata, or if discovery fails, `max_tokens`
is omitted and the provider decides; guessed ceilings from older catalogs are
not reused. Startup does not query the network.
Reasoning-only partials remain in the session and are sent with empty text so
DeepSeek can accept the next request. Provider HTTP errors include the returned
error detail. Editing a model in Models fixes the chosen capabilities and leaves
output to the provider. The form does not offer token quotas; manual maxima from
older configurations are not sent. `write` supports
`append: true` to build files in parts; the agent prompt instructs it to complete
functionality on disk before finishing.

Bun inherits the environment and may load existing files; `--cwd` sets the tools'
folder without changing the process's global directory. To use only exported
variables: `bun run --no-env-file index.ts`.

## Development and distribution

```bash
bun run typecheck
bun test
bun run build             # Optional: compiles the host binary to dist/s42-agent.
```

The binary contains Bun's runtime; the LLM server/model and programs invoked by
shell/MCP remain external. `build:targets` generates other targets, but cross-building
does not prove they run at the destination. TUI and tabs have source validation
on Linux with PTY and fixtures. There is prior real GLM evidence; physical
mouse/drop and macOS/Windows/arm64 runtime validation remain pending.

[CHANGELOG](../CHANGELOG.md) records completed changes. Tests and distribution
smoke remain versioned. Local reports and task-specific QA scripts are archived
in `private/`; distribution results are generated in `dist/`. Both directories
are ignored by Git.

To contribute: [CONTRIBUTING.md](../CONTRIBUTING.md). Release preparation:
[PUBLISHING.md](PUBLISHING.md). License: [MIT](../LICENSE).

## WebServer for project previews

1. Activate the project tab or one of its files to preview.
2. Open **Tools → WebServer** (`Alt+O` opens Tools).
3. Enter a port from 1 to 65535 (initial: 3000) and press Enter or **Start**.
4. The default browser opens `http://127.0.0.1:PORT/` or the active file's URL
   inside the project. The document root is always the registered project folder.

Bun serves HTML/CSS/JS and images directly with their MIME types. A folder uses
`index.html` when available; otherwise it shows a linked directory listing.
You can navigate to other files within that root. Refresh to see saved changes:
responses are not cached. It does not transpile, execute backends or replace a
framework's development server.

**Apply** changes the port and reopens the preview. If the port is occupied,
the error appears and the previous server stays active. **Stop** releases the
port; **Open browser** shows the preview again without restarting. If opening
the browser fails, the server remains available and the dialog retains the URL.
The port is retained while the server is active; reopening the agent does not
automatically start it.

Each project can have a server on a different port. Switching tabs or closing
the dialog does not stop it; closing the project tab, changing its folder or
exiting the agent does. Closing only a file tab preserves the project's server.
Without an active project, the Name/Folder form opens.
