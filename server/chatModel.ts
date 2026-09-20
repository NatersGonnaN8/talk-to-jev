/** OpenRouter chat ids for `/api/llm`. Never Jev. */

export const CHAT_MODEL_MAX = 160;
export const CHAT_MODEL_RE =
  /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:+-]*$/i;
const FALLBACK_LLM = "deepseek/deepseek-v4-flash";

export function isJevModelId(id: string): boolean {
  return /^typesafe\/jev(\b|[/-:]|$)/i.test(id.trim());
}

/** Valid OpenRouter chat slug, or empty. Rejects Jev. */
export function normalizeChatModel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  if (!id || id.length > CHAT_MODEL_MAX) return "";
  if (!CHAT_MODEL_RE.test(id)) return "";
  if (isJevModelId(id)) return "";
  return id;
}

export function resolveChatModel(requested: unknown, fallback: string): string {
  return (
    normalizeChatModel(requested) ||
    normalizeChatModel(fallback) ||
    FALLBACK_LLM
  );
}

