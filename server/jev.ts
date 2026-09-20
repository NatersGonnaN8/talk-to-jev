import { openRouterHeaders } from "./openrouter";

export type JevCallResult =
  | { ok: true; model: string; answers: unknown; usage: unknown }
  | { ok: false; status: number; message: string };

export async function callJev(opts: {
  apiKey: string;
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
}): Promise<JevCallResult> {
  const upstream = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: openRouterHeaders(opts.apiKey),
    body: JSON.stringify({
      model: opts.model,
      state: opts.state,
      questions: opts.questions,
    }),
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
    answers: payload.answers,
    usage: payload.usage,
  };
}
