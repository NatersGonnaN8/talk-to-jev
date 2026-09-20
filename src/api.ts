import type { Health, JevAnswer, JevQuestion, SettingsResponse } from "./types";
import type { WeatherResponse } from "./weather";

export async function getHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  return (await res.json()) as Health;
}

export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch("/api/settings");
  const body = (await res.json()) as SettingsResponse;
  if (!res.ok) throw new Error(body.message || "Settings failed");
  return body;
}

export async function saveSetting(
  id: string,
  value: string,
): Promise<SettingsResponse> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, value }),
  });
  const body = (await res.json()) as SettingsResponse;
  if (!res.ok) throw new Error(body.message || "Save failed");
  return body;
}

export async function updateDocs() {
  const res = await fetch("/api/docs/update", { method: "POST" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Docs update failed");
  return body as {
    ok: boolean;
    fetched: number;
    failed: number;
    files: number;
    fetchedAt: string;
  };
}

function docsGet(url: string) {
  const join = url.includes("?") ? "&" : "?";
  return fetch(`${url}${join}t=${Date.now()}`, { cache: "no-store" });
}

export async function listDocs() {
  const res = await docsGet("/api/docs");
  return (await res.json()) as {
    files: Array<{ path: string; title: string; source: string; fetchedAt: string }>;
    fetchedAt: string;
  };
}

export async function readDoc(path: string) {
  const res = await docsGet(
    `/api/docs/file?path=${encodeURIComponent(path)}`,
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Doc not found");
  return body as { ok: true; path: string; text: string };
}

export async function fetchWeather(q: string): Promise<WeatherResponse> {
  const res = await fetch(`/api/weather?q=${encodeURIComponent(q)}`);
  const body = (await res.json()) as WeatherResponse;
  if (!res.ok || !body.ok) {
    throw new Error(body.message || "Weather request failed");
  }
  return body;
}

export async function askJev(payload: {
  state: string;
  questions: unknown;
  transcript?: Array<{ role: string; content: string }>;
  includeTranscript?: boolean;
}) {
  const res = await fetch("/api/jev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Jev request failed");
  return body;
}

export type LlmStreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "set_jev_case"; state: string }
  | { type: "set_jev_questions"; questions: Record<string, JevQuestion> }
  | {
      type: "ask_jev";
      answers: Record<string, JevAnswer>;
      model?: string;
      usage?: unknown;
    };

type SsePayload = {
  type?: string;
  name?: string;
  ok?: boolean;
  text?: string;
  state?: string;
  questions?: Record<string, JevQuestion>;
  answers?: Record<string, JevAnswer>;
  model?: string;
  usage?: unknown;
  message?: string;
  choices?: Array<{ delta?: { content?: string } }>;
};

/** Complete SSE frames; leftover (possibly mid-event) stays in `rest`. */
export function takeSseFrames(buffer: string): { frames: string[]; rest: string } {
  const text = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = text.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((part) => part.trim()), rest };
}

export function parseSseFrame(frame: string): SsePayload | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^\s/, ""))
    .join("\n");
  if (!data || data === "[DONE]") return null;
  try {
    return JSON.parse(data) as SsePayload;
  } catch {
    return null;
  }
}

export function eventFromPayload(
  json: SsePayload,
): LlmStreamEvent | null {
  if (json.type === "error") {
    return { type: "error", message: json.message || "LLM request failed" };
  }
  if (json.type === "done") return null;
  if (json.type === "delta" && typeof json.text === "string") {
    return { type: "delta", text: json.text };
  }
  const toolName = json.type === "tool" || json.type === "tool_call" ? json.name : json.type;
  if (json.ok && toolName === "set_jev_case" && typeof json.state === "string") {
    return { type: "set_jev_case", state: json.state };
  }
  if (json.ok && toolName === "set_jev_questions" && json.questions) {
    return { type: "set_jev_questions", questions: json.questions };
  }
  if (json.ok && toolName === "ask_jev" && json.answers) {
    return {
      type: "ask_jev",
      answers: json.answers,
      model: json.model,
      usage: json.usage,
    };
  }
  const legacy = json.choices?.[0]?.delta?.content;
  if (typeof legacy === "string" && legacy) return { type: "delta", text: legacy };
  return null;
}

export async function streamLlm(
  payload: {
    messages: Array<{ role: string; content: string }>;
    state: string;
    questions?: unknown;
    jevAnswers?: unknown;
    includeTranscript?: boolean;
    mode?: "chat" | "propose-questions";
  },
  onEvent: (ev: LlmStreamEvent) => void,
): Promise<string> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = "LLM request failed";
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      /* */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("LLM stream missing");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleFrame = (frame: string) => {
    const json = parseSseFrame(frame);
    if (!json) return;
    const ev = eventFromPayload(json);
    if (!ev) return;
    if (ev.type === "delta") {
      full += ev.text;
      onEvent({ type: "delta", text: full });
      return;
    }
    onEvent(ev);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const taken = takeSseFrames(buffer);
    buffer = taken.rest;
    for (const frame of taken.frames) handleFrame(frame);
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const taken = takeSseFrames(buffer.endsWith("\n\n") ? buffer : `${buffer}\n\n`);
    for (const frame of taken.frames) handleFrame(frame);
  }
  return full;
}
