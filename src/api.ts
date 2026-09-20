import type { Health, SettingsResponse } from "./types";
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

function parseSseDelta(chunk: string): string {
  let out = "";
  for (const block of chunk.split("\n\n")) {
    const line = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!line || line === "[DONE]") continue;
    try {
      const json = JSON.parse(line) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      out += json.choices?.[0]?.delta?.content ?? "";
    } catch {
      /* ignore partial */
    }
  }
  return out;
}

export async function streamLlm(
  payload: {
    messages: Array<{ role: string; content: string }>;
    state: string;
    jevAnswers?: unknown;
    mode?: "chat" | "propose-questions";
  },
  onDelta: (full: string) => void,
): Promise<string> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    full += parseSseDelta(`${parts.join("\n\n")}\n\n`);
    onDelta(full);
  }
  if (buffer.trim()) full += parseSseDelta(buffer);
  onDelta(full);
  return full;
}
