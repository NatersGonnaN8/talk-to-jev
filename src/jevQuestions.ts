import type { JevQuestion, QuestionType } from "./types";

/** Map key for a user-added card whose id field is still empty. Never shown, never sent to Jev. */
export const BLANK_QUESTION_KEY_PREFIX = "__blank__:";

export function isBlankQuestionId(id: string) {
  return !id.trim() || id.startsWith(BLANK_QUESTION_KEY_PREFIX);
}

export function questionIdValue(storageKey: string) {
  return isBlankQuestionId(storageKey) ? "" : storageKey;
}

/** Stable identity for a q-card or option row. Never the editable id / option key. */
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

/** 0 → a, 25 → z, 26 → aa, 27 → ab */
function optionLetterSuffix(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Next unused choice option key on one question: option_a … option_z, then option_aa.
 * Skips keys already present. Does not mint random opt_* ids.
 */
export function nextChoiceOptionKey(usedKeys: Iterable<string>): string {
  const used = new Set(usedKeys);
  for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
    const key = `option_${optionLetterSuffix(i)}`;
    if (!used.has(key)) return key;
  }
  throw new Error("exhausted sequential option keys");
}

export function emptyQuestion(type: QuestionType): JevQuestion {
  if (type === "choice") {
    return {
      type: "choice",
      instructions: "",
      criteria: { option_a: "", option_b: "" },
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
