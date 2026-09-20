/** First-run / Tour coach. Storage: `talk-to-jev:tutorial-done`. Never store keys.
 * Live copy SoT — overlay + chrome Tour button import this module.
 * Human-readable twin (keep 1:1): `docs/TOUR.md`.
 */

export const TUTORIAL_DONE_KEY = "talk-to-jev:tutorial-done";

export type TutorialPage =
  | "workshop"
  | "docs"
  | "use-cases"
  | "settings"
  | "convert";

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  page: TutorialPage;
  /** `data-tutorial` ids, first match wins */
  hooks?: string[];
  /** Extra CSS selectors */
  selectors?: string[];
  /** Exact button / nav labels */
  texts?: string[];
};

/** Overlay chrome + card controls. Keep in sync with `docs/TOUR.md`. */
export const TUTORIAL_UI = {
  chromeLabel: "Tour",
  chromeAria: "Start tour",
  kickerPrefix: "Tour",
  skip: "Skip",
  back: "Back",
  next: "Next",
  done: "Done",
} as const;

export function tutorialKicker(shown: number, total: number): string {
  return `${TUTORIAL_UI.kickerPrefix} · ${shown} / ${total}`;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Two AIs, one key",
    body: "Talk to Jev wires an LLM that chats to Jev which decides using a single OpenRouter key.",
    page: "workshop",
  },
  {
    id: "case",
    title: "Jev’s State",
    body: "This is Jev's state: the briefing from which Jev makes decisions. New State starts a blank workshop — not a preset. Preset States loads one of the ten prewritten example uses (states). Drop .md here; other text files can be dropped to convert them to markdown.",
    page: "workshop",
    hooks: ["case"],
    selectors: [".ticket"],
  },
  {
    id: "llm",
    title: "The LLM pane talks",
    body: "The LLM talks to Jev with four tools: read_jev_workshop (reads the current pane), set_jev_state (writes Jev's state), set_jev_questions (writes Jev's questions), ask_jev (asks Jev to answer the questions).",
    page: "workshop",
    hooks: ["llm"],
    selectors: [".pane.llm"],
  },
  {
    id: "random-state",
    title: "Random state",
    body: "This invents a short fake ticket so you can try the pane without writing one. It does not call Jev — Ask Jev still does that.",
    page: "workshop",
    hooks: ["random-state"],
    texts: ["Random state"],
  },
  {
    id: "agentic-loop",
    title: "Agentic loop",
    body: "A few LLM turns on this ticket — questions, then Jev, then talk from the numbers. You pick how many (1–10, default 3); empty pane disables it.",
    page: "workshop",
    hooks: ["agentic-loop"],
    texts: ["Agentic loop"],
  },
  {
    id: "propose-questions",
    title: "Propose Jev questions",
    body: "Have the LLM write typed questions for whatever is in Jev’s State right now.",
    page: "workshop",
    hooks: ["propose-questions"],
    texts: ["Propose Jev questions"],
  },
  {
    id: "inspector",
    title: "Inspector",
    body: "The raw To LLM / To Jev payloads. Keys never show up here — Close it if it covers Send.",
    page: "workshop",
    hooks: ["inspector"],
    texts: ["Inspector"],
  },
  {
    id: "jev",
    title: "Jev’s Questions",
    body: "Question types Jev answers: choice (rice or noodles?), noul (probability, 0-1), or score (How mad is the customer? 1: not mad, 2: mildly mad, 3: livid). Add questions, then Ask Jev. Send answers to LLM sits next to Ask Jev and sends typed answers to the LLM immediately for greater cooperation between multiple AI types.",
    page: "workshop",
    hooks: ["jev", "ask-jev", "feed-jev"],
    selectors: [".pane.jev"],
  },
  {
    id: "use-cases",
    title: "Example Uses",
    body: "Nine operator snaps plus Jacket — the same list as Workshop Preset States. Open a card to load the state and Jev questions.",
    page: "use-cases",
    hooks: ["use-cases", "use-cases-page"],
    texts: ["Example Uses"],
  },
  {
    id: "docs",
    title: "Docs: Nice, Code, Iframe",
    body: "Official Jev docs live in this repo. Update Jev docs is on this page (not the header). Open a page, then Nice view, Code view, or the boxed-i Iframe when the live page will actually embed. Iframe hides for primer and sites that block framing.",
    page: "docs",
    hooks: ["docs-view", "update-docs", "docs"],
    selectors: [".doc-overlay"],
    texts: ["Docs"],
  },
  {
    id: "settings",
    title: "Settings — bring your own key",
    body: "Paste your OpenRouter key here. It stays on the server — never in git, never in the browser. Optional later: OpenAI, Anthropic, Tavily, Brave. They are saved only until those features land.",
    page: "settings",
    hooks: ["settings-page", "settings"],
    texts: ["Settings"],
  },
  {
    id: "convert",
    title: "Convert to Markdown",
    body: "Chrome Convert opens this tab. Drop txt, html, docx, or pdf here — or onto Jev’s State, which brings you here. Files stay in the browser. Add the markdown to the LLM, to Jev’s State, or save it.",
    page: "convert",
    hooks: ["convert-page", "convert", "convert-nav"],
    texts: ["Convert"],
  },
  {
    id: "history",
    title: "History stays on this machine",
    body: "History lives on Jev’s State, not in the header. Threads stay in this browser’s localStorage. Refresh restores them. Keys are never stored here.",
    page: "workshop",
    hooks: ["history"],
    texts: ["History"],
  },
  {
    id: "weather",
    title: "Load weather",
    body: "Jacket is the one weather snap. Load weather writes Open-Meteo into that ticket. Other snaps are operator decisions — no weather field.",
    page: "workshop",
    hooks: ["weather"],
    texts: ["Load weather"],
  },
];

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {
    /* quota / private mode — do not crash */
  }
}

function labeled(el: Element, text: string): boolean {
  const own = el.textContent?.replace(/\s+/g, " ").trim();
  if (own === text) return true;
  const aria = el.getAttribute("aria-label")?.trim();
  return aria === text;
}

function queryByText(text: string): HTMLElement | null {
  const nodes = document.querySelectorAll("button, a, [role='button']");
  for (const n of nodes) {
    if (labeled(n, text)) return n as HTMLElement;
  }
  return null;
}

function isShown(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

export function queryTutorialEl(
  step: TutorialStep,
  requireVisible: boolean,
): HTMLElement | null {
  const consider = (el: HTMLElement | null) => {
    if (!el) return null;
    if (requireVisible && !isShown(el)) return null;
    return el;
  };
  for (const id of step.hooks ?? []) {
    const hit = consider(document.querySelector(`[data-tutorial="${id}"]`));
    if (hit) return hit;
  }
  for (const sel of step.selectors ?? []) {
    const hit = consider(document.querySelector(sel));
    if (hit) return hit;
  }
  for (const text of step.texts ?? []) {
    const hit = consider(queryByText(text));
    if (hit) return hit;
  }
  return null;
}

export function findTutorialTarget(step: TutorialStep): HTMLElement | null {
  return queryTutorialEl(step, true);
}

/** Whether this step can exist on this origin (hidden Workshop still counts). */
export function stepExistsInDom(step: TutorialStep): boolean {
  if (!step.hooks?.length && !step.selectors?.length && !step.texts?.length) {
    return true;
  }
  if (queryTutorialEl(step, false)) return true;
  if (step.page === "workshop") return true;
  if (step.page === "docs" || step.page === "use-cases") {
    return Boolean(queryByText(step.page === "docs" ? "Docs" : "Example Uses"));
  }
  return false;
}

export function hasLaterStep(fromIndex: number): boolean {
  for (let i = fromIndex + 1; i < TUTORIAL_STEPS.length; i++) {
    if (stepExistsInDom(TUTORIAL_STEPS[i])) return true;
  }
  return false;
}
