export interface TokenUsage { input?: number; output?: number; total?: number; requests: number; reported: number; partial: boolean; timedOutput?: number; generationMs?: number }
export interface ProviderUsage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
// Window occupancy is per request, never the accumulated input/output counters.
export interface ContextUsage { providerId: string; modelId: string; window?: number; used?: number; estimated: boolean; inputWeight?: number; inputTokens?: number }
export const emptyUsage = (): TokenUsage => ({ requests: 0, reported: 0, partial: false });
export function addUsage(current: TokenUsage, usage?: ProviderUsage, durationMs?: number): TokenUsage {
  const next = { ...current, requests: current.requests + 1 };
  const valid = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
  let reported = false;
  for (const [field, source] of [["input", "prompt_tokens"], ["output", "completion_tokens"], ["total", "total_tokens"]] as const) {
    const value = usage?.[source];
    if (valid(value)) { next[field] = (next[field] ?? 0) + value; reported = true; }
  }
  next.reported += Number(reported);
  next.partial ||= !valid(usage?.prompt_tokens) || !valid(usage?.completion_tokens);
  // Match the numerator to timed requests only. Never count SSE chunks as tokens.
  if (valid(usage?.completion_tokens) && durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0) {
    next.timedOutput = (next.timedOutput ?? 0) + usage!.completion_tokens!;
    next.generationMs = (next.generationMs ?? 0) + durationMs;
  }
  return next;
}
export function tokensPerSecond(usage?: TokenUsage): number | undefined {
  return usage?.generationMs && usage.timedOutput !== undefined ? usage.timedOutput * 1000 / usage.generationMs : undefined;
}
