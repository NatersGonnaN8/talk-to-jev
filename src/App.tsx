import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  askJev,
  fetchWeather,
  getHealth,
  listDocs,
  readDoc,
  streamLlm,
  updateDocs,
} from "./api";
import type {
  ChatMessage,
  Health,
  JevAnswer,
  JevQuestion,
  QuestionType,
} from "./types";
import { toNiceHtml } from "./markdown";
import { DEFAULT_QUESTIONS, DEFAULT_STATE } from "./types";
import { SAMPLE_CASES, cloneSample, type SampleId } from "./samples";
import { DEFAULT_LOCATION_QUERY, mergeWeatherIntoCase } from "./weather";
import { UseCasesPage } from "./UseCases";
import { SettingsPage } from "./pages/Settings";
import { HistoryPanel } from "./HistoryPanel";
import { TutorialOverlay } from "./TutorialOverlay";
import { isTutorialDone, TUTORIAL_UI, type TutorialPage } from "./tutorial";
import {
  activeThread,
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

type Page = "workshop" | "docs" | "use-cases" | "settings";

function pageFromPath(): Page {
  const p = window.location.pathname;
  if (p.startsWith("/docs")) return "docs";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/use-cases") || p.startsWith("/cases")) return "use-cases";
  return "workshop";
}

function caseFromSearch(): string | null {
  const id = new URLSearchParams(window.location.search).get("case");
  return id?.trim() || null;
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}`;
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function parseProposedQuestions(text: string): Record<string, JevQuestion> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const map =
      parsed &&
      typeof parsed === "object" &&
      parsed !== null &&
      "questions" in parsed
        ? (parsed as { questions: unknown }).questions
        : parsed;
    if (!map || typeof map !== "object") return null;
    const out: Record<string, JevQuestion> = {};
    for (const [id, q] of Object.entries(map as Record<string, unknown>)) {
      if (!q || typeof q !== "object") continue;
      const rec = q as Record<string, unknown>;
      const type = rec.type;
      const instructions = String(rec.instructions ?? "");
      if (type === "choice" && rec.criteria && typeof rec.criteria === "object") {
        out[id] = {
          type: "choice",
          instructions,
          criteria: Object.fromEntries(
            Object.entries(rec.criteria as Record<string, unknown>).map(([k, v]) => [
              k,
              v == null ? "" : String(v),
            ]),
          ),
        };
      } else if (type === "score" && Array.isArray(rec.criteria)) {
        out[id] = {
          type: "score",
          instructions,
          criteria: rec.criteria.map((v) => String(v)),
        };
      } else if (type === "noul") {
        const c = rec.criteria;
        out[id] = {
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
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
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

function emptyQuestion(type: QuestionType): JevQuestion {
  if (type === "choice") {
    return {
      type: "choice",
      instructions: "",
      criteria: { option_a: "", option_b: "" },
    };
  }
  if (type === "score") {
    return { type: "score", instructions: "", criteria: ["Low", "Medium", "High"] };
  }
  return {
    type: "noul",
    instructions: "",
    criteria: { true: "", false: "" },
  };
}

/** Chrome key-status pill — shortcut to Settings, never a second “Settings” label. */
function chromeKeyPill(health: Health | null, failed: boolean) {
  if (failed) {
    return {
      className: "pill error",
      label: "Key check failed",
      title: "Could not check OpenRouter key — open Settings",
    };
  }
  if (health == null) {
    return {
      className: "pill",
      label: "Checking key…",
      title: "Checking OpenRouter key — open Settings",
    };
  }
  if (health.hasKey) {
    return {
      className: "pill ready",
      label: "Key ready",
      title: "OpenRouter key is on the server — open Settings",
    };
  }
  return {
    className: "pill missing",
    label: "Need OpenRouter key",
    title: "Need OpenRouter key — paste in Settings",
  };
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromPath);
  const [caseId, setCaseId] = useState<string | null>(caseFromSearch);
  const [presetNonce, setPresetNonce] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [toast, setToast] = useState("");
  const [updating, setUpdating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !isTutorialDone());
  const [tourKey, setTourKey] = useState(0);

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
        setHealthError(false);
      })
      .catch(() => {
        setHealth(null);
        setHealthError(true);
      });
  }, []);

  const go = (next: Page, sampleId?: SampleId) => {
    if (next === "docs") {
      window.history.pushState({}, "", "/docs");
      setCaseId(null);
    } else if (next === "use-cases") {
      window.history.pushState({}, "", "/use-cases");
      setCaseId(null);
    } else if (next === "settings") {
      window.history.pushState({}, "", "/settings");
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
      try {
        setHealth(await getHealth());
        setHealthError(false);
      } catch {
        setHealthError(true);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const keyPill = chromeKeyPill(health, healthError);

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
            Use Cases
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
          {page === "workshop" ? (
            <button
              className={historyOpen ? "btn ghost on" : "btn ghost"}
              type="button"
              data-tutorial="history"
              aria-expanded={historyOpen}
              aria-controls="workshop-history"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              History
            </button>
          ) : null}
          <button
            type="button"
            className={keyPill.className}
            title={keyPill.title}
            aria-label={keyPill.title}
            onClick={() => go("settings")}
          >
            {keyPill.label}
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
      {page === "docs" ? <DocsPage /> : null}
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
              setHealthError(false);
            } catch {
              setHealthError(true);
            }
          }}
        />
      ) : null}
      <div hidden={page !== "workshop"}>
        <Workshop
          health={health}
          onToast={setToast}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
          presetId={caseId}
          presetNonce={presetNonce}
          onOpenSample={(id: SampleId) => go("workshop", id)}
          onBlankWorkshop={() => go("workshop")}
        />
      </div>
      <TutorialOverlay
        key={tourKey}
        open={tourOpen}
        onDismiss={() => setTourOpen(false)}
        onGo={goTour}
      />
    </div>
  );
}

function Workshop({
  health,
  onToast,
  historyOpen,
  onHistoryOpenChange,
  presetId,
  presetNonce,
  onOpenSample,
  onBlankWorkshop,
}: {
  health: Health | null;
  onToast: (s: string) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  presetId: string | null;
  presetNonce: number;
  onOpenSample: (id: SampleId) => void;
  onBlankWorkshop: () => void;
}) {
  const [store, setStore] = useState<ChatStore>(() => loadStore());
  const boot = activeThread(store);
  const [state, setState] = useState(() => boot?.state ?? DEFAULT_STATE);
  const [includeChat, setIncludeChat] = useState(() => boot?.includeChat ?? true);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => boot?.messages ?? [],
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"llm" | "jev" | "propose" | "weather" | null>(
    null,
  );
  const [split, setSplit] = useState(50);
  const [questions, setQuestions] = useState<Record<string, JevQuestion>>(
    () => boot?.questions ?? DEFAULT_QUESTIONS,
  );
  const [answers, setAnswers] = useState<Record<string, JevAnswer> | null>(
    () => boot?.answers ?? null,
  );
  const [jevMeta, setJevMeta] = useState(() => boot?.jevMeta ?? "");
  const [samplePresetId, setSamplePresetId] = useState<string | null>(
    () => boot?.samplePresetId ?? null,
  );
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCATION_QUERY);
  const [weatherLine, setWeatherLine] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<WorkshopSnapshot>(emptySnapshot());
  const storeRef = useRef(store);
  storeRef.current = store;

  const skipMatchingBoot = useRef(
    Boolean(presetId && boot?.samplePresetId === presetId),
  );

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

  const applySnapshot = (snap: WorkshopSnapshot) => {
    setState(snap.state);
    setIncludeChat(snap.includeChat);
    setMessages(snap.messages);
    setQuestions(snap.questions);
    setAnswers(snap.answers);
    setJevMeta(snap.jevMeta);
    setSamplePresetId(snap.samplePresetId);
    setDraft("");
    setWeatherLine("");
    setLocationQuery(DEFAULT_LOCATION_QUERY);
  };

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStore((s) => upsertActive(s, snapRef.current));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [messages, state, includeChat, questions, answers, jevMeta, samplePresetId]);

  useEffect(() => {
    const flush = () => {
      persistStore(upsertActive(storeRef.current, snapRef.current));
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    if (!presetId) return;
    if (skipMatchingBoot.current) {
      skipMatchingBoot.current = false;
      return;
    }
    const preset = cloneSample(presetId);
    if (!preset) return;
    setStore(startNewChat(storeRef.current, snapRef.current));
    setSamplePresetId(preset.id);
    setState(preset.state);
    setQuestions(preset.questions);
    setAnswers(null);
    setJevMeta("");
    setMessages([]);
    setDraft("");
    setWeatherLine("");
    onToast(
      `Loaded “${preset.label}”. Click Load weather for live Open-Meteo.`,
    );
  }, [presetId, presetNonce, onToast]);

  const onNewChat = () => {
    setStore(startNewChat(storeRef.current, snapRef.current));
    applySnapshot(emptySnapshot());
    onBlankWorkshop();
    onHistoryOpenChange(false);
  };

  const onClearCurrent = () => {
    setMessages([]);
    setAnswers(null);
    setJevMeta("");
    setDraft("");
  };

  const onSelectChat = (id: string) => {
    const chat = storeRef.current.chats.find((c) => c.id === id);
    if (!chat) return;
    persistStore(upsertActive(storeRef.current, snapRef.current));
    const next = selectChat(loadStore(), id);
    setStore(next);
    applySnapshot(chat);
    onHistoryOpenChange(false);
  };

  const onRenameChat = (id: string, title: string) => {
    setStore(renameChat(storeRef.current, id, title));
  };

  const onDeleteChat = (id: string) => {
    const wasActive = storeRef.current.activeId === id;
    const next = deleteChat(storeRef.current, id);
    setStore(next);
    if (wasActive) applySnapshot(emptySnapshot());
  };

  const locked = health?.hasKey === false || busy !== null;

  const sendLlm = async (mode: "chat" | "propose-questions", extra?: string) => {
    const content = extra ?? draft.trim();
    if (mode === "chat" && !content) return;
    const nextUser: ChatMessage =
      mode === "propose-questions"
        ? {
            role: "user",
            content:
              "Propose atomic Jev questions for this case. Return JSON only.",
          }
        : { role: "user", content };
    const history = [...messages, nextUser];
    setMessages([...history, { role: "assistant", content: "" }]);
    if (!extra) setDraft("");
    setBusy(mode === "propose-questions" ? "propose" : "llm");
    try {
      const full = await streamLlm(
        {
          messages: history,
          state,
          jevAnswers: answers ?? undefined,
          mode,
        },
        (text) => {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: text };
            return copy;
          });
        },
      );
      if (mode === "propose-questions") {
        const parsed = parseProposedQuestions(full);
        if (parsed) {
          setQuestions(parsed);
          onToast(`Loaded ${Object.keys(parsed).length} proposed questions into Jev.`);
        } else {
          onToast("LLM replied, but it was not valid questions JSON.");
        }
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "LLM failed");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(null);
    }
  };

  const onAskJev = async () => {
    setBusy("jev");
    try {
      const payload = await askJev({
        state,
        questions,
        includeTranscript: includeChat,
        transcript: includeChat ? messages : [],
      });
      setAnswers((payload.answers ?? {}) as Record<string, JevAnswer>);
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
    if (!answers) return;
    const note = summarizeAnswers(answers);
    setMessages((m) => [
      ...m,
      { role: "user", content: note },
      {
        role: "assistant",
        content: "Got Jev’s typed answers. Ask me what to do with the probabilities.",
      },
    ]);
    onToast("Fed Jev’s answers into the LLM thread.");
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

  return (
    <main className="workshop">
      <HistoryPanel
        open={historyOpen}
        onClose={() => onHistoryOpenChange(false)}
        store={store}
        onNew={onNewChat}
        onClear={onClearCurrent}
        onSelect={onSelectChat}
        onRename={onRenameChat}
        onDelete={onDeleteChat}
      />
      <section className="ticket" data-tutorial="case">
        <div className="ticket-head">
          <span className="eyebrow">Case</span>
          <label className="check">
            <input
              type="checkbox"
              checked={includeChat}
              onChange={(e) => setIncludeChat(e.target.checked)}
            />
            Include LLM chat in Jev state
          </label>
        </div>
        <div className="samples" role="list" aria-label="Sample cases">
          {SAMPLE_CASES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={samplePresetId === s.id ? "sample-chip on" : "sample-chip"}
              disabled={busy !== null}
              onClick={() => onOpenSample(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
        {weatherLine ? <p className="weather-status">{weatherLine}</p> : null}
        <textarea
          className="case"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="What Jev should judge"
          rows={8}
        />
        <p className="hint">
          Jev judges this. The LLM can draft it. Weather is Open-Meteo input, not a
          model.
        </p>
      </section>

      <section className="board">
        <article className="pane llm" data-tutorial="llm" style={{ flex: `${split} 1 0` }}>
          <header className="pane-head">
            <div>
              <span className="eyebrow">LLM</span>
              <code>{health?.llmModel ?? "deepseek/deepseek-v4-flash"}</code>
            </div>
            <div className="row-actions" data-tutorial="wire">
              <button
                type="button"
                className="btn ghost"
                disabled={locked}
                onClick={() => void sendLlm("propose-questions")}
              >
                {busy === "propose" ? "Proposing…" : "Propose Jev questions"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!answers || busy !== null}
                onClick={feedJev}
              >
                Feed Jev to LLM
              </button>
            </div>
          </header>
          <div className="thread" ref={threadRef}>
            {messages.length === 0 ? (
              <p className="empty">
                Draft the case, or ask how to phrase a Jev question.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={`${m.role}-${i}`} className={`bubble ${m.role}`}>
                  <span className="who">{m.role === "user" ? "You" : "LLM"}</span>
                  <pre>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</pre>
                </div>
              ))
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
              {busy === "llm" ? "Sending…" : "Send"}
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
              <span className="eyebrow">Jev</span>
              <code>{health?.jevModel ?? "typesafe/jev-1.13"}</code>
            </div>
            <button
              type="button"
              className="btn solid"
              data-tutorial="ask-jev"
              disabled={locked}
              onClick={() => void onAskJev()}
            >
              {busy === "jev" ? "Asking…" : "Ask Jev"}
            </button>
          </header>
          <QuestionEditor questions={questions} onChange={setQuestions} />
          <div className="answers">
            {!answers ? (
              <p className="empty">Define questions, then ask Jev.</p>
            ) : (
              Object.entries(answers).map(([id, a]) => (
                <AnswerCard key={id} id={id} answer={a} />
              ))
            )}
            {jevMeta ? <p className="meta">{jevMeta}</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}

function QuestionEditor({
  questions,
  onChange,
}: {
  questions: Record<string, JevQuestion>;
  onChange: (next: Record<string, JevQuestion>) => void;
}) {
  const entries = useMemo(() => Object.entries(questions), [questions]);

  const setId = (oldId: string, nextId: string) => {
    const id = nextId.trim() || oldId;
    if (id === oldId) return;
    const next: Record<string, JevQuestion> = {};
    for (const [k, v] of entries) next[k === oldId ? id : k] = v;
    onChange(next);
  };

  const setQ = (id: string, q: JevQuestion) => onChange({ ...questions, [id]: q });

  const remove = (id: string) => {
    const next = { ...questions };
    delete next[id];
    onChange(next);
  };

  return (
    <div className="q-list">
      {entries.map(([id, q]) => (
        <div className="q-card" key={id}>
          <div className="q-row">
            <input
              className="id-input"
              value={id}
              onChange={(e) => setId(id, e.target.value)}
              aria-label="Question id"
            />
            <select
              value={q.type}
              onChange={(e) =>
                setQ(id, emptyQuestion(e.target.value as QuestionType))
              }
              aria-label="Question type"
            >
              <option value="choice">choice</option>
              <option value="noul">noul</option>
              <option value="score">score</option>
            </select>
            <button type="button" className="btn tiny" onClick={() => remove(id)}>
              Remove
            </button>
          </div>
          <textarea
            value={q.instructions}
            onChange={(e) => setQ(id, { ...q, instructions: e.target.value })}
            placeholder="Instructions (the full question)"
            rows={2}
          />
          {q.type === "choice" ? (
            <div className="criteria">
              {Object.entries(q.criteria).map(([k, v]) => (
                <div className="crit-row" key={k}>
                  <input
                    value={k}
                    onChange={(e) => {
                      const criteria = { ...q.criteria };
                      delete criteria[k];
                      criteria[e.target.value || k] = v;
                      setQ(id, { ...q, criteria });
                    }}
                    aria-label="Option key"
                  />
                  <input
                    value={v}
                    onChange={(e) =>
                      setQ(id, {
                        ...q,
                        criteria: { ...q.criteria, [k]: e.target.value },
                      })
                    }
                    aria-label="Option description"
                  />
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() => {
                      const criteria = { ...q.criteria };
                      delete criteria[k];
                      setQ(id, { ...q, criteria });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn tiny"
                onClick={() =>
                  setQ(id, {
                    ...q,
                    criteria: { ...q.criteria, [newId("opt")]: "" },
                  })
                }
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
                      setQ(id, { ...q, criteria });
                    }}
                    aria-label={`Score level ${i}`}
                  />
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() =>
                      setQ(id, {
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
                onClick={() => setQ(id, { ...q, criteria: [...q.criteria, ""] })}
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
                    setQ(id, {
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
                    setQ(id, {
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
      ))}
      <button
        type="button"
        className="btn ghost"
        onClick={() =>
          onChange({
            ...questions,
            [newId("q")]: emptyQuestion("noul"),
          })
        }
      >
        Add question
      </button>
    </div>
  );
}

function AnswerCard({ id, answer }: { id: string; answer: JevAnswer }) {
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
            <span>
              {answer.type === "score" && answer.legend
                ? `${k} ${answer.legend[k] ?? ""}`
                : k}
            </span>
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

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.2 12s3.6-6.2 9.8-6.2S21.8 12 21.8 12 18.2 18.2 12 18.2 2.2 12 2.2 12Z"
      />
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="9 18 3 12 9 6"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="15 6 21 12 15 18"
      />
    </svg>
  );
}

function DocsPage() {
  const [files, setFiles] = useState<
    Array<{ path: string; title: string; source: string; fetchedAt: string }>
  >([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [text, setText] = useState("");
  const [view, setView] = useState<"nice" | "code">("nice");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await listDocs();
      setFiles(data.files);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not list docs");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = files.filter((f) => {
    const hay = `${f.path} ${f.title} ${f.source}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const niceHtml = useMemo(() => {
    if (!active || !text) return "";
    return toNiceHtml(text, active);
  }, [active, text]);

  const open = async (path: string) => {
    setActive(path);
    try {
      const doc = await readDoc(path);
      setText(doc.text);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open doc");
    }
  };

  return (
    <main className="docs">
      <aside className="doc-rail">
        <input
          className="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search snapshot"
        />
        {err ? <p className="empty">{err}</p> : null}
        {files.length === 0 ? (
          <p className="empty">
            Snapshot is empty. Use Update Jev docs or `npm run update-jev-docs`.
          </p>
        ) : (
          <ul>
            {shown.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  className={active === f.path ? "doc-link on" : "doc-link"}
                  onClick={() => void open(f.path)}
                >
                  <strong>{f.title}</strong>
                  <span>{f.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <article className="doc-view">
        {active && text ? (
          <div
            className="doc-overlay"
            data-tutorial="docs-view"
            role="group"
            aria-label="Markdown view"
          >
            <button
              type="button"
              className={view === "nice" ? "view-btn on" : "view-btn"}
              aria-pressed={view === "nice"}
              aria-label="Nice view"
              onClick={() => setView("nice")}
            >
              <IconEye />
              <span className="tip">Nice view</span>
            </button>
            <button
              type="button"
              className={view === "code" ? "view-btn on" : "view-btn"}
              aria-pressed={view === "code"}
              aria-label="Code view"
              onClick={() => setView("code")}
            >
              <IconCode />
              <span className="tip">Code view</span>
            </button>
          </div>
        ) : null}
        {!active ? (
          <p className="empty pick">Pick a page from the snapshot.</p>
        ) : view === "code" ? (
          <pre className="doc-code">{text}</pre>
        ) : (
          <div
            className="md-nice"
            dangerouslySetInnerHTML={{ __html: niceHtml }}
          />
        )}
      </article>
    </main>
  );
}
