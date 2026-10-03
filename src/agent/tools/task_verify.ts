import { definition, string, type NativeTool } from "./shared.ts";

export const taskVerify: NativeTool = {
  definition: definition("task_verify", "Execute a task's previously planned command through the shared Bun Shell runner, or record a proportional review using evidence IDs from existing successful tools. Records real process exit/output/cancellation and code fingerprints. A printed OK while running does not pass. Failed runs remain in history. Does not mark the task completed.", {
    taskId: string, verificationId: string, evidence: { type: "array", items: string },
  }, ["taskId", "verificationId"]),
  async run(args, { tasks, onOutput }) {
    if (!tasks) throw new Error("task_verify requiere una sesión de tarea");
    const run = args.evidence ? await tasks.review(String(args.taskId), String(args.verificationId), args.evidence as string[])
      : await tasks.verify(String(args.taskId), String(args.verificationId), onOutput);
    return { output: JSON.stringify(run), failed: run.state !== "passed", ...(run.exitCode === undefined ? {} : { exitCode: run.exitCode }) };
  },
};
