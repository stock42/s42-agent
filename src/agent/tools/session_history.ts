import { definition, positiveInteger, string, type NativeTool } from "./shared.ts";

export const sessionHistory: NativeTool = {
  definition: definition("session_history", "Recover original messages from the current session, including answers and tool results omitted by compaction. Search before repeating research or downloads. query is a case-insensitive literal match over the full message JSON; role optionally filters user, assistant or tool. offset/limit select matching messages (1-based); no limit returns all matches. Returns complete messages with their original 1-based index; does not access other sessions or the network.", {
    query: string, role: { type: "string", enum: ["user", "assistant", "tool"] }, offset: positiveInteger, limit: positiveInteger,
  }, []),
  async run(args, { history, signal }) {
    if (!history) throw new Error("Historial de sesión no disponible en este contexto");
    const query = String(args.query ?? "").toLowerCase(), offset = Number(args.offset ?? 1);
    const messages = []; let totalMatches = 0;
    for (const [index, message] of history.entries()) {
      signal.throwIfAborted();
      if (args.role && message.role !== args.role) continue;
      if (query && !JSON.stringify(message).toLowerCase().includes(query)) continue;
      totalMatches++;
      if (totalMatches >= offset && (args.limit === undefined || messages.length < Number(args.limit))) messages.push({ index: index + 1, message });
    }
    return { output: JSON.stringify({ totalMessages: history.length, totalMatches, offset, messages, truncated: false }), failed: false, truncated: false };
  },
};
