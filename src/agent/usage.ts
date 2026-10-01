export interface TokenUsage { input?: number; output?: number; total?: number; requests: number; reported: number; partial: boolean }
export interface ProviderUsage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
export const emptyUsage = (): TokenUsage => ({ requests: 0, reported: 0, partial: false });
export function addUsage(current: TokenUsage, usage?: ProviderUsage): TokenUsage {
  const next = { ...current, requests: current.requests + 1 };
  const valid = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
  let reported = false;
  for (const [field, source] of [["input", "prompt_tokens"], ["output", "completion_tokens"], ["total", "total_tokens"]] as const) {
    const value = usage?.[source];
    if (valid(value)) { next[field] = (next[field] ?? 0) + value; reported = true; }
  }
  next.reported += Number(reported);
  next.partial ||= !valid(usage?.prompt_tokens) || !valid(usage?.completion_tokens);
  return next;
}
