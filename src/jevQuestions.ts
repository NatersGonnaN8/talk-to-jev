import type { JevQuestion, QuestionType } from "./types";

/** Map key for a user-added card whose id field is still empty. Never shown, never sent to Jev. */
export const BLANK_QUESTION_KEY_PREFIX = "__blank__:";

export function isBlankQuestionId(id: string) {
  return !id.trim() || id.startsWith(BLANK_QUESTION_KEY_PREFIX);
}

export function questionIdValue(storageKey: string) {
  return isBlankQuestionId(storageKey) ? "" : storageKey;
}

/** ASCII space → `_` for snake_case typing (question ids, choice option descriptions). */
export function spacesToSnake(value: string) {
  return value.replaceAll(" ", "_");
}

/** Stable identity for a q-card or option row. Never the question id or displayed option number. */
export function nextStableUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nextBlankQuestionKey() {
  return `${BLANK_QUESTION_KEY_PREFIX}${nextStableUid()}`;
}

/** Rename a record key in place (insertion order). Does not move the row to the end. */
export function renameRecordKey<V>(
  rec: Record<string, V>,
  oldKey: string,
  newKey: string,
): Record<string, V> {
  if (oldKey === newKey) return rec;
  const next: Record<string, V> = {};
  for (const [k, v] of Object.entries(rec)) {
    next[k === oldKey ? newKey : k] = v;
  }
  return next;
}

export function blankQuestionKeys(questions: Record<string, JevQuestion>) {
  return Object.keys(questions).filter((id) => isBlankQuestionId(id));
}

/**
 * Choice keys sent to Jev and shown on the card: "1", "2", "3", … (never 0).
 * Visual/object order wins. Semantic LLM keys (refund/deny) are dropped as keys;
 * their descriptions stay.
 */
export function toPositionalChoiceCriteria(
  rec: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 1;
  for (const value of Object.values(rec)) {
    out[String(n)] = value;
    n += 1;
  }
  return out;
}

export function withPositionalChoiceKeys(
  questions: Record<string, JevQuestion>,
): Record<string, JevQuestion> {
  const out: Record<string, JevQuestion> = {};
  for (const [id, q] of Object.entries(questions)) {
    out[id] =
      q.type === "choice"
        ? { ...q, criteria: toPositionalChoiceCriteria(q.criteria) }
        : q;
  }
  return out;
}

export function addChoiceOption(
  criteria: Record<string, string>,
): Record<string, string> {
  const next = toPositionalChoiceCriteria(criteria);
  next[String(Object.keys(next).length + 1)] = "";
  return next;
}

export function removeChoiceOption(
  criteria: Record<string, string>,
  key: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(criteria)) {
    if (k !== key) next[k] = v;
  }
  return toPositionalChoiceCriteria(next);
}

export function emptyQuestion(type: QuestionType): JevQuestion {
  if (type === "choice") {
    return {
      type: "choice",
      instructions: "",
      criteria: { "1": "", "2": "" },
    };
  }
  if (type === "score") {
    return { type: "score", instructions: "", criteria: ["Low", "Medium", "High"] };
  }
  return {
    type: "noul",
    instructions: "",
    criteria: { true: "", false: "" },
  };
}

/** One blank noul card — same as clicking Add question on an empty editor. */
export function blankWorkshopQuestions(): Record<string, JevQuestion> {
  return { [nextBlankQuestionKey()]: emptyQuestion("noul") };
}

function isEmptyNoulCard(q: JevQuestion) {
  if (q.type !== "noul") return false;
  if (q.instructions.trim()) return false;
  const trueText = q.criteria?.true ?? "";
  const falseText = q.criteria?.false ?? "";
  return !trueText.trim() && !falseText.trim();
}

/** Empty list, or one untouched blank-id noul card. */
export function questionsAreBlankWorkshop(
  questions: Record<string, JevQuestion>,
): boolean {
  const entries = Object.entries(questions);
  if (entries.length === 0) return true;
  if (entries.length !== 1) return false;
  const [id, q] = entries[0];
  return isBlankQuestionId(id) && isEmptyNoulCard(q);
}
