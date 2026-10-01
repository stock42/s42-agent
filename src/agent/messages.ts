export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[] | null;
  reasoning_content?: string;
  reasoning?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface Selection { providerId: string; modelId?: string }
