import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, toolDefinitions } from "../src/agent/tools.ts";
import { runTurn } from "../src/agent/loop.ts";
import type { Message } from "../src/agent/messages.ts";
import type { Model, Provider } from "../src/storage/config.ts";
import { Session } from "../src/storage/sessions.ts";
import { translate } from "../src/ui/i18n.ts";

test("session_history recupera texto completo, filtra sin mutar y usa solo la sesión recibida", async () => {
  const history: Message[] = [
    { role: "user", content: "Resumen de noticias" },
    { role: "tool", tool_call_id: "source", content: "https://example.com/á文🙂 " + "contenido ".repeat(20000) },
    { role: "assistant", content: "Resumen á文🙂", reasoning_content: "Decisión conservada" },
  ];
  const original = structuredClone(history);
  const run = (args: object, messages = history, signal = new AbortController().signal) => execute("session_history", JSON.stringify(args), "/tmp", signal, undefined, messages);
  const result = await run({ query: "EXAMPLE.COM", role: "tool" });
  expect(result.failed).toBe(false); expect(result.truncated).toBe(false);
  expect(JSON.parse(result.output).messages).toEqual([{ index: 2, message: original[1] }]);
  expect(JSON.parse((await run({ query: "resumen", offset: 2, limit: 1 })).output)).toMatchObject({ totalMatches: 2, messages: [{ index: 3, message: original[2] }] });
  expect(JSON.parse((await run({ query: "Decisión" })).output).messages[0].message.reasoning_content).toBe("Decisión conservada");
  expect(JSON.parse((await run({}, [])).output).messages).toEqual([]);
  expect(JSON.parse((await run({ query: "missing" })).output).totalMatches).toBe(0);
  expect(history).toEqual(original);
  for (const args of [{ limit: 0 }, { offset: -1 }, { role: "system" }, { query: 1 }, { sessionId: "another" }]) expect((await run(args)).failed).toBe(true);
  expect((await execute("session_history", "{}", "/tmp", new AbortController().signal)).failed).toBe(true);
  const controller = new AbortController(); controller.abort(new Error("cancelled-history"));
  expect((await run({}, history, controller.signal)).output).toBe("cancelled-history");
  for (const name of ["fetch", "scrape", "shell", "session_history"]) {
    const description = toolDefinitions.find(t => t.function.name === name)!.function.description;
    expect(translate(description, "es")).not.toBe(description); expect(translate(description, "en")).toBe(description);
  }
});

for (const storage of ["sessions", "agent.sqlite"]) test(`resumen → CSV → HTML recupera fuentes compactadas y archivo actual tras reabrir ${storage}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "s42-followup-")), path = join(root, storage);
  let session = await Session.open(path, "project"), sourceRequests = 0, step = 0;
  let workflow: ReturnType<typeof taskWorkflow> | undefined;
  const fragments: string[] = [];
  const article = { title: "Noticia á文🙂", category: "Sociedad", link: "https://example.com/noticia-original", resumen: "Resumen ya entregado" };
  const answer = `${article.title}: ${article.resumen}`;
  const source = Bun.serve({ port: 0, fetch() { sourceRequests++; return Response.json(article); } });
  const packet = (delta: unknown, usage: unknown = { prompt_tokens: 1000, completion_tokens: 100 }) => new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: "stop" }], usage })}\n\ndata: [DONE]\n\n`);
  const call = (name: string, args: object) => packet({ tool_calls: [{ index: 0, id: `call-${step}`, function: { name, arguments: JSON.stringify(args) } }] });
  const csv = (title: string) => `title,category,link,resumen\n${title},${article.category},${article.link},${article.resumen}\n`;
  const bodies: { messages: Message[]; tools: typeof toolDefinitions }[] = [];
  const server = Bun.serve({ port: 0, error: error => new Response(error.message, { status: 500 }), async fetch(req) {
    const body = await req.json() as typeof bodies[number]; bodies.push(body);
    if (String(body.messages[0]!.content).startsWith("Compactá TODO")) {
      fragments.push(JSON.stringify(body.messages));
      return packet({ content: "Resumen de noticias entregado. Faltan URLs en este checkpoint; recuperar fuentes con session_history query example.com y role tool." });
    }
    if (workflow) { const flow = workflow(body, step === 4 || step === 7); if (flow) return flow; }
    const last = body.messages.at(-1)!;
    step++;
    switch (step) {
      case 1:
        expect(body.tools.map(t => t.function.name)).toEqual(expect.arrayContaining(["fetch", "scrape", "session_history"]));
        return call("fetch", { url: source.url.href });
      case 2:
        expect(last.role).toBe("tool"); expect(last.content).toContain(article.link);
        // The fixture reports occupancy near the window after delivering the answer.
        return packet({ content: answer }, { prompt_tokens: 10400, completion_tokens: 100 });
      case 3:
        expect(body.messages.map(m => JSON.stringify(m)).join("\n")).toContain("Guardá ese resumen en infobae.csv: title, category, link, resumen");
        expect(body.messages.some(m => m.content === answer)).toBe(false);
        return call("session_history", { query: "example.com", role: "tool" });
      case 4: {
        const restored = JSON.parse(JSON.parse(String(last.content)).output);
        expect(restored.messages).toHaveLength(1);
        const originalResult = JSON.parse(restored.messages[0].message.content);
        const originalArticle = JSON.parse(JSON.parse(originalResult.output).body);
        expect(originalArticle).toEqual(article);
        return call("write", { path: "infobae.csv", content: csv(originalArticle.title) });
      }
      case 5: return packet({ content: "Guardado infobae.csv con el resumen anterior." });
      case 6:
        expect(body.messages.map(m => JSON.stringify(m)).join("\n")).toContain("Creá infobae.html con el CSV");
        expect(session.state.messages.some(m => m.content === "Guardado infobae.csv con el resumen anterior.")).toBe(true);
        expect(session.state.messages.some(m => m.tool_calls?.some(c => c.function.name === "write" && c.function.arguments.includes("infobae.csv")))).toBe(true);
        return call("read", { path: "infobae.csv" });
      case 7: {
        const read = JSON.parse(String(last.content)).output;
        expect(read).toContain("Título editado en disco á文🙂");
        return call("write", { path: "infobae.html", content: `<!doctype html><meta charset="utf-8"><pre>${read}</pre>` });
      }
      case 8: return packet({ content: "HTML creado desde el CSV actual." });
      default: throw new Error(`Unexpected provider request ${step}`);
    }
  } });
  const model: Model = { id: "fixture", name: "Fixture", manual: true, contextWindow: 12000, capabilities: { tools: true, images: false } };
  const provider: Provider = { id: "fixture", name: "Fixture", kind: "openai-compatible", baseUrl: server.url.href, models: [model] };
  const turn = async (content: string) => {
    workflow = content.startsWith("Dame") ? undefined : taskWorkflow(2);
    const message: Message = { role: "user", content };
    await session.append({ type: "message", message }); session.state.messages.push(message);
    await runTurn({ project: { id: "project", name: "Fixture", path: root }, session, provider, model, signal: new AbortController().signal, onDelta: () => {}, onState: () => {}, onMessage: () => {} });
  };
  const reopen = async () => { const id = session.state.id; await session.close(); session = await Session.open(path, "project", id); };
  try {
    await turn("Dame un resumen de las noticias");
    expect(fragments.length).toBeGreaterThan(0); expect(fragments.join("")).toContain(article.link); expect(fragments.join("")).toContain(answer);
    expect(session.state.compaction).toBeDefined(); expect(session.state.messages.at(-1)!.content).toBe(answer);
    await reopen(); await turn("Guardá ese resumen en infobae.csv: title, category, link, resumen");
    expect(await Bun.file(join(root, "infobae.csv")).text()).toBe(csv(article.title));
    await Bun.write(join(root, "infobae.csv"), csv("Título editado en disco á文🙂"));
    await reopen(); await turn("Creá infobae.html con el CSV");
    expect(await Bun.file(join(root, "infobae.html")).text()).toContain("Título editado en disco á文🙂");
    expect(sourceRequests).toBe(1); expect(step).toBe(8);
    expect(session.state.events.filter(e => e.type === "tool-start" && !e.name.startsWith("task_")).map(e => e.type === "tool-start" && e.name)).toEqual(["fetch", "session_history", "write", "read", "write"]);
    expect(session.state.messages.some(m => m.content === answer)).toBe(true);
  } finally { await session.close(); source.stop(true); server.stop(true); await rm(root, { recursive: true, force: true }); }
});
import { taskWorkflow } from "./task-provider-fixture.ts";
