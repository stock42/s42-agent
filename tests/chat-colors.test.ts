import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "../src/app.ts";
import { theme, type Style } from "../src/ui/theme.ts";

async function until(check: () => boolean) {
  for (let i = 0; i < 600; i++) { if (check()) return; await Bun.sleep(5); }
  throw new Error("No apareció el mensaje esperado");
}
function labelStyles(app: App, label: string): Style[] {
  const canvas = app.desktop.draw(), rect = app.view.editorWindow.client;
  return canvas.lines().slice(rect.y, rect.y + rect.height).flatMap((line, row) => {
    const x = line.indexOf(label); return x < 0 ? [] : [canvas.cells[rect.y + row]![x]!.style];
  });
}

test("autores en historial/stream, texto literal sin colorear, selección, ES/EN y reapertura real de index.ts", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-chat-colors-")), config = join(root, "config.json");
  const encoder = new TextEncoder(), event = (delta: unknown, finish_reason?: string) => encoder.encode(`data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`);
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const server = Bun.serve({ port: 0, fetch() {
    return new Response(new ReadableStream({ start(c) { controller = c; } }));
  } });
  const app = await App.open({ config, cwd: root }); let closed = false;
  try {
    const next = structuredClone(app.store.value);
    next.providers[0]!.baseUrl = `http://127.0.0.1:${server.port}/v1`;
    next.providers[0]!.models = [{ id: "fixture", name: "Fixture", manual: true, contextWindow: 32000, maxOutputTokens: 1000, capabilities: { tools: false, images: false } }];
    await app.store.save(next); await app.selectModel({ providerId: next.providers[0]!.id, modelId: "fixture" });
    app.desktop.resize(100, 32);
    const prompt = "Agente:\ntexto á文🙂\tfin", answer = "Vos:\nrespuesta á文🙂";
    app.view.prompt.setValue(prompt); await app.submit(); await until(() => Boolean(controller));
    expect(labelStyles(app, "Vos:")).toEqual([theme.chatUser]);
    expect(labelStyles(app, "Agente:")).toEqual([theme.window, theme.chatAgent]); // Literal in body, activity label.
    controller!.enqueue(event({ reasoning_content: "Analizo el pedido" }));
    await until(() => app.view.response.value.includes("Analizo el pedido"));
    expect(labelStyles(app, "Razonamiento:")).toEqual([theme.chatAgent]);
    controller!.enqueue(event({ content: answer })); await until(() => app.view.response.value.includes("respuesta"));
    expect(labelStyles(app, "Vos:")).toEqual([theme.chatUser, theme.window]);
    expect(labelStyles(app, "Agente:")).toEqual([theme.window, theme.chatAgent, theme.chatAgent]);
    await app.toggleReasoning(); expect(app.view.response.value).not.toContain("Analizo el pedido");
    expect(labelStyles(app, "Vos:")).toEqual([theme.chatUser, theme.window]);
    await app.toggleReasoning(); await app.setLanguage("en");
    expect(labelStyles(app, "You:")).toEqual([theme.chatUser]);
    expect(labelStyles(app, "Agent:")).toEqual([theme.chatAgent, theme.chatAgent]);
    expect(labelStyles(app, "Agente:")).toEqual([theme.window]); expect(labelStyles(app, "Vos:")).toEqual([theme.window]);
    controller!.enqueue(event({}, "stop")); controller!.enqueue(encoder.encode("data: [DONE]\n\n")); controller!.close(); await app.tabs[0]!.turn;
    const original = app.view.response.value;
    expect(labelStyles(app, "Agent:")).toEqual([theme.chatAgent]);
    for (const [width, height] of [[60, 16], [100, 32]] as const) {
      app.desktop.resize(width, height); app.desktop.focus(app.view.editorWindow); app.desktop.handle({ type: "key", key: "ctrl+home" });
      expect(labelStyles(app, "You:")).toEqual([theme.chatUser]); expect(app.view.response.value).toBe(original);
    }
    app.desktop.handle({ type: "key", key: "ctrl+a" });
    expect(labelStyles(app, "You:")).toEqual([theme.selected]); expect(labelStyles(app, "Agent:")).toEqual([theme.selected]);
    app.desktop.handle({ type: "paste", text: "no editar" }); expect(app.view.response.value).toBe(original);
    expect(app.session!.state.messages.map(m => m.content)).toEqual([prompt.replace(/\t/g, "    "), answer]);
    const sessionPath = app.session!.path;
    await app.desktop.onBeforeExit!(); closed = true;
    expect(await Bun.file(sessionPath).text()).not.toContain("\\u001b");

    let output = "";
    const terminal = new Bun.Terminal({ cols: 100, rows: 32, data: (_, bytes) => { output += new TextDecoder().decode(bytes); } });
    const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "../index.ts"), "--config", config], {
      cwd: root, terminal, env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", NO_COLOR: undefined },
    });
    try {
      await until(() => output.includes("respuesta"));
      expect(output).toContain("\x1b[38;2;255;255;85;48;2;0;0;170m\x1b[1mYou:");
      expect(output).toContain("\x1b[38;2;85;255;255;48;2;0;0;170m\x1b[1mAgent:");
      expect(Bun.stripANSI(output)).toContain("Agente:"); expect(Bun.stripANSI(output)).toContain("Vos:");
      terminal.write("\x11"); expect(await child.exited).toBe(0);
    } finally { child.kill(); await child.exited; terminal.close(); }
  } finally { if (!closed) await app.desktop.onBeforeExit!(); server.stop(true); await rm(root, { recursive: true, force: true }); }
}, 15000);
