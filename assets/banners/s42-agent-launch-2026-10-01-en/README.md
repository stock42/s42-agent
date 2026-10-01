# S42 Agent — English launch campaign

Five English editions of the [Spanish campaign](../s42-agent-launch-2026-10-01/README.md),
created with the built-in `image_gen` tool. Five **1254 × 1254 px** square PNG images for a carousel or
individual posts. The original Spanish assets remain available.

The campaign keeps the DOS-blue, cyan and warm-white visual identity, bold
headlines, monospace interface text and QBasic-inspired windows. Images 01–04
are product illustrations of implemented features, rather than screenshots or
evidence of a live model run. Marketing copy and interface examples are in English.

## Images and suggested captions

| Image | File | Suggested caption |
| --- | --- | --- |
| 01 · A superagent. With a QBasic soul. | [PNG](01-superagent-qbasic.png) | Meet S42 Agent: AI coding in a terminal with personality. QBasic-inspired windows, mouse support, menus and Vim shortcuts, built with Bun. Open source under MIT. |
| 02 · Your projects. Stay in the flow. | [PNG](02-projects-and-files.png) | Keep projects and files in separate tabs. Browse beyond the project folder, search by name or glob, and read HTML, CSS, JavaScript and TypeScript with syntax colors. |
| 03 · Your language. Your style. | [PNG](03-languages-and-themes.png) | Switch between English and Spanish, and choose QBasic, Graphite, Forest, Nord, Dracula or Gruvbox. Add a project with Name + Folder. Enter sends; Shift+Enter adds a line. |
| 04 · Your model. The power to build. | [PNG](04-models-and-tools.png) | Connect local llama.cpp, DeepSeek or another compatible provider. Use 12 native tools, MCP, skills, reusable prompts with {{variables}} and a headless CLI. Model capabilities depend on the selected provider and model. |
| 05 · Fast. Backed by numbers. | [PNG](05-benchmark.png) | Recorded S42 Agent v0.1.0 harness benchmark on Linux x64: 24.43 ms startup p95, 35.95 ms input p95 and 46.64 MiB idle RSS. Warm-cache PTY measurements exclude LLM inference and emulator painting. |

## Benchmark source and scope

Image 05 uses the historical results in
[final-validation.md](../../../docs/qa/final-validation.md) and
[benchmark-s42-agent-0.1.0-linux-x64.json](../../../docs/qa/benchmark-s42-agent-0.1.0-linux-x64.json).
English decimal punctuation changes the presentation, never the values.

| Measurement | Recorded result |
| --- | --- |
| Startup p95 | 24.43 ms |
| Input p95 | 35.95 ms |
| SSE delta to frame p95 | 4.07 ms |
| Idle RSS memory | 46.64 MiB |
| Resume a session of 1,000 messages | 42.07 ms |

Conditions: 30 startups, 100 inputs and 20 SSE deltas; warm OS cache; received
bytes measured in a PTY. LLM inference and graphical emulator painting are
excluded. Recorded host: Intel Core Ultra 9 275HX, Ubuntu 24.04.5, Bun 1.4.2.
These are recorded v0.1.0 results, rather than a new benchmark of the current
source, a comparison with competitors or a measure of model throughput.

## Generation and review

[prompts.json](prompts.json) preserves the five localization prompts and their
source images, including the benchmark decimal-format correction. Text inside the UI illustrations is localized as well as the
headlines, feature captions and benchmark labels. Tool identifiers remain
unchanged. The six theme names use their English display names.

Review covers English spelling, image readability, consistent campaign styling,
all twelve tool names, the six themes, and all five benchmark values and units.
All five saved PNGs were opened for visual inspection and checked for file integrity
and equal dimensions. The prompt JSON and local document links were checked as well.
Runtime code, personal configuration and the benchmark source are unchanged.
