/** Standing LLM instructions. Storage: `talk-to-jev:llm-instructions`. Never store keys. */

export const LLM_INSTRUCTIONS_KEY = "talk-to-jev:llm-instructions";
export const LLM_INSTRUCTIONS_MAX = 8_000;

export function normalizeLlmInstructions(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, LLM_INSTRUCTIONS_MAX);
}

export function readLlmInstructions(): string {
  try {
    return normalizeLlmInstructions(localStorage.getItem(LLM_INSTRUCTIONS_KEY));
  } catch {
    return "";
  }
}

/** Trimmed persist. Empty / whitespace removes the key (off). Returns what was stored. */
export function writeLlmInstructions(raw: string): string {
  const next = normalizeLlmInstructions(raw);
  try {
    if (!next) localStorage.removeItem(LLM_INSTRUCTIONS_KEY);
    else localStorage.setItem(LLM_INSTRUCTIONS_KEY, next);
  } catch {
    /* private mode / quota */
  }
  return next;
}
