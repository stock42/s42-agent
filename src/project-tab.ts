import type { Message, Selection } from "./agent/messages.ts";
import type { Attachment } from "./agent/attachments.ts";
import type { Project } from "./storage/config.ts";
import type { Session } from "./storage/sessions.ts";
import { Button } from "./ui/components/button.ts";
import { TextArea } from "./ui/components/text-area.ts";
import type { TokenUsage } from "./agent/usage.ts";

export interface ProjectTab {
  id: string; project?: Project; session?: Session;
  selection: Selection; status: string; busy: boolean; attachments: Attachment[];
  mode: "INSERT" | "NORMAL"; pending: string; pasting: boolean;
  turn?: Promise<void>; controller?: AbortController;
  rendered: WeakMap<Message, string>;
  response: TextArea; prompt: TextArea; send: Button;
  panel: "editor" | "prompt"; focusedId?: string;
  tokens?: TokenUsage;
  live: { id: string; label: string; text: string; reasoning: boolean }[];
}

export function createProjectTab(controls?: Pick<ProjectTab, "response" | "prompt" | "send">): ProjectTab {
  const response = controls?.response ?? new TextArea("response", { x: 1, y: 1, width: 76, height: 12 });
  response.readOnly = true;
  return { id: crypto.randomUUID(), selection: { providerId: "llama.cpp" }, status: "Listo", busy: false,
    attachments: [], mode: "INSERT", pending: "", pasting: false, rendered: new WeakMap(), panel: "prompt", live: [],
    response, prompt: controls?.prompt ?? new TextArea("draft", { x: 1, y: 0, width: 60, height: 4 }),
    send: controls?.send ?? new Button("send", { x: 63, y: 0, width: 14, height: 1 }, "Enviar", () => {}) };
}
