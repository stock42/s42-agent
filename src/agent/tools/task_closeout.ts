import { closeout } from "../closeout.ts";
import { definition, string, type NativeTool } from "./shared.ts";
export const taskCloseout: NativeTool = {
  definition: definition("task_closeout", "Close the active verified task: select only its files, inspect the selected diff, update CHANGELOG if project instructions require it, commit using a separate index preserving unrelated staging, and record SHA. Mixed pre-existing files block with a concrete error. A failed hook leaves work intact. Retry recovers an existing commit instead of duplicating it. Push only when the active project's policy authorizes it; no force/reset.", { files: { type: "array", items: string }, message: string, summary: string, push: { type: "boolean" } }, ["files", "message", "summary"]),
  async run(args, { tasks }) { if (!tasks) throw new Error("task_closeout requiere sesión de tarea"); const result = await closeout(tasks, { files: args.files as string[], message: String(args.message), summary: String(args.summary), push: args.push as boolean | undefined }); return { output: JSON.stringify(result), failed: result.state === "failed" || result.state === "unavailable" }; },
};
