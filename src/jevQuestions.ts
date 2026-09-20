import type { JevQuestion, QuestionType } from "./types";

/** Map key for a user-added card whose id field is still empty. Never shown, never sent to Jev. */
export const BLANK_QUESTION_KEY_PREFIX = "__blank__:";

export function isBlankQuestionId(id: string) {
  return !id.trim() || id.startsWith(BLANK_QUESTION_KEY_PREFIX);
}

export function questionIdValue(storageKey: string) {
  return isBlankQuestionId(storageKey) ? "" : storageKey;
}

export function nextBlankQuestionKey() {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return `${BLANK_QUESTION_KEY_PREFIX}${suffix}`;
}

export function blankQuestionKeys(questions: Record<string, JevQuestion>) {
  return Object.keys(questions).filter((id) => isBlankQuestionId(id));
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
