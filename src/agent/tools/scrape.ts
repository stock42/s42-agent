import { clip, definition, positiveInteger, string, type NativeTool } from "./shared.ts";

export const scrape: NativeTool = {
  definition: definition("scrape", "Scrape a rendered HTTP(S) page with Bun.WebView, including JavaScript content. Return title, URL, text or HTML and links. Optional CSS selector waits for an element; requires an installed Chrome-family browser on Linux/Windows.", {
    url: string, selector: string, format: { type: "string", enum: ["text", "html"] }, timeoutMs: positiveInteger,
  }, ["url"]),
  async run(args, { signal }) {
    const url = new URL(String(args.url));
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Scrape requiere una URL http/https");
    signal.throwIfAborted();
    const view = new Bun.WebView(process.platform === "darwin" ? { backend: "webkit" } : { backend: { type: "chrome", url: false } });
    const controller = new AbortController(), relay = () => controller.abort(signal.reason);
    const timer = setTimeout(() => controller.abort(new Error("Timeout de scraping")), Number(args.timeoutMs ?? 30000));
    signal.addEventListener("abort", relay, { once: true });
    if (signal.aborted) relay();
    let abort = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => { view.close(); reject(controller.signal.reason); };
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
    });
    try {
      const operation = async () => {
        await view.navigate(url.href);
        // Selectors are data; no caller-supplied JavaScript is evaluated.
        const selector = JSON.stringify(String(args.selector ?? "body"));
        const html = args.format === "html";
        const data = await view.evaluate(`(async () => {
          const selector = ${selector};
          let element;
          while (!(element = document.querySelector(selector))) await new Promise(resolve => setTimeout(resolve, 25));
          const links = [...element.querySelectorAll('a[href]')];
          return { url: location.href, title: document.title, content: ${html ? "element.outerHTML" : "element.innerText ?? element.textContent ?? ''"}, linkCount: links.length,
            links: links.slice(0, 25).map(a => ({ text: (a.innerText ?? a.textContent ?? '').slice(0, 100), href: a.href.slice(0, 500) })) };
        })()`) as { url: string; title: string; content: string; linkCount: number; links: { text: string; href: string }[] };
        const content = clip(data.content, 30000), finalUrl = clip(data.url, 2000), title = clip(data.title, 1000);
        const truncated = content !== data.content || finalUrl !== data.url || title !== data.title || data.linkCount > data.links.length;
        return { output: JSON.stringify({ ...data, url: finalUrl, title, content, format: html ? "html" : "text", truncated }), failed: false, truncated };
      };
      return await Promise.race([operation(), cancelled]);
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timer); signal.removeEventListener("abort", relay); controller.signal.removeEventListener("abort", abort);
      view.close();
    }
  },
};
