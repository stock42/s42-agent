import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Medición local de la demo compilada: transporte PTY, sin LLM ni terminal gráfico.
const source = resolve(import.meta.dir, "../dist/s42-agent");
const directory = await mkdtemp(`${tmpdir()}/s42-tui-bench-`);
const binary = `${directory}/s42-agent`;
await Bun.write(binary, Bun.file(source)); await chmod(binary, 0o755);
const startup: number[] = [];
const input: number[] = [];
let rssKiB = 0;

async function until(check: () => boolean, stage: string): Promise<void> {
  const deadline = performance.now() + 3000;
  while (!check()) {
    if (performance.now() > deadline) throw new Error(`Timeout en benchmark PTY: ${stage}`);
    await Bun.sleep(1);
  }
}

function session() {
  let output = "";
  let firstFrame = 0;
  const decoder = new TextDecoder();
  let start = 0;
  const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, data) => {
    output += decoder.decode(data, { stream: true });
    if (!firstFrame && output.includes("\x1b[?7h")) firstFrame = performance.now() - start;
  } });
  start = performance.now();
  // PATH sin Bun/Node; cwd externo. No equivale a desinstalarlos del host.
  const child = Bun.spawn([binary], { cwd: directory, terminal, env: { TERM: "xterm-256color", PATH: "/nonexistent" } });
  return { terminal, child, get output() { return output; }, get firstFrame() { return firstFrame; },
    async close() { terminal.write("\x11"); await child.exited; await until(() => output.includes("\x1b[?1049l"), "cleanup"); terminal.close(); },
    dispose() { child.kill(); terminal.close(); } };
}

function metrics(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return { samples: values.length, minMs: sorted[0], p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maxMs: sorted.at(-1) };
}

try {
  for (let cycle = 0; cycle < 30; cycle++) {
    const run = session();
    try { await until(() => run.firstFrame > 0, `startup ${cycle}`); startup.push(run.firstFrame); await run.close(); }
    finally { run.dispose(); }
  }
  const run = session();
  try {
    await until(() => run.firstFrame > 0, "startup input");
    const status = await Bun.file(`/proc/${run.child.pid}/status`).text();
    rssKiB = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]);
    for (let entry = 0; entry < 100; entry++) {
      const offset = run.output.length; const start = performance.now(); run.terminal.write(String.fromCharCode(97 + entry % 26));
      await until(() => run.output.slice(offset).includes("\x1b[?7h"), `input ${entry}`); input.push(performance.now() - start);
    }
    for (let cycle = 0; cycle < 50; cycle++) {
      const opened = run.output.length; run.terminal.write("\x1bOP");
      await until(() => run.output.slice(opened).includes("Mouse: clic"), `modal open ${cycle}`);
      const closed = run.output.length; run.terminal.write("\x1b");
      await until(() => run.output.slice(closed).includes("\x1b[?7h"), `modal close ${cycle}`);
    }
    await run.close();
  } finally { run.dispose(); }
  const cpuInfo = await Bun.file("/proc/cpuinfo").text();
  const memInfo = await Bun.file("/proc/meminfo").text();
  const os = await Bun.file("/etc/os-release").text();
  const bytes = await Bun.file(binary).arrayBuffer();
  const result = { measuredAt: new Date().toISOString(), bun: Bun.version, platform: process.platform, arch: process.arch,
    cpu: cpuInfo.match(/^model name\s*:\s*(.+)$/m)?.[1], ramKiB: Number(memInfo.match(/^MemTotal:\s+(\d+)/m)?.[1]),
    os: os.match(/^PRETTY_NAME="(.+)"/m)?.[1], terminal: "Bun.Terminal · 80×24 · xterm-256color",
    binaryBytes: bytes.byteLength, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    startup: metrics(startup), input: metrics(input), idleRSSMiB: rssKiB / 1024, modalOpenCloseCycles: 50,
    limits: "Caché del SO caliente; frame medido al recibir bytes en PTY, sin pintura gráfica. Binario copiado fuera del checkout con PATH sin Bun/Node; no se desinstalaron runtimes del host." };
  const path = resolve(import.meta.dir, "../docs/qa/tui-benchmark.json");
  await Bun.write(path, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
