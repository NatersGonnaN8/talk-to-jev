import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SAMPLES, type SampleId } from "./samples";

const CHROME = 64;
const PAD = 8;

export function PresetCasesMenu({
  currentId,
  disabled,
  onPick,
}: {
  currentId: string | null;
  disabled?: boolean;
  onPick: (id: SampleId) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    visibility: "hidden",
    top: 0,
    left: 0,
  });

  const current = SAMPLES.find((s) => s.id === currentId);
  const aria = current
    ? `Preset States, ${current.label} selected`
    : "Preset States";

  const measure = () => {
    const b = btn.current;
    const m = menu.current;
    if (!b || !m) return;
    const hr = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(hr.width, 340), vw - PAD * 2);
    const need = Math.max(m.scrollHeight, 120);
    const spaceBelow = vh - hr.bottom - PAD;
    const spaceAbove = hr.top - CHROME - PAD;
    const below =
      spaceBelow >= Math.min(need, 160) || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, below ? spaceBelow : spaceAbove);
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
      zIndex: 25,
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="preset-menu" ref={host} data-tutorial="presets">
      <button
        ref={btn}
        type="button"
        className={open ? "sample-chip on" : "sample-chip"}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="preset-cases-menu"
        aria-label={aria}
        onClick={() => setOpen((v) => !v)}
      >
        Preset States
      </button>
      {open ? (
        <ul
          ref={menu}
          id="preset-cases-menu"
          role="menu"
          aria-label="Preset States"
          className="preset-menu-list"
          style={style}
        >
          {SAMPLES.map((s) => {
            const on = currentId === s.id;
            return (
              <li key={s.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={on ? "preset-item on" : "preset-item"}
                  aria-current={on ? "true" : undefined}
                  onClick={() => {
                    onPick(s.id);
                    setOpen(false);
                  }}
                >
                  <span className="preset-item-head">
                    <span className="preset-item-label">{s.label}</span>
                    {s.kind === "weather" ? (
                      <span className="kind-chip weather">weather</span>
                    ) : null}
                  </span>
                  <span className="preset-item-pitch">{s.pitch}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
