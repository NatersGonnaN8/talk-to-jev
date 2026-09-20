/** Always-on LLM / Jev request logs. Inspector is only the viewer — never store keys. */

export const DEV_LOGS_KEY = "talk-to-jev:dev-logs";
export const DEV_INSPECTOR_HEIGHT_KEY = "talk-to-jev:dev-inspector-height";
export const PAYLOAD_LOG_KEY = DEV_LOGS_KEY;
const LEGACY_PAYLOAD_KEY = "talk-to-jev:payload-log";

export type DevChannel = "llm" | "jev";
export type PayloadChannel = DevChannel;

export type DevCall = {
  id: string;
  at: number;
  channel: DevChannel;
  title: string;
  request: unknown;
  response?: unknown;
  error?: string;
  pending?: boolean;
};
export type PayloadCall = DevCall;

const MAX_CALLS = 40;
const MAX_JSON_CHARS = 120_000;
const KEYISH =
  /sk-or-[A-Za-z0-9_-]+|sk-ant-[A-Za-z0-9_-]+|sk-proj-[A-Za-z0-9_-]+|tvly-[A-Za-z0-9_-]+|BSA[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{8,}|Bearer\s+\S+|OPENROUTER_API_KEY\s*=\s*\S+|OPENAI_API_KEY\s*=\s*\S+|ANTHROPIC_API_KEY\s*=\s*\S+|TAVILY_API_KEY\s*=\s*\S+|BRAVE_API_KEY\s*=\s*\S+/gi;
const SECRET_KEY =
  /^(authorization|api[-_]?key|secret|token|last4|last_4|password)$/i;

type Store = { v: 1; calls: DevCall[] };

let snapshot: DevCall[] = loadCalls();
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function scrubString(s: string): string {
  return s.replace(KEYISH, "[redacted]");
}

export function scrubDevValue(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubDevValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = scrubDevValue(v);
    }
    return out;
  }
  return String(value);
}

export const scrubPayloadValue = scrubDevValue;

function clipValue(value: unknown): unknown {
  let json = "";
  try {
    json = JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
  if (json.length <= MAX_JSON_CHARS) return value;
  return {
    truncated: true,
    chars: json.length,
    preview: json.slice(0, MAX_JSON_CHARS),
  };
}

function readStore(raw: string | null): DevCall[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Store;
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.calls)) return [];
  return parsed.calls.filter(
    (c) =>
      c &&
      (c.channel === "llm" || c.channel === "jev") &&
      typeof c.id === "string",
  );
}

function loadCalls(): DevCall[] {
  try {
    const primary = readStore(localStorage.getItem(DEV_LOGS_KEY));
    const legacy = readStore(localStorage.getItem(LEGACY_PAYLOAD_KEY));
    const seen = new Set<string>();
    const merged: DevCall[] = [];
    for (const call of [...primary, ...legacy].sort((a, b) => b.at - a.at)) {
      if (seen.has(call.id)) continue;
      seen.add(call.id);
      merged.push(call);
      if (merged.length >= MAX_CALLS) break;
    }
    if (legacy.length) {
      try {
        localStorage.setItem(DEV_LOGS_KEY, JSON.stringify({ v: 1, calls: merged }));
        localStorage.removeItem(LEGACY_PAYLOAD_KEY);
      } catch {
        /* */
      }
    }
    return merged;
  } catch {
    return [];
  }
}

function persist(calls: DevCall[]) {
  snapshot = calls;
  const body = JSON.stringify({ v: 1, calls });
  try {
    localStorage.setItem(DEV_LOGS_KEY, body);
  } catch {
    let next = calls;
    while (next.length > 4) {
      next = next.slice(0, -4);
      try {
        localStorage.setItem(DEV_LOGS_KEY, JSON.stringify({ v: 1, calls: next }));
        snapshot = next;
        break;
      } catch {
        /* keep dropping */
      }
    }
  }
  notify();
}

function newId() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function consoleLabel(channel: DevChannel) {
  return channel === "llm" ? "[Talk to Jev · To LLM]" : "[Talk to Jev · To Jev]";
}

export function getDevLogsSnapshot(): DevCall[] {
  return snapshot;
}

export const getPayloadLogsSnapshot = getDevLogsSnapshot;

export function subscribeDevLogs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const subscribePayloadLogs = subscribeDevLogs;

export function beginDevCall(
  channel: DevChannel,
  title: string,
  request: unknown,
): string {
  const id = newId();
  const call: DevCall = {
    id,
    at: Date.now(),
    channel,
    title,
    request: clipValue(scrubDevValue(request)),
    pending: true,
  };
  persist([call, ...snapshot].slice(0, MAX_CALLS));
  try {
    console.info(consoleLabel(channel), title, call.request);
  } catch {
    /* ignore console failures */
  }
  return id;
}

export function beginPayloadCall(
  channel: DevChannel,
  title: string,
  request: unknown,
  _path?: string,
): string {
  return beginDevCall(channel, title, request);
}

export function patchDevCall(
  id: string,
  patch: Partial<Pick<DevCall, "request" | "title">>,
) {
  const next = snapshot.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.request !== undefined
        ? { request: clipValue(scrubDevValue(patch.request)) }
        : {}),
    };
  });
  persist(next);
}

export const patchPayloadCall = patchDevCall;

export function finishDevCall(
  id: string,
  response?: unknown,
  error?: string,
) {
  const next = snapshot.map((c) => {
    if (c.id !== id) return c;
    const done: DevCall = {
      ...c,
      pending: false,
      ...(response !== undefined
        ? { response: clipValue(scrubDevValue(response)) }
        : {}),
      ...(error ? { error: scrubString(error) } : {}),
    };
    try {
      console.info(
        consoleLabel(c.channel),
        `${c.title} · ${error ? "error" : "response"}`,
        error || done.response,
      );
    } catch {
      /* ignore */
    }
    return done;
  });
  persist(next);
}

export const finishPayloadCall = finishDevCall;

export function clearDevLogs() {
  persist([]);
}

export const clearPayloadLogs = clearDevLogs;

export function loadInspectorHeight(fallback = 280) {
  try {
    const n = Number(localStorage.getItem(DEV_INSPECTOR_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= 160 && n <= 900) return n;
  } catch {
    /* */
  }
  return fallback;
}

export function saveInspectorHeight(px: number) {
  try {
    localStorage.setItem(DEV_INSPECTOR_HEIGHT_KEY, String(Math.round(px)));
  } catch {
    /* quota */
  }
}
