# Contributing to S42 Agent

**English** · [Español](CONTRIBUTING.es.md)

Keep the harness small, fast and stable: TypeScript/Bun, a QBasic-style TUI and
local-model support. Read [AGENTS.md](AGENTS.md) before changing code.

## Environment

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

Use Bun 1.4.2 and an ANSI terminal of at least 60×16 cells. For an isolated workspace:

```bash
bun run index.ts --config /tmp/s42-contribution/agent.sqlite --cwd /path/to/test-project
```

The source test suite does not require an LLM or API key. Browser integration
tests use an installed supported browser and skip that scenario if unavailable.

## Focused changes

1. Run `git pull` on your configured branch before starting. Preserve unrelated changes.
2. Use strict TypeScript and keep `index.ts` as the entrypoint.
   TUI components live in `src/ui/components/`; native tools in `src/agent/tools/`.
3. Run `bun run typecheck` and `bun test`.
   For TUI changes, exercise 80×24 and 60×16, keyboard/mouse, resize and no-color mode.
   Do not bind function keys F1–F12.
4. Use temporary config and project folders. Streams, tools and sessions must
   retain their originating project when tabs change.
5. Update both language versions of relevant documentation and CHANGELOG before committing.
6. Push the task's commit to the configured remote branch, without force-push.
7. Submit a PR describing the problem, resulting behavior and actual validation.

Use Bun's APIs where they fit. Avoid adding runtime dependencies without a concrete
need. Binary tests apply to distribution changes; they do not replace TUI review.

## Workflow checks

`tests/workflow-integration.test.ts` exercises explicit AGENTS.md application, Git initialization, a TUI request, actual Bun checks and Git closeout, the equivalent CLI request, recovery and a second project. Its provider is a protocol fixture; it does not validate a real model. Task/Git/browser suites cover conflicts, interrupted closeout, stale evidence and resource ownership.

Chrome DevTools MCP acceptance is opt-in and uses already installed external programs:

```bash
S42_CHROME_MCP_ENTRY=/absolute/path/to/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js \
S42_BROWSER_NODE=/absolute/path/to/node \
bun test tests/browser-real.test.ts
```

Without this variable the real-Chrome scenario is not registered. Protocol tests and a passing source suite do not establish Chrome/model operation. Use `bun run dev` with temporary config for actual UI review; record physical emulator mouse separately from injected PTY events.

## Repository contents

Keep source tests, CI and reusable build/release tooling versioned. Binary smoke
reports and build manifests go to ignored `dist/`. Internal plans, local QA
reports, one-off validation scripts, campaigns and image-generation prompts
belong in ignored `private/`; source, tests, CI and release commands must work
without those local files.

## Report a problem

Reports in English or Spanish are welcome. Include OS, terminal, dimensions,
Bun/S42 Agent versions, steps and expected/actual behavior. For provider/MCP
issues, name the model or transport and the error observed. Remove credentials
and private project data from shared examples.

Distinguish fixtures from real-model validation and injected mouse events from
physical terminal interaction. Cross-compilation is not destination runtime proof.

## CI and license

[CI](.github/workflows/ci.yml) uses official checkout/setup-bun actions and runs
frozen installation, typecheck and tests on Linux. It does not publish releases
or packages. Its keychain integration test uses an isolated D-Bus/Secret Service
with temporary fixture credentials. Linux test dependencies are provisioned in
the workflow. Verify remote CI after pushing the reviewed commit.

Contributions are distributed under the [MIT license](LICENSE).
