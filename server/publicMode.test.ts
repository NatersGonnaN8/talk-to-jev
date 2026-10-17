import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeChatModel } from "./chatModel.ts";
import {
  BYOK_HEADER,
  DAY_MS,
  DEFAULT_FREE_MODELS,
  FREE_USED_UP_MESSAGE,
  GITHUB_URL,
  MINUTE_MS,
  RateLimiter,
  clampFreeInput,
  freeGate,
  freeLlmRoom,
  friendlyUpstreamMessage,
  loadPublicConfig,
  modelForAccess,
  parseFreeModels,
  readByokKey,
  scrubKnown,
} from "./publicMode.ts";

const cfg = loadPublicConfig({ JEV_PUBLIC: "1" });
const FALLBACK = "deepseek/deepseek-v4-flash";

test("default free models all end in :free and the default is on the list", () => {
  for (const id of DEFAULT_FREE_MODELS) assert.ok(id.endsWith(":free"), id);
  assert.ok(cfg.freeModels.includes(cfg.defaultFreeModel));
  assert.equal(cfg.enabled, true);
});

test("JEV_FREE_MODELS refuses any entry that is not a :free id", () => {
  assert.throws(() => parseFreeModels("deepseek/deepseek-v4-flash"), /:free/);
  assert.throws(() => parseFreeModels("google/gemma-4-31b-it:free,openai/gpt-4.1-mini"), /:free/);
  assert.throws(() => parseFreeModels("google/gemma-4-31b-it:free:extra"), /:free/);
  assert.throws(() => parseFreeModels("typesafe/jev-1.13"), /:free/);
  assert.throws(() => parseFreeModels(" , "), /no models/);
  assert.deepEqual(parseFreeModels("a/b:free, c/d:free"), ["a/b:free", "c/d:free"]);
  assert.throws(
    () => loadPublicConfig({ JEV_PUBLIC: "1", JEV_FREE_DEFAULT_MODEL: "x/y:free" }),
    /one of JEV_FREE_MODELS/,
  );
});

test("config rejects out-of-range numbers loudly", () => {
  assert.throws(() => loadPublicConfig({ JEV_FREE_MAX_TOKENS: "9" }), /JEV_FREE_MAX_TOKENS/);
  assert.throws(() => loadPublicConfig({ JEV_FREE_LLM_PER_IP_PER_DAY: "x" }));
});

test("free tier: an allowlisted model passes, empty picks the free default", () => {
  const ok = modelForAccess(cfg, "free", cfg.freeModels[1], normalizeChatModel, FALLBACK);
  assert.deepEqual(ok, { ok: true, model: cfg.freeModels[1] });
  const dflt = modelForAccess(cfg, "free", "", normalizeChatModel, FALLBACK);
  assert.deepEqual(dflt, { ok: true, model: cfg.defaultFreeModel });
  const missing = modelForAccess(cfg, "free", undefined, normalizeChatModel, FALLBACK);
  assert.deepEqual(missing, { ok: true, model: cfg.defaultFreeModel });
});

test("free tier: a lying client never gets a non-free model, and the server LLM_MODEL fallback is never used", () => {
  const liars = [
    "deepseek/deepseek-v4-flash",
    "openai/gpt-4.1-mini",
    "openai/gpt-5:free", // looks free, is not on the allowlist
    "google/gemma-4-31b-it", // the paid sibling of a free id
    "google/gemma-4-31b-it:free ", // trailing space is trimmed, still exact
    "GOOGLE/GEMMA-4-31B-IT:FREE", // case spoof
    "google/gemma-4-31b-it:free:nitro",
    "google/gemma-4-31b-it:free,openai/gpt-4.1-mini",
    "typesafe/jev-1.13",
    "../etc/passwd",
    "x".repeat(500),
  ];
  for (const liar of liars) {
    const d = modelForAccess(cfg, "free", liar, normalizeChatModel, FALLBACK);
    if (liar.trim() === "google/gemma-4-31b-it:free") {
      assert.equal(d.ok, true);
      continue;
    }
    assert.equal(d.ok, false, liar);
    if (!d.ok) {
      assert.equal(d.status, 403);
      assert.equal(d.code, "model-not-free");
      assert.ok(d.message.includes(GITHUB_URL));
    }
  }
  // Non-string and object picks are not a model either.
  for (const odd of [123, null, {}, ["google/gemma-4-31b-it:free"]]) {
    const d = modelForAccess(cfg, "free", odd, normalizeChatModel, FALLBACK);
    if (odd === null || typeof odd === "number") {
      assert.deepEqual(d, { ok: true, model: cfg.defaultFreeModel });
    } else {
      assert.deepEqual(d, { ok: true, model: cfg.defaultFreeModel });
    }
  }
});

test("a custom allowlist is exact: only configured ids pass", () => {
  const c = loadPublicConfig({ JEV_PUBLIC: "1", JEV_FREE_MODELS: "a/b:free" });
  assert.equal(modelForAccess(c, "free", "a/b:free", normalizeChatModel, FALLBACK).ok, true);
  assert.equal(modelForAccess(c, "free", cfg.defaultFreeModel, normalizeChatModel, FALLBACK).ok, false);
});

test("BYOK and admin may use any chat model, but never Jev", () => {
  for (const kind of ["byok", "admin"] as const) {
    assert.deepEqual(
      modelForAccess(cfg, kind, "openai/gpt-4.1-mini", normalizeChatModel, FALLBACK),
      { ok: true, model: "openai/gpt-4.1-mini" },
    );
    assert.deepEqual(modelForAccess(cfg, kind, "typesafe/jev-1.13", normalizeChatModel, FALLBACK), {
      ok: true,
      model: FALLBACK,
    });
    assert.deepEqual(modelForAccess(cfg, kind, "", normalizeChatModel, FALLBACK), {
      ok: true,
      model: FALLBACK,
    });
  }
});

test("BYOK header: strict shape, nothing echoed", () => {
  const good = "sk-or-v1-" + "a1b2c3d4".repeat(4);
  assert.deepEqual(readByokKey({}), { ok: true, key: null });
  assert.deepEqual(readByokKey({ [BYOK_HEADER]: good }), { ok: true, key: good });
  assert.deepEqual(readByokKey({ [BYOK_HEADER]: `  ${good}  ` }), { ok: true, key: good });
  const bads = [
    "",
    "short",
    "sk-or-v1-has space inside-and-long-enough",
    "sk-or-v1-new\nline-abcdefghijklmnop",
    "sk-or-v1-ünïcode-abcdefghijklmnopqrstuv",
    "a".repeat(513),
    good + ", " + good,
    ["x", "y"] as unknown as string,
  ];
  for (const bad of bads) {
    const r = readByokKey({ [BYOK_HEADER]: bad });
    assert.equal(r.ok, false, String(bad));
    if (!r.ok && typeof bad === "string" && bad.length > 8) {
      assert.ok(!r.message.includes(bad.trim()), "message must not echo the key");
    }
  }
});

test("RateLimiter: per-IP and global daily caps, atomic, reset at UTC midnight", () => {
  let t = Date.UTC(2026, 9, 17, 12, 0, 0);
  const limiter = new RateLimiter(() => t);
  const small = loadPublicConfig({
    JEV_PUBLIC: "1",
    JEV_FREE_LLM_PER_IP_PER_DAY: "3",
    JEV_FREE_LLM_GLOBAL_PER_DAY: "5",
    JEV_FREE_LLM_GLOBAL_PER_MIN: "100",
  });
  const a = freeGate(limiter, small, "1.1.1.1");
  const b = freeGate(limiter, small, "2.2.2.2");
  const c = freeGate(limiter, small, "3.3.3.3");
  assert.equal(a.llm(), null);
  assert.equal(a.llm(), null);
  assert.equal(a.llm(), null);
  const deniedIp = a.llm();
  assert.equal(deniedIp?.code, "limit-day");
  assert.equal(deniedIp?.status, 429);
  assert.equal(deniedIp?.message, FREE_USED_UP_MESSAGE);
  assert.ok(deniedIp?.message.includes(GITHUB_URL));
  assert.equal(b.llm(), null);
  assert.equal(b.llm(), null); // global now 5
  const deniedGlobal = c.llm();
  assert.equal(deniedGlobal?.code, "limit-day");
  // A denied hit counts nothing: C's own bucket is still empty.
  assert.equal(freeLlmRoom(limiter, small, "3.3.3.3")?.code, "limit-day"); // global is full
  // Next UTC day everything resets.
  t = Date.UTC(2026, 9, 18, 0, 0, 1);
  assert.equal(a.llm(), null);
  assert.equal(c.llm(), null);
});

test("RateLimiter: Jev calls have their own caps, separate from LLM requests", () => {
  const limiter = new RateLimiter(() => Date.UTC(2026, 9, 17, 12));
  const small = loadPublicConfig({
    JEV_PUBLIC: "1",
    JEV_FREE_JEV_PER_IP_PER_DAY: "2",
    JEV_FREE_JEV_GLOBAL_PER_DAY: "50",
  });
  const g = freeGate(limiter, small, "9.9.9.9");
  assert.equal(g.jev(), null);
  assert.equal(g.jev(), null);
  assert.equal(g.jev()?.code, "limit-day");
  assert.equal(g.llm(), null); // LLM budget untouched
});

test("RateLimiter: per-minute global cap says busy, then recovers next minute", () => {
  let t = Date.UTC(2026, 9, 17, 12, 0, 5);
  const limiter = new RateLimiter(() => t);
  const small = loadPublicConfig({ JEV_PUBLIC: "1", JEV_FREE_LLM_GLOBAL_PER_MIN: "2" });
  const g = freeGate(limiter, small, "4.4.4.4");
  assert.equal(g.llm(), null);
  assert.equal(g.llm(), null);
  const busy = g.llm();
  assert.equal(busy?.code, "limit-busy");
  assert.ok((busy?.retryAfterSec ?? 0) >= 1 && (busy?.retryAfterSec ?? 99) <= 60);
  t += MINUTE_MS;
  assert.equal(g.llm(), null);
});

test("RateLimiter: memory is bounded and old windows are swept", () => {
  let t = Date.UTC(2026, 9, 17, 12);
  const limiter = new RateLimiter(() => t);
  const rule = (key: string) => ({ scope: "x", key, limit: 1, windowMs: MINUTE_MS });
  for (let i = 0; i < 1000; i++) limiter.takeAll([rule(`k${i}`)]);
  assert.equal(limiter.size, 1000);
  t += 2 * MINUTE_MS;
  limiter.takeAll([rule("fresh")]);
  assert.equal(limiter.size, 1); // everything from the old window is gone
  assert.ok(DAY_MS === 24 * 60 * MINUTE_MS);
});

test("clampFreeInput: oversize case refused, chat history trimmed, instructions capped", () => {
  const tiny = loadPublicConfig({
    JEV_PUBLIC: "1",
    JEV_FREE_MAX_STATE_CHARS: "1000",
    JEV_FREE_MAX_MESSAGES: "2",
    JEV_FREE_MAX_MESSAGE_CHARS: "200",
    JEV_FREE_MAX_INSTRUCTION_CHARS: "10",
  });
  const big = clampFreeInput(tiny, { state: "x".repeat(1001), questions: {} });
  assert.equal(big.ok, false);
  const ok = clampFreeInput(tiny, {
    state: "hi",
    questions: {},
    instructions: "z".repeat(50),
    messages: [
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "y".repeat(500) },
    ],
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.messages.length, 2);
    assert.equal(ok.messages[1].content.length, 200);
    assert.equal(ok.instructions.length, 10);
  }
});

test("free gate: an oversize Jev payload is refused before it is counted", () => {
  const limiter = new RateLimiter(() => Date.UTC(2026, 9, 17, 12));
  const c = loadPublicConfig({ JEV_PUBLIC: "1", JEV_FREE_MAX_JEV_CHARS: "5000", JEV_FREE_JEV_PER_IP_PER_DAY: "1" });
  const g = freeGate(limiter, c, "7.7.7.7");
  assert.equal(g.jev(5001)?.code, "limit-size");
  assert.equal(g.jev(5001)?.status, 413);
  assert.equal(g.jev(4000), null); // still has its one call
  assert.equal(g.jev(4000)?.code, "limit-day");
});

test("free tier: a spent key limit (402) reads as used up, a 429 as busy", () => {
  assert.equal(friendlyUpstreamMessage(402, "free", "LLM"), FREE_USED_UP_MESSAGE);
  assert.match(friendlyUpstreamMessage(429, "free", "Jev"), /busy/);
});

test("friendly upstream wording never carries upstream text", () => {
  assert.match(friendlyUpstreamMessage(401, "byok", "LLM"), /did not accept your key/);
  assert.match(friendlyUpstreamMessage(402, "byok", "Jev"), /out of credit/);
  assert.ok(friendlyUpstreamMessage(429, "free", "LLM").includes(GITHUB_URL));
  assert.equal(friendlyUpstreamMessage(500, "admin", "Jev"), "Jev request failed (details omitted).");
});

test("scrubKnown removes known secrets, wherever they appear", () => {
  const key = "sk-or-v1-CANARYCANARYCANARY1234";
  assert.equal(scrubKnown(`bad header ${key} in ${key}`, key), "bad header [redacted] in [redacted]");
  assert.equal(scrubKnown("nothing here", key, null, undefined), "nothing here");
});
