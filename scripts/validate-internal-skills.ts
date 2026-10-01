import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { defaultConfig } from "../src/storage/config.ts";

// Explicit, optional live QA; never reads or replaces the user's configuration.
const base = Bun.argv[2] ?? "http://127.0.0.1:8080/v1";
const response = await fetch(base + "/models", { signal: AbortSignal.timeout(5000) });
if (!response.ok) throw new Error(`Models HTTP ${response.status}`);
const catalog = await response.json() as { data?: { id: string }[] }, id = catalog.data?.[0]?.id;
if (!id) throw new Error("No hay modelos disponibles");
const root = await mkdtemp(join(tmpdir(), "s42-internal-live-")), started = Date.now();
const messages: string[] = [];
const ws = Bun.serve({ port: 0,
  fetch(req, server) { if (server.upgrade(req)) return; return new Response("upgrade failed", { status: 400 }); },
  websocket: { message(socket, message) { messages.push(String(message)); socket.send(String(message)); } },
});
const config = defaultConfig();
config.providers[0]!.baseUrl = base;
config.providers[0]!.models = [{ id, name: id, contextWindow: 32768, maxOutputTokens: 2048, capabilities: { tools: true, images: false } }];
config.defaults.modelId = id; config.limits.maxSteps = 12;
const configPath = join(root, "config.json"); await Bun.write(configPath, JSON.stringify(config));
await Bun.write(join(root, "AGENTS.md"), "Proyecto temporal de QA. Usar solo las tools internal_skill, markdown_html y websocket solicitadas. No ejecutar shell, crear otros archivos ni modificar esta configuración.");
const app = await App.open({ config: configPath, cwd: root });
const timer = setTimeout(() => app.cancel(), 120000);
try {
  app.view.prompt.setValue(`Validación breve. Ejecutá estas tres tools reales: 1) internal_skill con name=software-project. 2) markdown_html con markdown="# Validación S42\\n\\nDocumento generado con Bun.", outputPath="informe.html", standalone=true. 3) websocket con url="ws://127.0.0.1:${ws.port}/echo", messages=["S42_WS_VERIFIED"], receiveCount=1. No uses otras tools. Al terminar respondé brevemente el resultado real de cada una.`);
  await app.submit(); while (app.busy) await Bun.sleep(50);
  const tools = app.session!.state.events.filter(event => event.type === "tool-start" || event.type === "tool-result");
  const html = await Bun.file(join(root, "informe.html")).text();
  for (const name of ["internal_skill", "markdown_html", "websocket"]) {
    if (!tools.some(event => event.type === "tool-start" && event.name === name)) throw new Error(`El modelo no llamó ${name}`);
  }
  if (tools.some(event => event.type === "tool-result" && event.failed)) throw new Error("Una herramienta falló");
  if (!html.includes("<html>") || !html.includes("Validación S42")) throw new Error("HTML no verificado");
  if (messages[0] !== "S42_WS_VERIFIED") throw new Error("WebSocket no verificó el envío");
  const evidence = { date: new Date().toISOString(), model: id, base, status: app.status, durationSeconds: (Date.now() - started) / 1000,
    tools, html, websocketReceived: messages, response: app.session!.state.messages.at(-1), tokens: app.tabs.find(tab => tab.session === app.session)?.tokens,
    environment: { bun: Bun.version, platform: process.platform, arch: process.arch },
    limits: "Prueba funcional breve de un modelo real; no comparación de inteligencia A/B, QA visual de PDF ni compatibilidad con otros modelos/SO." };
  await Bun.write(resolve(import.meta.dir, "../docs/qa/internal-skills-live.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ model: id, status: app.status, durationSeconds: evidence.durationSeconds, tools: tools.length / 2, tokens: evidence.tokens }));
} finally { clearTimeout(timer); await app.desktop.onBeforeExit!(); ws.stop(true); await rm(root, { recursive: true, force: true }); }
