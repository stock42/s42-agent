import { cpus, freemem, totalmem } from "node:os";
import { readdir, statfs } from "node:fs/promises";
import { join } from "node:path";
import { tokensPerSecond, type TokenUsage } from "../agent/usage.ts";
import type { ResourceIndicators } from "../storage/config.ts";

export interface Capacity { used: number; free: number; total: number }
export interface SystemMetrics { cpu?: Capacity; ram?: Capacity; disk?: Capacity; diskPath: string; gpu?: Capacity; gpuSource?: string; gpuError?: string; at?: string }
export interface CpuSample { idle: number; total: number }
export function cpuSample(): CpuSample {
  return cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
}
export function cpuUsage(before: CpuSample, after: CpuSample): Capacity | undefined {
  const total = after.total - before.total;
  if (total <= 0) return undefined;
  const free = Math.max(0, Math.min(100, (after.idle - before.idle) / total * 100));
  return { used: 100 - free, free, total: 100 };
}
export function diskCapacity(fs: { bsize: number; blocks: number; bfree: number; bavail: number }): Capacity {
  // Reserved blocks are neither used nor available to this user.
  return { used: (fs.blocks - fs.bfree) * fs.bsize, free: fs.bavail * fs.bsize, total: fs.blocks * fs.bsize };
}
export function parseNvidiaMemory(text: string): Capacity | undefined {
  const rows = text.trim().split("\n").map(line => line.split(",").map(v => Number(v.trim())));
  if (!text.trim() || rows.some(row => row.length !== 3 || row.some(n => !Number.isFinite(n) || n < 0))) return undefined;
  return rows.reduce((sum, row) => ({ total: sum.total + row[0]! * 1048576, used: sum.used + row[1]! * 1048576, free: sum.free + row[2]! * 1048576 }), { total: 0, used: 0, free: 0 });
}
async function gpuMemory(signal: AbortSignal): Promise<Pick<SystemMetrics, "gpu" | "gpuSource" | "gpuError">> {
  if (process.platform === "linux") {
    try {
      const cards = (await readdir("/sys/class/drm")).filter(name => /^card\d+$/.test(name));
      const values: Capacity[] = [];
      for (const card of cards) {
        const base = join("/sys/class/drm", card, "device");
        const totalText = (await Bun.file(join(base, "mem_info_vram_total")).text().catch(() => "")).trim();
        const usedText = (await Bun.file(join(base, "mem_info_vram_used")).text().catch(() => "")).trim();
        const total = Number(totalText), used = Number(usedText);
        if (totalText && usedText && total > 0 && Number.isFinite(used) && used >= 0 && used <= total) values.push({ total, used, free: total - used });
      }
      if (values.length) return { gpu: values.reduce((a, b) => ({ total: a.total + b.total, used: a.used + b.used, free: a.free + b.free })), gpuSource: "Linux DRM (VRAM dedicada)" };
    } catch { /* Try the installed driver utility below. */ }
  }
  const executable = Bun.which("nvidia-smi");
  if (!executable) return { gpuError: "No hay contador de VRAM disponible (DRM o nvidia-smi)." };
  signal.throwIfAborted();
  const child = Bun.spawn([executable, "--query-gpu=memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const abort = () => child.kill(), timer = setTimeout(abort, 2000);
  signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort();
  try {
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    signal.throwIfAborted(); const gpu = code === 0 ? parseNvidiaMemory(out) : undefined;
    return gpu ? { gpu, gpuSource: "nvidia-smi (suma de GPUs)" } : { gpuError: (err.trim() || out.trim()).slice(0, 300) || "El driver no reportó VRAM válida." };
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

export class SystemMonitor {
  snapshot: SystemMetrics;
  private previous = cpuSample();
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private controller = new AbortController();
  constructor(private path: () => string) { this.snapshot = { diskPath: path() }; }
  async refresh(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const current = cpuSample(), cpu = cpuUsage(this.previous, current); this.previous = current;
      const total = totalmem(), free = freemem(), diskPath = this.path();
      const [disk, gpu] = await Promise.allSettled([statfs(diskPath).then(diskCapacity), gpuMemory(this.controller.signal)]);
      if (this.controller.signal.aborted) return;
      this.snapshot = { cpu, ram: { used: total - free, free, total }, diskPath, disk: disk.status === "fulfilled" ? disk.value : undefined,
        ...(gpu.status === "fulfilled" ? gpu.value : { gpuError: "No se pudo consultar VRAM." }), at: new Date().toISOString() };
    })().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  start(changed: () => void): void {
    if (this.timer) return;
    const update = () => { if (!this.pending) void this.refresh().then(changed).catch(() => {}); };
    update(); this.timer = setInterval(update, 2000); this.timer.unref();
  }
  async stop(): Promise<void> { clearInterval(this.timer); this.timer=undefined; this.controller.abort(); await this.pending; }
}
export function size(bytes: number): string { return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)}G` : `${Math.round(bytes / 1048576)}M`; }
const capacity = (value?: Capacity) => value ? `${size(value.used)}/${size(value.total)}` : "N/D";
export function metricLines(metrics: SystemMetrics, visible: ResourceIndicators, width: number, t: (text: string) => string = text => text): string[] {
  const values = [
    visible.cpu ? `CPU: ${metrics.cpu ? `${Math.round(metrics.cpu.used)}%` : t("N/D")}` : "",
    visible.ram ? `RAM: ${t(capacity(metrics.ram))}` : "",
    visible.disk ? `${t("Disco")}: ${t(capacity(metrics.disk))}` : "",
    visible.gpu ? `VRAM: ${t(capacity(metrics.gpu))}` : "",
  ].filter(Boolean);
  const lines: string[] = [];
  for (const value of values) {
    const last = lines.at(-1);
    if (last && Bun.stringWidth(last + " · " + value) <= width - 2) lines[lines.length - 1] = last + " · " + value;
    else lines.push(value);
  }
  return lines;
}
function count(value: number): string {
  if (value < 10000) return String(value);
  const units = ["", "k", "M", "G", "T", "P"];
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return `${value.toFixed(1)}${units[unit]}`;
}
export function tokenLine(tokens?: TokenUsage, t: (text: string) => string = text => text): string {
  const rate = tokensPerSecond(tokens);
  const number = (value?: number) => value === undefined ? t("N/D") : count(value);
  return `${t("Tokens E/S")} ${number(tokens?.input)}/${number(tokens?.output)} · ${rate === undefined ? t("N/D") : rate >= 10000 ? count(rate) : rate.toFixed(1)} tok/s${tokens?.partial ? t(" (parcial)") : ""}`;
}
