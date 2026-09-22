import { useEffect, useState } from "react";

/** Cheap OpenRouter chat models. Never Jev. Storage: `talk-to-jev:llm-model`. */

export const LLM_MODEL_KEY = "talk-to-jev:llm-model";
export const LLM_MODEL_CHANGE = "talk-to-jev:llm-model-change";
export const LLM_CATALOG_KEY = "talk-to-jev:llm-catalog";
export const LLM_CATALOG_CHANGE = "talk-to-jev:llm-catalog-change";
export const HIGHLIGHT_LLM_PICKER = "talk-to-jev:highlight-llm-picker";
export const DEFAULT_LLM_MODEL = "deepseek/deepseek-v4-flash";
const LLM_MODEL_MAX = 160;
const LLM_MODEL_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:+-]*$/i;

export type LlmChatModel = { id: string; label: string };

export const LLM_CHAT_MODELS: LlmChatModel[] = [
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "qwen/qwen3-32b", label: "Qwen3 32B" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
];

export const LLM_MODEL_TIP =
  "OpenRouter chat model for this pane. Jev stays typesafe/jev-1.13.";

export function isJevModelId(id: string): boolean {
  return /^typesafe\/jev(\b|[/-:]|$)/i.test(id.trim());
}

export function normalizeLlmModel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  if (!id || id.length > LLM_MODEL_MAX) return "";
  if (!LLM_MODEL_RE.test(id)) return "";
  if (isJevModelId(id)) return "";
  return id;
}

export function readLlmModel(): string {
  try {
    return normalizeLlmModel(localStorage.getItem(LLM_MODEL_KEY)) || DEFAULT_LLM_MODEL;
  } catch {
    return DEFAULT_LLM_MODEL;
  }
}

export function writeLlmModel(raw: string): string {
  const next = normalizeLlmModel(raw) || DEFAULT_LLM_MODEL;
  try {
    localStorage.setItem(LLM_MODEL_KEY, next);
  } catch {
    /* private mode / quota */
  }
  try {
    window.dispatchEvent(new CustomEvent(LLM_MODEL_CHANGE, { detail: next }));
  } catch {
    /* */
  }
  return next;
}

export function readLlmCatalog(): LlmChatModel[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LLM_CATALOG_KEY) || "null") as {
      v?: number;
      models?: Array<{ id?: string; name?: string }>;
    } | null;
    if (!raw || raw.v !== 1 || !Array.isArray(raw.models)) return [];
    const rows: LlmChatModel[] = [];
    for (const row of raw.models) {
      const id = normalizeLlmModel(row?.id);
      if (!id) continue;
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      rows.push({ id, label: name || id });
    }
    return rows;
  } catch {
    return [];
  }
}

export function writeLlmCatalog(models: Array<{ id: string; name: string }>): number {
  const rows: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  for (const row of models) {
    const id = normalizeLlmModel(row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = row.name?.trim() || id;
    rows.push({ id, name });
  }
  try {
    localStorage.setItem(LLM_CATALOG_KEY, JSON.stringify({ v: 1, models: rows }));
  } catch {
    /* quota */
  }
  try {
    window.dispatchEvent(new Event(LLM_CATALOG_CHANGE));
  } catch {
    /* */
  }
  return rows.length;
}

export function listLlmChatModels(
  extras: Array<string | null | undefined> = [],
  catalog: LlmChatModel[] = [],
): LlmChatModel[] {
  const rows: LlmChatModel[] = [];
  const seen = new Set<string>();
  const add = (id: string, label?: string) => {
    const n = normalizeLlmModel(id);
    if (!n || seen.has(n)) return;
    seen.add(n);
    const known = LLM_CHAT_MODELS.find((m) => m.id === n);
    const fromCatalog = catalog.find((m) => m.id === n);
    rows.push({ id: n, label: known?.label ?? fromCatalog?.label ?? label ?? n });
  };
  for (const row of LLM_CHAT_MODELS) add(row.id, row.label);
  for (const row of catalog) add(row.id, row.label);
  for (const extra of extras) {
    if (extra) add(extra);
  }
  return rows;
}

export function useLlmCatalog(): LlmChatModel[] {
  const [rows, setRows] = useState(readLlmCatalog);
  useEffect(() => {
    const onChange = () => setRows(readLlmCatalog());
    window.addEventListener(LLM_CATALOG_CHANGE, onChange);
    return () => window.removeEventListener(LLM_CATALOG_CHANGE, onChange);
  }, []);
  return rows;
}

export function useLlmModel(): [string, (id: string) => void] {
  const [model, setModel] = useState(readLlmModel);
  useEffect(() => {
    const onChange = () => setModel(readLlmModel());
    window.addEventListener(LLM_MODEL_CHANGE, onChange);
    return () => window.removeEventListener(LLM_MODEL_CHANGE, onChange);
  }, []);
  return [model, (id: string) => setModel(writeLlmModel(id))];
}
