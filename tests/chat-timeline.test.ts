import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/app.ts";
import type { Message } from "../src/agent/messages.ts";

test("avisos, fallos antiguos y compactación mantienen su lugar en el chat al reabrir y cambiar idioma", async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-timeline-")), config = join(root, "config.json");
  let app = await App.open({ config, cwd: root });
  try {
    const session = app.session!;
    const message = async (message: Message) => { await session.append({ type: "message", message }); session.state.messages.push(message); };
    const notice = async (text: string) => { await session.append({ type: "notice", text }); session.state.notices.push(text); };
    await message({ role: "user", content: "Pedido anterior" });
    await message({ role: "assistant", content: "Parcial anterior" });
    await notice("Etapa 1 · recuperando respuesta");
    await session.append({ type: "turn", state: "failed", detail: "Proveedor: HTTP 400" });
    session.state.notices.push("Proveedor: HTTP 400");
    await message({ role: "user", content: "Pedido actual" });
    await session.append({ type: "compaction-part", message: { role: "assistant", content: "Resumen", reasoning_content: "Reasoning recibido al compactar" } });
    await message({ role: "assistant", content: "Actividad actual" });
    await notice("Etapa 1 · recuperando respuesta");
    await message({ role: "assistant", content: "Respuesta actual" });
    session.state.notices.push("Adjunto ausente al recuperar");
    app.showHistory();
    const positions = (text: string) => ["Pedido anterior", "Parcial anterior", "Turno fallido:", "HTTP 400", "Pedido actual", "Reasoning recibido al compactar", "Actividad actual", "Respuesta actual"].map(part => text.indexOf(part));
    expect(positions(app.view.response.value).every((position, i, all) => position >= 0 && (!i || position > all[i - 1]!))).toBe(true);
    expect(app.view.response.value.split("HTTP 400")).toHaveLength(2);
    expect(app.view.response.value.split("Etapa 1 · recuperando respuesta")).toHaveLength(3);
    expect(app.view.response.value).toContain("Adjunto ausente al recuperar");
    await app.toggleReasoning(); expect(app.view.response.value).not.toContain("Reasoning recibido al compactar");
    await app.toggleReasoning(); await app.setLanguage("en");
    expect(app.view.response.value).toContain("Turn failed:\nProvider: HTTP 400");
    expect(app.view.response.value).toContain("Stage 1 · recovering response");
    const before = app.view.response.value.replace(/\n\nAdjunto ausente al recuperar$/, "");
    await app.desktop.onBeforeExit!(); app = await App.open({ config, cwd: root });
    expect(app.view.response.value).toBe(before);
    expect(app.session!.state.messages.map(message => message.content)).toEqual(["Pedido anterior", "Parcial anterior", "Pedido actual", "Actividad actual", "Respuesta actual"]);
  } finally { await app.desktop.onBeforeExit!(); await rm(root, { recursive: true, force: true }); }
});
