import { openRouterBase, openRouterHeaders } from "./openrouter.ts";
import { friendlyUpstreamMessage, type Access } from "./publicMode.ts";
import { attachChoiceLegends, rewriteChoiceKeysInQuestions } from "./questions.ts";
import {
  VIOLENCE_GATE_CODE,
  ticketFromJevState,
  workshopPayloadBlocked,
} from "./violenceGate.ts";

export type JevCallResult =
  | { ok: true; model: string; answers: unknown; usage: unknown; elapsedMs: number }
  | { ok: false; status: number; message: string; code?: string };

export async function callJev(opts: {
  apiKey: string;
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
  signal?: AbortSignal;
  /** Who is paying, for friendly error wording. */
  tier?: Access["kind"];
}): Promise<JevCallResult> {
  const gate = workshopPayloadBlocked(ticketFromJevState(opts.state), opts.questions);
  if (gate.blocked) {
    return { ok: false, status: 400, message: gate.message, code: gate.code };
  }
  const questions = rewriteChoiceKeysInQuestions(opts.questions);
  const started = performance.now();
  const upstream = await fetch(`${openRouterBase()}/api/alpha/decisions`, {
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
      message: friendlyUpstreamMessage(upstream.status, opts.tier, "Jev"),
    };
  }
  return {
    ok: true,
    model: typeof payload.model === "string" ? payload.model : opts.model,
    answers: attachChoiceLegends(payload.answers, questions),
    usage: payload.usage,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
