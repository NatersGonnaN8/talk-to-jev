/**
 * OpenRouter model list for the Workshop LLM picker.
 * The key stays on the server. Jev ids never enter the chat catalog.
 */
import { openRouterHeaders } from "./openrouter.ts";

export type OpenRouterChatModel = { id: string; name: string };

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const MAX_MODELS = 2000;

function isJevId(id: string) {
  return /^typesafe\/jev(\b|[/-:]|$)/i.test(id.trim());
}

function isChatModel(row: Record<string, unknown>): boolean {
  const architecture = row.architecture;
  if (!architecture || typeof architecture !== "object") return true;
  const arch = architecture as Record<string, unknown>;
  const out = arch.output_modalities;
  if (Array.isArray(out)) return out.some((m) => String(m).toLowerCase() === "text");
  const modality = String(arch.modality ?? "");
  if (!modality) return true;
  return modality.toLowerCase().includes("text");
}

export function chatModelsFromOpenRouter(payload: unknown): OpenRouterChatModel[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const rows: OpenRouterChatModel[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id || isJevId(id) || seen.has(id)) continue;
    if (!isChatModel(row)) continue;
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : id;
    seen.add(id);
    rows.push({ id, name });
    if (rows.length >= MAX_MODELS) break;
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return rows;
}

export async function listOpenRouterModels(apiKey: string | undefined): Promise<
  | { ok: true; models: OpenRouterChatModel[] }
  | { ok: false; status: number; message: string }
> {
  if (!apiKey?.trim()) {
    return { ok: false, status: 501, message: "Need OPENROUTER_API_KEY in .env.local." };
  }
  const upstream = await fetch(MODELS_URL, {
    headers: openRouterHeaders(apiKey!),
  });
  if (!upstream.ok) {
    return { ok: false, status: 502, message: "OpenRouter model list failed." };
  }
  const payload = (await upstream.json().catch(() => null)) as unknown;
  return { ok: true, models: chatModelsFromOpenRouter(payload) };
}
