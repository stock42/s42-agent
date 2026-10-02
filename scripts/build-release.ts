import { $ } from "bun";
import { join, resolve } from "node:path";
import { version } from "../package.json";

const root = resolve(import.meta.dir, "..");
const directory = join(root, "dist");
if (!Bun.argv.includes("--package-only")) {
  await $`${process.execPath} run scripts/build-targets.ts`.cwd(root);
}
const manifest = await Bun.file(join(directory, "build-targets.json")).json() as {
  entries: { file: string; sha256: string; bytes: number; target: string }[];
};

// Release installers consume raw executables and this checksum file.
await Bun.write(join(directory, "SHASUMS256.txt"), manifest.entries.map(entry => `${entry.sha256}  ${entry.file}`).join("\n") + "\n");
for (const file of ["install.sh", "install.ps1", "LICENSE"]) {
  await Bun.write(join(directory, file), Bun.file(join(root, file)));
}
const uploadFiles = [...manifest.entries.map(entry => entry.file), "SHASUMS256.txt", "build-targets.json", "install.sh", "install.ps1", "LICENSE"];
const release = {
  version,
  tag: `v${version}`,
  published: false,
  uploadFiles,
  installers: { unix: "install.sh", windows: "install.ps1" },
  downloadBase: `https://github.com/stock42/s42-agent/releases/download/v${version}`,
};
await Bun.write(join(directory, "release-files.json"), JSON.stringify(release, null, 2) + "\n");

// One local handoff bundle; no GitHub upload or signing is performed here.
const archiveFiles: Record<string, Uint8Array> = {};
for (const file of [...uploadFiles, "release-files.json"]) {
  archiveFiles[file] = await Bun.file(join(directory, file)).bytes();
}
const bundle = `s42-agent-${version}-all-platforms.tar.gz`;
const archive = new Bun.Archive(archiveFiles, { compress: "gzip" });
// Explicit serialization preserves gzip with Bun 1.4.2; passing Archive to
// Bun.write directly writes the uncompressed tar representation.
await Bun.write(join(directory, bundle), await archive.bytes());
console.log(`Release files: ${directory}\nHandoff bundle: ${bundle}\nPublication: pending`);
