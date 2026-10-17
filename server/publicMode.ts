/**
 * Public mode (JEV_PUBLIC=1): anyone can use the hosted copy without a login.
 *
 * Two ways in:
 *  - Free tier: the server's own OpenRouter key, but ONLY with an allowlist of
 *    ":free" chat models, capped output, capped loop turns, and per-IP and
 *    global daily caps on LLM requests and Jev calls.
 *  - BYOK: the visitor sends their own OpenRouter key in a request header. It
 *    is used for that one request, never logged, never stored, never echoed.
 *
 * Everything here is pure (no I/O, no relative imports) so it is unit tested.
 * With JEV_PUBLIC unset nothing in here changes local or admin behavior.
 */

export const GITHUB_URL = "https://github.com/NatersGonnaN8/talk-to-jev";
export const BYOK_HEADER = "x-jev-openrouter-key";

/**
 * Free chat models that support BOTH `tools` and `tool_choice` (the loop forces
 * tool_choice), have no expiry date, and had a healthy endpoint, checked
 * against https://openrouter.ai/api/v1/models on 2026-10-17. Override with
 * JEV_FREE_MODELS (comma separated, every id must end in ":free").
 */
export const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

export const FREE_MODEL_LABELS: Record<string, string> = {
  "nvidia/nemotron-3-super-120b-a12b:free": "Nemotron 3 Super 120B (free)",
  "google/gemma-4-31b-it:free": "Gemma 4 31B (free)",
  "google/gemma-4-26b-a4b-it:free": "Gemma 4 26B A4B (free)",
};

export type PublicConfig = {
  enabled: boolean;
  freeModels: string[];
  defaultFreeModel: string;
  freeMaxTokens: number;
  freeMaxRounds: number;
  freeMaxStateChars: number;
  freeMaxQuestionsChars: number;
  /** Whole Jev payload (case + cards + chat transcript) in characters. Bounds the cost of one free Jev call. */
  freeMaxJevChars: number;
  freeMaxMessages: number;
  freeMaxMessageChars: number;
  freeMaxInstructionChars: number;
  freeLlmPerIpPerDay: number;
  freeLlmGlobalPerDay: number;
  freeLlmGlobalPerMin: number;
  freeJevPerIpPerDay: number;
  freeJevGlobalPerDay: number;
  apiPerIpPerMin: number;
  heavyPerIpPerMin: number;
  lookupPerIpPerMin: number;
  lookupGlobalPerMin: number;
  maxConcurrent: number;
  maxConcurrentPerIp: number;
};

type EnvLike = Record<string, string | undefined>;

function str(env: EnvLike, name: string, dflt: string) {
  const v = env[name];
  return v === undefined || v.trim() === "" ? dflt : v.trim();
}

function int(env: EnvLike, name: string, dflt: number, min: number, max: number) {
  const raw = str(env, name, String(dflt));
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

export function isPublicMode(env: EnvLike): boolean {
  return /^(1|true|yes)$/i.test((env.JEV_PUBLIC ?? "").trim());
}

const MODEL_ID_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._+-]*:free$/;

/**
 * Parse the free-model allowlist. Throws on any entry that is not a plain
 * ":free" id, so a config typo can never open a paid model to the server key.
 */
export function parseFreeModels(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_FREE_MODELS];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id) continue;
    if (!MODEL_ID_RE.test(id)) {
      throw new Error(`JEV_FREE_MODELS entry "${id}" must be an OpenRouter id ending in ":free"`);
    }
    if (!out.includes(id)) out.push(id);
  }
  if (!out.length) throw new Error("JEV_FREE_MODELS has no models");
  return out;
}

export function loadPublicConfig(env: EnvLike): PublicConfig {
  const freeModels = parseFreeModels(env.JEV_FREE_MODELS);
  const wanted = str(env, "JEV_FREE_DEFAULT_MODEL", freeModels[0]);
  if (!freeModels.includes(wanted)) {
    throw new Error("JEV_FREE_DEFAULT_MODEL must be one of JEV_FREE_MODELS");
  }
  return {
    enabled: isPublicMode(env),
    freeModels,
    defaultFreeModel: wanted,
    // Reasoning models spend max_tokens on thinking too, so this is not tiny.
    freeMaxTokens: int(env, "JEV_FREE_MAX_TOKENS", 4096, 256, 32768),
    freeMaxRounds: int(env, "JEV_FREE_MAX_ROUNDS", 6, 2, 8),
    freeMaxStateChars: int(env, "JEV_FREE_MAX_STATE_CHARS", 24_000, 1000, 400_000),
    freeMaxQuestionsChars: int(env, "JEV_FREE_MAX_QUESTIONS_CHARS", 24_000, 1000, 400_000),
    freeMaxJevChars: int(env, "JEV_FREE_MAX_JEV_CHARS", 40_000, 2000, 400_000),
    freeMaxMessages: int(env, "JEV_FREE_MAX_MESSAGES", 20, 1, 200),
    freeMaxMessageChars: int(env, "JEV_FREE_MAX_MESSAGE_CHARS", 6000, 200, 100_000),
    freeMaxInstructionChars: int(env, "JEV_FREE_MAX_INSTRUCTION_CHARS", 2000, 0, 8000),
    // OpenRouter's free models allow 20 requests/min and 50/day (under $10
    // bought, ever) or 1000/day (at least $10) PER ACCOUNT, so the global
    // numbers stay below that.
    freeLlmPerIpPerDay: int(env, "JEV_FREE_LLM_PER_IP_PER_DAY", 40, 1, 100000),
    freeLlmGlobalPerDay: int(env, "JEV_FREE_LLM_GLOBAL_PER_DAY", 600, 1, 1_000_000),
    freeLlmGlobalPerMin: int(env, "JEV_FREE_LLM_GLOBAL_PER_MIN", 15, 1, 100000),
    freeJevPerIpPerDay: int(env, "JEV_FREE_JEV_PER_IP_PER_DAY", 25, 1, 100000),
    freeJevGlobalPerDay: int(env, "JEV_FREE_JEV_GLOBAL_PER_DAY", 300, 1, 1_000_000),
    apiPerIpPerMin: int(env, "JEV_RL_API_PER_IP_PER_MIN", 240, 1, 100000),
    heavyPerIpPerMin: int(env, "JEV_RL_HEAVY_PER_IP_PER_MIN", 20, 1, 100000),
    lookupPerIpPerMin: int(env, "JEV_RL_LOOKUP_PER_IP_PER_MIN", 30, 1, 100000),
    lookupGlobalPerMin: int(env, "JEV_RL_LOOKUP_GLOBAL_PER_MIN", 300, 1, 1_000_000),
    maxConcurrent: int(env, "JEV_MAX_CONCURRENT", 12, 1, 1000),
    maxConcurrentPerIp: int(env, "JEV_MAX_CONCURRENT_PER_IP", 2, 1, 100),
  };
}

// ---------------------------------------------------------------- BYOK key

/** OpenRouter keys are url-safe tokens. Anything else never leaves this function, so it cannot reach an error message. */
const BYOK_KEY_RE = /^[A-Za-z0-9_-]{20,512}$/;

export type ByokRead = { ok: true; key: string | null } | { ok: false; message: string };

const BAD_KEY_MESSAGE =
  "That OpenRouter key does not look right. Paste it again in Settings.";

export function readByokKey(
  headers: Record<string, string | string[] | undefined>,
): ByokRead {
  const raw = headers[BYOK_HEADER];
  if (raw === undefined) return { ok: true, key: null };
  if (typeof raw !== "string") return { ok: false, message: BAD_KEY_MESSAGE };
  const key = raw.trim();
  if (!BYOK_KEY_RE.test(key)) return { ok: false, message: BAD_KEY_MESSAGE };
  return { ok: true, key };
}

export type Access =
  | { kind: "admin"; apiKey: string }
  | { kind: "free"; apiKey: string }
  | { kind: "byok"; apiKey: string };

// ------------------------------------------------------------ model choice

export type ModelDecision =
  | { ok: true; model: string }
  | { ok: false; status: number; code: string; message: string };

/**
 * Decide the chat model once, on the server. On the free tier the server key
 * is only ever paired with an exact allowlist match that also ends in ":free".
 * The client's pick is a request, never a fact.
 */
export function modelForAccess(
  cfg: PublicConfig,
  accessKind: Access["kind"],
  requested: unknown,
  normalize: (raw: unknown) => string,
  fallback: string,
): ModelDecision {
  const wanted = typeof requested === "string" ? requested.trim() : "";
  if (accessKind !== "free") {
    return { ok: true, model: normalize(wanted) || normalize(fallback) || fallback };
  }
  if (!wanted) return { ok: true, model: cfg.defaultFreeModel };
  if (cfg.freeModels.includes(wanted) && wanted.endsWith(":free")) {
    return { ok: true, model: wanted };
  }
  return {
    ok: false,
    status: 403,
    code: "model-not-free",
    message: `That model is not on the free tier. Pick a free model, paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`,
  };
}

// ---------------------------------------------------------------- limiter

export type Rule = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000; // windows align to UTC midnight

export type TakeResult = { ok: true } | { ok: false; rule: Rule; retryAfterSec: number };

const MAX_KEYS = 50_000;

/** Fixed-window counters held in memory (the hosted filesystem is read-only, so a restart resets them). */
export class RateLimiter {
  private now: () => number;
  private counts = new Map<string, { win: number; n: number }>();
  private lastSweep = 0;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private slot(rule: Rule): string {
    const k = `${rule.scope}|${rule.windowMs}|${rule.key}`;
    if (this.counts.has(k) || this.counts.size < MAX_KEYS) return k;
    // Map is full: strangers share one low-trust bucket instead of growing memory.
    return `${rule.scope}|${rule.windowMs}|overflow`;
  }

  private sweep(t: number) {
    if (t - this.lastSweep < MINUTE_MS) return;
    this.lastSweep = t;
    for (const [k, v] of this.counts) {
      const windowMs = Number(k.split("|")[1]);
      if (v.win !== Math.floor(t / windowMs)) this.counts.delete(k);
    }
  }

  private used(rule: Rule, t: number): number {
    const v = this.counts.get(this.slot(rule));
    const win = Math.floor(t / rule.windowMs);
    return v && v.win === win ? v.n : 0;
  }

  /** Count one hit against every rule, atomically: all must have room or nothing is counted. */
  takeAll(rules: Rule[]): TakeResult {
    const t = this.now();
    this.sweep(t);
    for (const rule of rules) {
      if (this.used(rule, t) >= rule.limit) {
        const end = (Math.floor(t / rule.windowMs) + 1) * rule.windowMs;
        return { ok: false, rule, retryAfterSec: Math.max(1, Math.ceil((end - t) / 1000)) };
      }
    }
    for (const rule of rules) {
      const k = this.slot(rule);
      const win = Math.floor(t / rule.windowMs);
      const v = this.counts.get(k);
      if (v && v.win === win) v.n += 1;
      else this.counts.set(k, { win, n: 1 });
    }
    return { ok: true };
  }

  /** Hits left in a rule's current window (does not count). */
  remaining(rule: Rule): number {
    return Math.max(0, rule.limit - this.used(rule, this.now()));
  }

  get size() {
    return this.counts.size;
  }
}

// ------------------------------------------------------- free-tier counters

export type Denial = {
  status: number;
  code: "limit-day" | "limit-busy" | "limit-size";
  message: string;
  retryAfterSec: number;
};

export const FREE_USED_UP_MESSAGE = `The free tier is used up for now. It resets at midnight UTC. To keep going, paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`;
export const FREE_BUSY_MESSAGE = `The free tier is busy right now. Try again in a minute, paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`;

function denialFor(res: { rule: Rule; retryAfterSec: number }): Denial {
  const day = res.rule.windowMs === DAY_MS;
  return {
    status: 429,
    code: day ? "limit-day" : "limit-busy",
    message: day ? FREE_USED_UP_MESSAGE : FREE_BUSY_MESSAGE,
    retryAfterSec: res.retryAfterSec,
  };
}

export function freeRules(cfg: PublicConfig) {
  return {
    llm: (ip: string): Rule[] => [
      { scope: "free-llm-min", key: "all", limit: cfg.freeLlmGlobalPerMin, windowMs: MINUTE_MS },
      { scope: "free-llm-day-ip", key: ip, limit: cfg.freeLlmPerIpPerDay, windowMs: DAY_MS },
      { scope: "free-llm-day", key: "all", limit: cfg.freeLlmGlobalPerDay, windowMs: DAY_MS },
    ],
    jev: (ip: string): Rule[] => [
      { scope: "free-jev-day-ip", key: ip, limit: cfg.freeJevPerIpPerDay, windowMs: DAY_MS },
      { scope: "free-jev-day", key: "all", limit: cfg.freeJevGlobalPerDay, windowMs: DAY_MS },
    ],
  };
}

/** Per-session gate: every upstream LLM request and every Jev call on the free tier passes through here. */
export type UsageGate = {
  llm(): Denial | null;
  /** `sizeChars` is the whole Jev payload (case, cards, transcript). Too big is refused before it is counted. */
  jev(sizeChars?: number): Denial | null;
};

export const FREE_TOO_BIG_MESSAGE = `That is longer than the free tier sends to Jev. Shorten the case, cards or chat, paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`;

export function freeGate(limiter: RateLimiter, cfg: PublicConfig, ipKey: string): UsageGate {
  const rules = freeRules(cfg);
  const take = (list: Rule[]): Denial | null => {
    const r = limiter.takeAll(list);
    return r.ok ? null : denialFor(r);
  };
  return {
    llm: () => take(rules.llm(ipKey)),
    jev: (sizeChars = 0) =>
      sizeChars > cfg.freeMaxJevChars
        ? { status: 413, code: "limit-size", message: FREE_TOO_BIG_MESSAGE, retryAfterSec: 0 }
        : take(rules.jev(ipKey)),
  };
}

/** Is there room to start a free LLM session? Does not count. */
export function freeLlmRoom(
  limiter: RateLimiter,
  cfg: PublicConfig,
  ipKey: string,
): Denial | null {
  for (const rule of freeRules(cfg).llm(ipKey)) {
    if (limiter.remaining(rule) <= 0) {
      return denialFor({ rule, retryAfterSec: 60 });
    }
  }
  return null;
}

export function freeUsage(limiter: RateLimiter, cfg: PublicConfig, ipKey: string) {
  const rules = freeRules(cfg);
  // Daily budget only: the per-minute limit is a pacing detail, not what is "left today".
  const left = (list: Rule[]) =>
    Math.min(...list.filter((r) => r.windowMs === DAY_MS).map((r) => limiter.remaining(r)));
  const llm = left(rules.llm(ipKey));
  const jev = left(rules.jev(ipKey));
  return { llm, jev };
}

// ------------------------------------------------------------ input limits

export type ClampResult =
  | { ok: true; messages: Array<{ role: string; content: string }>; instructions: string }
  | { ok: false; status: number; message: string };

function jsonLength(value: unknown): number {
  try {
    return JSON.stringify(value ?? null).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Free tier input caps for /api/llm and /api/jev: an oversize case or card set is refused, old chat turns are trimmed. */
export function clampFreeInput(
  cfg: PublicConfig,
  input: {
    state: unknown;
    questions: unknown;
    messages?: unknown;
    instructions?: unknown;
    jevAnswers?: unknown;
  },
): ClampResult {
  if (String(input.state ?? "").length > cfg.freeMaxStateChars) {
    return {
      ok: false,
      status: 413,
      message: `That case is longer than the free tier allows (${cfg.freeMaxStateChars.toLocaleString("en-US")} characters). Shorten it, paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`,
    };
  }
  if (
    jsonLength(input.questions) > cfg.freeMaxQuestionsChars ||
    jsonLength(input.jevAnswers) > cfg.freeMaxQuestionsChars
  ) {
    return {
      ok: false,
      status: 413,
      message:
        "Those questions are longer than the free tier allows. Trim them, or paste your own OpenRouter key in Settings.",
    };
  }
  const list = Array.isArray(input.messages) ? input.messages : [];
  const messages: Array<{ role: string; content: string }> = [];
  for (const m of list.slice(-cfg.freeMaxMessages)) {
    if (!m || typeof m !== "object") continue;
    const row = m as { role?: unknown; content?: unknown };
    messages.push({
      role: String(row.role ?? ""),
      content: String(row.content ?? "").slice(0, cfg.freeMaxMessageChars),
    });
  }
  const instructions =
    typeof input.instructions === "string"
      ? input.instructions.slice(0, cfg.freeMaxInstructionChars)
      : "";
  return { ok: true, messages, instructions };
}

// ---------------------------------------------------------- error wording

/** Friendly, key-free wording for an upstream HTTP status. */
export function friendlyUpstreamMessage(
  status: number,
  kind: Access["kind"] | undefined,
  what: "LLM" | "Jev",
): string {
  if (kind === "byok") {
    if (status === 401 || status === 403) {
      return "OpenRouter did not accept your key. Check it in Settings.";
    }
    if (status === 402) {
      return "Your OpenRouter key is out of credit or at its spending limit.";
    }
    if (status === 429) {
      return "OpenRouter says you are sending too fast. Wait a moment and try again.";
    }
  }
  if (kind === "free" && status === 402) return FREE_USED_UP_MESSAGE; // the dedicated key hit its credit limit
  if (kind === "free" && status === 429) return FREE_BUSY_MESSAGE;
  return `${what} request failed (details omitted).`;
}

/** Remove any occurrence of a known secret (a visitor key or the server key) from text. */
export function scrubKnown(text: string, ...secrets: Array<string | null | undefined>): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 8) out = out.split(s).join("[redacted]");
  }
  return out;
}
