import { definition, string, type NativeTool } from "./shared.ts";
import type { PlannedTask } from "../tasks.ts";

export const taskPlan: NativeTool = {
  definition: definition("task_plan", "Register or refine an execution plan in TODO.md before mutations or shell. Every step needs an observable criterion and proportional planned verification. Returns stable request/task/verification IDs. Informational answers do not need a plan. Does not execute implementation or checks.", {
    objective: string, mode: { type: "string", enum: ["execution", "planning"] }, steps: { type: "array", items: { type: "object", properties: {
      id: string, title: string, description: string, criterion: string, dependencies: { type: "array", items: string },
      verification: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["command", "review", "browser"] }, description: string, command: string, required: { type: "boolean" }, paths: { type: "array", items: string } }, required: ["kind", "description", "required", "paths"], additionalProperties: false } },
    }, required: ["title", "criterion", "verification"], additionalProperties: false } },
  }, ["objective", "steps"]),
  async run(args, { tasks }) {
    if (!tasks) throw new Error("task_plan requiere una sesión de tarea");
    const steps = args.steps as PlannedTask[];
    if (!Array.isArray(steps) || steps.some(step => !step || typeof step.title !== "string" || typeof step.criterion !== "string"
      || step.id !== undefined && typeof step.id !== "string" || step.description !== undefined && typeof step.description !== "string"
      || step.dependencies !== undefined && (!Array.isArray(step.dependencies) || step.dependencies.some(id => typeof id !== "string"))
      || Object.keys(step).some(key => !["id", "title", "description", "criterion", "dependencies", "verification"].includes(key)))) throw new Error("Etapas inválidas");
    return { output: JSON.stringify(await tasks.plan(String(args.objective), steps, args.mode as "execution" | "planning" | undefined)), failed: false };
  },
};
