/**
 * BYOK env slots for Talk to Jev.
 * Never log values. Never return full keys to the browser.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = resolve(here, "..", ".env.local");

export const PROVIDERS = [
  {
    id: "openrouter",
    env: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    why: "Required today for the LLM and Jev.",
    required: true,
  },
  {
    id: "openai",
    env: "OPENAI_API_KEY",
    label: "OpenAI",
    why: "Unused until direct OpenAI models land.",
    required: false,
  },
  {
    id: "anthropic",
    env: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    why: "Unused until direct Anthropic models land.",
    required: false,
  },
  {
    id: "tavily",
    env: "TAVILY_API_KEY",
    label: "Tavily",
    why: "Unused until search lands.",
    required: false,
  },
  {
    id: "brave",
    env: "BRAVE_API_KEY",
    label: "Brave",
    why: "Unused until search lands.",
    required: false,
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export type PublicKeyRow = {
  id: ProviderId;
  env: string;
  label: string;
  why: string;
  required: boolean;
  present: boolean;
  last4: string | null;
};

const MAX_VALUE = 512;

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDERS.some((p) => p.id === value);
}

export function present(value: string | undefined) {
  return Boolean(value && value.trim());
}

function stripQuotes(val: string) {
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

function encodeValue(val: string) {
  if (/[\s#"']/.test(val)) return JSON.stringify(val);
  return val;
}

function parseAssignment(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 1) return null;
  return {
    key: trimmed.slice(0, eq),
    value: stripQuotes(trimmed.slice(eq + 1)),
  };
}

function hasKeyLine(text: string, key: string) {
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseAssignment(line);
    if (parsed?.key === key) return true;
  }
  return false;
}

export function loadEnvMap(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  if (!existsSync(ENV_FILE)) return env;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const parsed = parseAssignment(line);
    if (!parsed) continue;
    env[parsed.key] = parsed.value; // .env.local wins over a stale Windows user-level key
  }
  return env;
}

function last4(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(-4);
}

export function publicKeyRows(env: Record<string, string> = loadEnvMap()): PublicKeyRow[] {
  return PROVIDERS.map((p) => {
    const value = env[p.env] ?? "";
    const ok = present(value);
    return {
      id: p.id,
      env: p.env,
      label: p.label,
      why: p.why,
      required: p.required,
      present: ok,
      last4: ok ? last4(value) : null,
    };
  });
}

export function healthKeyFlags(env: Record<string, string> = loadEnvMap()) {
  const rows = publicKeyRows(env);
  const flags = {
    openrouter: false,
    openai: false,
    anthropic: false,
    tavily: false,
    brave: false,
  };
  for (const row of rows) flags[row.id] = row.present;
  return flags;
}

export function ensureProviderSlots() {
  let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const missing = PROVIDERS.filter((p) => !hasKeyLine(text, p.env));
  if (!missing.length && text) return;
  if (!text.trim()) {
    text =
      "# Talk to Jev local keys. Never commit this file.\n# Paste keys in Settings at /settings.\n";
  }
  if (!text.endsWith("\n")) text += "\n";
  for (const p of missing) {
    text += `${p.env}=\n`;
  }
  writeFileSync(ENV_FILE, text, "utf8");
}

function setKeyInText(text: string, key: string, value: string) {
  const lines = text.split(/\r?\n/);
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseAssignment(lines[i]);
    if (parsed?.key === key) last = i;
  }
  const next = `${key}=${encodeValue(value)}`;
  if (last >= 0) lines[last] = next;
  else lines.push(next);
  let out = lines.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

export function upsertProviderValue(id: ProviderId, raw: string) {
  if (raw.length > MAX_VALUE) {
    throw new Error("Key is too long.");
  }
  if (/[\r\n\0]/.test(raw)) {
    throw new Error("Key cannot contain line breaks.");
  }
  const value = raw.trim();
  ensureProviderSlots();
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const envName = PROVIDERS.find((p) => p.id === id)!.env;
  writeFileSync(ENV_FILE, setKeyInText(text, envName, value), "utf8");
}

export function settingsPayload() {
  ensureProviderSlots();
  return { ok: true as const, keys: publicKeyRows() };
}

export function sanitizePublicError(message: string) {
  if (
    /sk-or-|sk-ant-|tvly-|BSA[A-Za-z0-9_-]{12,}|Bearer\s+\S{8,}|OPENROUTER_API_KEY=|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|TAVILY_API_KEY=|BRAVE_API_KEY=/.test(
      message,
    )
  ) {
    return "Request failed.";
  }
  return message;
}
