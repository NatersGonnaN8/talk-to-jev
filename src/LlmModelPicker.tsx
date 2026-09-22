import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FlipTip } from "./FlipTip";
import {
  HIGHLIGHT_LLM_PICKER,
  LLM_MODEL_TIP,
  listLlmChatModels,
  useLlmCatalog,
  useLlmModel,
} from "./llmModel";

type MenuPlace = { top: number; left: number; width: number; maxHeight: number };

export function LlmModelPicker({
  disabled,
  extraId,
  className,
  tip,
}: {
  disabled?: boolean;
  extraId?: string;
  className?: string;
  tip?: string;
}) {
  const [model, setModel] = useLlmModel();
  const catalog = useLlmCatalog();
  const options = listLlmChatModels([model, extraId], catalog);
  const current = options.find((row) => row.id === model) ?? options[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (row) =>
        row.label.toLowerCase().includes(q) || row.id.toLowerCase().includes(q),
    );
  }, [options, query]);

  const placeMenu = () => {
    const el = rootRef.current?.querySelector("button");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(352, Math.max(rect.width, 240));
    const gap = 6;
    const roomAbove = rect.top - 12;
    const roomBelow = window.innerHeight - rect.bottom - 12;
    const openAbove = roomAbove > roomBelow;
    const maxHeight = Math.max(160, Math.min(320, (openAbove ? roomAbove : roomBelow) - gap));
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setPlace({
      top: openAbove ? Math.max(8, rect.top - gap) : rect.bottom + gap,
      left: Math.max(8, left),
      width,
      maxHeight,
    });
  };

  const reveal = () => {
    setHighlight(true);
    setOpen(true);
    setQuery("");
    rootRef.current?.querySelector("button")?.scrollIntoView({ block: "nearest" });
    window.setTimeout(() => setHighlight(false), 4000);
  };

  useEffect(() => {
    const onHighlight = () => reveal();
    window.addEventListener(HIGHLIGHT_LLM_PICKER, onHighlight);
    if (sessionStorage.getItem(HIGHLIGHT_LLM_PICKER) === "1") {
      sessionStorage.removeItem(HIGHLIGHT_LLM_PICKER);
      reveal();
    }
    return () => window.removeEventListener(HIGHLIGHT_LLM_PICKER, onHighlight);
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById(listId);
        if (menu?.contains(event.target as Node)) return;
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", placeMenu);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu);
    };
  }, [open, listId]);

  return (
    <div className="llm-model-combo" ref={rootRef}>
      <FlipTip text={tip ?? LLM_MODEL_TIP}>
        <button
          type="button"
          className={`${className ?? "llm-model-pick"}${highlight ? " is-highlight" : ""}`}
          aria-label="LLM model"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          title={current?.id}
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen((v) => !v);
          }}
        >
          <span>{current?.label ?? "LLM model"}</span>
        </button>
      </FlipTip>
      {open && place ? (
        <div
          id={listId}
          className="llm-model-menu"
          role="listbox"
          aria-label="LLM models"
          style={{
            top: place.top,
            left: place.left,
            width: place.width,
            transform: place.top < (rootRef.current?.getBoundingClientRect().top ?? 0) ? "translateY(-100%)" : undefined,
          }}
        >
          <input
            ref={searchRef}
            className="llm-model-search"
            aria-label="Search models"
            placeholder="Search models"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul style={{ maxHeight: place.maxHeight }}>
            {filtered.length ? (
              filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={row.id === model}
                    onClick={() => {
                      setModel(row.id);
                      setOpen(false);
                    }}
                  >
                    <span>{row.label}</span>
                    <code>{row.id}</code>
                  </button>
                </li>
              ))
            ) : (
              <li className="llm-model-empty">No models match.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
