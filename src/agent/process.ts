import { join } from "node:path";

// Bun owns the child; the operating system owns its descendants.
export async function killTree(child: Bun.Subprocess): Promise<void> {
  if (process.platform === "win32") {
    const taskkill = Bun.spawn([join(process.env.SystemRoot??"C:\\Windows","System32","taskkill.exe"), "/PID", String(child.pid), "/T", "/F"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    await taskkill.exited;
    try { child.kill(); } catch {}
  } else {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
}
