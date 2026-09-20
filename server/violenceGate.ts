/**
 * Mill violence gate. Jev has no conscience — never hand it this class.
 * Matcher only; no graphic examples in comments.
 */

export const VIOLENCE_GATE_CODE = "blocked-violence";

export const VIOLENCE_GATE_MESSAGE =
  "These questions are not allowed. Use operator-appropriate options — no violence.";

export const VIOLENCE_GATE_TOOL_MESSAGE =
  "Rejected. Write operator-appropriate questions. Do not list violence as options.";

const BLOCKED: RegExp[] = [
  /\brape[sd]?\b/u,
  /\braping\b/u,
  /\brapist\b/u,
  /\bsexual assault/u,
  /\bsexually assault/u,
  /\bsexual violence/u,
  /\bsexual exploitation/u,
  /\bchild sexual/u,
  /\bcsam\b/u,
  /\bchild porn/u,
  /\bunderage (?:sex|porn|nude)/u,
  /\bmolest/u,
  /\bnon consensual sex/u,
  /\bnonconsensual sex/u,
  /\bmurder/u,
  /\btorture/u,
  /\bdismember/u,
  /\bdecapitat/u,
  /\bbehead/u,
];

export function normalizeGateText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectGateText(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    into.push(String(value));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  if (Array.isArray(value)) {
    for (const item of value) collectGateText(item, into);
    return into;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    into.push(key);
    collectGateText(child, into);
  }
  return into;
}

/** Ticket string Jev judges — not the LLM transcript. */
export function ticketFromJevState(state: unknown): unknown {
  if (state && typeof state === "object" && !Array.isArray(state)) {
    const rec = state as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rec, "case")) return rec.case;
  }
  return state;
}

export function textIsBlocked(text: string): boolean {
  const hay = normalizeGateText(text);
  if (!hay) return false;
  return BLOCKED.some((re) => re.test(hay));
}

export type ViolenceGateHit =
  | { blocked: false }
  | { blocked: true; code: typeof VIOLENCE_GATE_CODE; message: string };

export function workshopPayloadBlocked(
  state?: unknown,
  questions?: unknown,
  message: string = VIOLENCE_GATE_MESSAGE,
): ViolenceGateHit {
  const parts = collectGateText(state);
  collectGateText(questions, parts);
  if (!textIsBlocked(parts.join("\n"))) return { blocked: false };
  return { blocked: true, code: VIOLENCE_GATE_CODE, message };
}
