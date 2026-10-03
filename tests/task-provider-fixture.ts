import type { TaskCard } from "../src/storage/tasks.ts";

// Protocol fixtures that focus on streaming/recovery still exercise the real
// task tools. Keep their original provider script/count separate from these
// additional plan/review/close messages; there is no runtime bypass.
export function taskWorkflow(expectedCalls: number) {
  let card: TaskCard | undefined, verificationRun = "", started = false, done = false;
  const prefix = `fixture-task-${crypto.randomUUID()}`;
  const observed = new Set<string>();
  const response = (name: string, args: object) => new Response(`data: ${JSON.stringify({ choices: [{ delta: {
    tool_calls: [{ index: 0, id: `${prefix}-${name}`, function: { name, arguments: JSON.stringify(args) } }],
  }, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`);
  return (body: { messages: any[] }, finish?: boolean): Response | undefined => {
    const messages = body.messages;
    for (const message of messages.filter(m => m.role === "tool")) {
      if (message.tool_call_id === `${prefix}-task_plan`) card = JSON.parse(JSON.parse(message.content).output)[0];
      if (message.tool_call_id === `${prefix}-task_verify`) verificationRun = JSON.parse(JSON.parse(message.content).output).id;
      if (message.tool_call_id === `${prefix}-task_update`) done = !JSON.parse(message.content).failed;
      if (!message.tool_call_id.startsWith("fixture-task-") && !JSON.parse(message.content).failed) observed.add(message.tool_call_id);
    }
    // Task IDs and recorded verification IDs survive history compaction in
    // the live system context; the fixture behaves like a tool-capable model.
    if (started) {
      const system = String(messages[0]?.content);
      const cards = /Task IDs, criteria, verification IDs and progress:\n([^\n]+)\n/.exec(system);
      if (!card && cards) card = JSON.parse(cards[1]!)[0];
      const runs = /Verification runs \(original output in session_history\):\n([^\n]+)\n/.exec(system);
      if (!verificationRun && runs && card) verificationRun = JSON.parse(runs[1]!).findLast((v: any) => v.taskId === card!.id && v.state === "passed")?.id ?? "";
    }
    body.messages = messages.filter(m => m.role === "tool" ? !m.tool_call_id.startsWith("fixture-task-") : !m.tool_calls?.some((c: any) => c.id.startsWith("fixture-task-")));
    if (done) return;
    if (!started) { started = true; const user = messages.findLast(m => m.role === "user"); return response("task_plan", { objective: typeof user?.content === "string" ? user.content : "Ejecutar escenario de protocolo", steps: [{ title: "Escenario fixture", criterion: "Resultados reales de las herramientas disponibles",
      verification: [{ kind: "review", description: "Revisar resultados registrados del escenario", required: true, paths: [] }] }] }); }
    if (!card || !(finish ?? observed.size >= expectedCalls)) return;
    if (!verificationRun) return response("task_verify", { taskId: card.id, verificationId: card.verification[0]!.id, evidence: [...observed] });
    return response("task_update", { id: card.id, status: "done", acceptanceEvidence: [verificationRun], result: "Resultados del escenario revisados" });
  };
}
