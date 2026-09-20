/**
 * Validate Jev question maps the LLM tools (and Propose) write into the editor.
 * Shape matches src/types.ts. Never mint blank / placeholder ids.
 */

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevQuestion = ChoiceQuestion | NoulQuestion | ScoreQuestion;

const BLANK_PREFIX = "__blank__:";
const MAX_QUESTIONS = 32;

export function isBlankQuestionId(id: string) {
  return !id.trim() || id.startsWith(BLANK_PREFIX);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Description text only — never fall back to the option key (`"1": "1"`). */
function asChoiceDescription(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => asChoiceDescription(item)).filter(Boolean).join("; ");
  }
  const rec = asRecord(value);
  if (!rec) return "";
  const text = rec.description ?? rec.label ?? rec.text ?? rec.instructions;
  if (text != null) return asChoiceDescription(text);
  return "";
}

function asChoiceCriteria(raw: unknown): Record<string, string> | null {
  const values: string[] = [];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      values.push(asChoiceDescription(value));
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        if (item.trim()) values.push(item.trim());
        continue;
      }
      const rec = asRecord(item);
      if (!rec) continue;
      const desc = asChoiceDescription(
        rec.description ?? rec.label ?? rec.text ?? rec.instructions ?? rec.value,
      );
      if (desc) values.push(desc);
    }
  } else {
    return null;
  }
  if (values.length < 2) return null;
  const out: Record<string, string> = {};
  values.forEach((desc, i) => {
    out[String(i + 1)] = desc;
  });
  return out;
}

/** Choice keys Jev receives: "1", "2", "3", … → description text. Never `"1": "1"`. */
export function toPositionalChoiceCriteria(
  rec: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 1;
  for (const value of Object.values(rec)) {
    out[String(n)] = asChoiceDescription(value);
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

/** Decisions payload: rewrite semantic choice keys even if the map was not parsed. */
export function rewriteChoiceKeysInQuestions(
  questions: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    const rec = asRecord(q);
    if (!rec || String(rec.type ?? "").toLowerCase() !== "choice") {
      out[id] = q;
      continue;
    }
    const parsed = asChoiceCriteria(rec.criteria ?? rec.options ?? rec.choices);
    if (parsed) {
      out[id] = { ...rec, criteria: parsed };
      continue;
    }
    const crit = rec.criteria;
    if (!crit || typeof crit !== "object" || Array.isArray(crit)) {
      out[id] = q;
      continue;
    }
    const asStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(crit as Record<string, unknown>)) {
      asStrings[k] = asChoiceDescription(v);
    }
    out[id] = { ...rec, criteria: toPositionalChoiceCriteria(asStrings) };
  }
  return out;
}

/** Jev choice answers are keyed by option name only — attach descriptions we sent. */
export function attachChoiceLegends(
  answers: unknown,
  questions: Record<string, unknown>,
): unknown {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return answers;
  }
  const out: Record<string, unknown> = {};
  for (const [id, a] of Object.entries(answers as Record<string, unknown>)) {
    const rec = asRecord(a);
    const q = asRecord(questions[id]);
    if (!rec || String(rec.type ?? "").toLowerCase() !== "choice" || !q) {
      out[id] = a;
      continue;
    }
    const parsed = asChoiceCriteria(q.criteria ?? q.options ?? q.choices);
    let legend = parsed;
    if (!legend && q.criteria && typeof q.criteria === "object" && !Array.isArray(q.criteria)) {
      legend = {};
      for (const [k, v] of Object.entries(q.criteria as Record<string, unknown>)) {
        legend[k] = asChoiceDescription(v);
      }
    }
    out[id] = legend ? { ...rec, legend } : a;
  }
  return out;
}

function asScoreLegend(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const levels = raw
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item);
        const rec = asRecord(item);
        if (!rec) return "";
        return String(rec.label ?? rec.name ?? rec.level ?? rec.text ?? "");
      })
      .map((s) => s.trim())
      .filter(Boolean);
    return levels.length >= 2 ? levels : null;
  }
  const rec = asRecord(raw);
  if (!rec) return null;
  const levels = Object.keys(rec)
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    .map((k) => String(rec[k] ?? "").trim())
    .filter(Boolean);
  return levels.length >= 2 ? levels : null;
}

function asNoulCriteria(raw: unknown): { true?: string; false?: string } | undefined {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const trueText = rec.true ?? rec.yes;
  const falseText = rec.false ?? rec.no;
  if (trueText == null && falseText == null) return undefined;
  return {
    true: trueText == null ? "" : String(trueText),
    false: falseText == null ? "" : String(falseText),
  };
}

function parseOneQuestion(raw: unknown): JevQuestion | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const type = String(rec.type ?? "").trim().toLowerCase();
  const instructions = String(rec.instructions ?? rec.question ?? rec.text ?? rec.prompt ?? "");
  if (type === "choice") {
    const criteria = asChoiceCriteria(rec.criteria ?? rec.options ?? rec.choices);
    if (!criteria) return null;
    return { type: "choice", instructions, criteria };
  }
  if (type === "score") {
    const criteria = asScoreLegend(rec.criteria ?? rec.legend ?? rec.levels ?? rec.scale);
    if (!criteria) return null;
    return { type: "score", instructions, criteria };
  }
  if (type === "noul") {
    return { type: "noul", instructions, criteria: asNoulCriteria(rec.criteria) };
  }
  return null;
}

function looksLikeQuestionMap(value: unknown): value is Record<string, unknown> {
  const rec = asRecord(value);
  if (!rec) return false;
  const entries = Object.entries(rec);
  if (!entries.length) return false;
  return entries.every(([, v]) => {
    const inner = asRecord(v);
    return Boolean(inner && typeof inner.type === "string");
  });
}

/** Pull a questions value out of a tool-argument object. */
export function questionsFromToolArgs(args: Record<string, unknown>): unknown {
  if (Array.isArray(args.question)) return args.question;
  if (args.questions != null) return args.questions;
  return args;
}

export type ParseQuestionsResult =
  | { ok: true; questions: Record<string, JevQuestion>; skipped: string[] }
  | { ok: false; message: string; skipped: string[] };

export function parseJevQuestions(input: unknown): ParseQuestionsResult {
  const skipped: string[] = [];
  let entries: Array<[string, unknown]> = [];

  if (Array.isArray(input)) {
    entries = input.map((item, i) => {
      const rec = asRecord(item);
      const id = rec ? String(rec.id ?? rec.key ?? "").trim() : "";
      return [id || `__missing_${i}`, rec ?? item];
    });
  } else {
    const rec = asRecord(input);
    if (!rec) {
      return { ok: false, message: "questions must be an object or array.", skipped };
    }
    const inner = rec.questions;
    if (Array.isArray(inner) || looksLikeQuestionMap(inner)) {
      return parseJevQuestions(inner);
    }
    entries = Object.entries(rec);
  }

  const questions: Record<string, JevQuestion> = {};
  for (const [rawId, rawQ] of entries) {
    const id = rawId.trim();
    if (isBlankQuestionId(id) || id.startsWith("__missing_")) {
      skipped.push(id || "(blank)");
      continue;
    }
    const parsed = parseOneQuestion(rawQ);
    if (!parsed) {
      skipped.push(id);
      continue;
    }
    questions[id] = parsed;
    if (Object.keys(questions).length >= MAX_QUESTIONS) break;
  }

  if (!Object.keys(questions).length) {
    return {
      ok: false,
      message: "No valid questions (need real ids and choice/noul/score).",
      skipped,
    };
  }
  return { ok: true, questions, skipped };
}

export function questionsAreClean(questions: Record<string, JevQuestion>) {
  const ids = Object.keys(questions);
  if (!ids.length) return false;
  return ids.every((id) => !isBlankQuestionId(id));
}

export function stripBlankQuestions(questions: Record<string, JevQuestion>) {
  const out: Record<string, JevQuestion> = {};
  for (const [id, q] of Object.entries(questions)) {
    if (!isBlankQuestionId(id)) out[id] = q;
  }
  return out;
}
