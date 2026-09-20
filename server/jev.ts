import { openRouterHeaders } from "./openrouter";
import { attachChoiceLegends, rewriteChoiceKeysInQuestions } from "./questions";
import {
  VIOLENCE_GATE_CODE,
  ticketFromJevState,
  workshopPayloadBlocked,
} from "./violenceGate";

export type JevCallResult =
  | { ok: true; model: string; answers: unknown; usage: unknown }
  | { ok: false; status: number; message: string; code?: string };

export async function callJev(opts: {
  apiKey: string;
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<JevCallResult> {
  const gate = workshopPayloadBlocked(ticketFromJevState(opts.state), opts.questions);
  if (gate.blocked) {
    return { ok: false, status: 400, message: gate.message, code: gate.code };
  }
  const questions = rewriteChoiceKeysInQuestions(opts.questions);
  const upstream = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: openRouterHeaders(opts.apiKey),
    body: JSON.stringify({
      model: opts.model,
      state: opts.state,
      questions,
    }),
    signal: opts.signal,
  });
  const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      message: "Jev request failed (details omitted).",
    };
  }
  return {
    ok: true,
    model: typeof payload.model === "string" ? payload.model : opts.model,
    answers: attachChoiceLegends(payload.answers, questions),
    usage: payload.usage,
  };
}
