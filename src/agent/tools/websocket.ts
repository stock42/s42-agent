import { definition, positiveInteger, string, type NativeTool } from "./shared.ts";

type Reason = "received" | "closed" | "cancelled" | "error";
export const websocket: NativeTool = {
  definition: definition("websocket", "Test any ws/wss server with Bun WebSocket. Open one connection, send optional text messages, collect receiveCount messages (default 1), then disconnect. Supports headers/subprotocols. Complete binary replies are base64. Runs until the requested replies, remote closure or cancellation.", {
    url: string, headers: { type: "object", additionalProperties: string },
    protocols: { type: "array", items: string }, messages: { type: "array", items: string },
    receiveCount: positiveInteger,
  }, ["url"]),
  async run(args, { signal }) {
    const url = new URL(String(args.url));
    if (!["ws:", "wss:"].includes(url.protocol)) throw new Error("WebSocket requiere ws:// o wss://");
    const receiveCount = Number(args.receiveCount ?? 1);
    const messages = (args.messages ?? []) as string[];
    signal.throwIfAborted();
    return await new Promise(resolve => {
      const socket = new WebSocket(url, { headers: args.headers as Record<string, string> | undefined, protocols: args.protocols as string[] | undefined });
      socket.binaryType = "arraybuffer";
      const received: { type: "text" | "binary"; data: string; bytes: number; truncated: boolean }[] = [];
      let opened = false, sent = 0, finished = false;
      const finish = (reason: Reason, detail: Record<string, unknown> = {}) => {
        if (finished) return;
        finished = true; signal.removeEventListener("abort", cancel);
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        const protocol = socket.protocol;
        socket.terminate();
        resolve({ output: JSON.stringify({ url: url.href, opened, protocol, sent, received, reason, ...detail }), failed: reason !== "received", truncated: false });
      };
      const cancel = () => finish("cancelled");
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) { cancel(); return; }
      socket.onopen = () => {
        opened = true;
        try { for (const message of messages) { socket.send(message); sent++; } }
        catch (error) { finish("error", { error: (error as Error).message }); }
      };
      socket.onmessage = event => {
        const text = typeof event.data === "string", data = text ? Buffer.from(event.data) : Buffer.from(event.data as ArrayBuffer);
        received.push({ type: text ? "text" : "binary", data: text ? data.toString() : data.toString("base64"), bytes: data.length, truncated: false });
        if (received.length >= receiveCount) finish("received");
      };
      socket.onerror = () => finish("error", { error: "WebSocket connection error" });
      socket.onclose = event => finish("closed", { closeCode: event.code, closeReason: event.reason, wasClean: event.wasClean });
    });
  },
};
