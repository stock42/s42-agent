import { afterEach, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { chmod, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { version } from "../package.json";

const installer = resolve(import.meta.dir, "../install.sh");
const roots: string[] = [];
const contents = `#!/bin/sh\nprintf '${version}\\n'\n`;
const digest = new Bun.CryptoHasher("sha256").update(contents).digest("hex");
const asset = `s42-agent-${version}-${process.platform}-${process.arch}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "s42 installer "));
  roots.push(root);
  const release = join(root, "release files");
  const bin = join(root, "installed bin");
  await mkdir(release);
  await Bun.write(join(release, asset), contents);
  await Bun.write(join(release, "SHASUMS256.txt"), `${digest}  ${asset}\n`);
  return { root, release, bin };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.platform === "win32")("Unix release installer", () => {
  test("installs a local release with spaces in paths, SHA-256 and version checked", async () => {
    const { root, release, bin } = await fixture();
    const result = await $`bash ${installer} --from-dir ${release} --install-dir ${bin} --no-modify-path`.cwd(root).quiet().nothrow();
    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(bin, "s42-agent")).text()).toBe(contents);
    expect((await $`${join(bin, "s42-agent")} --version`.quiet().text()).trim()).toBe(version);
  });

  test("checksum mismatch preserves an existing installation", async () => {
    const { root, release, bin } = await fixture();
    await mkdir(bin);
    await Bun.write(join(bin, "s42-agent"), "existing installation");
    await Bun.write(join(release, asset), contents + "# changed\n");
    const result = await $`bash ${installer} --from-dir ${release} --install-dir ${bin} --no-modify-path`.cwd(root).quiet().nothrow();
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("SHA-256 mismatch");
    expect(await Bun.file(join(bin, "s42-agent")).text()).toBe("existing installation");
  });

  test("downloads the selected executable and checksum from a real HTTP server", async () => {
    const { root, bin } = await fixture();
    const requests: string[] = [];
    const server = Bun.serve({ port: 0, fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path === "/SHASUMS256.txt") return new Response(`${digest}  ${asset}\n`);
      if (path === `/${asset}`) return new Response(contents);
      return new Response("Not found", { status: 404 });
    } });
    try {
      const result = await $`bash ${installer} --install-dir ${bin} --no-modify-path`.cwd(root).env({ ...process.env, S42_AGENT_RELEASE_BASE: `http://127.0.0.1:${server.port}` }).quiet().nothrow();
      expect(result.exitCode).toBe(0);
      expect(requests).toEqual(["/SHASUMS256.txt", `/${asset}`]);
      expect(await Bun.file(join(bin, "s42-agent")).text()).toBe(contents);
    } finally { server.stop(true); }
  });

  test("unpublished release fails without replacing the installed program", async () => {
    const { root, bin } = await fixture();
    await mkdir(bin);
    await Bun.write(join(bin, "s42-agent"), "existing installation");
    const server = Bun.serve({ port: 0, fetch: () => new Response("No release", { status: 404 }) });
    try {
      const result = await $`bash ${installer} --install-dir ${bin} --no-modify-path`.cwd(root).env({ ...process.env, S42_AGENT_RELEASE_BASE: `http://127.0.0.1:${server.port}` }).quiet().nothrow();
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("Release download failed");
      expect(await Bun.file(join(bin, "s42-agent")).text()).toBe("existing installation");
    } finally { server.stop(true); }
  });

  test("selects macOS ARM64 by system metadata (fixture, not macOS execution)", async () => {
    const { root, release, bin } = await fixture();
    const mockBin = join(root, "system fixture");
    await mkdir(mockBin);
    const uname = join(mockBin, "uname");
    await Bun.write(uname, '#!/bin/sh\ncase "$1" in -s) printf "Darwin\\n" ;; -m) printf "arm64\\n" ;; esac\n');
    await chmod(uname, 0o755);
    const macAsset = `s42-agent-${version}-darwin-arm64`;
    await Bun.write(join(release, macAsset), contents);
    await Bun.write(join(release, "SHASUMS256.txt"), `${digest}  ${macAsset}\n`);
    const result = await $`bash ${installer} --from-dir ${release} --install-dir ${bin} --no-modify-path`.cwd(root).env({ ...process.env, PATH: `${mockBin}:${process.env.PATH}` }).quiet().nothrow();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(`Installed S42 Agent ${version}`);
  });
});
