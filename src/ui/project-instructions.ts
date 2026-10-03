import { join, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { files } from "../agent/tools/shared.ts";
import { complete, CompletionError, runtimeModel } from "../llm/client.ts";
import type { Model, Provider } from "../storage/config.ts";
import { theme } from "./theme.ts";
import { info } from "./dialogs.ts";
import { Button } from "./components/button.ts";
import { TextArea } from "./components/text-area.ts";
import type { Desktop } from "./desktop.ts";

const start = "<!-- s42:project-instructions -->", end = "<!-- /s42:project-instructions -->";
const rules = "Siempre mantener actualizado CHANGELOG.md luego de cada tarea.\n\nSiempre hacer commit al terminar la tarea.\n\nRegistrar solo cambios efectivamente realizados. Validar y revisar el diff; incluir CHANGELOG.md en el mismo commit y agregar exclusivamente el trabajo de la tarea, preservando cambios e índice ajenos. Una consulta sin cambios no genera entrada ni commit vacío. Si falla el commit, el cierre sigue pendiente. Conservar las reglas de pull/push y rama de este proyecto; no añadir push sin autorización.";
export interface ProjectInspection { cwd: string; previous: string; context: string; conflicts: string[] }
export async function inspectProject(cwd: string, signal: AbortSignal): Promise<ProjectInspection> {
  const file = Bun.file(join(cwd, "AGENTS.md")), previous = await file.exists() ? await file.text() : "";
  const listing = (await readdir(cwd, { withFileTypes: true })).filter(e => ![".git", "node_modules", "dist", "private"].includes(e.name)).map(e => `${e.name}${e.isDirectory() ? "/" : ""}`);
  const context = [`Folder: ${cwd}`, `Root entries:\n${listing.join("\n")}`];
  for (const name of ["package.json", "Cargo.toml", "pyproject.toml", "Makefile", "go.mod", "README.md"]) {
    signal.throwIfAborted(); const source = Bun.file(join(cwd, name)); if (await source.exists()) context.push(`${name}:\n${await source.text()}`);
  }
  for await (const path of files(cwd, signal)) if (path.endsWith("/AGENTS.md")) context.push(`${relative(cwd, path)} (retain scope):\n${await Bun.file(path).text()}`);
  const unmanaged = previous.replace(/<!-- s42:project-instructions -->[\s\S]*?<!-- \/s42:project-instructions -->\s*/g, "").trimEnd();
  const conflicts = unmanaged.split("\n").filter(line => /(?:no|never|do not|don't|sin)[^\n]*(?:commit|CHANGELOG)/i.test(line));
  return { cwd, previous, context: context.join("\n\n"), conflicts };
}
export function instructionsDraft(previous: string, generated: string): string {
  const original = previous.replace(/<!-- s42:project-instructions -->[\s\S]*?<!-- \/s42:project-instructions -->\s*/g, "").trimEnd();
  const content = generated.replace(/^```(?:markdown|md)?\s*\n|\n```\s*$/g, "").trim();
  return `${original ? original + "\n\n" : ""}${start}\n## Proyecto y flujo de trabajo\n\n${content}\n\n## Cierre de tareas\n\n${rules}\n${end}\n`;
}
export function instructionsDiff(previous: string, next: string): string { return `--- AGENTS.md (anterior)\n+++ AGENTS.md (preview)\n@@ documento @@\n${previous.split("\n").map(s => `-${s}`).join("\n")}\n${next.split("\n").map(s => `+${s}`).join("\n")}`; }
export async function applyInstructions(inspection: ProjectInspection, draft: string): Promise<void> {
  const path = join(inspection.cwd, "AGENTS.md"), current = await Bun.file(path).exists() ? await Bun.file(path).text() : "";
  if (current !== inspection.previous) throw new Error("AGENTS.md cambió fuera del preview; regenerá para conservar ambas versiones");
  await Bun.write(path, draft);
}
export async function generateInstructions(inspection: ProjectInspection, provider: Provider, model: Model, key: string | undefined, signal: AbortSignal, delta: (text: string) => void): Promise<string> {
  const actual = await runtimeModel(provider, model, key, signal);
  const result = await complete({ provider, model: actual, key, signal, onDelta: delta, messages: [
    { role: "system", content: "Generá instrucciones breves de proyecto en español usando solo la evidencia adjunta. Describí stack, carpetas, entrypoints, scripts/comandos realmente declarados, convenciones y planificación por etapas con verificación proporcional. No ejecutes scripts ni inventes tests o capacidades. Las instrucciones existentes se conservarán fuera de tu sección: no las dupliques ni agregues políticas de rama, pull, push, commit o changelog; el harness agregará el cierre pedido. No incluyas bloques de código delimitadores ni secretos." },
    { role: "user", content: inspection.context },
  ] });
  if (result.finishReason === "length") throw new CompletionError("Generación interrumpida por la capacidad del proveedor; revisá el borrador parcial", result.message, "length");
  return typeof result.message.content === "string" ? result.message.content : "";
}
export function previewInstructions(desktop: Desktop, inspection: ProjectInspection, draft: string, error = "", applied?: () => void): void {
  info(desktop, desktop.t("AGENTS.md · preview"), [draft]); const window = desktop.modal; if (!window) return;
  const text = window.controls[0] as TextArea; let diff = false; const saved = { value: draft };
  const toggle = new Button("instructions-diff", { x: 17, y: window.client.height - 1, width: 13, height: 1 }, "Diff / editar", () => {
    if (!diff) saved.value = text.value; diff = !diff; text.readOnly = diff; text.setValue(diff ? instructionsDiff(inspection.previous, saved.value) : saved.value, "start");
  }); text.readOnly = false;
  const apply = new Button("instructions-apply", { x: 31, y: window.client.height - 1, width: 15, height: 1 }, "Aplicar", () => {
    apply.disabled = true;
    void applyInstructions(inspection, diff ? saved.value : text.value).then(() => { applied?.(); desktop.close(window); }, e => { error = (e as Error).message; }).finally(() => { apply.disabled = false; desktop.invalidate(); });
  });
  const inherited = window.onLayout!; window.onLayout = client => { inherited(client); toggle.bounds.y = apply.bounds.y = client.height - 1; };
  const draw = window.onDraw; window.onDraw = (canvas, client) => { draw?.(canvas, client); if (error || inspection.conflicts.length) canvas.text(client.x + 1, client.y + client.height - 2, error || `Conflicto: ${inspection.conflicts.join(" · ")}`, theme.dialog, client.width - 2); };
  const original = text.handle.bind(text); text.handle = event => event.type === "key" && event.key === "enter" ? TextArea.prototype.handle.call(text, event) : original(event);
  for (const button of [toggle, apply]) button.translate = desktop.t; window.controls.push(toggle, apply);
}
