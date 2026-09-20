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

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, "docs", "jev");

const DEFAULT_JEV = "typesafe/jev-1.13";
const DEFAULT_LLM = "deepseek/deepseek-v4-flash";

function publicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "server error";
  return sanitizePublicError(raw);
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
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
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

function orHeaders(env: Record<string, string>) {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://127.0.0.1:5182",
    "X-OpenRouter-Title": "Talk to Jev",
  };
}

function llmSystem(state: string, jevAnswers: unknown, mode: string) {
  const primer = primerText();
  const answers =
    jevAnswers === undefined
      ? ""
      : `\n\n## Latest Jev answers (typed)\n\`\`\`json\n${JSON.stringify(jevAnswers, null, 2)}\n\`\`\`\n`;
  const propose =
    mode === "propose-questions"
      ? `\n\nYou MUST reply with ONLY a JSON object. Keys are question ids. Each value has "type" ("choice"|"noul"|"score"), "instructions" (full question text), and "criteria" (choice: object of option→description; score: array of level strings; noul: optional {true,false}). No markdown fences. No prose.`
      : `\n\nYou may suggest Jev questions in a fenced json block named questions. Do not pretend to be Jev or invent probabilities.`;
  return `You are the prose half of Talk to Jev. You talk. Jev decides.

Jev is TypeSafe's System One model. It is NOT an LLM. It does not write. It evaluates a state against typed questions in one parallel call and returns choice / noul / score answers with probabilities. OpenRouter route: POST https://openrouter.ai/api/alpha/decisions (never chat/completions). Pin typesafe/jev-1.13.

A weather block in the case (<!-- weather:start --> or ## Weather) is observational Open-Meteo input. Do not invent weather. Do not pretend to be Jev.

Rules from the stored docs:
- One snap judgment per question. Decompose; compose in code.
- Question ids are for code; put the whole question in instructions.
- Prefer many questions in one Jev call (speculative fan-out).
- Noul is P(true) in [0,1], not a separate confidence.
- A typed answer can still be wrong. Talk in probabilities.

## Current case (Jev state)
${state || "(empty)"}
${answers}

## Jev primer from this repo
${primer.slice(0, 40_000)}
${propose}`;
}

function workshopApi(): Plugin {
  return {
    name: "talk-to-jev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api/")) return next();
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
            if (!present(env.OPENROUTER_API_KEY)) {
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
            const transcript = Array.isArray(body.transcript) ? body.transcript : [];
            const caseText = String(body.state ?? "");
            const state =
              includeTranscript && transcript.length
                ? { case: caseText, transcript }
                : caseText;
            const model = env.JEV_MODEL || DEFAULT_JEV;
            const upstream = await fetch("https://openrouter.ai/api/alpha/decisions", {
              method: "POST",
              headers: orHeaders(env),
              body: JSON.stringify({ model, state, questions }),
            });
            const payload = (await upstream.json().catch(() => ({}))) as Record<
              string,
              unknown
            >;
            if (!upstream.ok) {
              return send(res, 502, {
                ok: false,
                message: "Jev request failed (details omitted).",
                status: upstream.status,
              });
            }
            return send(res, 200, {
              ok: true,
              model: typeof payload.model === "string" ? payload.model : model,
              answers: payload.answers,
              usage: payload.usage,
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
            const messages = Array.isArray(body.messages) ? body.messages : [];
            const mode = body.mode === "propose-questions" ? "propose-questions" : "chat";
            const state = String(body.state ?? "");
            const model = env.LLM_MODEL || DEFAULT_LLM;
            const system = llmSystem(state, body.jevAnswers, mode);
            const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: orHeaders(env),
              body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: "system", content: system }, ...messages],
              }),
            });
            if (!upstream.ok || !upstream.body) {
              return send(res, 502, {
                ok: false,
                message: "LLM request failed (details omitted).",
                status: upstream.status,
              });
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            const reader = upstream.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
            } finally {
              res.end();
            }
            return;
          }

          return send(res, 404, { ok: false, message: "unknown api" });
        } catch (err) {
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
