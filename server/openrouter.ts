/** Shared OpenRouter call bits. Never log the key. */

export const DEFAULT_JEV = "typesafe/jev-1.13";
export const DEFAULT_LLM = "deepseek/deepseek-v4-flash";
export const OPENROUTER_REFERER = "http://127.0.0.1:5182";
export const OPENROUTER_TITLE = "Talk to Jev";

export function openRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": OPENROUTER_REFERER,
    "X-Title": OPENROUTER_TITLE,
  };
}
