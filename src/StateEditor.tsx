import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  fromProseHtml,
  sanitizeProseHtml,
  toProseHtml,
} from "./markdown";

const PLACEHOLDER = "What Jev should judge";

function clickIsOnChrome(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, .mill-bar"))
  );
}

function armEditable(el: HTMLElement): void {
  if (el.getAttribute("contenteditable") === "true") return;
  el.contentEditable = "true";
  try {
    document.execCommand("defaultParagraphSeparator", false, "p");
  } catch {
    /* ignore */
  }
}

function paint(el: HTMLElement, md: string): void {
  const top = el.scrollTop;
  const html = md.trim() ? toProseHtml(md) : "";
  if (el.innerHTML !== html) el.innerHTML = html;
  el.scrollTop = top;
}

/**
 * Jev’s State ticket: painted Public Sans prose while focused.
 * Click puts a caret in the ticket; blur serializes to markdown and re-paints.
 * Never swap to a raw-source textarea.
 */
export function StateEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [empty, setEmpty] = useState(() => !value.trim());
  const hostRef = useRef<HTMLDivElement>(null);
  const lastSent = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (!editing) el.contentEditable = "false";
    if (editing && value === lastSent.current) return;
    lastSent.current = value;
    paint(el, value);
    setEmpty(!value.trim());
  }, [value, editing]);

  function commitFromDom(): void {
    const el = hostRef.current;
    const md = el ? fromProseHtml(el.innerHTML) : "";
    lastSent.current = md;
    setEmpty(!md.trim());
    onChangeRef.current(md);
  }

  function endEdit(): void {
    commitFromDom();
    const node = hostRef.current;
    if (node) node.contentEditable = "false";
    setEditing(false);
  }

  useEffect(() => {
    if (!editing) return;
    const leave = (event: Event) => {
      const t = "target" in event ? event.target : null;
      if (t instanceof Node && hostRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest(".mill-bar")) return;
      endEdit();
    };
    document.addEventListener("pointerdown", leave, true);
    return () => document.removeEventListener("pointerdown", leave, true);
  }, [editing]);

  return (
    <div
      ref={hostRef}
      className={
        empty ? "case case-read md-prose is-empty" : "case case-read md-prose"
      }
      role="textbox"
      aria-multiline="true"
      aria-readonly={!editing}
      aria-label="Jev’s State"
      aria-placeholder={PLACEHOLDER}
      data-placeholder={PLACEHOLDER}
      tabIndex={0}
      contentEditable={editing ? "true" : "false"}
      suppressContentEditableWarning
      spellCheck
      onPointerDown={(e) => {
        if (clickIsOnChrome(e.target)) return;
        if (hostRef.current) armEditable(hostRef.current);
        setEditing(true);
      }}
      onFocus={() => {
        if (hostRef.current) armEditable(hostRef.current);
        setEditing(true);
      }}
      onBlur={() => endEdit()}
      onInput={(e) => {
        if (e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing) {
          return;
        }
        commitFromDom();
      }}
      onCompositionEnd={() => commitFromDom()}
      onPaste={(e) => {
        e.preventDefault();
        const html = e.clipboardData.getData("text/html");
        const text = e.clipboardData.getData("text/plain");
        if (html.trim()) {
          document.execCommand("insertHTML", false, sanitizeProseHtml(html));
        } else {
          document.execCommand("insertText", false, text);
        }
        commitFromDom();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
