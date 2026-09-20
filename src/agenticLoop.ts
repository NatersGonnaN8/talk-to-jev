/** Agentic loop: N-turn LLM↔Jev on the current mill. Does not invent a random state. */

export const AGENTIC_LOOP_MIN_TURNS = 3;
export const AGENTIC_LOOP_MAX_TURNS = 10;

export const AGENTIC_LOOP_NEED_MILL =
  "Agentic loop needs Jev’s State and at least one question. Use Random state to invent, or load a preset / write them first.";

export function clampAgenticLoopTurns(n: number) {
  if (!Number.isFinite(n)) return AGENTIC_LOOP_MIN_TURNS;
  return Math.min(
    AGENTIC_LOOP_MAX_TURNS,
    Math.max(AGENTIC_LOOP_MIN_TURNS, Math.round(n)),
  );
}

export function agenticLoopTurnOptions() {
  const out: number[] = [];
  for (let n = AGENTIC_LOOP_MIN_TURNS; n <= AGENTIC_LOOP_MAX_TURNS; n++) {
    out.push(n);
  }
  return out;
}

export function millReadyForAgenticLoop(state: string, realQuestionCount: number) {
  return state.trim().length > 0 && realQuestionCount > 0;
}

const AWARENESS =
  "Jev cannot invent answers that were not given. Choice = listed options only (mill numbers + those descriptions). Noul = P(true). Score = a legend level. If you need a new option, call set_jev_questions then ask_jev again. Do not invent a new random state.";

/** Visible You-bubble for turn 1. Full contract lives in server agentic-loop mode. */
export function agenticLoopFirstPrompt(total: number) {
  const n = clampAgenticLoopTurns(total);
  return `Agentic loop · ${n} turns. Use the current Jev’s State and current questions. Do not invent a new random state. Call ask_jev. Do not paste JSON in the chat. Do not wait for me.`;
}

/** Later turns: Feed Jev send-now note + agent instruction. */
export function agenticLoopContinuePrompt(
  turn: number,
  total: number,
  answersNote: string,
) {
  const n = clampAgenticLoopTurns(total);
  const t = Math.min(n, Math.max(1, Math.round(turn)));
  const last = t === n;
  const instruction = last
    ? `Agent turn ${t} of ${n} — last turn. Write analysis for the operator from Jev’s typed answers. Do not invent probabilities. Do not invent a new random state. Prefer not to call ask_jev unless there are still no answers. ${AWARENESS}`
    : `Agent turn ${t} of ${n}. Continue the agentic loop on the current mill. You may update questions (set_jev_questions) then ask_jev if you need a new snap. Do not invent a new random state. Reason about the probabilities. Do not wait for the operator. ${AWARENESS}`;
  const feed = answersNote.trim();
  return feed ? `${feed}\n\n${instruction}` : instruction;
}
