# Contributing to S42 Agent

[Español](CONTRIBUTING.es.md)

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
5. Update relevant documentation and CHANGELOG before committing.
6. Submit a PR describing the problem, resulting behavior and actual validation.

Use Bun's APIs where they fit. Avoid adding runtime dependencies without a concrete
need. Binary tests apply to distribution changes; they do not replace TUI review.

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
