import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  TUTORIAL_STEPS,
  TUTORIAL_UI,
  findTutorialTarget,
  hasLaterStep,
  markTutorialDone,
  queryTutorialEl,
  stepExistsInDom,
  tutorialKicker,
  type TutorialPage,
  type TutorialStep,
} from "./tutorial";

const CHROME = 72;
const PAD = 14;
const HOLE = 8;
const CARD_W = 360;

type Hole = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number };

function waitFrames(n: number) {
  return new Promise<void>((resolve) => {
    const tick = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => tick(left - 1));
    };
    requestAnimationFrame(() => tick(n));
  });
}

async function ensureDocsView() {
  if (document.querySelector("[data-tutorial='docs-view'], .doc-overlay")) return;
  const first = document.querySelector<HTMLElement>(".doc-link");
  if (!first) return;
  first.click();
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => window.setTimeout(r, 50));
    if (document.querySelector("[data-tutorial='docs-view'], .doc-overlay")) return;
  }
}

function clamp(top: number, left: number, w: number, h: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    top: Math.min(vh - h - PAD, Math.max(CHROME + PAD, top)),
    left: Math.min(vw - w - PAD, Math.max(PAD, left)),
  };
}

function placeCard(target: DOMRect | null, cw: number, ch: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!target) {
    return clamp(CHROME + 28, (vw - cw) / 2, cw, ch);
  }
  const spaceBelow = vh - target.bottom;
  const spaceAbove = target.top - CHROME;
  let top: number;
  if (spaceBelow >= ch + PAD * 2) top = target.bottom + PAD;
  else if (spaceAbove >= ch + PAD * 2) top = target.top - ch - PAD;
  else top = CHROME + Math.max(PAD, (vh - CHROME - ch) / 2);
  const left = target.left + target.width / 2 - cw / 2;
  return clamp(top, left, cw, ch);
}

function holeFrom(el: HTMLElement): Hole {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - HOLE,
    left: r.left - HOLE,
    width: r.width + HOLE * 2,
    height: r.height + HOLE * 2,
  };
}

export function TutorialOverlay({
  open,
  onDismiss,
  onGo,
}: {
  open: boolean;
  onDismiss: () => void;
  onGo: (page: TutorialPage) => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [pos, setPos] = useState<Pos>({ top: CHROME + 28, left: 24 });
  const cardRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const runId = useRef(0);

  const finish = useCallback(() => {
    runId.current += 1;
    markTutorialDone();
    onDismissRef.current();
  }, []);

  const layout = useCallback((step: TutorialStep) => {
    const el = findTutorialTarget(step);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    const card = cardRef.current;
    const cw = card?.offsetWidth || CARD_W;
    const ch = card?.offsetHeight || 220;
    const rect = el?.getBoundingClientRect() ?? null;
    setHole(el ? holeFrom(el) : null);
    setPos(placeCard(rect, cw, ch));
  }, []);

  const activate = useCallback(
    async (start: number, dir: 1 | -1) => {
      const mine = ++runId.current;
      if (start < 0) {
        setCursor(0);
        return;
      }
      for (let i = start; i >= 0 && i < TUTORIAL_STEPS.length; i += dir) {
        if (mine !== runId.current) return;
        const step = TUTORIAL_STEPS[i];
        onGoRef.current(step.page);
        await waitFrames(2);
        if (mine !== runId.current) return;
        if (step.page === "docs") await ensureDocsView();
        await waitFrames(2);
        if (mine !== runId.current) return;
        const needs =
          Boolean(step.hooks?.length) ||
          Boolean(step.selectors?.length) ||
          Boolean(step.texts?.length);
        if (needs && !queryTutorialEl(step, false)) continue;
        setCursor(i);
        return;
      }
      if (dir === 1 && mine === runId.current) finish();
    },
    [finish],
  );

  useEffect(() => {
    if (!open) return;
    void activate(0, 1);
    return () => {
      runId.current += 1;
    };
  }, [open, activate]);

  useLayoutEffect(() => {
    if (!open) return;
    layout(TUTORIAL_STEPS[cursor] ?? TUTORIAL_STEPS[0]);
  }, [open, cursor, layout]);

  useEffect(() => {
    if (!open) return;
    const onWin = () => layout(TUTORIAL_STEPS[cursorRef.current] ?? TUTORIAL_STEPS[0]);
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, layout]);

  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cursor, finish]);

  if (!open) return null;

  const step = TUTORIAL_STEPS[cursor] ?? TUTORIAL_STEPS[0];
  const last = !hasLaterStep(cursor);
  const existing = TUTORIAL_STEPS.map((s, i) => ({ s, i })).filter(({ s }) =>
    stepExistsInDom(s),
  );
  const total = Math.max(1, existing.length);
  const shown = Math.max(1, existing.findIndex(({ i }) => i === cursor) + 1);

  return (
    <div className="tour-root" role="presentation">
      {hole ? (
        <div className="tour-spot" style={hole} />
      ) : (
        <div className="tour-scrim" />
      )}
      <aside
        ref={cardRef}
        className={step.id === "jev" || step.id === "docs" ? "tour-card blueprint" : "tour-card"}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <p className="tour-kicker">{tutorialKicker(shown, total)}</p>
        <h2 className="pane-title" id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn ghost" onClick={finish}>
            {TUTORIAL_UI.skip}
          </button>
          <span className="tour-spacer" />
          <button
            type="button"
            className="btn ghost"
            disabled={cursor === 0}
            onClick={() => void activate(cursor - 1, -1)}
          >
            {TUTORIAL_UI.back}
          </button>
          <button
            ref={nextRef}
            type="button"
            className="btn solid"
            onClick={() => {
              if (last) finish();
              else void activate(cursorRef.current + 1, 1);
            }}
          >
            {last ? TUTORIAL_UI.done : TUTORIAL_UI.next}
          </button>
        </div>
      </aside>
    </div>
  );
}
