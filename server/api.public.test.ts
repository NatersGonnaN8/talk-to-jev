/**
 * Public mode end to end: the real /api handler on a real http server, talking
 * to a MOCK OpenRouter on 127.0.0.1. No real network, no real keys: both keys
 * below are canaries. Every upstream request is recorded so the tests can
 * assert exactly which key and which model went where.
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApiHandler } from "./api.ts";
import { FREE_USED_UP_MESSAGE, GITHUB_URL } from "./publicMode.ts";

const SERVER_KEY = "sk-or-v1-SERVERKEYCANARY0123456789abcdef";
const VISITOR_KEY = "sk-or-v1-VISITORKEYCANARY0123456789abcdef";
const FREE_MODEL = "google/gemma-4-31b-it:free";
const PAID_MODEL = "openai/gpt-4.1-mini";

type Seen = {
  path: string;
  auth: string;
  model?: string;
  maxTokens?: number;
  body: Record<string, unknown>;
};

let upstream: http.Server;
let upstreamBase = "";
let seen: Seen[] = [];
let chatReply: (n: number, body: Record<string, unknown>) => Record<string, unknown> | { status: number };
let jevStatus = 200;

function readAll(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
  });
}

before(async () => {
  upstream = http.createServer(async (req, res) => {
    const raw = await readAll(req);
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      /* ignore */
    }
    const path = (req.url ?? "").split("?")[0];
    seen.push({
      path,
      auth: String(req.headers.authorization ?? ""),
      model: typeof body.model === "string" ? body.model : undefined,
      maxTokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
      body,
    });
    res.setHeader("Content-Type", "application/json");
    if (path === "/api/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" }, { id: "typesafe/jev-1.13" }] }));
      return;
    }
    if (path === "/api/alpha/decisions") {
      if (jevStatus !== 200) {
        res.statusCode = jevStatus;
        // A hostile upstream that echoes the Authorization header back.
        res.end(JSON.stringify({ error: { message: `bad key ${req.headers.authorization}` } }));
        return;
      }
      res.end(
        JSON.stringify({
          model: "typesafe/jev-1.13",
          answers: { q1: { type: "noul", probability: 0.7 } },
          usage: { cost: 0.00004 },
        }),
      );
      return;
    }
    if (path === "/api/v1/chat/completions") {
      const n = seen.filter((s) => s.path === path).length;
      const out = chatReply(n, body);
      if ("status" in out && typeof out.status === "number") {
        res.statusCode = out.status;
        res.end(JSON.stringify({ error: { message: `no ${req.headers.authorization}` } }));
        return;
      }
      res.end(JSON.stringify(out));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  upstreamBase = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

after(() => {
  upstream.close();
});

const BASE_ENV: Record<string, string> = {
  JEV_PUBLIC: "1",
  OPENROUTER_API_KEY: SERVER_KEY,
};
let savedEnv: Record<string, string | undefined> = {};
let app: http.Server;
let appUrl = "";
let logs: string[] = [];
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };

function setEnv(extra: Record<string, string> = {}) {
  const all = { ...BASE_ENV, JEV_OPENROUTER_BASE: upstreamBase, ...extra };
  savedEnv = {};
  for (const [k, v] of Object.entries(all)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
}

async function startApp(extra: Record<string, string> = {}) {
  setEnv(extra);
  const handler = createApiHandler({ env: { ...process.env } });
  app = http.createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404;
      res.end("{}");
    }),
  );
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
  appUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
}

beforeEach(() => {
  seen = [];
  logs = [];
  jevStatus = 200;
  chatReply = () => ({
    choices: [{ message: { role: "assistant", content: "Hello from the mock." } }],
  });
  const grab =
    (name: keyof typeof realConsole) =>
    (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      void name;
    };
  console.log = grab("log");
  console.info = grab("info");
  console.warn = grab("warn");
  console.error = grab("error");
});

afterEach(async () => {
  Object.assign(console, realConsole);
  await new Promise<void>((r) => (app ? app.close(() => r()) : r()));
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

type Resp = { status: number; headers: http.IncomingHttpHeaders; text: string };

function call(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Resp> {
  return new Promise((resolve, reject) => {
    const data = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const req = http.request(
      appUrl + path,
      {
        method,
        headers: {
          ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
      },
    );
    req.on("error", reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

function sse(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n\n")
    .map((f) => f.replace(/^data:\s*/, "").trim())
    .filter(Boolean)
    .map((j) => JSON.parse(j) as Record<string, unknown>);
}

const chatBody = (model?: string, extra: Record<string, unknown> = {}) => ({
  mode: "chat",
  state: "A short case.",
  questions: {},
  messages: [{ role: "user", content: "Hello" }],
  ...(model !== undefined ? { model } : {}),
  ...extra,
});

function assertNoKeys(label: string, ...texts: string[]) {
  for (const t of [...texts, ...logs]) {
    assert.ok(!t.includes("SERVERKEYCANARY"), `${label}: server key leaked`);
    assert.ok(!t.includes("VISITORKEYCANARY"), `${label}: visitor key leaked`);
  }
}

const jevBody = {
  state: "A short case.",
  questions: { q1: { type: "noul", instructions: "Is it true?" } },
};

// ---------------------------------------------------------------- free tier

test("free tier: a free model works on the server key with a capped max_tokens", async () => {
  await startApp();
  const r = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL) });
  assert.equal(r.status, 200);
  const events = sse(r.text);
  assert.ok(events.some((e) => e.type === "delta" && String(e.text).includes("Hello from the mock")));
  const chat = seen.filter((s) => s.path === "/api/v1/chat/completions");
  assert.equal(chat.length, 1);
  assert.equal(chat[0].auth, `Bearer ${SERVER_KEY}`);
  assert.equal(chat[0].model, FREE_MODEL);
  assert.equal(chat[0].maxTokens, 4096);
  assertNoKeys("free chat", r.text);
});

test("free tier: no model in the request means the free default, never the server's paid LLM_MODEL", async () => {
  await startApp({ LLM_MODEL: PAID_MODEL });
  const r = await call("POST", "/api/llm", { body: chatBody(undefined) });
  assert.equal(r.status, 200);
  assert.equal(seen[0].model, "nvidia/nemotron-3-super-120b-a12b:free");
  const health = JSON.parse((await call("GET", "/api/health")).text);
  assert.equal(health.llmModel, "nvidia/nemotron-3-super-120b-a12b:free");
});

test("free tier: a non-free model is refused and nothing reaches the upstream", async () => {
  await startApp();
  const r = await call("POST", "/api/llm", { body: chatBody(PAID_MODEL) });
  assert.equal(r.status, 403);
  const body = JSON.parse(r.text);
  assert.equal(body.code, "model-not-free");
  assert.ok(body.message.includes(GITHUB_URL));
  assert.equal(seen.length, 0);
});

test("free tier: a lying client can never pair the server key with a paid model", async () => {
  await startApp();
  const liars = [
    PAID_MODEL,
    "openai/gpt-5:free",
    "google/gemma-4-31b-it",
    "GOOGLE/GEMMA-4-31B-IT:FREE",
    "google/gemma-4-31b-it:free:nitro",
    "google/gemma-4-31b-it:free,openai/gpt-4.1-mini",
    "deepseek/deepseek-v4-flash",
  ];
  for (const model of liars) {
    const r = await call("POST", "/api/llm", { body: chatBody(model) });
    assert.equal(r.status, 403, model);
  }
  // Also via a header trying to smuggle a second model, and a body with extra model-ish fields.
  const sneaky = await call("POST", "/api/llm", {
    body: { ...chatBody(FREE_MODEL), models: [PAID_MODEL], route: "fallback", provider: { order: ["x"] } },
  });
  assert.equal(sneaky.status, 200);
  // The invariant, asserted on the upstream log: every call carrying the server key used an allowlisted :free model.
  for (const s of seen.filter((x) => x.path === "/api/v1/chat/completions")) {
    assert.equal(s.auth, `Bearer ${SERVER_KEY}`);
    assert.ok(s.model?.endsWith(":free"), String(s.model));
    assert.equal(s.model, FREE_MODEL);
    assert.deepEqual(Object.keys(s.body).sort(), ["include_reasoning", "max_tokens", "messages", "model", "reasoning", "stream", "tool_choice", "tools"]);
  }
});

test("free tier: LLM requests are capped per IP per day, with a friendly message", async () => {
  await startApp({ JEV_FREE_LLM_PER_IP_PER_DAY: "2" });
  const h = { "X-Forwarded-For": "203.0.113.10" };
  assert.equal((await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h })).status, 200);
  assert.equal((await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h })).status, 200);
  const third = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h });
  assert.equal(third.status, 429);
  const body = JSON.parse(third.text);
  assert.equal(body.message, FREE_USED_UP_MESSAGE);
  assert.ok(body.message.includes("OpenRouter key") && body.message.includes(GITHUB_URL));
  assert.ok(Number(third.headers["retry-after"]) >= 1);
  assert.equal(seen.filter((s) => s.path === "/api/v1/chat/completions").length, 2);
  // A different visitor still has their own budget.
  const other = await call("POST", "/api/llm", {
    body: chatBody(FREE_MODEL),
    headers: { "X-Forwarded-For": "203.0.113.11" },
  });
  assert.equal(other.status, 200);
  // Usage endpoint tells the visitor what is left.
  const usage = JSON.parse((await call("GET", "/api/usage", { headers: h })).text);
  assert.equal(usage.free.llmLeft, 0);
});

test("free tier: the global daily cap stops everyone, and a forged CF-Connecting-IP does not dodge the per-IP cap", async () => {
  await startApp({ JEV_FREE_LLM_PER_IP_PER_DAY: "1", JEV_FREE_LLM_GLOBAL_PER_DAY: "3" });
  // Same real hop, rotating forged CF headers: still one bucket.
  const a = await call("POST", "/api/llm", {
    body: chatBody(FREE_MODEL),
    headers: { "X-Forwarded-For": "203.0.113.20", "CF-Connecting-IP": "1.1.1.1" },
  });
  const b = await call("POST", "/api/llm", {
    body: chatBody(FREE_MODEL),
    headers: { "X-Forwarded-For": "203.0.113.20", "CF-Connecting-IP": "2.2.2.2" },
  });
  assert.equal(a.status, 200);
  assert.equal(b.status, 429);
  // Genuine Cloudflare last hop: the CF header is trusted and gives each visitor their own bucket.
  const cf = (ip: string) => ({ "X-Forwarded-For": "173.245.48.10", "CF-Connecting-IP": ip });
  assert.equal((await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: cf("198.51.100.1") })).status, 200);
  assert.equal((await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: cf("198.51.100.2") })).status, 200);
  // Global is now 3 of 3.
  const late = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: cf("198.51.100.3") });
  assert.equal(late.status, 429);
  assert.equal(JSON.parse(late.text).code, "limit-day");
  assert.equal(seen.filter((s) => s.path === "/api/v1/chat/completions").length, 3);
});

test("free tier: every upstream request counts, so the loop cannot outrun the cap", async () => {
  // The model keeps asking for a tool, so one session would make many upstream requests.
  chatReply = () => ({
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "c1", type: "function", function: { name: "read_jev_state", arguments: "{}" } }],
        },
      },
    ],
  });
  await startApp({ JEV_FREE_LLM_PER_IP_PER_DAY: "3", JEV_FREE_MAX_ROUNDS: "6" });
  const r = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL) });
  const events = sse(r.text);
  const err = events.find((e) => e.type === "error");
  assert.ok(err, "the session should stop with a friendly error");
  assert.ok(String(err?.message).includes(GITHUB_URL));
  assert.equal(seen.filter((s) => s.path === "/api/v1/chat/completions").length, 3);
});

test("free tier: loop turns are capped by JEV_FREE_MAX_ROUNDS", async () => {
  chatReply = () => ({
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "c1", type: "function", function: { name: "read_jev_state", arguments: "{}" } }],
        },
      },
    ],
  });
  await startApp({ JEV_FREE_MAX_ROUNDS: "3" });
  await call("POST", "/api/llm", { body: chatBody(FREE_MODEL) });
  assert.equal(seen.filter((s) => s.path === "/api/v1/chat/completions").length, 3);
});

test("free tier: ask_jev inside the loop uses the server key, counts as a Jev call, and is capped", async () => {
  let n = 0;
  chatReply = () => {
    n += 1;
    if (n % 2 === 1) {
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [{ id: `c${n}`, type: "function", function: { name: "ask_jev", arguments: "{}" } }],
            },
          },
        ],
      };
    }
    return { choices: [{ message: { role: "assistant", content: "Jev answered." } }] };
  };
  await startApp({ JEV_FREE_JEV_PER_IP_PER_DAY: "1" });
  const loop = () =>
    call("POST", "/api/llm", { body: { ...chatBody(FREE_MODEL, jevBody), mode: "agentic-loop" } });
  const first = await loop();
  const ev1 = sse(first.text);
  assert.ok(ev1.some((e) => e.type === "tool" && e.name === "ask_jev" && e.ok === true));
  const jev = seen.filter((s) => s.path === "/api/alpha/decisions");
  assert.equal(jev.length, 1);
  assert.equal(jev[0].auth, `Bearer ${SERVER_KEY}`);
  assert.equal(jev[0].model, "typesafe/jev-1.13");
  // Second loop: the Jev budget (1) is spent, so ask_jev fails with the friendly message and Jev is not called again.
  n = 0;
  const second = await loop();
  const ev2 = sse(second.text);
  const failed = ev2.find((e) => e.type === "tool" && e.name === "ask_jev" && e.ok === false);
  assert.ok(failed, "ask_jev should be refused");
  assert.ok(String(failed?.message).includes(GITHUB_URL));
  assert.equal(seen.filter((s) => s.path === "/api/alpha/decisions").length, 1);
  assertNoKeys("agentic loop", first.text, second.text);
});

test("free tier: direct /api/jev uses the server key, counts, and caps", async () => {
  await startApp({ JEV_FREE_JEV_PER_IP_PER_DAY: "1" });
  const ok = await call("POST", "/api/jev", { body: jevBody });
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.text).model, "typesafe/jev-1.13");
  assert.equal(seen[0].auth, `Bearer ${SERVER_KEY}`);
  const capped = await call("POST", "/api/jev", { body: jevBody });
  assert.equal(capped.status, 429);
  assert.ok(JSON.parse(capped.text).message.includes(GITHUB_URL));
  assert.equal(seen.length, 1);
});

test("free tier: /api/jev forwards only the clamped chat, never the raw transcript", async () => {
  await startApp({ JEV_FREE_MAX_JEV_CHARS: "400000" });
  const transcript = Array.from({ length: 100 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "m".repeat(9000),
  }));
  const r = await call("POST", "/api/jev", {
    body: { ...jevBody, includeTranscript: true, transcript },
  });
  assert.equal(r.status, 200);
  const sent = seen.find((s) => s.path === "/api/alpha/decisions");
  const state = sent?.body.state as { case: string; transcript: Array<{ content: string }> };
  assert.ok(Array.isArray(state.transcript));
  assert.equal(state.transcript.length, 20);
  assert.ok(state.transcript.every((m) => m.content.length <= 6000));
});

test("free tier: a Jev payload over the size cap is refused, not counted, and never sent", async () => {
  await startApp({ JEV_FREE_JEV_PER_IP_PER_DAY: "1" });
  const transcript = Array.from({ length: 20 }, () => ({ role: "user", content: "m".repeat(6000) }));
  const big = await call("POST", "/api/jev", { body: { ...jevBody, includeTranscript: true, transcript } });
  assert.equal(big.status, 413);
  assert.equal(JSON.parse(big.text).code, "limit-size");
  assert.equal(seen.length, 0);
  // The refusal did not use up the one allowed Jev call.
  const small = await call("POST", "/api/jev", { body: jevBody });
  assert.equal(small.status, 200);
});

test("free tier: ask_jev in the loop is refused when the payload is over the size cap", async () => {
  let n = 0;
  chatReply = () => {
    n += 1;
    return n === 1
      ? {
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
                tool_calls: [{ id: "c1", type: "function", function: { name: "ask_jev", arguments: "{}" } }],
              },
            },
          ],
        }
      : { choices: [{ message: { role: "assistant", content: "Done." } }] };
  };
  await startApp({ JEV_FREE_MAX_JEV_CHARS: "2000", JEV_FREE_MAX_ROUNDS: "2" });
  const r = await call("POST", "/api/llm", {
    body: { ...chatBody(FREE_MODEL, { ...jevBody, state: "s".repeat(3000) }), mode: "agentic-loop" },
  });
  const failed = sse(r.text).find((e) => e.type === "tool" && e.name === "ask_jev" && e.ok === false);
  assert.ok(failed);
  assert.equal(seen.filter((s) => s.path === "/api/alpha/decisions").length, 0);
});

test("free tier: an oversize case is refused before any upstream call", async () => {
  await startApp({ JEV_FREE_MAX_STATE_CHARS: "1000" });
  const r = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL, { state: "x".repeat(1001) }) });
  assert.equal(r.status, 413);
  const j = await call("POST", "/api/jev", { body: { ...jevBody, state: "x".repeat(1001) } });
  assert.equal(j.status, 413);
  assert.equal(seen.length, 0);
});

test("free tier: models endpoint shows only the free list and spends no key", async () => {
  await startApp();
  const r = await call("POST", "/api/openrouter/models", { body: {} });
  assert.equal(r.status, 200);
  const body = JSON.parse(r.text);
  assert.equal(body.tier, "free");
  assert.ok(body.models.length >= 1);
  for (const m of body.models) assert.ok(m.id.endsWith(":free"));
  assert.equal(seen.length, 0);
});

test("free tier unavailable when the server has no key: friendly message, BYOK still works", async () => {
  await startApp({ OPENROUTER_API_KEY: "" });
  const r = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL) });
  assert.equal(r.status, 501);
  assert.equal(JSON.parse(r.text).code, "free-unavailable");
  const byok = await call("POST", "/api/llm", {
    body: chatBody(PAID_MODEL),
    headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY },
  });
  assert.equal(byok.status, 200);
  assert.equal(seen[0].auth, `Bearer ${VISITOR_KEY}`);
});

// -------------------------------------------------------------------- BYOK

test("BYOK: the visitor key goes upstream, the server key never does, any model is allowed, caps do not apply", async () => {
  await startApp({ JEV_FREE_LLM_PER_IP_PER_DAY: "1", JEV_FREE_LLM_GLOBAL_PER_DAY: "1" });
  for (let i = 0; i < 4; i++) {
    const r = await call("POST", "/api/llm", {
      body: chatBody(PAID_MODEL),
      headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY },
    });
    assert.equal(r.status, 200);
    assertNoKeys("byok chat", r.text);
  }
  const chat = seen.filter((s) => s.path === "/api/v1/chat/completions");
  assert.equal(chat.length, 4);
  for (const s of chat) {
    assert.equal(s.auth, `Bearer ${VISITOR_KEY}`);
    assert.equal(s.model, PAID_MODEL);
    assert.equal(s.maxTokens, undefined); // free-tier caps are for the free tier
  }
  assert.ok(!seen.some((s) => s.auth.includes("SERVERKEYCANARY")));
});

test("BYOK: ask_jev inside the loop and direct /api/jev both use the visitor key", async () => {
  let n = 0;
  chatReply = () => {
    n += 1;
    return n === 1
      ? {
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
                tool_calls: [{ id: "c1", type: "function", function: { name: "ask_jev", arguments: "{}" } }],
              },
            },
          ],
        }
      : { choices: [{ message: { role: "assistant", content: "Done." } }] };
  };
  await startApp();
  const h = { "X-Jev-OpenRouter-Key": VISITOR_KEY };
  const loop = await call("POST", "/api/llm", {
    body: { ...chatBody(PAID_MODEL, jevBody), mode: "agentic-loop" },
    headers: h,
  });
  const direct = await call("POST", "/api/jev", { body: jevBody, headers: h });
  assert.equal(direct.status, 200);
  const decisions = seen.filter((s) => s.path === "/api/alpha/decisions");
  assert.equal(decisions.length, 2);
  for (const d of decisions) assert.equal(d.auth, `Bearer ${VISITOR_KEY}`);
  assert.ok(seen.every((s) => !s.auth.includes("SERVERKEYCANARY")));
  assertNoKeys("byok jev", loop.text, direct.text);
});

test("BYOK: models endpoint lists the public catalog with no Authorization at all", async () => {
  await startApp();
  const r = await call("POST", "/api/openrouter/models", {
    body: {},
    headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY },
  });
  const body = JSON.parse(r.text);
  assert.equal(body.tier, "byok");
  assert.deepEqual(body.models.map((m: { id: string }) => m.id), ["openai/gpt-4.1-mini"]);
  assert.equal(seen[0].auth, "");
  assertNoKeys("byok models", r.text);
});

test("BYOK: a malformed key is refused with a message that does not echo it", async () => {
  await startApp();
  const bads = ["sk-or-v1-has space inside-and-long-enough-VISITORKEYCANARY", "a".repeat(600), "short"];
  for (const bad of bads) {
    for (const path of ["/api/llm", "/api/jev", "/api/openrouter/models"]) {
      const r = await call("POST", path, {
        body: path === "/api/jev" ? jevBody : chatBody(FREE_MODEL),
        headers: { "X-Jev-OpenRouter-Key": bad },
      });
      assert.equal(r.status, 400, `${path} ${bad.slice(0, 12)}`);
      assert.ok(!r.text.includes(bad));
      assertNoKeys("bad key", r.text);
    }
  }
  assert.equal(seen.length, 0);
});

test("BYOK: upstream 401/402/429 become friendly messages, even when the upstream echoes the key", async () => {
  await startApp();
  const h = { "X-Jev-OpenRouter-Key": VISITOR_KEY };
  chatReply = () => ({ status: 401 });
  const r1 = await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: h });
  assert.match(String(sse(r1.text).find((e) => e.type === "error")?.message), /did not accept your key/);
  chatReply = () => ({ status: 402 });
  const r2 = await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: h });
  assert.match(String(sse(r2.text).find((e) => e.type === "error")?.message), /out of credit/);
  jevStatus = 401;
  const r3 = await call("POST", "/api/jev", { body: jevBody, headers: h });
  assert.equal(r3.status, 502);
  assert.match(JSON.parse(r3.text).message, /did not accept your key/);
  assertNoKeys("upstream errors", r1.text, r2.text, r3.text);
});

test("BYOK header is only read on the three key-spending endpoints", async () => {
  await startApp();
  const r = await call("GET", "/api/health", { headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY } });
  assert.equal(r.status, 200);
  assertNoKeys("health", r.text);
  const s = await call("GET", "/api/settings", { headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY } });
  assertNoKeys("settings", s.text);
});

// ----------------------------------------------------------- hardening

test("public mode: Settings is read-only, shows no part of the server key, docs update is off", async () => {
  await startApp();
  const s = JSON.parse((await call("GET", "/api/settings")).text);
  assert.equal(s.readOnly, true);
  assert.equal(s.public, true);
  assert.equal(s.keys[0].present, true);
  assert.equal(s.keys[0].last4, null);
  const w = await call("POST", "/api/settings", { body: { id: "openrouter", value: "x" } });
  assert.equal(w.status, 403);
  const d = await call("POST", "/api/docs/update", { body: {} });
  assert.equal(d.status, 403);
  assertNoKeys("settings", JSON.stringify(s));
  assert.equal(seen.length, 0);
});

test("public mode: the old gates still hold (CSRF, JSON only, size, traversal)", async () => {
  await startApp();
  assert.equal(
    (await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: { Origin: "https://evil.example" } })).status,
    403,
  );
  assert.equal(
    (await call("GET", "/api/health", { headers: { "Sec-Fetch-Site": "cross-site" } })).status,
    403,
  );
  const textPlain = await new Promise<number>((resolve, reject) => {
    const req = http.request(appUrl + "/api/llm", { method: "POST", headers: { "Content-Type": "text/plain" } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end("{}");
  });
  assert.equal(textPlain, 415);
  const big = await call("POST", "/api/llm", { body: { messages: "x".repeat(2.2 * 1024 * 1024) } }).catch(() => null);
  if (big) assert.equal(big.status, 413);
  assert.equal((await call("GET", "/api/docs/file?path=../../package.json")).status, 404);
  assert.equal(seen.length, 0);
});

test("public mode: per-IP rate limits protect the server (heavy, lookup, general)", async () => {
  await startApp({
    JEV_RL_HEAVY_PER_IP_PER_MIN: "2",
    JEV_RL_LOOKUP_PER_IP_PER_MIN: "1",
    JEV_RL_API_PER_IP_PER_MIN: "1000",
  });
  const h = { "X-Forwarded-For": "203.0.113.77" };
  const byok = { ...h, "X-Jev-OpenRouter-Key": VISITOR_KEY };
  assert.equal((await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: byok })).status, 200);
  assert.equal((await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: byok })).status, 200);
  const third = await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: byok });
  assert.equal(third.status, 429);
  assert.ok(Number(third.headers["retry-after"]) >= 1);
  // Another visitor is unaffected.
  assert.equal(
    (await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: { ...byok, "X-Forwarded-For": "203.0.113.78" } })).status,
    200,
  );
  // Weather and place lookups share the lookup cap. The first reaches the lookup (and may fail to fetch, never 429),
  // the second is refused by the limiter before any network call.
  const w1 = await call("GET", "/api/geo?q=", { headers: h });
  assert.notEqual(w1.status, 429);
  const w2 = await call("GET", "/api/geo?q=Columbus", { headers: h });
  assert.equal(w2.status, 429);
});

test("public mode: concurrent streams are capped per address", async () => {
  await startApp({ JEV_MAX_CONCURRENT_PER_IP: "1" });
  // A slow upstream keeps the first stream open.
  const prev = chatReply;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const slow = http.createServer(async (req, res) => {
    await readAll(req);
    await gate;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "late" } }] }));
  });
  await new Promise<void>((r) => slow.listen(0, "127.0.0.1", r));
  process.env.JEV_OPENROUTER_BASE = `http://127.0.0.1:${(slow.address() as AddressInfo).port}`;
  const h = { "X-Forwarded-For": "203.0.113.90" };
  const first = call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h });
  await new Promise((r) => setTimeout(r, 150));
  const second = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h });
  assert.equal(second.status, 429);
  release();
  const done = await first;
  assert.equal(done.status, 200);
  // The slot is released afterwards.
  process.env.JEV_OPENROUTER_BASE = upstreamBase;
  const third = await call("POST", "/api/llm", { body: chatBody(FREE_MODEL), headers: h });
  assert.equal(third.status, 200);
  slow.close();
  chatReply = prev;
});

test("public mode: logs and every response are free of both keys across a mixed workload", async () => {
  await startApp();
  const out: string[] = [];
  const byok = { "X-Jev-OpenRouter-Key": VISITOR_KEY };
  out.push((await call("POST", "/api/llm", { body: chatBody(FREE_MODEL) })).text);
  out.push((await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: byok })).text);
  out.push((await call("POST", "/api/llm", { body: chatBody(PAID_MODEL) })).text);
  out.push((await call("POST", "/api/jev", { body: jevBody })).text);
  out.push((await call("POST", "/api/jev", { body: jevBody, headers: byok })).text);
  out.push((await call("GET", "/api/health")).text);
  out.push((await call("GET", "/api/settings")).text);
  out.push((await call("GET", "/api/usage")).text);
  jevStatus = 500;
  out.push((await call("POST", "/api/jev", { body: jevBody, headers: byok })).text);
  chatReply = () => ({ status: 500 });
  out.push((await call("POST", "/api/llm", { body: chatBody(PAID_MODEL), headers: byok })).text);
  assert.ok(logs.length > 0, "the server does log (model, mode, counts), just never keys");
  assertNoKeys("mixed workload", ...out);
});

test("local default is unchanged: no JEV_PUBLIC means admin access and no BYOK header handling", async () => {
  await startApp({ JEV_PUBLIC: "", JEV_READONLY_KEYS: "1" });
  // Admin: the server key, any model, the header is ignored.
  const r = await call("POST", "/api/llm", {
    body: chatBody(PAID_MODEL),
    headers: { "X-Jev-OpenRouter-Key": VISITOR_KEY },
  });
  assert.equal(r.status, 200);
  assert.equal(seen[0].auth, `Bearer ${SERVER_KEY}`);
  assert.equal(seen[0].model, PAID_MODEL);
  assert.equal(seen[0].maxTokens, undefined);
  const health = JSON.parse((await call("GET", "/api/health")).text);
  assert.equal(health.public, undefined);
});
