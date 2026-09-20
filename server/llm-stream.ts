/** OpenRouter chat stream — thoughts, content, tool_calls. Never logs the key. */
import { openRouterHeaders } from "./openrouter";
import {
  parseJevQuestions,
  questionsFromToolArgs,
} from "./questions";

export type OrToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatOk = {
  ok: true;
  message: {
    content: string | null;
    tool_calls?: OrToolCall[];
    reasoning?: string;
    reasoning_details?: unknown[];
  };
};

export type ChatFail = {
  ok: false;
  status: number;
  retryTools: boolean;
  retryReasoning: boolean;
  message: string;
};

export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function newCallId() {
  return `call_${Math.random().toString(36).slice(2, 12)}`;
}

function looksLikeToolMarkup(text: string) {
  return /<tool_call\b|<function=/i.test(text);
}

function contentPiece(delta: Record<string, unknown> | null): string {
  if (!delta) return "";
  const c = delta.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  let out = "";
  for (const part of c) {
    if (typeof part === "string") out += part;
    else {
      const rec = asRecord(part);
      if (rec && typeof rec.text === "string") out += rec.text;
    }
  }
  return out;
}

function thoughtPiece(obj: Record<string, unknown> | null): string {
  if (!obj) return "";
  const details = obj.reasoning_details;
  if (Array.isArray(details)) {
    const bits: string[] = [];
    for (const item of details) {
      const rec = asRecord(item);
      if (!rec) continue;
      const kind = String(rec.type ?? "");
      if (kind.includes("encrypted")) continue;
      if (typeof rec.text === "string" && rec.text && rec.text !== "[REDACTED]") {
        bits.push(rec.text);
      } else if (
        typeof rec.summary === "string" &&
        rec.summary &&
        rec.summary !== "[REDACTED]"
      ) {
        bits.push(rec.summary);
      }
    }
    if (bits.length) return bits.join("");
  }
  if (typeof obj.reasoning === "string") return obj.reasoning;
  if (typeof obj.reasoning_content === "string") return obj.reasoning_content;
  return "";
}

function appendUnique(acc: string, piece: string): { acc: string; emit: string } {
  if (!piece) return { acc, emit: "" };
  if (!acc) return { acc: piece, emit: piece };
  if (piece.startsWith(acc)) return { acc: piece, emit: piece.slice(acc.length) };
  if (acc.endsWith(piece)) return { acc, emit: "" };
  return { acc: acc + piece, emit: piece };
}

function absorbToolDelta(acc: Map<number, OrToolCall>, raw: unknown) {
  const rec = asRecord(raw);
  if (!rec) return;
  const index = typeof rec.index === "number" ? rec.index : acc.size;
  const prev = acc.get(index) ?? {
    id: "",
    type: "function" as const,
    function: { name: "", arguments: "" },
  };
  const fn = asRecord(rec.function);
  const id = typeof rec.id === "string" && rec.id ? rec.id : prev.id;
  const name =
    fn && typeof fn.name === "string" && fn.name ? fn.name : prev.function.name;
  const argPiece = fn && typeof fn.arguments === "string" ? fn.arguments : "";
  acc.set(index, {
    id: id || prev.id,
    type: "function",
    function: {
      name,
      arguments: `${prev.function.arguments}${argPiece}`,
    },
  });
}

function toolCallsFromMap(acc: Map<number, OrToolCall>): OrToolCall[] {
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, call]) => ({
      ...call,
      id: call.id || newCallId(),
    }))
    .filter((c) => c.function.name);
}

function looksLikeDumpInProgress(acc: string) {
  const t = acc.trim();
  if (!t) return false;
  if (t.startsWith("<") || t.startsWith("{") || t.startsWith("[") || t.startsWith("```")) {
    return true;
  }
  if (looksLikeToolMarkup(acc)) return true;
  if (/\|.+\|/.test(t) && /noul|choice|score|instructions/i.test(t)) return true;
  const ids = t.match(/`[a-z][a-z0-9_]{2,}`/gi);
  if (ids && ids.length >= 2 && /noul|choice|score/i.test(t)) return true;
  if (/^\s*\d+\.\s+.+\n\s*\d+\.\s+/m.test(t) && /noul|choice|score/i.test(t)) return true;
  return false;
}

function shouldStreamContent(acc: string, sawTools: boolean) {
  if (sawTools) return false;
  if (!acc.trim()) return false;
  return !looksLikeDumpInProgress(acc);
}

export function isAbortError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError",
  );
}

export function summarizeToolArgs(name: string, args: Record<string, unknown>): string {
  if (name === "set_jev_state") {
    const state = String(args.state ?? args.case ?? args.text ?? "");
    const line =
      state
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("<!--")) ?? "";
    const clip = line.replace(/\s+/g, " ").slice(0, 72);
    const chars = state.length;
    if (clip) {
      return `${clip}${line.length > 72 ? "…" : ""} · ${chars.toLocaleString()} chars`;
    }
    return `${chars.toLocaleString()} chars`;
  }
  if (name === "set_jev_questions") {
    const parsed = parseJevQuestions(questionsFromToolArgs(args) ?? args);
    if (!parsed.ok) return parsed.message.slice(0, 96);
    const ids = Object.keys(parsed.questions);
    const shown = ids.slice(0, 6).join(", ");
    const extra = ids.length > 6 ? "…" : "";
    return `${ids.length} question${ids.length === 1 ? "" : "s"}${ids.length ? ` · ${shown}${extra}` : ""}`;
  }
  if (name === "ask_jev" || name === "read_jev_workshop") {
    return "Current state + questions";
  }
  return "";
}

async function* iterateUpstreamSse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const take = (block: string) => {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^\s/, ""))
      .join("\n");
    if (!data || data === "[DONE]") return null;
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const json = take(part);
      if (json) yield json;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const json = take(buffer);
    if (json) yield json;
  }
}

function failFromPayload(
  status: number,
  payload: Record<string, unknown>,
): ChatFail {
  const errMsg = String(
    payload.error ? JSON.stringify(payload.error) : payload.message ?? "",
  );
  const retryTools = status === 400 && /tool[_ ]choice|tools|function/i.test(errMsg);
  const retryReasoning =
    status === 400 && /reasoning|include_reasoning/i.test(errMsg);
  return {
    ok: false,
    status,
    retryTools,
    retryReasoning,
    message: "LLM request failed (details omitted).",
  };
}

function messageFromNonStream(payload: Record<string, unknown>): ChatOk | ChatFail {
  const choices = payload.choices;
  const first = Array.isArray(choices) ? asRecord(choices[0]) : null;
  const message = first ? asRecord(first.message) : null;
  if (!message) {
    return {
      ok: false,
      status: 502,
      retryTools: false,
      retryReasoning: false,
      message: "LLM request failed (details omitted).",
    };
  }
  const toolCallsRaw = message.tool_calls;
  const tool_calls: OrToolCall[] = [];
  if (Array.isArray(toolCallsRaw)) {
    for (const item of toolCallsRaw) {
      const rec = asRecord(item);
      const fn = rec ? asRecord(rec.function) : null;
      if (!rec || !fn || typeof fn.name !== "string") continue;
      tool_calls.push({
        id: typeof rec.id === "string" ? rec.id : newCallId(),
        type: "function",
        function: {
          name: fn.name,
          arguments:
            typeof fn.arguments === "string"
              ? fn.arguments
              : JSON.stringify(fn.arguments ?? {}),
        },
      });
    }
  }
  const details = Array.isArray(message.reasoning_details)
    ? message.reasoning_details
    : undefined;
  return {
    ok: true,
    message: {
      content:
        typeof message.content === "string"
          ? message.content
          : message.content == null
            ? null
            : String(message.content),
      tool_calls: tool_calls.length ? tool_calls : undefined,
      reasoning: thoughtPiece(message) || undefined,
      reasoning_details: details,
    },
  };
}

export async function completeChat(opts: {
  apiKey: string;
  model: string;
  messages: unknown[];
  tools: unknown;
  toolChoice: ToolChoice;
  includeReasoning: boolean;
  deferContent?: boolean;
  onThought?: (text: string) => void;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}): Promise<ChatOk | ChatFail> {
  const body: Record<string, unknown> = {
    model: opts.model,
    stream: true,
    tools: opts.tools,
    tool_choice: opts.toolChoice,
    messages: opts.messages,
  };
  if (opts.includeReasoning) {
    body.include_reasoning = true;
    body.reasoning = { exclude: false };
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(opts.apiKey),
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const ctype = upstream.headers.get("content-type") || "";
  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    return failFromPayload(upstream.status, payload);
  }

  if (!ctype.includes("text/event-stream") || !upstream.body) {
    const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = messageFromNonStream(payload);
    if (parsed.ok) {
      const thought = parsed.message.reasoning;
      if (thought) opts.onThought?.(thought);
      const content = parsed.message.content;
      if (content && shouldStreamContent(content, Boolean(parsed.message.tool_calls?.length))) {
        opts.onDelta?.(content);
      }
    }
    return parsed;
  }

  let contentAcc = "";
  let thoughtAcc = "";
  let streamedContent = 0;
  let sawTools = false;
  const toolAcc = new Map<number, OrToolCall>();
  const reasoningDetails: unknown[] = [];
  let fatal: ChatFail | null = null;

  for await (const payload of iterateUpstreamSse(upstream.body)) {
    if (opts.signal?.aborted) {
      try {
        await upstream.body.cancel();
      } catch {
        /* */
      }
      if (opts.signal.reason instanceof Error) throw opts.signal.reason;
      const stop = new Error("Stopped.");
      stop.name = "AbortError";
      throw stop;
    }
    if (payload.error) {
      fatal = failFromPayload(502, payload);
      break;
    }
    const choices = payload.choices;
    const first = Array.isArray(choices) ? asRecord(choices[0]) : null;
    const delta = first ? asRecord(first.delta) : null;
    const message = first ? asRecord(first.message) : null;

    const thought = appendUnique(
      thoughtAcc,
      thoughtPiece(delta) || thoughtPiece(message),
    );
    thoughtAcc = thought.acc;
    if (thought.emit) opts.onThought?.(thought.emit);

    if (delta && Array.isArray(delta.reasoning_details)) {
      reasoningDetails.push(...delta.reasoning_details);
    }

    if (delta && Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
      sawTools = true;
      for (const item of delta.tool_calls) absorbToolDelta(toolAcc, item);
    }

    const piece = contentPiece(delta);
    if (piece) {
      contentAcc += piece;
      if (
        !opts.deferContent &&
        shouldStreamContent(contentAcc, sawTools) &&
        streamedContent < contentAcc.length
      ) {
        const next = contentAcc.slice(streamedContent);
        streamedContent = contentAcc.length;
        if (next) opts.onDelta?.(next);
      }
    }
  }

  if (fatal) return fatal;

  const tool_calls = toolCallsFromMap(toolAcc);
  if (
    !opts.deferContent &&
    !tool_calls.length &&
    contentAcc &&
    streamedContent < contentAcc.length &&
    shouldStreamContent(contentAcc, false)
  ) {
    opts.onDelta?.(contentAcc.slice(streamedContent));
  }

  return {
    ok: true,
    message: {
      content: contentAcc || null,
      tool_calls: tool_calls.length ? tool_calls : undefined,
      reasoning: thoughtAcc || undefined,
      reasoning_details: reasoningDetails.length ? reasoningDetails : undefined,
    },
  };
}
