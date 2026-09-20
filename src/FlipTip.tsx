import { useRef, useState, type ReactNode } from "react";

/** Opaque tip that flips above/below and stays on-screen (fixed, escapes overflow). */
export function FlipTip({ text, children }: { text: string; children: ReactNode }) {
  const host = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<"below" | "above">("below");
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const measure = () => {
    const t = tip.current;
    const h = host.current;
    if (!t || !h) return;
    const hr = h.getBoundingClientRect();
    const chrome = 64;
    const pad = 8;
    const need = Math.max(t.offsetHeight, 28) + 10;
    const spaceBelow = window.innerHeight - hr.bottom;
    const spaceAbove = hr.top - chrome;
    const below =
      spaceBelow >= need || (spaceBelow >= spaceAbove && spaceBelow >= 20);
    setPlace(below ? "below" : "above");
    const width = Math.min(t.offsetWidth || 180, window.innerWidth - pad * 2);
    const height = t.offsetHeight || 28;
    let left = hr.left;
    if (left + width > window.innerWidth - pad) {
      left = window.innerWidth - pad - width;
    }
    if (left < pad) left = pad;
    const top = below ? hr.bottom + 8 : Math.max(pad, hr.top - height - 8);
    setPos({ top, left });
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
        style={{ top: pos.top, left: pos.left }}
      >
        {text}
      </span>
    </span>
  );
}
