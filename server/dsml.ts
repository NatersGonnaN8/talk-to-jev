/**
 * DeepSeek DSML fences leaked into assistant content.
 * Strip for the mill pane; parse mill invokes so we can honor them as tools.
 * One-pass scan — do not loop on shrinking strings.
 */

export const MILL_TOOLS = [
  "read_jev_workshop",
  "set_jev_state",
  "set_jev_questions",
  "ask_jev",
] as const;

export type MillToolName = (typeof MILL_TOOLS)[number];

export type DsmlCall = {
  name: MillToolName;
  arguments: string;
};

export type DsmlParse = {
  text: string;
  calls: DsmlCall[];
  stripped: boolean;
  invokes: string[];
};

const MILL_SET = new Set<string>(MILL_TOOLS);
const PIPE = String.raw`[|｜│]`;
/** `<|DSML|…>`, `< | DSML | …>`, `</ | DSML | invoke>` */
const TAG_RE = new RegExp(
  String.raw`<\s*(\/?)\s*${PIPE}\s*DSML\s*${PIPE}\s*([^>]*)>`,
  "gi",
);
const MAX_TAGS = 400;

export function isMillTool(name: string): name is MillToolName {
  return MILL_SET.has(name);
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type Tag = {
  start: number;
  end: number;
  closing: boolean;
  kind: string;
  name: string;
};

function parseAttrs(inner: string): { kind: string; name: string } {
  const t = inner.trim();
  const kind = (t.split(/\s+/)[0] || "").toLowerCase();
  const named =
    t.match(/\bname\s*=\s*"([^"]*)"/i)?.[1] ||
    t.match(/\bname\s*=\s*'([^']*)'/i)?.[1] ||
    t.match(/\bname\s*=\s*([^\s>]+)/i)?.[1] ||
    "";
  return { kind, name: named.trim() };
}

function collectTags(raw: string): Tag[] {
  const tags: Tag[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(raw))) {
    if (!m[0].length) {
      TAG_RE.lastIndex += 1;
      continue;
    }
    const { kind, name } = parseAttrs(m[2] ?? "");
    tags.push({
      start: m.index,
      end: m.index + m[0].length,
      closing: m[1] === "/",
      kind: kind === "function_calls" ? "tool_calls" : kind,
      name,
    });
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

/** Suffix from `<` that could still become a DSML tag. Not `<div` / `< 3`. */
export function couldBeDsmlPrefix(suffix: string): boolean {
  if (!suffix.startsWith("<")) return false;
  return new RegExp(
    String.raw`^<\s*\/?\s*(${PIPE}(\s*D(S(M(L(\s*${PIPE}[^>]*)?)?)?)?)?)?$`,
    "i",
  ).test(suffix);
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const sorted = ranges
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const out: Array<[number, number]> = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

function cutRanges(raw: string, ranges: Array<[number, number]>): string {
  const merged = mergeRanges(ranges);
  if (!merged.length) return raw;
  let out = "";
  let i = 0;
  for (const [a, b] of merged) {
    out += raw.slice(i, a);
    i = b;
  }
  out += raw.slice(i);
  return out;
}

function paramsFromInner(inner: string): Record<string, string> {
  const tags = collectTags(inner);
  const params: Record<string, string> = {};
  const stack: Tag[] = [];
  for (const tag of tags) {
    if (!tag.closing) {
      stack.push(tag);
      continue;
    }
    let i = stack.length - 1;
    while (i >= 0 && stack[i].kind !== tag.kind) i -= 1;
    if (i < 0) continue;
    const open = stack.splice(i, 1)[0];
    if (open.kind === "parameter" && open.name) {
      params[open.name] = inner.slice(open.end, tag.start);
    }
  }
  return params;
}

function argsFromParams(params: Record<string, string>): string {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const trimmed = value.trim();
    const parsed = tryJson(trimmed);
    out[key] = parsed !== null ? parsed : trimmed;
  }
  return JSON.stringify(out);
}

function invokeToCall(name: string, inner: string): DsmlCall | null {
  if (!isMillTool(name)) return null;
  const params = paramsFromInner(inner);
  if (Object.keys(params).length) {
    return { name, arguments: argsFromParams(params) };
  }
  TAG_RE.lastIndex = 0;
  const leftover = inner.replace(TAG_RE, "").trim();
  if (!leftover) return { name, arguments: "{}" };
  const json = tryJson(leftover);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return { name, arguments: JSON.stringify(json) };
  }
  if (name === "set_jev_state") {
    return { name, arguments: JSON.stringify({ state: leftover }) };
  }
  if (name === "set_jev_questions") {
    return { name, arguments: JSON.stringify({ questions: json ?? leftover }) };
  }
  return { name, arguments: "{}" };
}

export function parseDsml(raw: string): DsmlParse {
  if (!raw) {
    return { text: "", calls: [], stripped: false, invokes: [] };
  }
  const tags = collectTags(raw);
  const ranges: Array<[number, number]> = [];
  const calls: DsmlCall[] = [];
  const invokes: string[] = [];
  const stack: Tag[] = [];

  const takeInvoke = (open: Tag, innerEnd: number) => {
    if (open.kind !== "invoke") return;
    if (open.name) invokes.push(open.name);
    const call = invokeToCall(open.name, raw.slice(open.end, innerEnd));
    if (call) calls.push(call);
  };

  for (const tag of tags) {
    if (!tag.closing) {
      stack.push(tag);
      continue;
    }
    let i = stack.length - 1;
    while (i >= 0 && stack[i].kind !== tag.kind) i -= 1;
    if (i < 0) {
      ranges.push([tag.start, tag.end]);
      continue;
    }
    const open = stack.splice(i, 1)[0];
    takeInvoke(open, tag.start);
    ranges.push([open.start, tag.end]);
  }

  for (const open of stack) {
    takeInvoke(open, raw.length);
    ranges.push([open.start, raw.length]);
  }

  if (tags.length >= MAX_TAGS && tags[0]) {
    ranges.push([tags[0].start, raw.length]);
  }

  const lt = raw.lastIndexOf("<");
  if (lt >= 0 && couldBeDsmlPrefix(raw.slice(lt))) {
    ranges.push([lt, raw.length]);
  }

  const text = cutRanges(raw, ranges);
  const stripped = ranges.length > 0 || tags.length > 0;
  return { text, calls, stripped, invokes };
}

export function tidyDsmlText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/```[a-zA-Z0-9_-]*\s*```/g, "")
    .trim();
}

/** Final mill-pane prose: DSML gone, leftover blank lines collapsed. */
export function stripDsml(raw: string): string {
  return tidyDsmlText(parseDsml(raw).text);
}

export function hasDsml(text: string): boolean {
  if (!text) return false;
  TAG_RE.lastIndex = 0;
  if (TAG_RE.test(text)) return true;
  const lt = text.lastIndexOf("<");
  return lt >= 0 && couldBeDsmlPrefix(text.slice(lt));
}

export function mergeDsmlCalls<T extends { function: { name: string } }>(
  official: T[],
  dsml: DsmlCall[],
): DsmlCall[] {
  const have = new Set(official.map((c) => c.function.name));
  const extra: DsmlCall[] = [];
  const seen = new Set<string>();
  for (const call of dsml) {
    if (have.has(call.name) || seen.has(call.name)) continue;
    seen.add(call.name);
    extra.push(call);
  }
  return extra;
}
