# S42 Agent

**A coding agent with the soul of QBasic.**

Built with TypeScript and Bun. A terminal workspace with windows, mouse support,
project tabs and local LLMs — under the [MIT license](LICENSE).

[Español](README.es.md) · [User guide](docs/USAGE.es.md) ·
[Tools](docs/TOOLS.md) · [Contributing](CONTRIBUTING.md)

<img src="assets/screenshots/2026-10-01/03-typescript-file.jpg" alt="S42 Agent running: project and file tabs, numbered TypeScript source, syntax colors and a permanent prompt" width="960">

*Real `index.ts` execution in a Bun PTY, displayed by xterm.js in Chrome.
[Screenshot gallery and capture details](assets/screenshots/2026-10-01/README.md).*

## Why S42 Agent?

A familiar desktop made of terminal cells: classic menus, titled windows,
keyboard navigation and a prompt that stays visible while the agent works.
Choose your model, open a project and keep its conversation, files and tools
together.

- **QBasic-style TUI:** mouse, draggable auxiliary windows, menus and Vim-inspired shortcuts.
- **Multiple projects:** independent sessions, drafts and models; background activity in each tab.
- **Files at hand:** browse any folder, search filenames/globs, attach files and read HTML/CSS/JS/TS with syntax colors and line numbers. Chats also have a numbered margin.
- **Local first:** llama.cpp is the default; DeepSeek and other Chat Completions-compatible providers are configurable.
- **12 native tools:** files, content search, HTTP, commands, Markdown, WebSocket and rendered-page scraping.
- **MCP and skills:** manage servers, enable/disable them, load internal or external skills and search skills.sh.
- **Reusable prompts:** a library with `{{variables}}` and a form to fill their values.
- **Your workspace:** Spanish/English, six themes, visible tool activity, token usage and average tok/s.
- **Persistence:** OS-specific global configuration and history in native SQLite; API keys in the OS keychain.
- **Headless CLI:** the same agent loop without the TUI.

The harness has **no external runtime package dependencies**. Your LLM server,
models and programs invoked by shell/MCP are separate.

## Start from source

Requires **Bun 1.4.2**. Use an ANSI terminal, at least **60×16** cells
(80×24 or larger recommended).

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

The UI starts in Spanish. **Vista → Language → English** switches its language.

1. Add a project from **Projects** using **Name + Folder**.
2. Open **Models → Providers** (Spanish: **Proveedores**). Configure llama.cpp,
   DeepSeek or your compatible endpoint, discover its models and select one.
3. Write in **Prompt**. **Enter** sends; **Shift+Enter** adds a line.
4. Follow the response and tool calls in the project's read-only chat.
   **Ctrl+C** cancels its active turn.

Configuration, selected models and history survive restarts and are shared
across launch directories. Each project tab retains its own session and model.

### Use a local model

Start your llama.cpp server separately, with a GGUF you already have:

```bash
llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080 --alias local-coder --jinja
```

Choose `local-coder` in Models. Tool calling requires support in the model and
its chat template. S42 Agent discovers llama.cpp capabilities through `/props`.
See the [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

### Run without the UI

```bash
bun run index.ts \
  --cwd /path/to/project \
  --llm_server http://127.0.0.1 \
  --llm_port 8080 \
  --prompting "Build a single-file HTML Tetris game with sound" \
  --reasoning off
```

Use `--model id` to select a specific model and `--llm_apikey` for a per-run
credential override. Answers stream to stdout; tools, errors, session ID and
usage go to stderr. `--reasoning` controls visibility of provider-emitted
reasoning, not how the model reasons. Run `bun run index.ts --help` for flags.

## Tools and extensions

| Capability | Native tools |
| --- | --- |
| Read, write, edit and list files | `read`, `write`, `edit`, `list` |
| Find files and search contents | `find`, `search` |
| HTTP and system commands | `fetch`, `shell` |
| Internal instructions and Markdown → HTML | `internal_skill`, `markdown_html` |
| WebSocket and rendered-page scraping | `websocket`, `scrape` |

These tools use Bun's APIs, including Bun Shell, Markdown, WebSocket and WebView.
The agent follows project AGENTS.md instructions. Tools run with your user's
permissions and have real filesystem/network/process effects; there is no sandbox.

**Tools → MCP** manages stdio/HTTP tool servers. **Tools → Skills** manages skills
and searches [skills.sh](https://skills.sh). Included internal guides cover
software project structure, debugging/verification and PDF workflows.
Scraping needs an installed browser on Linux/Windows; PDF generation needs an
installed renderer. MCP implements tools; resources/prompts, OAuth, sampling and
elicitation are not implemented.

## Keyboard, language and themes

| Action | Shortcut |
| --- | --- |
| Send / new line | Enter / Shift+Enter |
| Cancel current project / exit | Ctrl+C / Ctrl+Q |
| File explorer / project selector | Ctrl+E / Ctrl+P |
| Previous / next tab | Alt+← / Alt+→ |
| Close tab or auxiliary window | Ctrl+W |
| Promptings / MCP / skills | Alt+T / Alt+C / Alt+S |
| Change panel / focus | Ctrl+N / Tab |

Vim starts in INSERT; Esc enters NORMAL. Function keys F1–F12 are unassigned.
If your terminal cannot distinguish Shift+Enter, use Ctrl+J.

**View** (Spanish: **Vista**) switches Spanish/English and the six palettes:
**QBasic, Graphite, Forest, Nord, Dracula and Gruvbox**. It also controls reasoning
visibility and CPU/RAM/disk/VRAM indicators. Input/output tokens and average tok/s
remain visible; unavailable provider or device counters show N/A.

## Recorded benchmark

The [v0.1.0 Linux x64 benchmark](docs/qa/benchmark-s42-agent-0.1.0-linux-x64.json)
records:

| Measurement | Result |
| --- | --- |
| Startup p95 | 24.43 ms |
| Input p95 | 35.95 ms |
| SSE delta to frame p95 | 4.07 ms |
| Idle RSS | 46.64 MiB |
| Resume 1,000 session messages | 42.07 ms |

Historical binary measurement: hot OS cache, received PTY bytes, no graphical
emulator painting and no LLM inference. These figures are not a fresh benchmark
of the current source. See [methodology](docs/qa/final-validation.md).

## Status and development

**v0.1.0 is a source preview.** Linux x64 has local source, PTY and real-model
validation. Cross-builds were produced for Windows, macOS and Linux arm64;
runtime validation on those targets and physical terminal mouse/drop coverage
remain pending. No new downloadable binaries are included in this launch.

```bash
bun run typecheck
bun test
bun run index.ts --demo   # Component laboratory, without project persistence.
```

An optional `bun run build` creates a host binary. The compiled harness includes
Bun; the LLM and external commands remain separate.

- [Detailed user guide · Español](docs/USAGE.es.md)
- [Tool contracts](docs/TOOLS.md) and [agent design](docs/AGENT-INTELLIGENCE.md)
- [Latest coding/SQLite QA](docs/qa/reliable-coding-and-sqlite.md)
- [Publication validation](docs/qa/publication-readiness.md)
- [Development phases](docs/phases/README.md) and [changelog](CHANGELOG.md)
- [Release notes](docs/releases/v0.1.0.md) and [launch materials](docs/launch/ANNOUNCEMENTS.md)

## Credits

Created by [César Casas](https://www.linkedin.com/in/cesarcasas/) · Stock42.
**Building with Codex & GPT-6.1 Sol.**

Inspired by QBasic's terminal experience and [Pi](https://github.com/earendil-works/pi)
as an architectural reference. S42 Agent is an independent project.

Contributions and reproducible bug reports are welcome.
See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
