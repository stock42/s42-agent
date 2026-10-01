import { join } from "node:path";
import { $ } from "bun";

// Bun owns the child; the operating system owns its descendants.
export async function killTree(child: Bun.Subprocess): Promise<void> {
  if (process.platform === "win32") {
    await $`${join(process.env.SystemRoot??"C:\\Windows","System32","taskkill.exe")} /PID ${String(child.pid)} /T /F`.nothrow().quiet();
    try { child.kill(); } catch {}
  } else {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
}
