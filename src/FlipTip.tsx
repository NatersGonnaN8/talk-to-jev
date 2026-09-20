import { useRef, useState, type ReactNode } from "react";

/** Opaque tip that flips above/below and stays on-screen. */
export function FlipTip({ text, children }: { text: string; children: ReactNode }) {
  const host = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<"below" | "above">("below");
  const [shift, setShift] = useState(0);

  const measure = () => {
    const t = tip.current;
    const h = host.current;
    if (!t || !h) return;
    const hr = h.getBoundingClientRect();
    const chrome = 64;
    const need = Math.max(t.offsetHeight, 28) + 10;
    const spaceBelow = window.innerHeight - hr.bottom;
    const spaceAbove = hr.top - chrome;
    if (spaceBelow >= need) setPlace("below");
    else if (spaceAbove >= need) setPlace("above");
    else setPlace(spaceBelow >= spaceAbove ? "below" : "above");
    const tr = t.getBoundingClientRect();
    const pad = 8;
    let dx = 0;
    if (tr.left + shift < pad) dx = pad - tr.left;
    else if (tr.right + shift > window.innerWidth - pad) {
      dx = window.innerWidth - pad - tr.right;
    }
    setShift(dx);
  };

  return (
    <span
      className="flip-host"
      ref={host}
      onMouseEnter={measure}
      onFocus={measure}
    >
      {children}
      <span
        ref={tip}
        className={`flip-tip ${place}`}
        role="tooltip"
        style={{ transform: `translateX(${shift}px)` }}
      >
        {text}
      </span>
    </span>
  );
}
