import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BrowserSession } from "../src/mcp/browser.ts";
import { killTree } from "../src/agent/process.ts";

// Explicit opt-in: uses the already-installed external Node/MCP/Chrome. No install.
if (process.env.S42_CHROME_MCP_ENTRY) test("Chrome real: perfil aislado, imágenes, tab cerrado, cancelación y Chrome externo preservado", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-real-chrome-")), controller = new AbortController();
  const server = { id: "chrome", name: "Chrome", enabled: true, purpose: "browser" as const, transport: "stdio" as const, command: process.env.S42_BROWSER_NODE ?? "node", args: [process.env.S42_CHROME_MCP_ENTRY!, "--headless", "--no-usage-statistics", "--no-performance-crux", "--no-update-checks"] };
  const browser = new BrowserSession(server, root, join(root, "artifacts")); let stderr = ""; let external: Bun.Subprocess | undefined, attached: BrowserSession | undefined;
  const app = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response('<title>S42</title><label>Nombre <input id="name"></label><button onclick="localStorage.setItem(\'name\',document.querySelector(\'#name\').value)">Guardar</button><p id="saved"></p><script>document.querySelector(\'#saved\').textContent=localStorage.getItem(\'name\')</script>', { headers: { "Content-Type": "text/html" } }) });
  const ok = async (b: BrowserSession, tool: string, args: object) => { const r = await b.action(tool, args, controller.signal); expect(r.failed).toBe(false); return r; };
  try {
    await browser.open(controller.signal); const page = await ok(browser, "new_page", { url: `http://127.0.0.1:${app.port}` }), pageId = Number(/(\d+):[^\n]*\[selected\]/.exec(page.output)?.[1]); expect(pageId).toBeGreaterThan(0);
    await ok(browser, "evaluate_script", { pageId, function: "() => { document.querySelector('#name').value='á文🙂'; document.querySelector('button').click(); return localStorage.getItem('name'); }" });
    await ok(browser, "navigate_page", { pageId, type: "reload" }); expect((await ok(browser, "take_snapshot", { pageId })).output).toContain("á文🙂");
    await ok(browser, "resize_page", { pageId, width: 390, height: 844 }); const screenshot = await ok(browser, "take_screenshot", { pageId, format: "png" }); expect(screenshot.artifacts?.[0]?.mimeType).toBe("image/png"); expect(await Bun.file(screenshot.artifacts![0]!.path!).exists()).toBe(true);
    await ok(browser, "close_page", { pageId }); expect((await browser.action("take_snapshot", { pageId }, controller.signal)).failed).toBe(true);
    const newPage = await ok(browser, "new_page", { url: "about:blank" }), nextId = Number(/(\d+):[^\n]*\[selected\]/.exec(newPage.output)?.[1]);
    const cancel = new AbortController(), pending = browser.action("evaluate_script", { pageId: nextId, function: "() => new Promise(() => {})" }, cancel.signal); await Bun.sleep(50); cancel.abort(new Error("Cancelación explícita QA")); expect((await pending).failed).toBe(true); await browser.close();
    external = Bun.spawn([process.env.S42_CHROME_EXECUTABLE ?? "google-chrome", "--headless", "--remote-debugging-port=0", `--user-data-dir=${join(root, "external-profile")}`, "about:blank"], { detached: true, stdout: "ignore", stderr: "pipe" });
    void (async () => { for await (const bytes of external!.stderr as ReadableStream<Uint8Array>) stderr += new TextDecoder().decode(bytes); })();
    const portFile = Bun.file(join(root, "external-profile/DevToolsActivePort")); for (let i = 0; i < 300 && !await portFile.exists() && !/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.test(stderr); i++) await Bun.sleep(10); const port = await portFile.exists() ? (await portFile.text()).split("\n")[0] : /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(stderr)?.[1]; if (!port) throw new Error(`Chrome externo exit=${external.exitCode}: ${stderr}`);
    attached = new BrowserSession({ ...server, args: [process.env.S42_CHROME_MCP_ENTRY!, `--browser-url=http://127.0.0.1:${port}`, "--no-usage-statistics", "--no-update-checks"] }, root, join(root, "external-artifacts"), "existing");
    await attached.open(controller.signal); expect((await ok(attached, "list_pages", {})).output).toContain("about:blank"); await attached.close();
    expect((await fetch(`http://127.0.0.1:${port}/json/version`)).status).toBe(200);
  } finally { await browser.close(); await attached?.close(); if (external) { await killTree(external); await external.exited; } app.stop(true); await rm(root, { recursive: true, force: true }); }
}, 20000);
