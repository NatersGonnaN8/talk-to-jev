/** Shared OpenRouter call bits. Never log the key. */

export const DEFAULT_JEV = "typesafe/jev-1.13";
export const DEFAULT_LLM = "deepseek/deepseek-v4-flash";
export const OPENROUTER_REFERER = "http://127.0.0.1:5182";
export const OPENROUTER_TITLE = "Talk to Jev";

/**
 * Where OpenRouter lives. TEST ONLY override: JEV_OPENROUTER_BASE points the
 * server at a mock so tests never send a key to the real network. Unset in
 * production (the default is the real origin).
 */
export function openRouterBase(): string {
  const raw = (process.env.JEV_OPENROUTER_BASE ?? "").trim();
  if (!raw) return "https://openrouter.ai";
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
  } catch {
    /* fall through */
  }
  return "https://openrouter.ai";
}

export function openRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": OPENROUTER_REFERER,
    "X-Title": OPENROUTER_TITLE,
  };
}
