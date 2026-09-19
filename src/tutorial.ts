/** First-run / Tour coach. Storage: `talk-to-jev:tutorial-done`. Never store keys.
 * Live copy SoT — overlay + chrome Tour button import this module.
 * Human-readable twin (keep 1:1): `docs/TOUR.md`.
 */

export const TUTORIAL_DONE_KEY = "talk-to-jev:tutorial-done";

export type TutorialPage = "workshop" | "docs" | "use-cases" | "settings";

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
    body: "Talk to Jev wires a cheap LLM (it talks) to Jev (it does not write). One OpenRouter key runs chat completions and the Decisions API. Jev is System One: state plus typed questions, then probabilities — not a chatbot.",
    page: "workshop",
  },
  {
    id: "case",
    title: "The Case ticket is Jev state",
    body: "This slip is what Jev judges. The LLM can draft it. Weather, samples, and your notes all live here as state — not as a chat with Jev.",
    page: "workshop",
    hooks: ["case"],
    selectors: [".ticket"],
  },
  {
    id: "llm",
    title: "The LLM pane talks",
    body: "Manila side: draft the case, ask how to phrase a question, or chat. This is the prose half. Jev never writes in this thread.",
    page: "workshop",
    hooks: ["llm"],
    selectors: [".pane.llm"],
  },
  {
    id: "jev",
    title: "Ask Jev typed questions",
    body: "Blueprint side: choice, noul, or score — not essays. Add questions, then Ask Jev. You get probabilities, not a paragraph.",
    page: "workshop",
    hooks: ["jev", "ask-jev"],
    selectors: [".pane.jev"],
  },
  {
    id: "wire",
    title: "Pass work across the wire",
    body: "Propose Jev questions asks the LLM for a JSON question map. After Jev answers, Feed Jev to LLM drops those typed results into the chat.",
    page: "workshop",
    hooks: ["wire"],
    selectors: [".pane.llm .row-actions"],
  },
  {
    id: "use-cases",
    title: "Use Cases",
    body: "Ten sample snaps — the same list as the Workshop chips. Open a card to load the case and Jev questions.",
    page: "use-cases",
    hooks: ["use-cases", "use-cases-page"],
    texts: ["Use Cases"],
  },
  {
    id: "docs",
    title: "Docs: eyeball vs code",
    body: "Official Jev docs live in this repo. Open a page, then the eyeball for a nice read or the code icon for the raw snapshot.",
    page: "docs",
    hooks: ["docs-view", "docs"],
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
    id: "history",
    title: "History stays on this machine",
    body: "Threads live in this browser’s localStorage. Refresh restores them. Keys are never stored here.",
    page: "workshop",
    hooks: ["history"],
    texts: ["History"],
  },
  {
    id: "weather",
    title: "Load weather",
    body: "Weather is Open-Meteo input, not a third model. Load weather writes live conditions into the Case ticket. No extra API key.",
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
    return Boolean(queryByText(step.page === "docs" ? "Docs" : "Use Cases"));
  }
  return false;
}

export function hasLaterStep(fromIndex: number): boolean {
  for (let i = fromIndex + 1; i < TUTORIAL_STEPS.length; i++) {
    if (stepExistsInDom(TUTORIAL_STEPS[i])) return true;
  }
  return false;
}
