// Compatibility entrypoint for existing integrations.
export { execute, instructions, toolDefinitions, nativeTools } from "./tools/index.ts";
export type { ToolResult, ToolContext } from "./tools/shared.ts";
