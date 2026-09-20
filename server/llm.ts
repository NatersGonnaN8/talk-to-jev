/**
 * Cheap LLM tool loop. OpenRouter chat/completions; keys stay server-side.
 * Mutates Workshop via SSE tool events — never a JSON dump as the product.
 */
import type { ServerResponse } from "node:http";
import { callJev } from "./jev";
import {
  completeChat as completeOpenRouterChat,
  newCallId,
  summarizeToolArgs,
  type OrToolCall,
  type ToolChoice,
} from "./llm-stream";
import {
  parseJevQuestions,
  questionsAreClean,
  questionsFromToolArgs,
  stripBlankQuestions,
  type JevQuestion,
} from "./questions";
import { sanitizePublicError } from "./settings";

const MAX_ROUNDS = 8;
const MAX_STATE_CHARS = 400_000;

export const LLM_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "set_jev_case",
      description:
        "Write Jev’s case (the ticket / Jev state). Replaces the case textarea. Use this instead of pasting case JSON into chat.",
      parameters: {
        type: "object",
        properties: {
          state: {
            type: "string",
            description: "Full Jev case text (situation, facts, optional weather/attach blocks).",
          },
        },
        required: ["state"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_jev_questions",
      description:
        "Replace typed Jev questions in Jev’s Questions. Real ids only (never empty, never q_* placeholders). Types: choice (option→description), noul (optional true/false criteria), score (ordered legend strings). Do not paste this JSON into chat.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "object",
            description:
              "Map of question id → { type, instructions, criteria }. choice criteria is an object; score criteria is an array of level labels; noul criteria is { true, false }.",
            additionalProperties: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["choice", "noul", "score"] },
                instructions: { type: "string" },
                criteria: {},
              },
              required: ["type", "instructions"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ask_jev",
      description:
        "Call Jev (Decisions API) with the current case + questions if they are clean (real ids). Do not invent probabilities. If questions are not clean, use set_jev_questions instead and tell the operator to click Ask Jev. Do not use this for the Propose Jev questions button.",
      parameters: { type: "object", properties: {} },
    },
  },
];

type OrMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OrToolCall[];
      reasoning?: string;
      reasoning_details?: unknown[];
    }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type LlmMode = "chat" | "propose-questions";

export type LlmSessionBody = {
  messages: unknown;
  state: unknown;
  questions?: unknown;
  jevAnswers?: unknown;
  includeTranscript?: unknown;
  mode?: unknown;
};

type Working = {
  state: string;
  questions: Record<string, JevQuestion>;
  appliedCase: boolean;
  appliedQuestions: boolean;
  askedJev: boolean;
  questionCount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return {};
  const s = raw.trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s) as unknown;
    return asRecord(parsed) ?? {};
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(s.slice(start, end + 1)) as unknown;
        return asRecord(parsed) ?? {};
      } catch {
        return {};
      }
    }
    return {};
  }
}

function incomingMessages(raw: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const role = rec.role === "assistant" ? "assistant" : rec.role === "user" ? "user" : null;
    if (!role) continue;
    const content = typeof rec.content === "string" ? rec.content : "";
    out.push({ role, content: content.slice(0, 80_000) });
    if (out.length >= 80) break;
  }
  return out;
}

function incomingQuestions(raw: unknown): Record<string, JevQuestion> {
  const parsed = parseJevQuestions(raw);
  if (!parsed.ok) return {};
  return parsed.questions;
}

export function llmSystem(opts: {
  primer: string;
  state: string;
  questions: Record<string, JevQuestion>;
  jevAnswers: unknown;
  mode: LlmMode;
}) {
  const answers =
    opts.jevAnswers === undefined || opts.jevAnswers === null
      ? ""
      : `\n\n## Latest Jev answers (typed)\n\`\`\`json\n${JSON.stringify(opts.jevAnswers, null, 2)}\n\`\`\`\n`;
  const editor = Object.keys(opts.questions).length
    ? `\n\n## Current Jev’s Questions (editor)\n\`\`\`json\n${JSON.stringify(opts.questions, null, 2)}\n\`\`\`\n`
    : "\n\n## Current Jev’s Questions (editor)\n(empty or blank ids only)\n";
  const propose =
    opts.mode === "propose-questions"
      ? `\n\nMode: propose-questions. You MUST call set_jev_questions with a complete valid map (typically 2–4 atomic questions). Do NOT call ask_jev. Do NOT reply with JSON only. After the tool, one short confirmation.`
      : `\n\nMode: chat. If the operator asks to write the case and/or propose Jev questions, call set_jev_case and/or set_jev_questions. Only call ask_jev when they want a snap now AND questions are clean. Otherwise leave Ask Jev as the click.`;

  return `You are the prose half of Talk to Jev. You talk. Jev decides.

Jev is TypeSafe's System One model. It is NOT an LLM. It does not write. It evaluates a state against typed questions in one parallel call and returns choice / noul / score answers with probabilities. OpenRouter route: POST https://openrouter.ai/api/alpha/decisions (never chat/completions). Pin typesafe/jev-1.13.

A weather block in the case (<!-- weather:start --> or ## Weather) is observational Open-Meteo input. Do not invent weather. Do not pretend to be Jev.

You have tools that mutate the Workshop. USE THEM. Do not paste case JSON or a questions map into the chat — the UI already shows the ticket and q-cards. After tools, write one short confirmation.

Tools:
1. set_jev_case — write Jev’s case (the ticket / state).
2. set_jev_questions — replace typed questions. Real ids. Types choice / noul / score. instructions hold the full question. choice criteria = option key → description. score criteria = ordered level strings. noul criteria = optional {true, false}. Skip blank ids; never invent q_* or empty ids.
3. ask_jev — call Jev only if the case + questions are clean. Do not invent probabilities. If not clean: tools 1–2, tell them to click Ask Jev.

Never fake Jev answers in chat unless ask_jev just ran or Latest Jev answers are in this prompt.

Rules from the stored docs:
- One snap judgment per question. Decompose; compose in code.
- Question ids are for code; put the whole question in instructions.
- Prefer many questions in one Jev call (speculative fan-out).
- Noul is P(true) in [0,1], not a separate confidence.
- A typed answer can still be wrong. Talk in probabilities.

## Current case (Jev state)
${opts.state || "(empty)"}
${editor}
${answers}

## Jev primer from this repo
${opts.primer.slice(0, 40_000)}
${propose}`;
}

function emit(res: ServerResponse, obj: unknown) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function looksLikeJsonDump(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const unfenced = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!unfenced.startsWith("{") && !unfenced.startsWith("[")) return false;
  const parsed = parseJevQuestions(unfenced.startsWith("{") || unfenced.startsWith("[") ? tryJson(unfenced) : null);
  return parsed.ok;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function confirmationFor(work: Working): string {
  if (work.askedJev) return "Jev’s answers are in the pane.";
  if (work.appliedCase && work.appliedQuestions) {
    return `Updated Jev’s case and loaded ${work.questionCount} question${work.questionCount === 1 ? "" : "s"}. Click Ask Jev when you’re ready.`;
  }
  if (work.appliedQuestions) {
    return `Loaded ${work.questionCount} question${work.questionCount === 1 ? "" : "s"} into Jev’s Questions. Click Ask Jev when you’re ready.`;
  }
  if (work.appliedCase) return "Updated Jev’s case.";
  return "Done.";
}

function extractXmlToolCalls(content: string): OrToolCall[] {
  const calls: OrToolCall[] = [];
  const blocks = content.matchAll(/<tool_call>([\s\S]*?)<\/tool_call>/gi);
  for (const m of blocks) {
    const inner = m[1].trim();
    const asJson = tryJson(inner);
    const rec = asRecord(asJson);
    if (rec && typeof rec.name === "string") {
      calls.push({
        id: newCallId(),
        type: "function",
        function: {
          name: rec.name,
          arguments:
            typeof rec.arguments === "string"
              ? rec.arguments
              : JSON.stringify(rec.arguments ?? rec.parameters ?? rec),
        },
      });
      continue;
    }
    const fn =
      inner.match(/<function=([^>]+)>/i)?.[1] ||
      inner.match(/<function>([^<]+)<\/function>/i)?.[1] ||
      inner.match(/name["']?\s*[:=]\s*["']([^"']+)/i)?.[1];
    if (!fn) continue;
    const argBlock =
      inner.match(/<parameter=questions>([\s\S]*?)<\/parameter>/i)?.[1] ||
      inner.match(/<arguments>([\s\S]*?)<\/arguments>/i)?.[1] ||
      inner.match(/\{[\s\S]*\}/)?.[0] ||
      "{}";
    calls.push({
      id: newCallId(),
      type: "function",
      function: { name: fn.trim(), arguments: argBlock.trim() },
    });
  }
  return calls;
}

function toolCallsFromMessage(msg: {
  content?: string | null;
  tool_calls?: OrToolCall[];
}): OrToolCall[] {
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
    return msg.tool_calls.filter((c) => c && c.function && typeof c.function.name === "string");
  }
  const content = typeof msg.content === "string" ? msg.content : "";
  if (!content) return [];
  const xml = extractXmlToolCalls(content);
  if (xml.length) return xml;
  return [];
}

function sortToolCalls(calls: OrToolCall[]) {
  const rank = (name: string) =>
    name === "set_jev_case" ? 0 : name === "set_jev_questions" ? 1 : name === "ask_jev" ? 2 : 3;
  return [...calls].sort((a, b) => rank(a.function.name) - rank(b.function.name));
}

async function completeChat(opts: {
  apiKey: string;
  model: string;
  messages: OrMessage[];
  toolChoice: ToolChoice;
  includeReasoning?: boolean;
  onThought?: (text: string) => void;
  onDelta?: (text: string) => void;
}) {
  return completeOpenRouterChat({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: opts.messages,
    tools: LLM_TOOLS,
    toolChoice: opts.toolChoice,
    includeReasoning: opts.includeReasoning !== false,
    onThought: opts.onThought,
    onDelta: opts.onDelta,
  });
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: {
    env: Record<string, string>;
    jevModel: string;
    includeTranscript: boolean;
    transcript: Array<{ role: string; content: string }>;
    work: Working;
    res: ServerResponse;
    callId: string;
    argsSummary: string;
  },
): Promise<string> {
  const { work, res, callId, argsSummary } = ctx;
  const base = { id: callId, name, status: "done" as const, argsSummary };
  if (name === "set_jev_case") {
    const state = String(args.state ?? args.case ?? args.text ?? "");
    if (!state.trim()) {
      const payload = { ok: false, message: "state is required." };
      emit(res, { type: "tool", ...base, ...payload, resultSummary: payload.message });
      return JSON.stringify(payload);
    }
    work.state = state.slice(0, MAX_STATE_CHARS);
    work.appliedCase = true;
    emit(res, {
      type: "tool",
      ...base,
      ok: true,
      resultSummary: `Wrote ${work.state.length.toLocaleString()} characters`,
      state: work.state,
    });
    return JSON.stringify({ ok: true, chars: work.state.length });
  }

  if (name === "set_jev_questions") {
    const parsed = parseJevQuestions(questionsFromToolArgs(args) ?? args);
    if (!parsed.ok) {
      const payload = { ok: false, message: parsed.message, skipped: parsed.skipped };
      emit(res, { type: "tool", ...base, ...payload, resultSummary: parsed.message });
      return JSON.stringify(payload);
    }
    work.questions = parsed.questions;
    work.appliedQuestions = true;
    work.questionCount = Object.keys(parsed.questions).length;
    emit(res, {
      type: "tool",
      ...base,
      ok: true,
      resultSummary: `Loaded ${work.questionCount} question${work.questionCount === 1 ? "" : "s"}`,
      questions: parsed.questions,
      skipped: parsed.skipped,
    });
    return JSON.stringify({
      ok: true,
      count: work.questionCount,
      ids: Object.keys(parsed.questions),
      skipped: parsed.skipped,
    });
  }

  if (name === "ask_jev") {
    const clean = stripBlankQuestions(work.questions);
    if (!questionsAreClean(clean) || !Object.keys(clean).length) {
      const payload = {
        ok: false,
        message:
          "Questions are not clean (need real ids). Use set_jev_questions, then the operator clicks Ask Jev.",
      };
      emit(res, { type: "tool", ...base, ...payload, resultSummary: payload.message });
      return JSON.stringify(payload);
    }
    const state =
      ctx.includeTranscript && ctx.transcript.length
        ? { case: work.state, transcript: ctx.transcript }
        : work.state;
    const result = await callJev({
      apiKey: ctx.env.OPENROUTER_API_KEY,
      model: ctx.jevModel,
      state,
      questions: clean,
    });
    if (!result.ok) {
      emit(res, {
        type: "tool",
        ...base,
        ok: false,
        message: result.message,
        resultSummary: result.message,
      });
      return JSON.stringify({ ok: false, message: result.message });
    }
    work.askedJev = true;
    const count = result.answers && typeof result.answers === "object"
      ? Object.keys(result.answers as object).length
      : 0;
    emit(res, {
      type: "tool",
      ...base,
      ok: true,
      resultSummary: `Jev answered ${count} question${count === 1 ? "" : "s"}`,
      answers: result.answers,
      model: result.model,
      usage: result.usage,
    });
    return JSON.stringify({
      ok: true,
      answers: result.answers,
      note: "Answers are in the Jev pane. Do not dump them as if you were Jev writing prose.",
    });
  }

  const payload = { ok: false, message: `Unknown tool ${name}.` };
  emit(res, { type: "tool", ...base, ...payload, resultSummary: payload.message });
  return JSON.stringify(payload);
}

function salvageQuestionsFromText(text: string): Record<string, JevQuestion> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const parsedJson = tryJson(raw);
  if (parsedJson == null) return null;
  const parsed = parseJevQuestions(parsedJson);
  return parsed.ok ? parsed.questions : null;
}

export async function runLlmSession(opts: {
  env: Record<string, string>;
  model: string;
  jevModel: string;
  primer: string;
  body: LlmSessionBody;
  res: ServerResponse;
}): Promise<void> {
  const mode: LlmMode = opts.body.mode === "propose-questions" ? "propose-questions" : "chat";
  const transcript = incomingMessages(opts.body.messages);
  const includeTranscript = Boolean(opts.body.includeTranscript);
  const work: Working = {
    state: String(opts.body.state ?? "").slice(0, MAX_STATE_CHARS),
    questions: incomingQuestions(opts.body.questions),
    appliedCase: false,
    appliedQuestions: false,
    askedJev: false,
    questionCount: 0,
  };
  work.questionCount = Object.keys(work.questions).length;

  const system = llmSystem({
    primer: opts.primer,
    state: work.state,
    questions: work.questions,
    jevAnswers: opts.body.jevAnswers,
    mode,
  });

  const messages: OrMessage[] = [
    { role: "system", content: system },
    ...transcript.map((m) => ({ role: m.role, content: m.content })),
  ];

  let toolChoice: ToolChoice =
    mode === "propose-questions"
      ? { type: "function", function: { name: "set_jev_questions" } }
      : "auto";
  let includeReasoning = true;

  const runChat = async (choice: ToolChoice, streamed: { delta: boolean }) =>
    completeChat({
      apiKey: opts.env.OPENROUTER_API_KEY,
      model: opts.model,
      messages,
      toolChoice: choice,
      includeReasoning,
      onThought: (text) => emit(opts.res, { type: "thought", text }),
      onDelta: (text) => {
        streamed.delta = true;
        emit(opts.res, { type: "delta", text });
      },
    });

  const runTool = async (
    name: string,
    args: Record<string, unknown>,
    callId: string,
  ) => {
    const argsSummary = summarizeToolArgs(name, args);
    emit(opts.res, {
      type: "tool",
      id: callId,
      name,
      status: "running",
      argsSummary,
    });
    return executeTool(name, args, {
      env: opts.env,
      jevModel: opts.jevModel,
      includeTranscript,
      transcript,
      work,
      res: opts.res,
      callId,
      argsSummary,
    });
  };

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (opts.res.writableEnded) return;
      if (round === MAX_ROUNDS - 1) toolChoice = "none";
      else if (mode === "propose-questions" && work.appliedQuestions) toolChoice = "auto";

      const streamed = { delta: false };
      let result = await runChat(toolChoice, streamed);

      if (!result.ok && result.retryReasoning && includeReasoning) {
        includeReasoning = false;
        result = await runChat(toolChoice, streamed);
      }

      if (!result.ok && result.retryTools && toolChoice !== "auto") {
        toolChoice = toolChoice === "required" ? "auto" : "required";
        result = await runChat(toolChoice, streamed);
        if (!result.ok && result.retryTools && toolChoice !== "auto") {
          result = await runChat("auto", streamed);
        }
      }

      if (!result.ok) {
        emit(opts.res, { type: "error", message: sanitizePublicError(result.message) });
        emit(opts.res, { type: "done" });
        return;
      }

      const calls = sortToolCalls(toolCallsFromMessage(result.message));
      const content = (result.message.content || "").trim();

      if (calls.length) {
        messages.push({
          role: "assistant",
          content: result.message.content,
          tool_calls: calls,
          reasoning: result.message.reasoning,
          reasoning_details: result.message.reasoning_details,
        });
        for (const call of calls) {
          const args = parseArgs(call.function.arguments);
          const toolResult = await runTool(call.function.name, args, call.id);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: toolResult,
          });
        }
        continue;
      }

      if (mode === "propose-questions" && !work.appliedQuestions && content) {
        const salvaged = salvageQuestionsFromText(content);
        if (salvaged) {
          await runTool("set_jev_questions", { questions: salvaged }, newCallId());
          emit(opts.res, { type: "delta", text: confirmationFor(work) });
          emit(opts.res, { type: "done" });
          return;
        }
      }

      let text = content;
      if (!text && (work.appliedCase || work.appliedQuestions || work.askedJev)) {
        text = confirmationFor(work);
      } else if (text && (work.appliedCase || work.appliedQuestions) && looksLikeJsonDump(text)) {
        text = confirmationFor(work);
      }
      if (text && (!streamed.delta || text !== content)) {
        emit(opts.res, { type: "delta", text });
      }
      emit(opts.res, { type: "done" });
      return;
    }

    if (mode === "propose-questions" && !work.appliedQuestions) {
      const last = [...messages].reverse().find((m) => m.role === "assistant" && "content" in m);
      const lastText = last && last.role === "assistant" ? String(last.content ?? "") : "";
      const salvaged = salvageQuestionsFromText(lastText);
      if (salvaged) {
        await runTool("set_jev_questions", { questions: salvaged }, newCallId());
      }
    }
    emit(opts.res, {
      type: "delta",
      text: work.appliedQuestions || work.appliedCase || work.askedJev
        ? confirmationFor(work)
        : "I could not apply Jev questions. Try Propose Jev questions again.",
    });
    emit(opts.res, { type: "done" });
  } catch (err) {
    const message = sanitizePublicError(err instanceof Error ? err.message : "LLM failed");
    emit(opts.res, { type: "error", message });
    emit(opts.res, { type: "done" });
  }
}
