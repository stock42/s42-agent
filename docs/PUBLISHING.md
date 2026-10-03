# Prepare and publish a release

**English** · [Español](PUBLISHING.es.md)

S42 Agent distributes source and six executables: Linux glibc, macOS and Windows,
each x64/ARM64. Compiled binaries include Bun; the LLM server, models and external
programs remain separate. Generated files stay in `dist/`, outside Git.

## Local preparation

Requires Bun 1.4.2. Use temporary configuration and projects for tests.
The [contribution guide](../CONTRIBUTING.md) describes credential tests with
temporary SQLite databases; no Linux keychain services are required.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:release
bun run smoke:binary dist/s42-agent-0.1.1-linux-x64
bun run scripts/build-release.ts --package-only
bun run scripts/release-draft.ts
```

The listed smoke runs on Linux x64, outside the checkout and without Bun/Node
in PATH. It generates `dist/binary-smoke.json` and updates the build manifest.
`--package-only` includes that manifest in the package without recompiling.
Other targets require execution on their OS/architecture to validate runtime;
cross-compilation verifies only executable generation.

`build:release` generates six binaries, `SHASUMS256.txt`, `build-targets.json`,
installers, LICENSE, `release-files.json` and an all-platforms.tar.gz package.
The [local check](../scripts/release-draft.ts) validates versions, targets, sizes,
hashes/checksums, installer/license copies and release-note links. By default
it only prints the eleven-asset plan; it does not create or publish a release.

[Release metadata](releases/metadata.json) contains only the repository, tag,
title and notes path. Keep it aligned with `package.json` and the
[notes](releases/v0.1.1.md). Filenames and tag are part of the installer contract.
These commands do not need `private/`.

## Manual workflow

The user has authorized the assistant to manage this project's packages and
releases. The delivery preference is a published prerelease in this
repository. Use configured GitHub access; do not store credentials in
the source or change repository visibility.

After pushing the completed task's commit and checking its CI:

1. Open **Actions → Prepare draft release → Run workflow**, selecting main.
2. The [workflow](../.github/workflows/release.yml) checks types/tests with
   temporary SQLite credentials, builds six targets, runs Linux smoke and packages.
3. It creates a **draft prerelease** with eleven distribution assets and uploads
   the combined tar.gz package as a twelfth asset. The target is the run's SHA.
4. Verify names, sizes, SHA-256 and the Linux runtime evidence in the build
   manifest, then publish the checked draft as a prerelease.
5. Check the published release and downloads with authorized GitHub access.

Only `workflow_dispatch` starts this flow. It uses GITHUB_TOKEN with contents: write;
pushes/PRs do not create releases. An existing release is not replaced.

A draft can also be created with authenticated GitHub CLI:

```bash
bun run scripts/release-draft.ts --create
```

The user's authorization covers this draft upload; HEAD must already exist on
the remote. This command does not push or publish the draft. Attach the generated
all-platforms.tar.gz package too, then verify and publish the prerelease. The
workflow handles that additional upload automatically. An authenticated GitHub
API client can dispatch the workflow and publish its verified draft.

## Public files

Keep the README [EN](../README.md)/[ES](../README.es.md), user guide
[EN](USAGE.md)/[ES](USAGE.es.md), tool contracts [EN](TOOLS.md)/[ES](TOOLS.es.md),
contribution guide [EN](../CONTRIBUTING.md)/[ES](../CONTRIBUTING.es.md), LICENSE
and release notes [EN](releases/v0.1.1.md)/[ES](releases/v0.1.1.es.md).
The gallery [EN](../screenshots/README.md)/[ES](../screenshots/README.es.md) shows
real TUI execution; the [social JPEG](../assets/github/social-preview.jpg) is the
GitHub cover. Campaigns, announcements, image prompts, plans and local reports
stay in ignored `private/`.

Finish each task with its CHANGELOG update, commit and push to the configured
remote branch, as instructed by the user. Distribution tasks include running
the release workflow and publishing verified prereleases in this repository.
Visibility changes and external announcements still require an explicit request.
`package.json` retains `private: true` because no npm package is published.
