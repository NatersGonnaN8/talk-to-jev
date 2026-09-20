/** Random state: invent once, then stop. Asking Jev is the mill Ask Jev button. */

/** Visible You-bubble for the invent session. Full contract lives in server random-case mode. */
export function randomStateInventPrompt() {
  return `Random state. Invent a short imaginary scenario (just enough to judge), call set_jev_case, then set_jev_questions with 3–5 atomic questions (at least one noul, one score, and one choice; snake_case ids; choice descriptions as values — mill numbers are the keys). Do not paste JSON in the chat. Do not start a multi-turn loop.`;
}
