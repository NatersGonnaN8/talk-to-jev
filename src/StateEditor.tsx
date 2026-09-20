import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MdProse } from "./MdProse";

const PLACEHOLDER = "What Jev should judge";

function clickIsOnChrome(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, .mill-bar"))
  );
}

function selectionIsInside(host: EventTarget | null): boolean {
  if (!(host instanceof Node)) return false;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString()) return false;
  const node = sel.anchorNode;
  return Boolean(node && host.contains(node));
}

/** Jev’s State ticket: rendered markdown until click/focus, then raw textarea. */
export function StateEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const readRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (editing) {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      const n = el.value.length;
      el.setSelectionRange(n, n);
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active === readRef.current) {
      active.blur();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const leave = (event: Event) => {
      const t = "target" in event ? event.target : null;
      if (t instanceof Node && taRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest(".mill-bar")) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", leave, true);
    return () => document.removeEventListener("pointerdown", leave, true);
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="case"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={PLACEHOLDER}
        rows={8}
        aria-label="Jev’s State"
      />
    );
  }

  const empty = !value.trim();
  return (
    <div
      ref={readRef}
      className={empty ? "case case-read is-empty" : "case case-read"}
      role="textbox"
      tabIndex={0}
      aria-readonly="true"
      aria-label="Jev’s State"
      data-placeholder={PLACEHOLDER}
      onClick={(e) => {
        if (clickIsOnChrome(e.target)) return;
        if (selectionIsInside(e.currentTarget)) return;
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      {empty ? null : <MdProse text={value} />}
    </div>
  );
}
