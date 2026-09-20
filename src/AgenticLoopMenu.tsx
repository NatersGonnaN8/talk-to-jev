import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AGENTIC_LOOP_DEFAULT_TURNS,
  AGENTIC_LOOP_NEED_MILL,
  agenticLoopTurnOptions,
} from "./agenticLoop";
import { FlipTip } from "./FlipTip";

const CHROME = 64;
const PAD = 8;

export function AgenticLoopMenu({
  disabled,
  needMill,
  onNeedMill,
  onConfirm,
}: {
  disabled?: boolean;
  needMill?: boolean;
  onNeedMill?: () => void;
  onConfirm: (turns: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState(AGENTIC_LOOP_DEFAULT_TURNS);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    visibility: "hidden",
    top: 0,
    left: 0,
  });

  const locked = Boolean(disabled || needMill);

  const close = () => {
    setOpen(false);
    setTurns(AGENTIC_LOOP_DEFAULT_TURNS);
    btn.current?.focus();
  };

  const measure = () => {
    const b = btn.current;
    const p = panel.current;
    if (!b || !p) return;
    const hr = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(hr.width, 280), vw - PAD * 2);
    const need = Math.max(p.scrollHeight, 160);
    const spaceBelow = vh - hr.bottom - PAD;
    const spaceAbove = hr.top - CHROME - PAD;
    const below = spaceBelow >= Math.min(need, 140) || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(140, below ? spaceBelow : spaceAbove);
    let left = hr.left;
    if (left + width > vw - PAD) left = vw - PAD - width;
    if (left < PAD) left = PAD;
    const shown = Math.min(need, maxHeight);
    const top = below ? hr.bottom + 6 : hr.top - shown - 6;
    setStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: 70,
      visibility: "visible",
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onWin = () => measure();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, turns]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const button = (
    <button
      ref={btn}
      type="button"
      className="btn ghost mill-loop-btn"
      data-tutorial="agentic-loop"
      disabled={locked}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="agentic-loop-popover"
      title={needMill && !disabled ? AGENTIC_LOOP_NEED_MILL : undefined}
      onClick={() => {
        if (needMill) {
          onNeedMill?.();
          return;
        }
        if (open) close();
        else setOpen(true);
      }}
    >
      Agentic loop
    </button>
  );

  return (
    <div className="mill-loop-menu" ref={host}>
      {needMill && !disabled ? (
        <FlipTip text={AGENTIC_LOOP_NEED_MILL}>{button}</FlipTip>
      ) : (
        button
      )}
      {open ? (
        <div
          ref={panel}
          id="agentic-loop-popover"
          role="dialog"
          aria-labelledby="agentic-loop-title"
          className="mill-loop-popover"
          style={style}
        >
          <p id="agentic-loop-title" className="mill-loop-title">
            How many turns do you want to do?
          </p>
          <div className="mill-loop-options" role="group" aria-label="Turn count">
            {agenticLoopTurnOptions().map((n) => (
              <button
                key={n}
                type="button"
                className={n === turns ? "mill-loop-opt on" : "mill-loop-opt"}
                aria-pressed={n === turns}
                onClick={() => setTurns(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mill-loop-actions">
            <button type="button" className="btn ghost" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn solid"
              onClick={() => {
                const n = turns;
                close();
                onConfirm(n);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
