---
name: software-project
description: Plan a new software project or its initial structure with clear scope, a small architecture and verifiable development stages.
---
# Software project foundation

Use for a new project, initial repository structure or an explicit architecture request. For a small fix, inspect the existing code instead of redesigning it.

1. Read the user's requirements, AGENTS.md, README and existing manifests. Preserve their stack, conventions and existing work. Ask only about missing decisions that block implementation; state reversible assumptions.
2. Describe the users, main workflow, inputs/outputs and concrete acceptance criteria. Separate requested scope from future ideas. Identify actual external integrations and runtime constraints.
3. Choose the smallest architecture that completes one useful workflow end to end. Describe the entrypoint, modules, data ownership and integration boundaries. Follow the repository's structure; do not add services, abstractions or dependencies without a concrete need.
4. Break implementation into small stages ordered by dependencies. Each stage needs tasks, observable acceptance criteria and an appropriate verification command or manual scenario. Validate uncertain APIs with official documentation or a minimal executable probe.
5. When planning is requested, save the plan/specification at the requested path before implementing. When implementation is requested, build the first complete workflow, then extend it in those stages.
6. Read before editing, inspect the resulting diff, and run the relevant checks. Report implemented behavior, evidence and unresolved limitations separately. A build is not proof of deployment or runtime compatibility on another OS.

Completion: a reader can identify what will be built, where each responsibility belongs, the next executable task and how to decide whether it works.
