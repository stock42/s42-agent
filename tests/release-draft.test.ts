import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releasePlan } from "../scripts/release-draft.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42-release-plan-"));
  roots.push(root);
  await mkdir(join(root, "dist"));
  await mkdir(join(root, "docs/launch"), { recursive: true });
  await Bun.write(join(root, "package.json"), JSON.stringify({ version: "0.1.0" }));
  await Bun.write(join(root, "docs/launch/github-metadata.json"), JSON.stringify({ repository: "stock42/s42-agent",
    release: { tag: "v0.1.0", title: "Preview", notes: "notes.md" } }));
  await Bun.write(join(root, "notes.md"), "[Readme](https://github.com/stock42/s42-agent/blob/v0.1.0/README.md)");
  const entries = [];
  for (const target of ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"]) {
    const file = `s42-agent-0.1.0-${target}${target.startsWith("windows") ? ".exe" : ""}`;
    const bytes = new TextEncoder().encode(target);
    await Bun.write(join(root, "dist", file), bytes);
    entries.push({ file, target: `bun-${target}`, bytes: bytes.length, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") });
  }
  for (const file of ["install.sh", "install.ps1", "LICENSE"]) {
    await Bun.write(join(root, file), file);
    await Bun.write(join(root, "dist", file), file);
  }
  await Bun.write(join(root, "dist/build-targets.json"), JSON.stringify({ version: "0.1.0", entries }));
  await Bun.write(join(root, "dist/SHASUMS256.txt"), entries.map(e => `${e.sha256}  ${e.file}`).join("\n") + "\n");
  await Bun.write(join(root, "dist/release-files.json"), JSON.stringify({ tag: "v0.1.0",
    uploadFiles: [...entries.map(e => e.file), "SHASUMS256.txt", "build-targets.json", "install.sh", "install.ps1", "LICENSE"] }));
  return root;
}

test("prepares the exact six-target draft plan without invoking GitHub", async () => {
  const plan = await releasePlan(await fixture());
  expect(plan.draft).toBe(true);
  expect(plan.prerelease).toBe(true);
  expect(plan.uploadFiles).toHaveLength(11);
  expect(plan.verified).toHaveLength(6);
});

test("rejects a corrupted executable before upload", async () => {
  const root = await fixture();
  await Bun.write(join(root, "dist/s42-agent-0.1.0-linux-x64"), "corrupted");
  await expect(releasePlan(root)).rejects.toThrow("Compiled manifest mismatch");
});

test("rejects an outdated installer copy and broken release-note links", async () => {
  const root = await fixture();
  await Bun.write(join(root, "dist/install.ps1"), "outdated");
  await expect(releasePlan(root)).rejects.toThrow("Distribution copy differs");
  await Bun.write(join(root, "dist/install.ps1"), "install.ps1");
  await Bun.write(join(root, "notes.md"), "[Readme](../../README.md)");
  await expect(releasePlan(root)).rejects.toThrow("absolute URLs");
});

test("rejects version mismatch and a checksum list from another build", async () => {
  const root = await fixture();
  await Bun.write(join(root, "package.json"), JSON.stringify({ version: "0.2.0" }));
  await expect(releasePlan(root)).rejects.toThrow("versions differ");
  await Bun.write(join(root, "package.json"), JSON.stringify({ version: "0.1.0" }));
  await Bun.write(join(root, "dist/SHASUMS256.txt"), "");
  await expect(releasePlan(root)).rejects.toThrow("Checksum mismatch");
});
