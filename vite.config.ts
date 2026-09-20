import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WeatherHttpError, getWeather, searchPlaces } from "./server/weather";
import {
  healthKeyFlags,
  isProviderId,
  loadEnvMap as loadDotenv,
  present,
  sanitizePublicError,
  settingsPayload,
  upsertProviderValue,
} from "./server/settings";
import { DEFAULT_JEV, DEFAULT_LLM } from "./server/openrouter";
import { resolveChatModel } from "./server/chatModel";
import { callJev } from "./server/jev";
import { runLlmSession } from "./server/llm";
import { checkCatalogEmbed } from "./server/embedCheck";
import { workshopPayloadBlocked } from "./server/violenceGate";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, "docs", "jev");
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function publicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "server error";
  return sanitizePublicError(raw);
}

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
function isSameOrigin(req: IncomingMessage): boolean {
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

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
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
  return JSON.parse(raw) as Record<string, unknown>;
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
  if (!abs.startsWith(docsRoot)) return null;
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

function workshopApi(): Plugin {
  return {
    name: "talk-to-jev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api/")) return next();
        if (!isSameOrigin(req)) {
          return send(res, 403, { ok: false, message: "Cross-site request refused." });
        }
        const env = loadDotenv();
        try {
          if (req.method === "GET" && url === "/api/health") {
            const docs = docsIndex();
            const keys = healthKeyFlags(env);
            return send(res, 200, {
              ok: true,
              hasKey: keys.openrouter,
              keys,
              jevModel: env.JEV_MODEL || DEFAULT_JEV,
              llmModel: env.LLM_MODEL || DEFAULT_LLM,
              docs: { files: docs.files.length, fetchedAt: docs.fetchedAt },
            });
          }

          if (req.method === "GET" && url === "/api/settings") {
            return send(res, 200, settingsPayload());
          }

          if (req.method === "POST" && url === "/api/settings") {
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
            const raw =
              new URL(req.url || "", "http://127.0.0.1").searchParams.get("url") ||
              "";
            const probe = await checkCatalogEmbed(raw, docsIndex().files);
            return send(res, 200, { ok: true, embed: probe.embed, src: probe.src });
          }

          if (req.method === "GET" && url === "/api/weather") {
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
            // Native ESM snapshotter — no TS types shipped with the .mjs
            const { updateJevDocs } = (await import(
              "./scripts/update-jev-docs.mjs"
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
            const result = await updateJevDocs(here);
            return send(res, 200, result);
          }

          if (req.method === "POST" && url === "/api/jev") {
            const body = await jsonBody(req);
            const questions = body.questions;
            if (!questions || typeof questions !== "object") {
              return send(res, 400, { ok: false, message: "questions required" });
            }
            const includeTranscript = Boolean(body.includeTranscript);
            const transcript = Array.isArray(body.transcript) ? body.transcript : [];
            const caseText = String(body.state ?? "");
            const gate = workshopPayloadBlocked(caseText, questions);
            if (gate.blocked) {
              return send(res, 400, {
                ok: false,
                code: gate.code,
                message: gate.message,
              });
            }
            if (!present(env.OPENROUTER_API_KEY)) {
              return send(res, 501, {
                ok: false,
                code: "missing-openrouter",
                message: "Need OPENROUTER_API_KEY in .env.local.",
              });
            }
            const state =
              includeTranscript && transcript.length
                ? { case: caseText, transcript }
                : caseText;
            const model = env.JEV_MODEL || DEFAULT_JEV;
            const result = await callJev({
              apiKey: env.OPENROUTER_API_KEY,
              model,
              state,
              questions: questions as Record<string, unknown>,
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
            });
          }

          if (req.method === "POST" && url === "/api/llm") {
            if (!present(env.OPENROUTER_API_KEY)) {
              return send(res, 501, {
                ok: false,
                code: "missing-openrouter",
                message: "Need OPENROUTER_API_KEY in .env.local.",
              });
            }
            const body = await jsonBody(req);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Accel-Buffering", "no");
            res.flushHeaders?.();
            await runLlmSession({
              env,
              model: resolveChatModel(body.model, env.LLM_MODEL || DEFAULT_LLM),
              jevModel: env.JEV_MODEL || DEFAULT_JEV,
              primer: primerText(),
              body: {
                messages: body.messages,
                state: body.state,
                questions: body.questions,
                jevAnswers: body.jevAnswers,
                includeTranscript: body.includeTranscript,
                mode: body.mode,
                instructions: body.instructions,
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
          return send(res, 500, { ok: false, message: publicError(err) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), workshopApi()],
  optimizeDeps: {
    include: ["mammoth", "turndown", "pdfjs-dist"],
  },
  server: {
    port: 5182,
    strictPort: true,
    host: "127.0.0.1",
    cors: false,
  },
  preview: {
    port: 5182,
    strictPort: true,
    host: "127.0.0.1",
    cors: false,
  },
});
