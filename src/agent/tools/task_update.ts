import { definition, string, type NativeTool } from "./shared.ts";

export const taskUpdate: NativeTool = {
  definition: definition("task_update", "Update an active task's progress, result or concrete blocker. Completion requires acceptanceEvidence referring to recorded successful tool call IDs or verification run IDs, plus every required check. A blocker leaves the task open. Cannot create human confirmations or verification results.", {
    id: string, status: { type: "string", enum: ["pending", "doing", "done"] }, result: string, blocked: string, acceptanceEvidence: { type: "array", items: string },
  }, ["id"]),
  async run(args, { tasks }) {
    if (!tasks) throw new Error("task_update requiere una sesión de tarea");
    const { id, ...values } = args;
    return { output: JSON.stringify(await tasks.update(String(id), values)), failed: false };
  },
};
