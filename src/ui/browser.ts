import { info, form } from "./dialogs.ts";
import { Button } from "./components/button.ts";
import { TextArea } from "./components/text-area.ts";
import type { Desktop } from "./desktop.ts";
import type { BrowserSession } from "../mcp/browser.ts";
interface BrowserContext { desktop: Desktop; owner: string; cwd: string; browser: () => BrowserSession | undefined; configure: () => void; task: <T>(label: string, work: (signal: AbortSignal) => Promise<T>) => Promise<T> }
export function showBrowser(ctx: BrowserContext): void {
  const t = ctx.desktop.t; info(ctx.desktop, t("Chrome / pruebas web"), []); const window = ctx.desktop.modal; if (!window) return;
  const text = window.controls[0] as TextArea;
  const action = (work: () => Promise<void>) => { void work().catch(e => { text.setValue((e as Error).message); }); };
  const buttons = [
    new Button("browser-config", { x: 17, y: 0, width: 14, height: 1 }, "Configurar", () => { ctx.desktop.close(window); ctx.configure(); }),
    new Button("browser-connect", { x: 32, y: 0, width: 12, height: 1 }, "Abrir", () => { ctx.desktop.close(window); form(ctx.desktop, t("Chrome · abrir URL"), [{ label: "URL", value: "about:blank" }], async ([url]) => { await ctx.task("Conectando Chrome…", async signal => { const browser = ctx.browser(); if (!browser) throw new Error("Chrome no configurado; seleccioná un MCP registrado"); await browser.open(signal); const result = await browser.action("new_page", { url }, signal); if (result.failed) throw new Error(result.output); }); return () => showBrowser(ctx); }); }),
    new Button("browser-close", { x: 1, y: 0, width: 16, height: 1 }, "Desconectar", () => action(async () => { await ctx.task("Desconectando Chrome…", async () => { await ctx.browser()?.close(); }); })),
    new Button("browser-pages", { x: 18, y: 0, width: 18, height: 1 }, "Pestañas", () => action(async () => { const result = await ctx.task("Consultando Chrome…", async signal => { const browser = ctx.browser(); if (!browser) throw new Error("Chrome no configurado"); await browser.open(signal); return browser.action("list_pages", {}, signal); }); if (result.failed) throw new Error(result.output); text.setValue(result.output, "start"); })),
  ];
  const layout = window.onLayout!; window.onLayout = client => { layout(client); text.bounds.height = Math.max(1, client.height - 3); for (const [i, button] of buttons.entries()) button.bounds.y = client.height - (i < 2 ? 1 : 2); };
  let prior = ""; window.onDraw = (canvas, client) => { const browser = ctx.browser(); const state = `${t("Proyecto propietario")}: ${ctx.owner}\ncwd: ${ctx.cwd}\n${browser?.server.name ?? t("Sin conexión configurada")} · ${t(({ disconnected: "Desconectado", connecting: "Conectando…", connected: "Conectado", failed: "Fallida" } as const)[browser?.state ?? "disconnected"])}\n${browser ? t(browser.mode === "isolated" ? "Perfil de pruebas separado" : "Chrome existente (explícito)") : ""}\n${browser?.activity ?? ""}\n${browser?.pages ?? ""}\n${browser?.error ?? ""}`; if (state !== prior) { prior = state; text.setValue(state, "start"); } };
  for (const button of buttons) button.translate = t; window.controls.push(...buttons);
}
