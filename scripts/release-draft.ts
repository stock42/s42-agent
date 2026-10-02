import { $ } from "bun";
import { join, resolve } from "node:path";

/** Check the exact upload list; the default command only prints a local plan. */
export async function releasePlan(root = resolve(import.meta.dir, "..")) {
  const { version } = await Bun.file(join(root, "package.json")).json();
  const metadata = await Bun.file(join(root, "docs/releases/metadata.json")).json();
  const release = await Bun.file(join(root, "dist/release-files.json")).json();
  const builds = await Bun.file(join(root, "dist/build-targets.json")).json() as {
    version: string;
    entries: { target: string; file: string; bytes: number; sha256: string }[];
  };
  const tag = `v${version}`;
  if (metadata.release.tag !== tag || release.tag !== tag || builds.version !== version) {
    throw new Error("Package, metadata and compiled release versions differ");
  }
  const targets = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64", "windows-arm64"];
  const binaries = targets.map(target => `s42-agent-${version}-${target}${target.startsWith("windows") ? ".exe" : ""}`);
  const uploadFiles = [...binaries, "SHASUMS256.txt", "build-targets.json", "install.sh", "install.ps1", "LICENSE"];
  if (JSON.stringify(release.uploadFiles) !== JSON.stringify(uploadFiles) || builds.entries.length !== 6) {
    throw new Error("Release must contain the six platform binaries and the exact distribution files");
  }
  const checksums = await Bun.file(join(root, "dist/SHASUMS256.txt")).text();
  const verified = [];
  for (const [index, file] of binaries.entries()) {
    const entry = builds.entries.find(entry => entry.file === file);
    const bytes = await Bun.file(join(root, "dist", file)).bytes();
    const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    if (!entry || entry.target !== `bun-${targets[index]}` || entry.bytes !== bytes.length || entry.sha256 !== sha256) {
      throw new Error(`Compiled manifest mismatch: ${file}`);
    }
    if (!checksums.split("\n").includes(`${sha256}  ${file}`)) throw new Error(`Checksum mismatch: ${file}`);
    verified.push({ file, bytes: bytes.length, sha256 });
  }
  for (const file of ["install.sh", "install.ps1", "LICENSE"]) {
    if (!Buffer.from(await Bun.file(join(root, file)).bytes()).equals(await Bun.file(join(root, "dist", file)).bytes())) {
      throw new Error(`Distribution copy differs from source: ${file}`);
    }
  }
  const notes = metadata.release.notes as string;
  const body = await Bun.file(join(root, notes)).text();
  if (/\]\((?!https?:\/\/|#)[^)]+\)/.test(body)) {
    throw new Error("Release notes need absolute URLs to work on the GitHub release page");
  }
  return { repository: metadata.repository as string, tag, title: metadata.release.title as string,
    draft: true, prerelease: true, notes, uploadFiles, verified };
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const plan = await releasePlan(root);
  const commit = (await $`git rev-parse HEAD`.cwd(root).text()).trim();
  console.log(JSON.stringify({ ...plan, targetCommit: commit, action: Bun.argv.includes("--create") ? "create-draft" : "local-check-only" }, null, 2));
  if (Bun.argv.includes("--create")) {
    const args = ["release", "create", plan.tag, ...plan.uploadFiles.map(file => join(root, "dist", file)),
      "--repo", plan.repository, "--target", commit, "--title", plan.title,
      "--notes-file", join(root, plan.notes), "--draft", "--prerelease", "--latest=false"];
    await $`gh ${args}`.cwd(root);
  }
}
