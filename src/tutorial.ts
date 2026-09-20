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
    body: "This slip is Jev state. New State starts a blank workshop — not a preset. Preset States loads one of the ten snaps. History is on this row, not in the header. Drop .md here; other files open Convert. Jacket can add Open-Meteo weather.",
    page: "workshop",
    hooks: ["case"],
    selectors: [".ticket"],
  },
  {
    id: "llm",
    title: "The LLM pane talks",
    body: "Manila side: draft the state, ask how to phrase a question, or chat. This is the prose half. While it works you get mill thinking, real thoughts if the model streams them, and tool cards when it writes Jev’s State or questions — not a JSON dump. Inspector (in this pane-head, off until you toggle it) always records what went to the LLM and to Jev. Jev never writes in this thread.",
    page: "workshop",
    hooks: ["llm"],
    selectors: [".pane.llm"],
  },
  {
    id: "jev",
    title: "Jev’s Questions",
    body: "Jev’s Questions: choice, noul, or score — not essays. Add questions, then Ask Jev. Send answers to LLM sits next to Ask Jev and sends typed answers to the LLM immediately. You get probabilities, not a paragraph.",
    page: "workshop",
    hooks: ["jev", "ask-jev", "feed-jev"],
    selectors: [".pane.jev"],
  },
  {
    id: "wire",
    title: "Pass work across the wire",
    body: "Propose Jev questions asks the LLM to fill the q-cards with tools (not a JSON dump in chat). Random state (left of Agentic loop) invents a mill once. Agentic loop runs N LLM↔Jev turns on the current mill. Inspector is on this mill row. Send answers to LLM lives on Jev’s Questions, next to Ask Jev — after Jev answers, it sends those typed results to the LLM immediately.",
    page: "workshop",
    hooks: ["wire"],
    selectors: [".pane.llm .row-actions"],
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
    body: "Official Jev docs live in this repo. Open a page, then Nice view, Code view, or the boxed-i Iframe when the live page will actually embed. Iframe hides for primer and sites that block framing.",
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
