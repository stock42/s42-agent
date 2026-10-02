# Prepare and publish a release

**English** · [Español](PUBLISHING.es.md)

S42 Agent distributes source and six executables: Linux glibc, macOS and Windows,
each x64/ARM64. Compiled binaries include Bun; the LLM server, models and external
programs remain separate. Generated files stay in `dist/`, outside Git.

## Local preparation

Requires Bun 1.4.2. Use temporary configuration and projects for tests.
The [contribution guide](../CONTRIBUTING.md) and workflow describe the isolated
keychain requirements for Linux tests.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:release
bun run smoke:binary dist/s42-agent-0.1.0-linux-x64
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
[notes](releases/v0.1.0.md). Filenames and tag are part of the installer contract.
These commands do not need `private/`.

## Manual workflow

After pushing the authorized commit and checking its CI:

1. Open **Actions → Prepare draft release → Run workflow**, selecting main.
2. The [workflow](../.github/workflows/release.yml) checks types/tests with a
   temporary keychain, builds six targets, runs Linux smoke and packages.
3. It creates a **draft prerelease** with eleven assets and the run's SHA as
   target. Review the draft before publishing.
4. After publishing, check download URLs and both installers.

Only `workflow_dispatch` starts this flow. It uses GITHUB_TOKEN with contents: write;
pushes/PRs do not create releases. An existing release is not replaced.

A draft can also be created with authenticated GitHub CLI:

```bash
bun run scripts/release-draft.ts --create
```

This command requires explicit authorization to upload the draft and HEAD must
already exist on the remote. It does not push or publish the draft. The
all-platforms.tar.gz package can be attached as an additional asset.

## Public files

Keep the README [EN](../README.md)/[ES](../README.es.md), user guide
[EN](USAGE.md)/[ES](USAGE.es.md), tool contracts [EN](TOOLS.md)/[ES](TOOLS.es.md),
contribution guide [EN](../CONTRIBUTING.md)/[ES](../CONTRIBUTING.es.md), LICENSE
and release notes [EN](releases/v0.1.0.md)/[ES](releases/v0.1.0.es.md).
The gallery [EN](../screenshots/README.md)/[ES](../screenshots/README.es.md) shows
real TUI execution; the [social JPEG](../assets/github/social-preview.jpg) is the
GitHub cover. Campaigns, announcements, image prompts, plans and local reports
stay in ignored `private/`.

Do not push, change visibility, run the workflow, upload a release or publish
announcements without an explicit request. `package.json` retains `private: true`
because no npm package is published.
