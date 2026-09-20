/** Random state autonomous LLM↔Jev loop. Turn = one /api/llm SSE session. */

export const RANDOM_CASE_MIN_TURNS = 3;
export const RANDOM_CASE_MAX_TURNS = 10;

export function clampRandomCaseTurns(n: number) {
  if (!Number.isFinite(n)) return RANDOM_CASE_MIN_TURNS;
  return Math.min(
    RANDOM_CASE_MAX_TURNS,
    Math.max(RANDOM_CASE_MIN_TURNS, Math.round(n)),
  );
}

export function randomCaseTurnOptions() {
  const out: number[] = [];
  for (let n = RANDOM_CASE_MIN_TURNS; n <= RANDOM_CASE_MAX_TURNS; n++) {
    out.push(n);
  }
  return out;
}

/** Visible You-bubble for turn 1. Full contract lives in server random-case mode. */
export function randomCaseFirstTurnPrompt(total: number) {
  const n = clampRandomCaseTurns(total);
  return `Random state · ${n} turns. Invent a short imaginary scenario (just enough to judge), call set_jev_case, then set_jev_questions with 3–5 atomic questions (at least one noul, one score, and one choice; snake_case ids; choice descriptions as values — mill numbers are the keys), then ask_jev. Do not paste JSON in the chat. Do not wait for me.`;
}

const AWARENESS =
  "Jev cannot invent answers that were not given. Choice = listed options only (mill numbers + those descriptions). Noul = P(true). Score = a legend level. If you need a new option, call set_jev_questions then ask_jev again.";

/** Later turns: Feed Jev send-now note + agent instruction. */
export function randomCaseContinuePrompt(
  turn: number,
  total: number,
  answersNote: string,
) {
  const n = clampRandomCaseTurns(total);
  const t = Math.min(n, Math.max(1, Math.round(turn)));
  const last = t === n;
  const instruction = last
    ? `Agent turn ${t} of ${n} — last turn. Write analysis for the operator from Jev’s typed answers. Do not invent probabilities. Prefer not to call ask_jev unless there are still no answers. ${AWARENESS}`
    : `Agent turn ${t} of ${n}. Continue the random-case loop. You may update Jev’s State or questions (set_jev_*), then ask_jev if you need a new snap. Reason about the probabilities. Do not wait for the operator. ${AWARENESS}`;
  const feed = answersNote.trim();
  return feed ? `${feed}\n\n${instruction}` : instruction;
}
