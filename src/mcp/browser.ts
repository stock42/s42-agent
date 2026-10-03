import { McpConnections } from "./client.ts";
import type { McpServer } from "../storage/config.ts";
import type { ToolDefinition } from "../llm/client.ts";
import type { ToolResult } from "../agent/tools.ts";
export class BrowserSession {
  private connections = new McpConnections();
  state: "disconnected" | "connecting" | "connected" | "failed" = "disconnected";
  activity = ""; pages = ""; error = "";
  constructor(readonly server: McpServer, readonly cwd: string, readonly artifacts: string, readonly mode: "isolated" | "existing" = "isolated", private changed: () => void = () => {}) {}
  async open(signal: AbortSignal, progress: (text: string) => void = () => {}): Promise<void> {
    if (this.state === "connected") return;
    this.state = "connecting"; this.error = ""; this.changed();
    try {
      const server = structuredClone(this.server);
      if (this.mode === "isolated") {
        if (server.transport !== "stdio") throw new Error("Perfil aislado requiere Chrome DevTools MCP stdio; conexión externa requiere selección explícita");
        const args = server.args ?? [];
        if (args.some(a => ["-u", "-w", "--isolated=false"].includes(a) || /^(?:--(?:browser[-]?url|ws[-]?endpoint|auto[-]?connect|user[-]?data[-]?dir))(?:=|$)/i.test(a))) throw new Error("La configuración apunta a Chrome existente; elegí esa conexión explícitamente o registrá un servidor aislado");
        if (!args.includes("--isolated")) args.push("--isolated"); server.args = args;
      }
      await this.connections.open([server], this.cwd, signal, text => { progress(text); this.error = text; }, this.artifacts);
      const tools = await this.connections.definitions(signal);
      if (!tools.some(t => t.function.name.includes("take_snapshot")) || !tools.some(t => t.function.name.includes("new_page"))) throw new Error(this.error || "El servidor no expone las capacidades Chrome DevTools requeridas");
      this.state = "connected"; this.error = "";
    } catch (e) { this.state = "failed"; this.error = (e as Error).message; await this.connections.close(); throw e; }
    finally { this.changed(); }
  }
  async definitions(signal: AbortSignal): Promise<ToolDefinition[]> { return this.state === "connected" ? this.connections.definitions(signal) : []; }
  has(name: string): boolean { return this.connections.has(name); }
  async execute(name: string, args: string, signal: AbortSignal): Promise<ToolResult> {
    if (this.state !== "connected") return { output: "Chrome desconectado", failed: true, durationMs: 0 };
    this.activity = name; this.changed();
    try { const result = await this.connections.execute(name, args, signal); this.error = result.failed ? result.output : ""; if (!this.connections.alive) { this.state = "failed"; await this.connections.close(); } if (/Pages|\[selected\]/.test(result.output)) this.pages = result.output; return result; }
    finally { this.activity = ""; this.changed(); }
  }
  async action(tool: string, args: object, signal: AbortSignal): Promise<ToolResult> {
    const definition = (await this.definitions(signal)).find(t => t.function.name.includes(`_${tool}_`));
    if (!definition) throw new Error(`Chrome tool no disponible: ${tool}`); return this.execute(definition.function.name, JSON.stringify(args), signal);
  }
  async close(): Promise<void> { await this.connections.close(); this.state = "disconnected"; this.activity = ""; this.pages = ""; this.changed(); }
}
export const browserOpenDefinition: ToolDefinition = { type: "function", function: { name: "browser_open", description: "Open the optional Chrome DevTools MCP test connection owned by this project. Call only for an authorized web test after task_plan. Subsequent iterations expose actual server tools. Connection persists across TUI turns until disconnect/project close; this does not change the project cwd. If URL is given opens a test page. No software installation or dev server startup.", parameters: { type: "object", properties: { url: { type: "string" } }, additionalProperties: false } } };
