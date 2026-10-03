import { definition, string, type NativeTool } from "./shared.ts";

export const taskVerify: NativeTool = {
  definition: definition("task_verify", "Execute a task's previously planned command through the shared Bun Shell runner, or record a proportional review using evidence IDs from existing successful tools. Records real process exit/output/cancellation and code fingerprints. A printed OK while running does not pass. Failed runs remain in history. For a browser verification provide actual browser call IDs in evidence, url, steps, expected, observed and passed (false retains a failed scenario; true requires successful observations). Does not mark the task completed.", {
    taskId: string, verificationId: string, evidence: { type: "array", items: string }, url: string, steps: { type: "array", items: string }, expected: string, observed: string, passed: { type: "boolean" },
  }, ["taskId", "verificationId"]),
  async run(args, { tasks, onOutput }) {
    if (!tasks) throw new Error("task_verify requiere una sesión de tarea");
    const run = args.url ? await tasks.browserReview(String(args.taskId), String(args.verificationId), args.evidence as string[] ?? [], { url: String(args.url), steps: args.steps as string[] ?? [], expected: String(args.expected ?? ""), observed: String(args.observed ?? "") }, args.passed === true) : args.evidence ? await tasks.review(String(args.taskId), String(args.verificationId), args.evidence as string[])
      : await tasks.verify(String(args.taskId), String(args.verificationId), onOutput);
    return { output: JSON.stringify(run), failed: run.state !== "passed", ...(run.exitCode === undefined ? {} : { exitCode: run.exitCode }) };
  },
};
