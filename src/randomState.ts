/** Random state: invent once, ask Jev, short analysis, then stop. */

const AWARENESS =
  "Jev cannot invent answers that were not given. Choice = listed options only (mill numbers + those descriptions). Noul = P(true). Score = a legend level. If you need a new option, call set_jev_questions then ask_jev again.";

/** Visible You-bubble for the invent session. Full contract lives in server random-case mode. */
export function randomStateInventPrompt() {
  return `Random state. Invent a short imaginary scenario (just enough to judge), call set_jev_case, then set_jev_questions with 3–5 atomic questions (at least one noul, one score, and one choice; snake_case ids; choice descriptions as values — mill numbers are the keys), then ask_jev. Do not paste JSON in the chat. Do not wait for me. Stop after Jev answers — do not start a multi-turn loop.`;
}

/** Send answers to LLM send-now note + one short analysis. Then the client stops. */
export function randomStateAnalysisPrompt(answersNote: string) {
  const instruction = `Write a short analysis for the operator from Jev’s typed answers. Do not invent probabilities. Do not invent a new scenario. Do not start another loop. ${AWARENESS}`;
  const feed = answersNote.trim();
  return feed ? `${feed}\n\n${instruction}` : instruction;
}
