/**
 * The whole /api/* surface, as one connect-style handler. vite.config.ts
 * mounts it on both `vite` (dev) and `vite preview` (hosted), and the tests
 * mount it on a plain http server, so every gate is the same everywhere.
 *
 * Local default: loopback only, one operator, keys in .env.local (unchanged).
 * JEV_PUBLIC=1: anyone, no login. Free tier on the server key (free models
 * only, capped) or BYOK with the visitor's own key in a request header.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WeatherHttpError, getWeather, searchPlaces } from "./weather.ts";
import {
  healthKeyFlags,
  isProviderId,
  keysReadOnly,
  loadEnvMap,
  present,
  sanitizePublicError,
  settingsPayload,
  upsertProviderValue,
} from "./settings.ts";
import { DEFAULT_JEV, DEFAULT_LLM } from "./openrouter.ts";
import { normalizeChatModel, resolveChatModel } from "./chatModel.ts";
import { callJev } from "./jev.ts";
import { runLlmSession } from "./llm.ts";
import { listOpenRouterModels, type OpenRouterChatModel } from "./openrouterModels.ts";
import { checkCatalogEmbed } from "./embedCheck.ts";
import { workshopPayloadBlocked } from "./violenceGate.ts";
import {
  CLOUDFLARE_RANGES,
  PRIVATE_RANGES,
  clientIp,
  ipKey,
  parseCidrList,
  type NetConfig,
} from "./netutil.ts";
import {
  DAY_MS,
  FREE_MODEL_LABELS,
  GITHUB_URL,
  MINUTE_MS,
  RateLimiter,
  clampFreeInput,
  freeGate,
  freeLlmRoom,
  freeUsage,
  loadPublicConfig,
  modelForAccess,
  readByokKey,
  scrubKnown,
  type Access,
  type Rule,
} from "./publicMode.ts";

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CATALOG_TTL_MS = 10 * 60_000;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * CSRF gate. The UI is same-origin, so any /api/* request that carries a
 * foreign Origin or a cross-site Sec-Fetch-Site came from another website
 * running in the user's browser. Browsers always stamp cross-site POSTs with
 * Origin, and pages cannot forge either header. Requests with neither header
 * (curl, address bar, same-origin GET) pass.
 */
export function isSameOrigin(req: IncomingMessage): boolean {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin" && site !== "none") {
    return false;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string") {
    const host = req.headers.host;
    if (!host) return false;
    // Vite already 403s foreign Host headers (allowedHosts), so Host is trusted.
    if (origin !== `http://${host}` && origin !== `https://${host}`) return false;
  }
  return true;
}

function send(
  res: ServerResponse,
  code: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function tooMany(res: ServerResponse, retryAfterSec: number, message: string, code = "rate-limited") {
  return send(res, 429, { ok: false, code, message }, { "Retry-After": String(retryAfterSec) });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const ok = (value: string) => {
      if (settled) return;
      settled = true;
      resolveBody(value);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    req.on("data", (c) => {
      if (settled) return;
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        fail(new HttpError(413, "Body too large."));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}

async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  // A cross-site POST can only be sent preflight-free as text/plain or a form
  // type. Our client always sends application/json, so anything else is not us.
  const type = String(req.headers["content-type"] || "");
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Expected application/json.");
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "Expected a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkMarkdown(p, acc);
    else if (name.endsWith(".md") || name.endsWith(".json") || name.endsWith(".txt")) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Content-Security-Policy for the hosted page. No script-src 'unsafe-eval' and
 * no inline script. style-src keeps 'unsafe-inline' because React and the
 * sanitized prose set style attributes. Images are same-origin or data/blob
 * only, so a prompt-injected markdown image cannot phone home. The Docs page
 * may frame the https source of a catalog doc (frame-src https:).
 */
export const HOSTED_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function hostedHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": HOSTED_CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  };
}

function publicError(err: unknown, ...secrets: Array<string | null | undefined>): string {
  const raw = err instanceof Error ? err.message : "server error";
  return sanitizePublicError(scrubKnown(raw, ...secrets));
}

export type ApiOptions = {
  /** Folder that holds docs/jev. Defaults to the repo root. */
  root?: string;
  /** Clock for the limiter (tests). */
  now?: () => number;
  /** Process env (tests). Defaults to process.env. Read once, when the handler is created. */
  env?: Record<string, string | undefined>;
};

type Next = (err?: unknown) => void;

export function createApiHandler(opts: ApiOptions = {}) {
  const root = opts.root ?? resolve(here, "..");
  const docsRoot = resolve(root, "docs", "jev");
  const bootEnv = opts.env ?? process.env;
  const pub = loadPublicConfig(bootEnv);
  const limiter = new RateLimiter(opts.now);
  const net: NetConfig = {
    trustedProxies: parseCidrList(bootEnv.JEV_TRUSTED_PROXIES || PRIVATE_RANGES),
    cloudflareRanges: parseCidrList(bootEnv.JEV_CLOUDFLARE_RANGES || CLOUDFLARE_RANGES),
  };
  let active = 0;
  const activeByIp = new Map<string, number>();
  let catalog: { at: number; models: OpenRouterChatModel[] } | null = null;
  const clock = opts.now ?? Date.now;

  function docsIndex() {
    const files = walkMarkdown(docsRoot)
      .map((abs) => {
        const rel = relative(docsRoot, abs).split(sep).join("/");
        let title = rel;
        let fetchedAt = "";
        let source = "";
        try {
          const text = readFileSync(abs, "utf8").slice(0, 1200);
          const src = text.match(/^source:\s*(.+)$/m);
          const at = text.match(/^fetched_at:\s*(.+)$/m);
          const h1 = text.match(/^#\s+(.+)$/m);
          if (src) source = src[1].trim();
          if (at) fetchedAt = at[1].trim();
          if (h1) title = h1[1].trim();
        } catch {
          /* skip */
        }
        return { path: rel, title, source, fetchedAt };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
    const manifestAt = files.find((f) => f.path === "INDEX.md")?.fetchedAt || "";
    return { files, fetchedAt: manifestAt };
  }

  function safeDocPath(rel: string) {
    const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleaned || cleaned.includes("..")) return null;
    const abs = resolve(docsRoot, cleaned);
    if (!abs.startsWith(docsRoot + sep)) return null;
    if (!existsSync(abs) || statSync(abs).isDirectory()) return null;
    return abs;
  }

  function primerText() {
    const p = join(docsRoot, "primer.md");
    if (!existsSync(p)) {
      return "Jev docs snapshot is empty. Use Update Jev docs. Jev is TypeSafe's System One model: state + typed questions (choice/noul/score) → answers with probabilities. Not a chatbot. OpenRouter POST /api/alpha/decisions, model typesafe/jev-1.13.";
    }
    return readFileSync(p, "utf8");
  }

  /** Per-IP and global per-minute rule for the endpoints that fetch from the network on a visitor's behalf. */
  function lookupRules(ip: string): Rule[] {
    return [
      { scope: "lookup-ip", key: ip, limit: pub.lookupPerIpPerMin, windowMs: MINUTE_MS },
      { scope: "lookup", key: "all", limit: pub.lookupGlobalPerMin, windowMs: MINUTE_MS },
    ];
  }

  function freeModelRows(): OpenRouterChatModel[] {
    return pub.freeModels.map((id) => ({ id, name: FREE_MODEL_LABELS[id] ?? id }));
  }

  return async function handler(req: IncomingMessage, res: ServerResponse, next: Next) {
    const url = req.url?.split("?")[0] ?? "";
    if (!url.startsWith("/api/")) return next();
    if (!isSameOrigin(req)) {
      return send(res, 403, { ok: false, message: "Cross-site request refused." });
    }
    const env = loadEnvMap();
    const serverKey = env.OPENROUTER_API_KEY;
    let visitorKey: string | null = null;
    try {
      // Who is asking, for limits only. Local mode has one operator and no limits.
      let ip = "local";
      if (pub.enabled) {
        ip = ipKey(clientIp(req, net));
        const hit = limiter.takeAll([
          { scope: "api-ip", key: ip, limit: pub.apiPerIpPerMin, windowMs: MINUTE_MS },
        ]);
        if (!hit.ok) {
          return tooMany(res, hit.retryAfterSec, "Too many requests. Slow down for a minute.");
        }
      }

      /**
       * Decide the key once. Admin: the server key, any model (local and the
       * old login-gated deploy). Public: a valid BYOK header means the
       * visitor's key; otherwise the free tier on the server key. The header
       * is read only on the three endpoints that spend a key.
       */
      const accessFor = (): { access: Access } | { refuse: () => void } => {
        if (!pub.enabled) {
          return { access: { kind: "admin", apiKey: serverKey ?? "" } };
        }
        const read = readByokKey(req.headers);
        if (!read.ok) {
          return {
            refuse: () => send(res, 400, { ok: false, code: "bad-key", message: read.message }),
          };
        }
        if (read.key) {
          visitorKey = read.key;
          return { access: { kind: "byok", apiKey: read.key } };
        }
        if (!present(serverKey)) {
          return {
            refuse: () =>
              send(res, 501, {
                ok: false,
                code: "free-unavailable",
                message: `The free tier is not available right now. Paste your own OpenRouter key in Settings, or get the app on GitHub: ${GITHUB_URL}`,
              }),
          };
        }
        return { access: { kind: "free", apiKey: serverKey as string } };
      };

      if (req.method === "GET" && url === "/api/health") {
        const docs = docsIndex();
        const keys = healthKeyFlags(env);
        return send(res, 200, {
          ok: true,
          hasKey: keys.openrouter,
          keys,
          jevModel: env.JEV_MODEL || DEFAULT_JEV,
          // Public mode never advertises the paid LLM_MODEL: the free tier has its own default.
          llmModel: pub.enabled ? pub.defaultFreeModel : env.LLM_MODEL || DEFAULT_LLM,
          docs: { files: docs.files.length, fetchedAt: docs.fetchedAt },
          ...(pub.enabled
            ? {
                public: true,
                freeTier: {
                  available: present(serverKey),
                  models: freeModelRows(),
                  defaultModel: pub.defaultFreeModel,
                },
                githubUrl: GITHUB_URL,
              }
            : {}),
        });
      }

      if (req.method === "GET" && url === "/api/usage") {
        if (!pub.enabled) return send(res, 200, { ok: true, public: false });
        const left = freeUsage(limiter, pub, ip);
        return send(res, 200, {
          ok: true,
          public: true,
          free: { llmLeft: left.llm, jevLeft: left.jev },
        });
      }

      if (req.method === "GET" && url === "/api/settings") {
        return send(res, 200, settingsPayload());
      }

      if (req.method === "POST" && url === "/api/openrouter/models") {
        await jsonBody(req);
        if (!pub.enabled) {
          const listed = await listOpenRouterModels(serverKey);
          if (!listed.ok) {
            return send(res, listed.status, { ok: false, message: listed.message });
          }
          return send(res, 200, { ok: true, models: listed.models });
        }
        const lim = limiter.takeAll(lookupRules(ip));
        if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many model list requests. Wait a minute.");
        const byok = readByokKey(req.headers);
        if (!byok.ok) {
          return send(res, 400, { ok: false, code: "bad-key", message: byok.message });
        }
        if (!byok.key) {
          // Free tier: the allowlist is the picker. No upstream call, no server key spent.
          return send(res, 200, { ok: true, models: freeModelRows(), tier: "free" });
        }
        if (!catalog || clock() - catalog.at > CATALOG_TTL_MS) {
          // The public catalog is the same for everyone, so it is fetched with no key at all.
          const listed = await listOpenRouterModels(undefined, { anonymous: true });
          if (!listed.ok) {
            return send(res, listed.status, { ok: false, message: listed.message });
          }
          catalog = { at: clock(), models: listed.models };
        }
        return send(res, 200, { ok: true, models: catalog.models, tier: "byok" });
      }

      if (req.method === "POST" && url === "/api/settings") {
        if (keysReadOnly()) {
          return send(res, 403, {
            ok: false,
            message: "Keys are set on the server and cannot be changed here.",
          });
        }
        const body = await jsonBody(req);
        if (!isProviderId(body.id)) {
          return send(res, 400, { ok: false, message: "Unknown key slot." });
        }
        if (typeof body.value !== "string") {
          return send(res, 400, { ok: false, message: "value must be a string." });
        }
        upsertProviderValue(body.id, body.value);
        return send(res, 200, settingsPayload());
      }

      if (req.method === "GET" && url === "/api/docs") {
        return send(res, 200, docsIndex());
      }

      if (req.method === "GET" && url === "/api/docs/file") {
        const q = new URL(req.url || "", "http://127.0.0.1").searchParams.get("path") || "";
        const abs = safeDocPath(q);
        if (!abs) return send(res, 404, { ok: false, message: "Doc not found." });
        const text = readFileSync(abs, "utf8");
        return send(res, 200, { ok: true, path: q, text });
      }

      if (req.method === "GET" && url === "/api/docs/embed") {
        if (pub.enabled) {
          const lim = limiter.takeAll(lookupRules(ip));
          if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many lookups. Wait a minute.");
        }
        const raw =
          new URL(req.url || "", "http://127.0.0.1").searchParams.get("url") ||
          "";
        const probe = await checkCatalogEmbed(raw, docsIndex().files);
        return send(res, 200, { ok: true, embed: probe.embed, src: probe.src });
      }

      if (req.method === "GET" && url === "/api/weather") {
        if (pub.enabled) {
          const lim = limiter.takeAll(lookupRules(ip));
          if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many weather lookups. Wait a minute.");
        }
        const params = new URL(req.url || "", "http://127.0.0.1").searchParams;
        try {
          const payload = await getWeather({
            q: params.get("q") || undefined,
            latitude: params.get("latitude") || undefined,
            longitude: params.get("longitude") || undefined,
          });
          return send(res, 200, { ok: true, ...payload });
        } catch (err) {
          if (err instanceof WeatherHttpError) {
            return send(res, err.status, { ok: false, message: err.message });
          }
          throw err;
        }
      }

      if (req.method === "GET" && url === "/api/geo") {
        if (pub.enabled) {
          const lim = limiter.takeAll(lookupRules(ip));
          if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many place lookups. Wait a minute.");
        }
        const q = new URL(req.url || "", "http://127.0.0.1").searchParams.get("q") || "";
        try {
          const results = await searchPlaces(q);
          return send(res, 200, { ok: true, results });
        } catch (err) {
          if (err instanceof WeatherHttpError) {
            return send(res, err.status, { ok: false, message: err.message });
          }
          throw err;
        }
      }

      if (req.method === "POST" && url === "/api/docs/update") {
        if (keysReadOnly()) {
          return send(res, 403, {
            ok: false,
            message: "Docs update is off on the hosted copy.",
          });
        }
        // Native ESM snapshotter. It fetches the web and writes docs/jev, so
        // it never runs in hosted or public mode (guard above).
        const { updateJevDocs } = (await import(
          "../scripts/update-jev-docs.mjs"
        )) as {
          updateJevDocs: (root?: string) => Promise<{
            ok: boolean;
            fetchedAt: string;
            fetched: number;
            failed: number;
            files: number;
            dest: string;
          }>;
        };
        const result = await updateJevDocs(root);
        return send(res, 200, result);
      }

      if (req.method === "POST" && url === "/api/jev") {
        if (pub.enabled) {
          const lim = limiter.takeAll([
            { scope: "heavy-ip", key: ip, limit: pub.heavyPerIpPerMin, windowMs: MINUTE_MS },
          ]);
          if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many requests. Wait a minute.");
        }
        const got = accessFor();
        if (!("access" in got)) return got.refuse();
        const access = got.access;
        if (access.kind === "admin" && !present(access.apiKey)) {
          return send(res, 501, {
            ok: false,
            code: "missing-openrouter",
            message: "Need OPENROUTER_API_KEY in .env.local.",
          });
        }
        const body = await jsonBody(req);
        const questions = body.questions;
        if (!questions || typeof questions !== "object") {
          return send(res, 400, { ok: false, message: "questions required" });
        }
        const includeTranscript = Boolean(body.includeTranscript);
        let transcript: unknown[] = Array.isArray(body.transcript) ? body.transcript : [];
        const caseText = String(body.state ?? "");
        const gate = workshopPayloadBlocked(caseText, questions);
        if (gate.blocked) {
          return send(res, 400, {
            ok: false,
            code: gate.code,
            message: gate.message,
          });
        }
        if (access.kind === "free") {
          const clamp = clampFreeInput(pub, {
            state: caseText,
            questions,
            messages: transcript,
          });
          if (!clamp.ok) return send(res, clamp.status, { ok: false, message: clamp.message });
          // Only the clamped chat goes to Jev: the free tier must never forward a 2 MiB transcript on the server key.
          transcript = clamp.messages;
        }
        const state =
          includeTranscript && transcript.length
            ? { case: caseText, transcript }
            : caseText;
        if (access.kind === "free") {
          const size = JSON.stringify({ state, questions }).length;
          const denied = freeGate(limiter, pub, ip).jev(size);
          if (denied) {
            return denied.code === "limit-size"
              ? send(res, denied.status, { ok: false, code: denied.code, message: denied.message })
              : tooMany(res, denied.retryAfterSec, denied.message, denied.code);
          }
        }
        const model = env.JEV_MODEL || DEFAULT_JEV;
        const result = await callJev({
          apiKey: access.apiKey,
          model,
          state,
          questions: questions as Record<string, unknown>,
          tier: access.kind,
        });
        if (!result.ok) {
          if (result.code) {
            return send(res, result.status === 400 ? 400 : 502, {
              ok: false,
              code: result.code,
              message: result.message,
            });
          }
          return send(res, 502, {
            ok: false,
            message: result.message,
            status: result.status,
          });
        }
        return send(res, 200, {
          ok: true,
          model: result.model,
          answers: result.answers,
          usage: result.usage,
          elapsedMs: result.elapsedMs,
        });
      }

      if (req.method === "POST" && url === "/api/llm") {
        if (pub.enabled) {
          const lim = limiter.takeAll([
            { scope: "heavy-ip", key: ip, limit: pub.heavyPerIpPerMin, windowMs: MINUTE_MS },
          ]);
          if (!lim.ok) return tooMany(res, lim.retryAfterSec, "Too many requests. Wait a minute.");
        }
        const got = accessFor();
        if (!("access" in got)) return got.refuse();
        const access = got.access;
        if (access.kind === "admin" && !present(access.apiKey)) {
          return send(res, 501, {
            ok: false,
            code: "missing-openrouter",
            message: "Need OPENROUTER_API_KEY in .env.local.",
          });
        }
        const body = await jsonBody(req);

        let model: string;
        let gate: ReturnType<typeof freeGate> | undefined;
        let limits: { maxTokens: number; maxRounds: number } | undefined;
        let messages: unknown = body.messages;
        let instructions: unknown = body.instructions;
        if (pub.enabled) {
          const decision = modelForAccess(
            pub,
            access.kind,
            body.model,
            normalizeChatModel,
            env.LLM_MODEL || DEFAULT_LLM,
          );
          if (!decision.ok) {
            return send(res, decision.status, {
              ok: false,
              code: decision.code,
              message: decision.message,
            });
          }
          model = decision.model;
          if (access.kind === "free") {
            const clamp = clampFreeInput(pub, {
              state: body.state,
              questions: body.questions,
              messages: body.messages,
              instructions: body.instructions,
              jevAnswers: body.jevAnswers,
            });
            if (!clamp.ok) return send(res, clamp.status, { ok: false, message: clamp.message });
            messages = clamp.messages;
            instructions = clamp.instructions;
            const room = freeLlmRoom(limiter, pub, ip);
            if (room) return tooMany(res, room.retryAfterSec, room.message, room.code);
            gate = freeGate(limiter, pub, ip);
            limits = { maxTokens: pub.freeMaxTokens, maxRounds: pub.freeMaxRounds };
          }
          // Concurrent streams are capped globally and per address.
          const mine = activeByIp.get(ip) ?? 0;
          if (active >= pub.maxConcurrent || mine >= pub.maxConcurrentPerIp) {
            return tooMany(res, 5, "Busy right now. Wait a few seconds and try again.", "limit-busy");
          }
          active += 1;
          activeByIp.set(ip, mine + 1);
          let released = false;
          const release = () => {
            if (released) return;
            released = true;
            active -= 1;
            const left = (activeByIp.get(ip) ?? 1) - 1;
            if (left > 0) activeByIp.set(ip, left);
            else activeByIp.delete(ip);
          };
          res.on("close", release);
        } else {
          model = resolveChatModel(body.model, env.LLM_MODEL || DEFAULT_LLM);
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();
        await runLlmSession({
          apiKey: access.apiKey,
          tier: access.kind,
          gate,
          limits,
          model,
          jevModel: env.JEV_MODEL || DEFAULT_JEV,
          primer: primerText(),
          body: {
            messages,
            state: body.state,
            questions: body.questions,
            jevAnswers: body.jevAnswers,
            includeTranscript: body.includeTranscript,
            mode: body.mode,
            instructions,
          },
          res,
        });
        if (!res.writableEnded) res.end();
        return;
      }

      return send(res, 404, { ok: false, message: "unknown api" });
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.status, { ok: false, message: err.message });
      }
      return send(res, 500, { ok: false, message: publicError(err, visitorKey, serverKey) });
    }
  };
}
