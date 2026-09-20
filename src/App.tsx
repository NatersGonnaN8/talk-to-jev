import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  askJev,
  fetchWeather,
  getHealth,
  streamLlm,
  updateDocs,
} from "./api";
import type {
  ChatMessage,
  ChatToolCall,
  Health,
  JevAnswer,
  JevQuestion,
  QuestionType,
} from "./types";
import { DevInspector } from "./DevInspector";
import { DocsPage } from "./pages/Docs";
import {
  cloneSample,
  isWeatherSample,
  type SampleId,
} from "./samples";
import {
  BLANK_QUESTION_KEY_PREFIX,
  addChoiceOption,
  attachChoiceLegends,
  blankQuestionKeys,
  emptyQuestion,
  isBlankQuestionId,
  nextBlankQuestionKey,
  nextStableUid,
  probabilityBarLabel,
  questionIdValue,
  removeChoiceOption,
  renameRecordKey,
  spacesToSnake,
  withPositionalChoiceKeys,
} from "./jevQuestions";
import { DEFAULT_LOCATION_QUERY, mergeWeatherIntoCase } from "./weather";
import {
  MAX_ATTACH_CHARS,
  MAX_ATTACH_FILES,
  attachFilesToCase,
  listAttachedNames,
  mergeAttachIntoCase,
  sanitizeAttachName,
  stripAttachFromCase,
} from "./attach";
import { AttachBar } from "./AttachBar";
import { FlipTip } from "./FlipTip";
import { PresetCasesMenu } from "./PresetCasesMenu";
import { ConvertPane } from "./ConvertPane";
import { partitionDroppedFiles } from "./convert/formats";
import { UseCasesPage } from "./UseCases";
import { SettingsPage } from "./pages/Settings";
import { HistoryPanel } from "./HistoryPanel";
import { TutorialOverlay } from "./TutorialOverlay";
import { LlmBubble, ThinkingMill } from "./LlmBubble";
import { AgenticLoopMenu } from "./AgenticLoopMenu";
import {
  AGENTIC_LOOP_NEED_MILL,
  agenticLoopContinuePrompt,
  agenticLoopFirstPrompt,
  clampAgenticLoopTurns,
  millReadyForAgenticLoop,
} from "./agenticLoop";
import {
  randomStateAnalysisPrompt,
  randomStateInventPrompt,
} from "./randomState";
import { isTutorialDone, TUTORIAL_UI, type TutorialPage } from "./tutorial";
import {
  activeThread,
  cloneSnapshot,
  cloneChatMessage,
  deleteChat,
  emptySnapshot,
  loadStore,
  persistStore,
  renameChat,
  selectChat,
  startNewChat,
  upsertActive,
  type ChatStore,
  type WorkshopSnapshot,
} from "./history";
import {
  TICKET_HEIGHT_MIN,
  TICKET_NUDGE_PX,
  TICKET_NUDGE_SHIFT_PX,
  clampTicketHeight,
  loadTicketHeight,
  saveTicketHeight,
  ticketHeightBounds,
  workshopColumnHeight,
} from "./ticketSplit";

type Page = "workshop" | "docs" | "use-cases" | "settings" | "convert";

function pageFromPath(): Page {
  const p = window.location.pathname;
  if (p.startsWith("/docs")) return "docs";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/convert")) return "convert";
  if (p.startsWith("/use-cases") || p.startsWith("/cases")) return "use-cases";
  return "workshop";
}

function caseFromSearch(): string | null {
  const id = new URLSearchParams(window.location.search).get("case");
  return id?.trim() || null;
}

const BLANK_QUESTION_ID_ERROR =
  "Type a question id before asking Jev. We will not invent one.";

function questionsForJev(questions: Record<string, JevQuestion>) {
  const out: Record<string, JevQuestion> = {};
  for (const [id, q] of Object.entries(questions)) {
    if (!isBlankQuestionId(id)) out[id] = q;
  }
  return withPositionalChoiceKeys(out);
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function summarizeAnswers(answers: Record<string, JevAnswer>) {
  const lines = ["Jev returned typed answers (not prose):"];
  for (const [id, a] of Object.entries(answers)) {
    if (a.type === "choice") {
      lines.push(
        `- ${id}: choice=${a.choice} confidence=${a.confidence ?? "n/a"} probs=${JSON.stringify(a.probabilities)}`,
      );
    } else if (a.type === "noul") {
      lines.push(`- ${id}: noul P(true)=${a.noul}`);
    } else if (a.type === "score") {
      lines.push(
        `- ${id}: score=${a.score} confidence=${a.confidence ?? "n/a"}`,
      );
    }
  }
  lines.push("Use these as signals. A typed answer can still be wrong.");
  return lines.join("\n");
}

function cloneMsg(m: ChatMessage): ChatMessage {
  return cloneChatMessage(m);
}

function patchLastAssistant(
  messages: ChatMessage[],
  patch: Partial<Pick<ChatMessage, "content" | "thoughts" | "tools">>,
): ChatMessage[] {
  const copy = messages.map(cloneMsg);
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role !== "assistant") continue;
    const prev = copy[i];
    copy[i] = cloneMsg({
      role: "assistant",
      content: patch.content ?? prev.content,
      thoughts: patch.thoughts ?? prev.thoughts,
      tools: patch.tools ?? prev.tools,
    });
    return copy;
  }
  return [
    ...copy,
    cloneMsg({
      role: "assistant",
      content: patch.content ?? "",
      thoughts: patch.thoughts,
      tools: patch.tools,
    }),
  ];
}

function upsertLastAssistantTool(
  messages: ChatMessage[],
  tool: ChatToolCall,
): ChatMessage[] {
  const copy = messages.map(cloneMsg);
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role !== "assistant") continue;
    const tools = [...(copy[i].tools ?? [])];
    const idx = tools.findIndex((t) => t.id === tool.id);
    if (idx >= 0) tools[idx] = { ...tools[idx], ...tool };
    else tools.push(tool);
    copy[i] = { ...copy[i], tools };
    return copy;
  }
  return [...copy, { role: "assistant", content: "", tools: [tool] }];
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromPath);
  const [caseId, setCaseId] = useState<string | null>(caseFromSearch);
  const [presetNonce, setPresetNonce] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [toast, setToast] = useState("");
  const [updating, setUpdating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !isTutorialDone());
  const [tourKey, setTourKey] = useState(0);
  const [docsTick, setDocsTick] = useState(0);
  const [convertBatch, setConvertBatch] = useState<{
    id: string;
    files: File[];
  } | null>(null);
  const [convertCaseText, setConvertCaseText] = useState("");
  const convertAddToCase = useRef<
    (filename: string, markdown: string) => { ok: boolean; message: string }
  >(() => ({ ok: false, message: "Workshop is still loading." }));
  const convertAddToLlm = useRef<(filename: string, markdown: string) => void>(
    () => {},
  );
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    const onPop = () => {
      setPage(pageFromPath());
      setCaseId(caseFromSearch());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth(h);
      })
      .catch(() => {
        setHealth(null);
      });
  }, []);

  const go = (next: Page, sampleId?: SampleId) => {
    if (next === pageRef.current && !sampleId) {
      if (next !== "workshop") setHistoryOpen(false);
      return;
    }
    if (next === "docs") {
      window.history.pushState({}, "", "/docs");
      setCaseId(null);
    } else if (next === "use-cases") {
      window.history.pushState({}, "", "/use-cases");
      setCaseId(null);
    } else if (next === "settings") {
      window.history.pushState({}, "", "/settings");
      setCaseId(null);
    } else if (next === "convert") {
      window.history.pushState({}, "", "/convert");
      setCaseId(null);
    } else if (sampleId) {
      window.history.pushState({}, "", `/?case=${encodeURIComponent(sampleId)}`);
      setCaseId(sampleId);
      setPresetNonce((n) => n + 1);
    } else {
      window.history.pushState({}, "", "/");
      setCaseId(null);
    }
    setPage(next);
    if (next !== "workshop") setHistoryOpen(false);
  };

  const consumeConvertBatch = useCallback(() => {
    setConvertBatch(null);
  }, []);

  const onBlankWorkshop = useCallback(() => {
    window.history.pushState({}, "", "/");
    setCaseId(null);
  }, []);

  const queueConvertFiles = (files: File[]) => {
    if (!files.length) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setConvertBatch({ id, files });
    go("convert");
  };

  const goTour = (next: TutorialPage) => {
    go(next);
  };

  const startTour = () => {
    setTourKey((k) => k + 1);
    setTourOpen(true);
  };

  const onUpdateDocs = async () => {
    setUpdating(true);
    setToast("Fetching official Jev docs…");
    try {
      const r = await updateDocs();
      setToast(
        `Docs updated: ${r.fetched} ok, ${r.failed} failed, ${r.files} listed.`,
      );
      setDocsTick((n) => n + 1);
      try {
        setHealth(await getHealth());
      } catch {
        setHealth(null);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="app">
      <header className="chrome">
        <a
          className="mark"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("workshop");
          }}
        >
          Talk to Jev
        </a>
        <nav className="nav">
          <button
            className={page === "workshop" ? "nav-btn on" : "nav-btn"}
            type="button"
            onClick={() => go("workshop")}
          >
            Workshop
          </button>
          <button
            className={page === "use-cases" ? "nav-btn on" : "nav-btn"}
            type="button"
            data-tutorial="use-cases"
            onClick={() => go("use-cases")}
          >
            Example Uses
          </button>
          <button
            className={page === "docs" ? "nav-btn on" : "nav-btn"}
            type="button"
            data-tutorial="docs"
            onClick={() => go("docs")}
          >
            Docs
          </button>
          <button
            className={page === "settings" ? "nav-btn on" : "nav-btn"}
            type="button"
            data-tutorial="settings"
            onClick={() => go("settings")}
          >
            Settings
          </button>
          <button
            className={page === "convert" ? "nav-btn on" : "nav-btn"}
            type="button"
            data-tutorial="convert-nav"
            title="Convert to Markdown"
            aria-label="Convert to Markdown"
            onClick={() => go("convert")}
          >
            Convert
          </button>
        </nav>
        <div className="chrome-right">
          <button
            type="button"
            className="btn ghost"
            data-tutorial="tour"
            aria-label={TUTORIAL_UI.chromeAria}
            onClick={startTour}
          >
            {TUTORIAL_UI.chromeLabel}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={updating}
            onClick={() => void onUpdateDocs()}
          >
            {updating ? "Updating…" : "Update Jev docs"}
          </button>
        </div>
      </header>
      {toast ? (
        <div className="toast" role="status">
          {toast}
          <button type="button" className="toast-x" onClick={() => setToast("")}>
            Close
          </button>
        </div>
      ) : null}
      {page === "docs" ? <DocsPage snapshotTick={docsTick} /> : null}
      {page === "use-cases" ? (
        <div data-tutorial="use-cases-page">
          <UseCasesPage onOpen={(id) => go("workshop", id)} />
        </div>
      ) : null}
      {page === "settings" ? (
        <SettingsPage
          onToast={setToast}
          onSaved={async () => {
            try {
              setHealth(await getHealth());
            } catch {
              setHealth(null);
            }
          }}
        />
      ) : null}
      <div className="page-mount" hidden={page !== "workshop"}>
        <Workshop
          health={health}
          onToast={setToast}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
          inspectorOpen={inspectorOpen}
          onInspectorOpenChange={setInspectorOpen}
          presetId={caseId}
          presetNonce={presetNonce}
          onOpenSample={(id: SampleId) => go("workshop", id)}
          onBlankWorkshop={onBlankWorkshop}
          onQueueConvert={queueConvertFiles}
          onCaseText={setConvertCaseText}
          convertAddToCase={convertAddToCase}
          convertAddToLlm={convertAddToLlm}
        />
      </div>
      <div className="page-mount" hidden={page !== "convert"}>
        <ConvertPane
          batch={convertBatch}
          caseText={convertCaseText}
          onBatchConsumed={consumeConvertBatch}
          onAddToCase={(filename, markdown) =>
            convertAddToCase.current(filename, markdown)
          }
          onAddToLlm={(filename, markdown) =>
            convertAddToLlm.current(filename, markdown)
          }
          onEnqueue={queueConvertFiles}
        />
      </div>
      <TutorialOverlay
        key={tourKey}
        open={tourOpen}
        onDismiss={() => setTourOpen(false)}
        onGo={goTour}
      />
      <DevInspector
        open={inspectorOpen && page === "workshop"}
        onClose={() => setInspectorOpen(false)}
      />
    </div>
  );
}

function Workshop({
  health,
  onToast,
  historyOpen,
  onHistoryOpenChange,
  inspectorOpen,
  onInspectorOpenChange,
  presetId,
  presetNonce,
  onOpenSample,
  onBlankWorkshop,
  onQueueConvert,
  onCaseText,
  convertAddToCase,
  convertAddToLlm,
}: {
  health: Health | null;
  onToast: (s: string) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  inspectorOpen: boolean;
  onInspectorOpenChange: (open: boolean) => void;
  presetId: string | null;
  presetNonce: number;
  onOpenSample: (id: SampleId) => void;
  onBlankWorkshop: () => void;
  onQueueConvert: (files: File[]) => void;
  onCaseText: (text: string) => void;
  convertAddToCase: React.MutableRefObject<
    (filename: string, markdown: string) => { ok: boolean; message: string }
  >;
  convertAddToLlm: React.MutableRefObject<
    (filename: string, markdown: string) => void
  >;
}) {
  const [store, setStore] = useState<ChatStore>(() => loadStore());
  const boot = activeThread(store);
  const [state, setState] = useState(() => boot?.state ?? "");
  const [includeChat, setIncludeChat] = useState(() => boot?.includeChat ?? true);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (boot?.messages ?? []).map(cloneChatMessage),
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"llm" | "jev" | "propose" | "weather" | null>(
    null,
  );
  const [split, setSplit] = useState(50);
  const [ticketHeight, setTicketHeight] = useState(() => loadTicketHeight());
  const [ticketSplitDrag, setTicketSplitDrag] = useState(false);
  const workshopRef = useRef<HTMLElement>(null);
  const desiredTicketHeightRef = useRef(ticketHeight);
  const ticketHeightRef = useRef(ticketHeight);
  ticketHeightRef.current = ticketHeight;
  const [questions, setQuestions] = useState<Record<string, JevQuestion>>(() =>
    withPositionalChoiceKeys(
      boot ? structuredClone(boot.questions) : emptySnapshot().questions,
    ),
  );
  const [answers, setAnswers] = useState<Record<string, JevAnswer> | null>(() =>
    boot?.answers ? structuredClone(boot.answers) : null,
  );
  const [jevMeta, setJevMeta] = useState(() => boot?.jevMeta ?? "");
  const [blankIdError, setBlankIdError] = useState(false);
  const [samplePresetId, setSamplePresetId] = useState<string | null>(
    () => boot?.samplePresetId ?? null,
  );
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCATION_QUERY);
  const [weatherLine, setWeatherLine] = useState("");
  const [attachError, setAttachError] = useState("");
  const [dropOn, setDropOn] = useState(false);
  const dragDepth = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<WorkshopSnapshot>(
    boot ? cloneSnapshot(boot) : emptySnapshot(),
  );
  const storeRef = useRef(store);
  storeRef.current = store;
  const persistReady = useRef(false);
  const skipFirstPersist = useRef(true);
  const streamLockRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const includeChatRef = useRef(includeChat);
  includeChatRef.current = includeChat;
  const [agentRun, setAgentRun] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const agentLockRef = useRef(false);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  const onBlankWorkshopRef = useRef(onBlankWorkshop);
  onBlankWorkshopRef.current = onBlankWorkshop;
  // History restore wins over a leftover `?case=` from last session.
  const skipStaleUrlPreset = useRef(Boolean(boot && presetId));

  const snapshot: WorkshopSnapshot = {
    messages,
    state,
    includeChat,
    questions,
    answers,
    jevMeta,
    samplePresetId,
  };
  snapRef.current = snapshot;

  const commitStore = (next: ChatStore) => {
    storeRef.current = next;
    setStore(next);
    return next;
  };

  const applySnapshot = (snap: WorkshopSnapshot) => {
    const copy = cloneSnapshot(snap);
    snapRef.current = copy;
    stateRef.current = copy.state;
    messagesRef.current = copy.messages;
    questionsRef.current = withPositionalChoiceKeys(copy.questions);
    answersRef.current = copy.answers;
    includeChatRef.current = copy.includeChat;
    setState(copy.state);
    setIncludeChat(copy.includeChat);
    setMessages(copy.messages);
    setQuestions(withPositionalChoiceKeys(copy.questions));
    setAnswers(copy.answers);
    setJevMeta(copy.jevMeta);
    setBlankIdError(false);
    setSamplePresetId(copy.samplePresetId);
    setDraft("");
    setWeatherLine("");
    setLocationQuery(DEFAULT_LOCATION_QUERY);
    setAttachError("");
    setDropOn(false);
    dragDepth.current = 0;
  };

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      const last = el.querySelector(".bubble:last-child");
      last?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [messages, busy]);

  useEffect(() => {
    if (!presetId) return;
    if (streamLockRef.current) return;
    if (skipStaleUrlPreset.current) {
      skipStaleUrlPreset.current = false;
      onBlankWorkshopRef.current();
      return;
    }
    const preset = cloneSample(presetId);
    if (!preset) return;
    commitStore(startNewChat(storeRef.current, snapRef.current));
    applySnapshot({
      messages: [],
      state: preset.state,
      includeChat: true,
      questions: structuredClone(preset.questions),
      answers: null,
      jevMeta: "",
      samplePresetId: preset.id,
    });
    onToastRef.current(
      preset.kind === "weather"
        ? `Loaded “${preset.label}”. Click Load weather for live Open-Meteo.`
        : `Loaded “${preset.label}”.`,
    );
  }, [presetId, presetNonce]);

  // Boot already loaded from localStorage. Re-applying disk on remount
  // (Strict Mode / HMR) overwrites an in-flight or just-finished LLM turn.
  useEffect(() => {
    persistReady.current = true;
  }, []);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    if (!persistReady.current) return;
    const timer = window.setTimeout(() => {
      commitStore(upsertActive(storeRef.current, snapRef.current));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [messages, state, includeChat, questions, answers, jevMeta, samplePresetId]);

  useEffect(() => {
    const flush = () => {
      if (!persistReady.current) return;
      persistStore(upsertActive(storeRef.current, snapRef.current));
    };
    window.addEventListener("beforeunload", flush);
    // Do not flush on unmount — React Strict Mode remounts would mint a new
    // thread or overwrite the restored one with an empty snapshot.
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  const onNewCase = () => {
    commitStore(startNewChat(storeRef.current, snapRef.current));
    applySnapshot(emptySnapshot());
    onBlankWorkshop();
    onHistoryOpenChange(false);
    onToast("New state.");
  };

  const onClearCurrent = () => {
    setMessages([]);
    setAnswers(null);
    setJevMeta("");
    setDraft("");
  };

  const onSelectChat = (id: string) => {
    const current = storeRef.current;
    if (current.activeId && current.activeId !== id) {
      commitStore(upsertActive(current, snapRef.current));
    }
    const next = selectChat(loadStore(), id);
    const chat = next.chats.find((c) => c.id === id);
    if (!chat) return;
    commitStore(next);
    applySnapshot(chat);
    onHistoryOpenChange(false);
  };

  const onRenameChat = (id: string, title: string) => {
    commitStore(renameChat(storeRef.current, id, title));
  };

  const onDeleteChat = (id: string) => {
    const wasActive = storeRef.current.activeId === id;
    commitStore(deleteChat(storeRef.current, id));
    if (wasActive) applySnapshot(emptySnapshot());
  };

  const locked = health?.hasKey === false || busy !== null;

  type LlmClientMode = "chat" | "propose-questions" | "random-case" | "agentic-loop";

  const runLlmTurn = async (
    mode: LlmClientMode,
    content: string,
    opts?: { keepBusy?: boolean; clearDraft?: boolean },
  ): Promise<{ askedJev: boolean; failed: boolean }> => {
    if (mode === "chat" && !content.trim()) {
      return { askedJev: false, failed: false };
    }
    const nextUser: ChatMessage =
      mode === "propose-questions"
        ? {
            role: "user",
            content:
              "Propose atomic Jev questions for this state. Call set_jev_questions. Do not paste JSON in the chat.",
          }
        : { role: "user", content };
    const history = [...messagesRef.current, nextUser];
    const nextMessages: ChatMessage[] = [
      ...history,
      { role: "assistant", content: "" },
    ];
    streamLockRef.current = true;
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    if (opts?.clearDraft) setDraft("");
    if (!opts?.keepBusy) {
      setBusy(mode === "propose-questions" ? "propose" : "llm");
    }
    commitStore(
      upsertActive(storeRef.current, {
        ...snapRef.current,
        messages: nextMessages,
      }),
    );
    let askedJev = false;
    let workingQuestions = questionsRef.current;
    try {
      let appliedQs = 0;
      const full = await streamLlm(
        {
          messages: history,
          state: stateRef.current,
          questions: workingQuestions,
          jevAnswers: answersRef.current ?? undefined,
          includeTranscript: includeChatRef.current,
          mode,
        },
        (ev) => {
          if (ev.type === "delta") {
            setMessages((m) => {
              const next = patchLastAssistant(m, { content: ev.text });
              messagesRef.current = next;
              return next;
            });
            return;
          }
          if (ev.type === "thought") {
            setMessages((m) => {
              const next = patchLastAssistant(m, { thoughts: ev.text });
              messagesRef.current = next;
              return next;
            });
            return;
          }
          if (ev.type === "tool") {
            setMessages((m) => {
              const next = upsertLastAssistantTool(m, {
                id: ev.id,
                name: ev.name,
                status: ev.status,
                ok: ev.ok,
                argsSummary: ev.argsSummary,
                resultSummary: ev.resultSummary,
              });
              messagesRef.current = next;
              return next;
            });
            return;
          }
          if (ev.type === "error") {
            setMessages((m) => {
              const next = patchLastAssistant(m, { content: ev.message });
              messagesRef.current = next;
              return next;
            });
            return;
          }
          if (ev.type === "set_jev_case") {
            stateRef.current = ev.state;
            setState(ev.state);
            onToast("Updated Jev’s State.");
            return;
          }
          if (ev.type === "set_jev_questions") {
            workingQuestions = withPositionalChoiceKeys(ev.questions);
            appliedQs = Object.keys(workingQuestions).length;
            questionsRef.current = workingQuestions;
            setQuestions(workingQuestions);
            setBlankIdError(false);
            answersRef.current = null;
            setAnswers(null);
            onToast(`Loaded ${appliedQs} proposed questions into Jev.`);
            return;
          }
          if (ev.type !== "ask_jev") return;
          askedJev = true;
          const nextAnswers = attachChoiceLegends(
            ev.answers,
            questionsForJev(workingQuestions),
          );
          answersRef.current = nextAnswers;
          setAnswers(nextAnswers);
          const usage = ev.usage as
            | { input_tokens?: number; cost?: number }
            | undefined;
          const bits = [
            ev.model ? String(ev.model) : "",
            usage?.input_tokens != null ? `${usage.input_tokens} in` : "",
            usage?.cost != null ? `$${Number(usage.cost).toFixed(6)}` : "",
          ].filter(Boolean);
          setJevMeta(bits.join(" · "));
          onToast("Jev answered.");
        },
      );
      if (!full.trim() && appliedQs && mode === "propose-questions") {
        setMessages((m) => {
          const next = patchLastAssistant(m, {
            content: `Loaded ${appliedQs} questions into Jev’s Questions. Click Ask Jev when you’re ready.`,
          });
          messagesRef.current = next;
          return next;
        });
      }
      return { askedJev, failed: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : "LLM failed";
      onToast(message);
      setMessages((m) => {
        const next = patchLastAssistant(m, { content: message });
        messagesRef.current = next;
        return next;
      });
      return { askedJev, failed: true };
    } finally {
      streamLockRef.current = false;
      if (!opts?.keepBusy) setBusy(null);
    }
  };

  const sendLlm = async (mode: "chat" | "propose-questions", extra?: string) => {
    const content = extra ?? draft.trim();
    if (mode === "chat" && !content) return;
    await runLlmTurn(mode, content, { clearDraft: !extra });
  };

  const runRandomState = async () => {
    if (health?.hasKey === false || busy !== null || agentLockRef.current) return;
    agentLockRef.current = true;
    setAgentRun(null);
    setBusy("llm");
    answersRef.current = null;
    setAnswers(null);
    setJevMeta("");
    try {
      const first = await runLlmTurn("random-case", randomStateInventPrompt(), {
        keepBusy: true,
      });
      if (first.failed) return;
      const note = answersRef.current
        ? summarizeAnswers(answersRef.current)
        : "";
      if (note.trim()) {
        const analysis = await runLlmTurn(
          "chat",
          randomStateAnalysisPrompt(note),
          { keepBusy: true },
        );
        if (analysis.failed) return;
      }
      onToast("Random state done.");
    } finally {
      agentLockRef.current = false;
      streamLockRef.current = false;
      setBusy(null);
      setAgentRun(null);
    }
  };

  const runAgenticLoop = async (rawTurns: number) => {
    if (health?.hasKey === false || busy !== null || agentLockRef.current) return;
    const realQs = Object.keys(questionsForJev(questionsRef.current)).length;
    if (!millReadyForAgenticLoop(stateRef.current, realQs)) {
      onToast(AGENTIC_LOOP_NEED_MILL);
      return;
    }
    const total = clampAgenticLoopTurns(rawTurns);
    agentLockRef.current = true;
    setAgentRun({ current: 1, total });
    setBusy("llm");
    try {
      const first = await runLlmTurn(
        "agentic-loop",
        agenticLoopFirstPrompt(total),
        { keepBusy: true },
      );
      if (first.failed) return;
      for (let t = 2; t <= total; t++) {
        setAgentRun({ current: t, total });
        const note = answersRef.current
          ? summarizeAnswers(answersRef.current)
          : "";
        const next = await runLlmTurn(
          "chat",
          agenticLoopContinuePrompt(t, total, note),
          { keepBusy: true },
        );
        if (next.failed) return;
      }
      onToast(`Agentic loop · ${total} turns done.`);
    } finally {
      agentLockRef.current = false;
      streamLockRef.current = false;
      setBusy(null);
      setAgentRun(null);
    }
  };

  const onAskJev = async () => {
    if (blankQuestionKeys(questions).length) {
      setBlankIdError(true);
      return;
    }
    const ready = questionsForJev(questions);
    setBlankIdError(false);
    setBusy("jev");
    try {
      const payload = await askJev({
        state,
        questions: ready,
        includeTranscript: includeChat,
        transcript: includeChat ? messages : [],
      });
      setAnswers(
        attachChoiceLegends(
          (payload.answers ?? {}) as Record<string, JevAnswer>,
          ready,
        ),
      );
      const usage = payload.usage as
        | { input_tokens?: number; cost?: number }
        | undefined;
      const bits = [
        payload.model ? String(payload.model) : "",
        usage?.input_tokens != null ? `${usage.input_tokens} in` : "",
        usage?.cost != null ? `$${Number(usage.cost).toFixed(6)}` : "",
      ].filter(Boolean);
      setJevMeta(bits.join(" · "));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Jev failed");
    } finally {
      setBusy(null);
    }
  };

  const feedJev = () => {
    if (!answers) {
      onToast("Ask Jev first — nothing to feed.");
      return;
    }
    const note = summarizeAnswers(answers);
    if (!note.trim()) {
      onToast("Ask Jev first — nothing to feed.");
      return;
    }
    onToast("Fed Jev’s answers into the LLM thread.");
    void sendLlm("chat", note);
  };

  const attachedNames = useMemo(() => listAttachedNames(state), [state]);

  const onTicketFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    const { markdown, convert, unsupported } = partitionDroppedFiles(files);
    const errors: string[] = [];
    if (unsupported.length) {
      errors.push(`Not supported: ${unsupported.join(", ")}`);
    }
    if (markdown.length) {
      const result = await attachFilesToCase(state, markdown);
      setState(result.state);
      errors.push(...result.errors);
    }
    if (convert.length) onQueueConvert(convert);
    setAttachError(errors.filter(Boolean).join(" "));
  };

  const onPickMarkdown = (list: FileList) => {
    void onTicketFiles(list);
  };

  const onRemoveAttach = (name: string) => {
    setState((s) => stripAttachFromCase(s, name));
    setAttachError("");
  };

  const onConvertAddToCase = (filename: string, markdown: string) => {
    const name = sanitizeAttachName(filename);
    if (markdown.length > MAX_ATTACH_CHARS) {
      return {
        ok: false,
        message: `Too large for Jev’s State (max ${MAX_ATTACH_CHARS.toLocaleString()} characters)`,
      };
    }
    let ok = true;
    let message = `Added ${name} to Jev’s State.`;
    setState((s) => {
      const already = listAttachedNames(s);
      const replacing = already.includes(name);
      if (!replacing && already.length >= MAX_ATTACH_FILES) {
        ok = false;
        message = `At most ${MAX_ATTACH_FILES} attached files`;
        return s;
      }
      return mergeAttachIntoCase(s, name, markdown);
    });
    return { ok, message };
  };

  const onConvertAddToLlm = (filename: string, markdown: string) => {
    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: `Converted markdown from ${filename}:\n\n${markdown}`,
      },
    ]);
    onToast("Added converted markdown to the LLM thread.");
  };

  convertAddToCase.current = onConvertAddToCase;
  convertAddToLlm.current = onConvertAddToLlm;

  useEffect(() => {
    onCaseText(state);
  }, [state, onCaseText]);

  const onTicketDragEnter = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDropOn(true);
  };

  const onTicketDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onTicketDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDropOn(false);
    }
  };

  const onTicketDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDropOn(false);
    const files = e.dataTransfer.files;
    if (files?.length) void onTicketFiles(files);
  };

  const onLoadWeather = async () => {
    setBusy("weather");
    try {
      const data = await fetchWeather(locationQuery);
      setState((s) => mergeWeatherIntoCase(s, data.text ?? ""));
      setWeatherLine(data.summary ?? data.place?.label ?? "");
      onToast(`Loaded weather for ${data.place?.label ?? "this place"}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Weather failed");
    } finally {
      setBusy(null);
    }
  };

  const displayTicketHeight = useCallback((desired: number) => {
    const el = workshopRef.current;
    const col = el ? workshopColumnHeight(el) : 0;
    const next = col > 0 ? clampTicketHeight(desired, col) : Math.round(desired);
    setTicketHeight(next);
    return next;
  }, []);

  useEffect(() => {
    const el = workshopRef.current;
    if (!el) return;
    const sync = () => {
      displayTicketHeight(desiredTicketHeightRef.current);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, [displayTicketHeight]);

  const commitTicketHeight = useCallback(
    (px: number, persist: boolean) => {
      const raw = Math.round(Math.min(2000, Math.max(80, px)));
      desiredTicketHeightRef.current = raw;
      displayTicketHeight(raw);
      if (persist) saveTicketHeight(raw);
    },
    [displayTicketHeight],
  );

  const onTicketSplitPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus({ preventScroll: true });
      const startY = e.clientY;
      const startH = ticketHeightRef.current;
      setTicketSplitDrag(true);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      const move = (ev: PointerEvent) => {
        commitTicketHeight(startH + (ev.clientY - startY), false);
      };
      const up = () => {
        setTicketSplitDrag(false);
        saveTicketHeight(desiredTicketHeightRef.current);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [commitTicketHeight],
  );

  const onTicketSplitKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ]);
      if (!keys.has(e.key)) return;
      e.preventDefault();
      const el = workshopRef.current;
      const col = el ? workshopColumnHeight(el) : 0;
      const { min, max } =
        col > 0
          ? ticketHeightBounds(col)
          : { min: TICKET_HEIGHT_MIN, max: 2000 };
      const step = e.shiftKey ? TICKET_NUDGE_SHIFT_PX : TICKET_NUDGE_PX;
      let next = ticketHeightRef.current;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") next -= step;
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") next += step;
      else if (e.key === "Home") next = min;
      else next = max;
      commitTicketHeight(next, true);
    },
    [commitTicketHeight],
  );

  const ticketBounds = (() => {
    const el = workshopRef.current;
    const col = el ? workshopColumnHeight(el) : 0;
    return col > 0
      ? ticketHeightBounds(col)
      : { min: TICKET_HEIGHT_MIN, max: 2000 };
  })();

  const onSplitPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rail = e.currentTarget.parentElement;
    if (!rail) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = rail.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(72, Math.max(28, x)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const feedNothing = !answers;
  const feedJevButton = (
    <button
      type="button"
      className="btn ghost"
      data-tutorial="feed-jev"
      disabled={feedNothing || locked}
      title={feedNothing ? "Ask Jev first — nothing to feed." : undefined}
      onClick={feedJev}
    >
      Feed Jev to LLM
    </button>
  );

  const llmJevBoard = (
    <>
      <article className="pane llm" data-tutorial="llm" style={{ flex: `${split} 1 0` }}>
        <header className="pane-head">
          <div>
            <h2 className="pane-title">LLM</h2>
            <code>{health?.llmModel ?? "deepseek/deepseek-v4-flash"}</code>
          </div>
          <div className="row-actions" data-tutorial="wire">
            <div className="llm-mill-slot">
              {busy === "llm" || busy === "propose" ? (
                <ThinkingMill
                  label={
                    agentRun
                      ? `Turn ${agentRun.current} of ${agentRun.total}`
                      : busy === "propose"
                        ? "Proposing"
                        : "Thinking"
                  }
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked}
                    onClick={() => void runRandomState()}
                  >
                    Random state
                  </button>
                  <AgenticLoopMenu
                    disabled={locked}
                    needMill={
                      !millReadyForAgenticLoop(
                        state,
                        Object.keys(questionsForJev(questions)).length,
                      )
                    }
                    onNeedMill={() => onToast(AGENTIC_LOOP_NEED_MILL)}
                    onConfirm={(n) => void runAgenticLoop(n)}
                  />
                </>
              )}
            </div>
            <button
              type="button"
              className="btn ghost"
              disabled={locked}
              onClick={() => void sendLlm("propose-questions")}
            >
              {busy === "propose" ? "Proposing…" : "Propose Jev questions"}
            </button>
            <FlipTip text="Always recording. Keys never appear here.">
              <button
                type="button"
                className={inspectorOpen ? "btn ghost on" : "btn ghost"}
                aria-pressed={inspectorOpen}
                aria-controls="dev-inspector"
                onClick={() => onInspectorOpenChange(!inspectorOpen)}
              >
                Inspector
              </button>
            </FlipTip>
          </div>
        </header>
        <div
          className="thread"
          ref={threadRef}
          aria-busy={busy === "llm" || busy === "propose"}
        >
          {messages.length === 0 ? (
            <p className="empty">
              Draft the state, or ask how to phrase a Jev question.
            </p>
          ) : (
            messages.map((m, i) => {
              const streaming =
                Boolean(busy === "llm" || busy === "propose") &&
                i === messages.length - 1 &&
                m.role === "assistant";
              if (m.role === "assistant") {
                return (
                  <LlmBubble
                    key={`${m.role}-${i}`}
                    message={m}
                    streaming={streaming}
                  />
                );
              }
              return (
                <div key={`${m.role}-${i}`} className="bubble user">
                  <span className="who">You</span>
                  <pre>{m.content}</pre>
                </div>
              );
            })
          )}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void sendLlm("chat");
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Talk to the LLM"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendLlm("chat");
              }
            }}
          />
          <button className="btn solid" type="submit" disabled={locked || !draft.trim()}>
            {busy === "llm" ? "Thinking…" : "Send"}
          </button>
        </form>
      </article>

      <div
        className="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        onPointerDown={onSplitPointer}
      />

      <article className="pane jev" data-tutorial="jev" style={{ flex: `${100 - split} 1 0` }}>
        <header className="pane-head">
          <div>
            <h2 className="pane-title">Jev’s Questions</h2>
            <code>{health?.jevModel ?? "typesafe/jev-1.13"}</code>
          </div>
          <div className="row-actions">
            {feedNothing ? (
              <FlipTip text="Ask Jev first — nothing to feed.">{feedJevButton}</FlipTip>
            ) : (
              feedJevButton
            )}
            <button
              type="button"
              className="btn solid"
              data-tutorial="ask-jev"
              disabled={locked}
              onClick={() => void onAskJev()}
            >
              {busy === "jev" ? "Asking…" : "Ask Jev"}
            </button>
          </div>
        </header>
        {blankIdError ? (
          <p className="inline-error" role="alert">
            {BLANK_QUESTION_ID_ERROR}
          </p>
        ) : null}
        <div className="jev-scroll">
          <QuestionEditor
            questions={questions}
            showBlankIdError={blankIdError}
            onChange={(next) => {
              setQuestions(withPositionalChoiceKeys(next));
              if (!blankQuestionKeys(next).length) setBlankIdError(false);
            }}
          />
          <div className="answers">
            {!answers ? (
              <p className="empty">Define questions, then ask Jev.</p>
            ) : (
              Object.entries(answers).map(([id, a]) => (
                <AnswerCard
                  key={id}
                  id={id}
                  answer={a}
                  question={questions[id]}
                />
              ))
            )}
            {jevMeta ? <p className="meta">{jevMeta}</p> : null}
          </div>
        </div>
      </article>
    </>
  );

  return (
    <main className="workshop" ref={workshopRef}>
      <HistoryPanel
        open={historyOpen}
        onClose={() => onHistoryOpenChange(false)}
        store={store}
        onNew={onNewCase}
        onClear={onClearCurrent}
        onSelect={onSelectChat}
        onRename={onRenameChat}
        onDelete={onDeleteChat}
      />
      <section
        id="workshop-ticket"
        className={dropOn ? "ticket drop-on" : "ticket"}
        data-tutorial="case"
        style={{ height: ticketHeight, flexBasis: ticketHeight, flexShrink: 0, flexGrow: 0 }}
        onDragEnter={onTicketDragEnter}
        onDragOver={onTicketDragOver}
        onDragLeave={onTicketDragLeave}
        onDrop={onTicketDrop}
      >
        <div className="ticket-head">
          <h2 className="pane-title">Jev’s State</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={includeChat}
              onChange={(e) => setIncludeChat(e.target.checked)}
            />
            Include LLM chat in Jev state
          </label>
        </div>
        <div className="case-tools" role="group" aria-label="State session">
          <FlipTip text="Starts a blank workshop — not a preset. Saves the open thread if it is worth keeping.">
            <button
              type="button"
              className="sample-chip"
              data-tutorial="new-case"
              disabled={busy !== null}
              onClick={onNewCase}
            >
              New State
            </button>
          </FlipTip>
          <PresetCasesMenu
            currentId={samplePresetId}
            disabled={busy !== null}
            onPick={(id) => {
              onHistoryOpenChange(false);
              onOpenSample(id);
            }}
          />
          <FlipTip text="This browser only — local threads.">
            <button
              type="button"
              className={historyOpen ? "sample-chip on" : "sample-chip"}
              data-tutorial="history"
              aria-expanded={historyOpen}
              aria-controls="workshop-history"
              onClick={() => onHistoryOpenChange(!historyOpen)}
            >
              History
            </button>
          </FlipTip>
        </div>
        {isWeatherSample(samplePresetId) ? (
          <div className="weather-row" data-tutorial="weather">
            <input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="City or lat, lon"
              aria-label="Weather location"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onLoadWeather();
                }
              }}
            />
            <button
              type="button"
              className="btn solid"
              disabled={busy !== null}
              onClick={() => void onLoadWeather()}
            >
              {busy === "weather" ? "Loading…" : "Load weather"}
            </button>
          </div>
        ) : null}
        {isWeatherSample(samplePresetId) && weatherLine ? (
          <p className="weather-status">{weatherLine}</p>
        ) : null}
        <textarea
          className="case"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="What Jev should judge"
          rows={8}
        />
        <AttachBar
          names={attachedNames}
          error={attachError}
          onPickMarkdown={onPickMarkdown}
          onRemove={onRemoveAttach}
        />
        <p className="hint">
          {isWeatherSample(samplePresetId)
            ? "Jev judges this. The LLM can draft it. Drop .md into Jev’s State. txt / html / docx / pdf go to Convert. Weather is Open-Meteo input, not a model."
            : "Jev judges this. The LLM can draft it. Drop .md into Jev’s State. txt / html / docx / pdf go to Convert."}
        </p>
      </section>

      <div
        className={ticketSplitDrag ? "splitter ticket-split is-drag" : "splitter ticket-split"}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize Jev’s State"
        aria-controls="workshop-ticket"
        aria-valuemin={ticketBounds.min}
        aria-valuemax={ticketBounds.max}
        aria-valuenow={ticketHeight}
        aria-valuetext={`${ticketHeight} pixels`}
        tabIndex={0}
        onPointerDown={onTicketSplitPointer}
        onKeyDown={onTicketSplitKeyDown}
      />

      <section className="board">{llmJevBoard}</section>
    </main>
  );
}

function transferUid(
  map: Map<string, string>,
  oldKey: string,
  newKey: string,
  mint: (storageKey: string) => string,
) {
  const uid = map.get(oldKey) ?? mint(oldKey);
  if (oldKey !== newKey) map.delete(oldKey);
  map.set(newKey, uid);
  return uid;
}

function QuestionCard({
  storageKey,
  q,
  showBlankIdError,
  autoFocusId,
  onRenameId,
  onChangeQ,
  onRemove,
}: {
  storageKey: string;
  q: JevQuestion;
  showBlankIdError: boolean;
  autoFocusId?: boolean;
  onRenameId: (nextId: string) => void;
  onChangeQ: (next: JevQuestion) => void;
  onRemove: () => void;
}) {
  const optionUids = useRef<string[]>([]);
  const idInputRef = useRef<HTMLInputElement>(null);
  const optionInputRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusOptionUid, setFocusOptionUid] = useState<string | null>(null);

  const optionUidAt = (index: number) => {
    while (optionUids.current.length <= index) {
      optionUids.current.push(nextStableUid());
    }
    return optionUids.current[index];
  };

  useEffect(() => {
    if (!autoFocusId) return;
    const frame = requestAnimationFrame(() => {
      idInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocusId]);

  useEffect(() => {
    if (!focusOptionUid) return;
    const uid = focusOptionUid;
    const frame = requestAnimationFrame(() => {
      optionInputRefs.current.get(uid)?.focus();
      setFocusOptionUid(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusOptionUid]);

  return (
    <div className="q-card">
      <div className="q-row">
        <input
          ref={idInputRef}
          className={
            showBlankIdError && isBlankQuestionId(storageKey)
              ? "id-input invalid"
              : "id-input"
          }
          value={questionIdValue(storageKey)}
          onChange={(e) => onRenameId(spacesToSnake(e.target.value))}
          placeholder="question id"
          aria-label="Question id"
          aria-invalid={showBlankIdError && isBlankQuestionId(storageKey)}
        />
        <select
          value={q.type}
          onChange={(e) => {
            optionUids.current = [];
            onChangeQ(emptyQuestion(e.target.value as QuestionType));
          }}
          aria-label="Question type"
        >
          <option value="choice">choice</option>
          <option value="noul">noul</option>
          <option value="score">score</option>
        </select>
        <button type="button" className="btn tiny" onClick={onRemove}>
          Remove
        </button>
      </div>
      {showBlankIdError && isBlankQuestionId(storageKey) ? (
        <p className="inline-error" role="alert">
          {BLANK_QUESTION_ID_ERROR}
        </p>
      ) : null}
      <textarea
        value={q.instructions}
        onChange={(e) => onChangeQ({ ...q, instructions: e.target.value })}
        placeholder="Instructions (the full question)"
        rows={2}
      />
      {q.type === "choice" ? (
        <div className="criteria">
          {Object.entries(q.criteria).map(([k, v], i) => {
            const n = i + 1;
            const uid = optionUidAt(i);
            return (
              <div className="crit-row choice-opt" key={uid}>
                <span className="opt-num" aria-hidden="true">
                  {n}
                </span>
                <input
                  ref={(el) => {
                    if (el) optionInputRefs.current.set(uid, el);
                    else optionInputRefs.current.delete(uid);
                  }}
                  value={v}
                  onChange={(e) =>
                    onChangeQ({
                      ...q,
                      criteria: {
                        ...q.criteria,
                        [k]: spacesToSnake(e.target.value),
                      },
                    })
                  }
                  placeholder="Option description"
                  aria-label={`Option ${n} description`}
                />
                <button
                  type="button"
                  className="btn tiny"
                  aria-label={`Remove option ${n}`}
                  onClick={() => {
                    optionUids.current.splice(i, 1);
                    onChangeQ({
                      ...q,
                      criteria: removeChoiceOption(q.criteria, k),
                    });
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="btn tiny"
            onClick={() => {
              const uid = nextStableUid();
              optionUids.current.push(uid);
              setFocusOptionUid(uid);
              onChangeQ({
                ...q,
                criteria: addChoiceOption(q.criteria),
              });
            }}
          >
            Add option
          </button>
        </div>
      ) : null}
      {q.type === "score" ? (
        <div className="criteria">
          {q.criteria.map((level, i) => (
            <div className="crit-row" key={i}>
              <span className="lvl">{i}</span>
              <input
                value={level}
                onChange={(e) => {
                  const criteria = [...q.criteria];
                  criteria[i] = e.target.value;
                  onChangeQ({ ...q, criteria });
                }}
                aria-label={`Score level ${i}`}
              />
              <button
                type="button"
                className="btn tiny"
                onClick={() =>
                  onChangeQ({
                    ...q,
                    criteria: q.criteria.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn tiny"
            onClick={() => onChangeQ({ ...q, criteria: [...q.criteria, ""] })}
          >
            Add level
          </button>
        </div>
      ) : null}
      {q.type === "noul" ? (
        <div className="criteria">
          <div className="crit-row">
            <span className="lvl">true</span>
            <input
              value={q.criteria?.true ?? ""}
              onChange={(e) =>
                onChangeQ({
                  ...q,
                  criteria: { ...q.criteria, true: e.target.value },
                })
              }
              placeholder="What yes means"
            />
          </div>
          <div className="crit-row">
            <span className="lvl">false</span>
            <input
              value={q.criteria?.false ?? ""}
              onChange={(e) =>
                onChangeQ({
                  ...q,
                  criteria: { ...q.criteria, false: e.target.value },
                })
              }
              placeholder="What no means"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionEditor({
  questions,
  onChange,
  showBlankIdError,
}: {
  questions: Record<string, JevQuestion>;
  onChange: (next: Record<string, JevQuestion>) => void;
  showBlankIdError: boolean;
}) {
  const entries = useMemo(() => Object.entries(questions), [questions]);
  const cardUids = useRef(new Map<string, string>());
  const [focusNewQuestionKey, setFocusNewQuestionKey] = useState<string | null>(
    null,
  );

  const cardUid = (storageKey: string) => {
    const existing = cardUids.current.get(storageKey);
    if (existing) return existing;
    const uid = isBlankQuestionId(storageKey) ? storageKey : nextStableUid();
    cardUids.current.set(storageKey, uid);
    return uid;
  };

  const setId = (oldKey: string, nextId: string) => {
    const trimmed = nextId.trim();
    const blankSuffix = oldKey.startsWith(BLANK_QUESTION_KEY_PREFIX)
      ? oldKey.slice(BLANK_QUESTION_KEY_PREFIX.length)
      : nextStableUid();
    const newKey = trimmed || `${BLANK_QUESTION_KEY_PREFIX}${blankSuffix}`;
    if (newKey === oldKey) return;
    transferUid(cardUids.current, oldKey, newKey, cardUid);
    onChange(renameRecordKey(questions, oldKey, newKey));
  };

  const setQ = (id: string, q: JevQuestion) => onChange({ ...questions, [id]: q });

  const remove = (id: string) => {
    const next = { ...questions };
    delete next[id];
    cardUids.current.delete(id);
    onChange(next);
  };

  return (
    <div className="q-list">
      {entries.map(([id, q]) => (
        <QuestionCard
          key={cardUid(id)}
          storageKey={id}
          q={q}
          showBlankIdError={showBlankIdError}
          autoFocusId={id === focusNewQuestionKey}
          onRenameId={(nextId) => setId(id, nextId)}
          onChangeQ={(next) => setQ(id, next)}
          onRemove={() => remove(id)}
        />
      ))}
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          const key = nextBlankQuestionKey();
          setFocusNewQuestionKey(key);
          onChange({
            ...questions,
            [key]: emptyQuestion("noul"),
          });
        }}
      >
        Add question
      </button>
    </div>
  );
}

function AnswerCard({
  id,
  answer,
  question,
}: {
  id: string;
  answer: JevAnswer;
  question?: JevQuestion;
}) {
  if (answer.type === "noul") {
    const p = Number(answer.noul);
    return (
      <div className="answer">
        <header>
          <code>{id}</code>
          <span className="stamp">noul {pct(p)}</span>
        </header>
        <div className="bar">
          <span style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }} />
        </div>
        <p className="meta">P(true), not a separate confidence.</p>
      </div>
    );
  }
  const probs = answer.probabilities ?? {};
  const legend =
    answer.type === "score"
      ? answer.legend
      : answer.legend ??
        (question?.type === "choice" ? question.criteria : undefined);
  return (
    <div className="answer">
      <header>
        <code>{id}</code>
        <span className="stamp">
          {answer.type === "choice"
            ? `choice ${answer.choice}`
            : `score ${answer.score}`}
          {answer.confidence != null ? ` · conf ${pct(answer.confidence)}` : ""}
        </span>
      </header>
      <ul className="probs">
        {Object.entries(probs).map(([k, v]) => (
          <li key={k}>
            <span>{probabilityBarLabel(k, legend)}</span>
            <div className="bar">
              <span style={{ width: `${Math.min(100, Math.max(0, Number(v) * 100))}%` }} />
            </div>
            <em>{pct(Number(v))}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
