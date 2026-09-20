import type { ChatMessage, ChatToolCall, JevAnswer, JevQuestion } from "./types";
import {
  DEFAULT_QUESTIONS,
  DEFAULT_STATE,
  LANDING_SAMPLE_ID,
} from "./samples";
import {
  blankWorkshopQuestions,
  questionsAreBlankWorkshop,
} from "./jevQuestions";

export const STORAGE_KEY = "talk-to-jev:chats";
export const STORE_VERSION = 1;
export const MAX_CHATS = 50;

export type WorkshopSnapshot = {
  messages: ChatMessage[];
  state: string;
  includeChat: boolean;
  questions: Record<string, JevQuestion>;
  answers: Record<string, JevAnswer> | null;
  jevMeta: string;
  samplePresetId: string | null;
};

export type ChatThread = WorkshopSnapshot & {
  id: string;
  title: string;
  titleLocked: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ChatStore = {
  v: 1;
  activeId: string | null;
  chats: ChatThread[];
};

const SECRET_FIELD =
  /^(openrouter_api_key|openai_api_key|anthropic_api_key|tavily_api_key|brave_api_key|api_key|apikey|authorization|token|secret)$/i;

export function emptySnapshot(): WorkshopSnapshot {
  return {
    messages: [],
    state: "",
    includeChat: true,
    questions: blankWorkshopQuestions(),
    answers: null,
    jevMeta: "",
    samplePresetId: null,
  };
}

export function cloneChatMessage(m: ChatMessage): ChatMessage {
  return {
    role: m.role,
    content: m.content,
    ...(m.thoughts ? { thoughts: m.thoughts } : {}),
    ...(m.tools?.length ? { tools: m.tools.map((t) => ({ ...t })) } : {}),
  };
}

/** Detached copy so React state is not aliased to the store object. */
export function cloneSnapshot(snap: WorkshopSnapshot): WorkshopSnapshot {
  return {
    messages: snap.messages.map(cloneChatMessage),
    state: snap.state,
    includeChat: snap.includeChat,
    questions: structuredClone(snap.questions),
    answers: snap.answers ? structuredClone(snap.answers) : null,
    jevMeta: snap.jevMeta,
    samplePresetId: snap.samplePresetId,
  };
}

export function autoTitle(messages: ChatMessage[], state: string): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (firstUser) return clipTitle(firstUser.content);
  const caseLine = firstMeaningfulCaseLine(state);
  if (caseLine) return clipTitle(caseLine);
  return "Untitled case";
}

function firstMeaningfulCaseLine(state: string) {
  const withoutWeather = state.replace(
    /<!--\s*weather:start\s-->[\s\S]*?<!--\s*weather:end\s-->/gi,
    "\n",
  );
  for (const raw of withoutWeather.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("<!--")) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    return line;
  }
  return "";
}

export function snapshotWorthSaving(snap: WorkshopSnapshot, titleLocked = false): boolean {
  if (titleLocked) return true;
  if (snap.messages.some((m) => m.content.trim() || m.thoughts?.trim() || (m.tools && m.tools.length))) return true;
  if (snap.answers && Object.keys(snap.answers).length) return true;
  if (snap.jevMeta.trim()) return true;
  if (snap.includeChat === false) return true;
  if (isEmptyWorkshop(snap)) return false;
  const invoiceLanding = snap.samplePresetId === LANDING_SAMPLE_ID;
  if (!invoiceLanding) return true;
  if (snap.state.trim() !== DEFAULT_STATE.trim()) return true;
  if (stableJson(snap.questions) !== stableJson(DEFAULT_QUESTIONS)) return true;
  return false;
}

function isEmptyWorkshop(snap: WorkshopSnapshot) {
  if (snap.samplePresetId != null) return false;
  if (snap.state.trim()) return false;
  return questionsAreBlankWorkshop(snap.questions);
}

export function loadStore(): ChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, activeId: null, chats: [] };
    const parsed: unknown = JSON.parse(raw);
    const store = normalizeStore(parsed);
    return store ?? { v: 1, activeId: null, chats: [] };
  } catch {
    return { v: 1, activeId: null, chats: [] };
  }
}

export function persistStore(store: ChatStore): ChatStore {
  const next = capStore(sanitizeStore(store));
  writeWithRetry(next);
  return next;
}

export function upsertActive(
  store: ChatStore,
  snap: WorkshopSnapshot,
  opts?: { titleLocked?: boolean; title?: string },
): ChatStore {
  const existing = store.chats.find((c) => c.id === store.activeId);
  const titleLocked = opts?.titleLocked ?? existing?.titleLocked ?? false;
  const worth = snapshotWorthSaving(snap, titleLocked);

  if (!worth) {
    if (existing && snapshotWorthSaving(existing, existing.titleLocked)) {
      // Boot / Strict unmount often flushes an empty Workshop while activeId
      // still points at a real thread. Park it. Never wipe messages/case.
      return persistStore({ v: 1, activeId: null, chats: store.chats });
    }
    const chats = existing
      ? store.chats.filter((c) => c.id !== existing.id)
      : store.chats;
    return persistStore({ v: 1, activeId: null, chats });
  }

  const now = Date.now();
  const title =
    opts?.title?.trim() ||
    (titleLocked && existing?.title
      ? existing.title
      : autoTitle(snap.messages, snap.state));

  const thread: ChatThread = {
    ...(existing ?? {
      id: newChatId(),
      createdAt: now,
      titleLocked: false,
    }),
    ...cloneSnapshot(snap),
    title,
    titleLocked,
    updatedAt: now,
  };

  const chats = [thread, ...store.chats.filter((c) => c.id !== thread.id)];
  return persistStore({ v: 1, activeId: thread.id, chats });
}

export function startNewChat(store: ChatStore, current: WorkshopSnapshot): ChatStore {
  const saved = snapshotWorthSaving(current)
    ? upsertActive(store, current)
    : store;
  return persistStore({ v: 1, activeId: null, chats: saved.chats });
}

export function selectChat(store: ChatStore, id: string): ChatStore {
  if (!store.chats.some((c) => c.id === id)) return store;
  return persistStore({ ...store, activeId: id });
}

export function renameChat(store: ChatStore, id: string, title: string): ChatStore {
  const nextTitle = title.trim() || "Untitled case";
  const chats = store.chats.map((c) =>
    c.id === id
      ? { ...c, title: nextTitle, titleLocked: true, updatedAt: Date.now() }
      : c,
  );
  return persistStore({ ...store, chats });
}

export function deleteChat(store: ChatStore, id: string): ChatStore {
  const chats = store.chats.filter((c) => c.id !== id);
  const activeId = store.activeId === id ? null : store.activeId;
  return persistStore({ v: 1, activeId, chats });
}

export function activeThread(store: ChatStore): ChatThread | null {
  if (!store.activeId) return null;
  return store.chats.find((c) => c.id === store.activeId) ?? null;
}

function newChatId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clipTitle(text: string) {
  const line = text.trim().split(/\r?\n/)[0]?.replace(/\s+/g, " ") ?? "";
  if (line.length <= 48) return line || "Untitled case";
  return `${line.slice(0, 45).trimEnd()}…`;
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function capStore(store: ChatStore): ChatStore {
  const chats = [...store.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  if (chats.length <= MAX_CHATS) {
    return { ...store, chats };
  }
  const kept: ChatThread[] = [];
  for (const chat of chats) {
    if (kept.length < MAX_CHATS || chat.id === store.activeId) kept.push(chat);
  }
  const trimmed = kept.slice(0, MAX_CHATS);
  if (store.activeId && !trimmed.some((c) => c.id === store.activeId)) {
    const active = chats.find((c) => c.id === store.activeId);
    if (active) trimmed.splice(MAX_CHATS - 1, 1, active);
  }
  return {
    ...store,
    chats: trimmed.sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

function writeWithRetry(store: ChatStore) {
  let attempt: ChatStore = store;
  for (let i = 0; i < 8; i++) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
      return;
    } catch {
      if (attempt.chats.length <= 1) return;
      const dropId =
        attempt.chats.filter((c) => c.id !== attempt.activeId).at(-1)?.id ??
        attempt.chats.at(-1)?.id;
      if (!dropId) return;
      attempt = {
        ...attempt,
        chats: attempt.chats.filter((c) => c.id !== dropId),
        activeId: attempt.activeId === dropId ? null : attempt.activeId,
      };
    }
  }
}

function sanitizeStore(store: ChatStore): ChatStore {
  return {
    v: 1,
    activeId: store.activeId,
    chats: store.chats.map(stripSecretsFromThread),
  };
}

function stripSecretsFromThread(thread: ChatThread): ChatThread {
  const clone = { ...thread } as ChatThread & Record<string, unknown>;
  for (const key of Object.keys(clone)) {
    if (SECRET_FIELD.test(key)) delete clone[key];
  }
  return clone;
}

function normalizeStore(raw: unknown): ChatStore | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1) return null;
  for (const k of [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "TAVILY_API_KEY",
    "BRAVE_API_KEY",
  ]) {
    if (k in rec) delete rec[k];
  }
  const chatsIn = Array.isArray(rec.chats) ? rec.chats : [];
  const chats = chatsIn
    .map(normalizeThread)
    .filter((c): c is ChatThread => c !== null);
  const activeId = typeof rec.activeId === "string" ? rec.activeId : null;
  return {
    v: 1,
    activeId: activeId && chats.some((c) => c.id === activeId) ? activeId : null,
    chats: chats.sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

function normalizeThread(raw: unknown): ChatThread | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== "string") return null;
  const messages = normalizeMessages(rec.messages);
  const questions = normalizeQuestions(rec.questions);
  const state = typeof rec.state === "string" ? rec.state : "";
  const titleLocked = Boolean(rec.titleLocked);
  const createdAt = num(rec.createdAt) ?? Date.now();
  const updatedAt = num(rec.updatedAt) ?? createdAt;
  return {
    id: rec.id,
    title:
      typeof rec.title === "string" && rec.title.trim()
        ? rec.title
        : autoTitle(messages, state),
    titleLocked,
    createdAt,
    updatedAt,
    messages,
    state,
    includeChat: rec.includeChat !== false,
    questions,
    answers: normalizeAnswers(rec.answers),
    jevMeta: typeof rec.jevMeta === "string" ? rec.jevMeta : "",
    samplePresetId:
      typeof rec.samplePresetId === "string" && rec.samplePresetId
        ? rec.samplePresetId
        : null,
  };
}

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.role !== "user" && rec.role !== "assistant") continue;
    if (typeof rec.content !== "string") continue;
    const tools = normalizeTools(rec.tools);
    out.push({
      role: rec.role,
      content: rec.content,
      ...(typeof rec.thoughts === "string" && rec.thoughts
        ? { thoughts: rec.thoughts }
        : {}),
      ...(tools.length ? { tools } : {}),
    });
  }
  return out;
}

function normalizeTools(raw: unknown): ChatToolCall[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== "string" || !rec.name) continue;
    const status = rec.status === "running" ? "running" : "done";
    out.push({
      id: typeof rec.id === "string" && rec.id ? rec.id : rec.name,
      name: rec.name,
      status,
      ...(typeof rec.ok === "boolean" ? { ok: rec.ok } : {}),
      argsSummary: typeof rec.argsSummary === "string" ? rec.argsSummary : "",
      ...(typeof rec.resultSummary === "string"
        ? { resultSummary: rec.resultSummary }
        : {}),
    });
  }
  return out;
}

function normalizeQuestions(raw: unknown): Record<string, JevQuestion> {
  if (!raw || typeof raw !== "object") return blankWorkshopQuestions();
  const out: Record<string, JevQuestion> = {};
  for (const [id, q] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = asQuestion(q);
    // Keep `__blank__:uuid` keys — restore must still show the empty-id card.
    if (parsed) out[id] = parsed;
  }
  return Object.keys(out).length ? out : blankWorkshopQuestions();
}

function asQuestion(raw: unknown): JevQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const instructions = String(rec.instructions ?? "");
  if (rec.type === "choice" && rec.criteria && typeof rec.criteria === "object") {
    return {
      type: "choice",
      instructions,
      criteria: Object.fromEntries(
        Object.entries(rec.criteria as Record<string, unknown>).map(([k, v]) => [
          k,
          v == null ? "" : String(v),
        ]),
      ),
    };
  }
  if (rec.type === "score" && Array.isArray(rec.criteria)) {
    return {
      type: "score",
      instructions,
      criteria: rec.criteria.map((v) => String(v)),
    };
  }
  if (rec.type === "noul") {
    const c = rec.criteria;
    return {
      type: "noul",
      instructions,
      criteria:
        c && typeof c === "object"
          ? {
              true: String((c as { true?: string }).true ?? ""),
              false: String((c as { false?: string }).false ?? ""),
            }
          : undefined,
    };
  }
  return null;
}

function normalizeAnswers(raw: unknown): Record<string, JevAnswer> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, JevAnswer> = {};
  for (const [id, a] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = asAnswer(a);
    if (parsed) out[id] = parsed;
  }
  return Object.keys(out).length ? out : null;
}

function asAnswer(raw: unknown): JevAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.type === "noul") {
    return { type: "noul", noul: Number(rec.noul) };
  }
  if (rec.type === "choice") {
    return {
      type: "choice",
      choice: String(rec.choice ?? ""),
      probabilities: asNumMap(rec.probabilities),
      confidence: num(rec.confidence),
    };
  }
  if (rec.type === "score") {
    return {
      type: "score",
      score: Number(rec.score),
      legend: asStrMap(rec.legend),
      probabilities: asNumMap(rec.probabilities),
      confidence: num(rec.confidence),
    };
  }
  return null;
}

function asNumMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, Number(v)]),
  );
}

function asStrMap(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
      k,
      v == null ? "" : String(v),
    ]),
  );
}

function num(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}
