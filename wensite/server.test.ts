import { afterAll, describe, expect, test } from "bun:test";
import { configuredPort, startWebsite } from "./server.ts";

const server = startWebsite({ port: 0, hostname: "127.0.0.1" });
afterAll(() => server.stop(true));
const get = (path: string, init?: RequestInit) => fetch(new URL(path, server.url), init);

describe("website HTTP", () => {
  test("serves crawlable HTML and public assets with the correct content type", async () => {
    const page = await get("/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const html = await page.text();
    expect(html).toContain('href="https://s42agent.dev/"');
    expect(html).toContain("César Casas");
    for (const [path, type] of [
      ["/styles.css", "text/css"], ["/app.js", "javascript"],
      ["/assets/screenshots/10-live-tool-chat.jpg", "image/jpeg"],
      ["/assets/opengraph.jpg", "image/jpeg"],
      ["/favicon.svg", "image/svg+xml"], ["/robots.txt", "text/plain"],
      ["/sitemap.xml", "application/xml"],
    ]) {
      const response = await get(path!);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(type!);
    }
  });

  test("HEAD includes the same headers and no response body", async () => {
    const response = await get("/", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    expect(await response.text()).toBe("");
  });

  test("does not expose configuration, source, repository or encoded parent paths", async () => {
    for (const path of ["/.env", "/.env.example", "/server.ts", "/.git/config", "/missing", "/%2e%2e%2f.env", "/%2e%2e%2fpackage.json"]) {
      expect((await get(path)).status).toBe(404);
    }
    expect((await get("/%zz")).status).toBe(400);
  });

  test("rejects unsupported HTTP methods", async () => {
    const response = await get("/", { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});

test("rejects an invalid configured port", () => {
  const previous = Bun.env.WEBSERVER_PORT;
  try {
    for (const value of ["", "0", "-1", "65536", "3000oops"]) {
      Bun.env.WEBSERVER_PORT = value;
      expect(configuredPort).toThrow("WEBSERVER_PORT");
    }
    Bun.env.WEBSERVER_PORT = "4317";
    expect(configuredPort()).toBe(4317);
  } finally {
    if (previous === undefined) delete Bun.env.WEBSERVER_PORT;
    else Bun.env.WEBSERVER_PORT = previous;
  }
});
