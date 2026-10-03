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
      ["/assets/opengraph-es.jpg", "image/jpeg"], ["/assets/hero-42.webp", "image/webp"],
      ["/favicon.svg", "image/svg+xml"], ["/robots.txt", "text/plain"],
      ["/sitemap.xml", "application/xml"],
    ]) {
      const response = await get(path!);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(type!);
    }
  });

  test("English is the default and Spanish has complete HTML and reciprocal SEO", async () => {
    const english = await (await get("/", { headers: { "Accept-Language": "es-AR" } })).text();
    const spanish = await (await get("/es/")).text();
    for (const [html, language, canonical, locale, image] of [
      [english, "en", "https://s42agent.dev/", "en_US", "opengraph.jpg"],
      [spanish, "es-AR", "https://s42agent.dev/es/", "es_AR", "opengraph-es.jpg"],
    ]) {
      expect(html).toContain(`<html lang="${language}">`);
      expect(html).toContain(`rel="canonical" href="${canonical}"`);
      expect(html).toContain('hreflang="en" href="https://s42agent.dev/"');
      expect(html).toContain('hreflang="es" href="https://s42agent.dev/es/"');
      expect(html).toContain('hreflang="x-default" href="https://s42agent.dev/"');
      expect(html).toContain(`property="og:locale" content="${locale}"`);
      expect(html).toContain(`content="https://s42agent.dev/assets/${image}"`);
      const json = html!.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      expect(json).toBeDefined();
      expect(JSON.parse(json!)["@graph"][0].url).toBe(canonical);
    }
    expect(english).toContain("AI coding.");
    expect(english).toContain("Copy command");
    expect(english).toContain("Developed by");
    expect(english).not.toContain("Instalar S42 Agent");
    expect(spanish).toContain("Coding con IA.");
    expect(spanish).toContain("Copiar comando");
    expect(spanish).toContain("Desarrollado por");
    expect(spanish).toContain('href="/es/" lang="es" hreflang="es" aria-label="Español" aria-current="page"');
    expect(english).toContain('href="/" lang="en" hreflang="en" aria-label="English" aria-current="page"');
  });

  test("normalizes the Spanish route without losing query parameters", async () => {
    const response = await get("/es?source=test", { redirect: "manual" });
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(new URL("/es/?source=test", server.url).href);
    const head = await get("/es/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toContain("text/html");
    expect(await head.text()).toBe("");
  });

  test("the sitemap includes both languages and mutable assets revalidate", async () => {
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://s42agent.dev/</loc>");
    expect(sitemap).toContain("<loc>https://s42agent.dev/es/</loc>");
    expect(sitemap.match(/hreflang="x-default"/g)?.length).toBe(2);
    for (const path of ["/", "/es/", "/styles.css?v=3", "/app.js?v=3"]) {
      expect((await get(path)).headers.get("cache-control")).toBe("no-cache");
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
