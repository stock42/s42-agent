import { expect, test } from "bun:test";
import { execute } from "../src/agent/tools.ts";

const browser = process.platform === "darwin" || !!process.env.BUN_CHROME_PATH ||
  ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "microsoft-edge", "msedge", "brave-browser"].some(name => Bun.which(name));
const run = (args: object, signal = new AbortController().signal) => execute("scrape", JSON.stringify(args), process.cwd(), signal);

test("scrape valida protocolo, argumentos y cancelación antes de abrir el navegador", async () => {
  expect((await run({ url: "file:///tmp/private" })).failed).toBe(true);
  expect((await run({ url: "https://example.com", format: "pdf" })).failed).toBe(true);
  const controller = new AbortController(); controller.abort(new Error("cancelled-before-browser"));
  expect((await run({ url: "https://example.com" }, controller.signal)).output).toContain("cancelled-before-browser");
});
test.skipIf(!browser)("WebView real extrae DOM JavaScript, HTML, todos los enlaces y Unicode; permite cancelar", async () => {
  const server = Bun.serve({ port: 0, fetch(req) {
    if (new URL(req.url).pathname === "/large") return new Response(`<meta charset="utf-8"><main id="ready">${"á文🙂".repeat(10000)}${'<a href="/link">Enlace</a>'.repeat(30)}</main>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response(`<meta charset="utf-8"><title>Scraping QA</title><body><script>setTimeout(() => {
      const main = document.createElement('main'); main.id = 'ready'; main.innerHTML = '<h1>Dinámico á文🙂</h1><a href="/next">Siguiente</a>'; document.body.append(main);
    }, 30);</script></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  } });
  try {
    const args = { url: `http://127.0.0.1:${server.port}/`, selector: "#ready" };
    const result = await run(args); expect(result.failed).toBe(false);
    const data = JSON.parse(result.output);
    expect(data.title).toBe("Scraping QA"); expect(data.content).toContain("Dinámico á文🙂"); expect(data.content).not.toContain("<h1>");
    expect(data.links).toEqual([{ text: "Siguiente", href: `http://127.0.0.1:${server.port}/next` }]);
    expect(JSON.parse((await run({ ...args, format: "html" })).output).content).toContain("<h1>Dinámico á文🙂</h1>");
    const controller = new AbortController(); const pending = run({ ...args, selector: "#missing" }, controller.signal);
    setTimeout(() => controller.abort(new Error("cancelled-browser")), 100);
    expect((await pending).output).toContain("cancelled-browser");
    expect((await run({ ...args, selector: "[" })).failed).toBe(true);
    // A fresh call still works after cancellation/selector failure.
    expect((await run(args)).failed).toBe(false);
    const large = await run({ ...args, url: `http://127.0.0.1:${server.port}/large` });
    expect(large.truncated).toBe(false); const full = JSON.parse(large.output);
    expect(full.content).toStartWith("á文🙂".repeat(10000)); expect(full.content).not.toContain("�");
    expect(full.linkCount).toBe(30); expect(full.links).toHaveLength(30);
  } finally { server.stop(true); }
}, 15000);
