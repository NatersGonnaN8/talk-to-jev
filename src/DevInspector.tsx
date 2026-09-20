import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  clearDevLogs,
  getDevLogsSnapshot,
  loadInspectorHeight,
  saveInspectorHeight,
  subscribeDevLogs,
  type DevCall,
  type DevChannel,
} from "./devLog";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clock(at: number) {
  try {
    return new Date(at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function pathOf(call: DevCall): string | null {
  const req = call.request;
  if (req && typeof req === "object" && "path" in req) {
    const p = (req as { path?: unknown }).path;
    if (p === "/api/llm" || p === "/api/jev") return p;
  }
  return call.channel === "llm" ? "/api/llm" : "/api/jev";
}

function CallCard({ call }: { call: DevCall }) {
  const [open, setOpen] = useState(true);
  const path = pathOf(call);
  return (
    <article className={call.pending ? "dev-call pending" : "dev-call"}>
      <button
        type="button"
        className="dev-call-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dev-call-time">{clock(call.at)}</span>
        <span className="dev-call-title">
          {call.title}
          {path ? <code>{path}</code> : null}
        </span>
        <span className="dev-call-stamp">
          {call.pending ? "Sending" : call.error ? "Failed" : "Done"}
        </span>
        <span className="dev-call-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="dev-call-body">
          <p className="dev-kicker">Request</p>
          <pre className="dev-json">{pretty(call.request)}</pre>
          {call.error ? (
            <>
              <p className="dev-kicker">Error</p>
              <pre className="dev-json error">{call.error}</pre>
            </>
          ) : call.response !== undefined ? (
            <>
              <p className="dev-kicker">Response</p>
              <pre className="dev-json">{pretty(call.response)}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Column({
  channel,
  title,
  calls,
}: {
  channel: DevChannel;
  title: string;
  calls: DevCall[];
}) {
  const mine = calls.filter((c) => c.channel === channel);
  return (
    <section className={`dev-col ${channel}`} aria-label={title}>
      <p className="eyebrow">{title}</p>
      {mine.length === 0 ? (
        <p className="dev-empty">
          Nothing here yet. Recording continues while this panel is closed.
        </p>
      ) : (
        <div className="dev-list">
          {mine.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </section>
  );
}

export function DevInspector({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const calls = useSyncExternalStore(
    subscribeDevLogs,
    getDevLogsSnapshot,
    getDevLogsSnapshot,
  );
  const [height, setHeight] = useState(() => loadInspectorHeight());
  const heightRef = useRef(height);
  heightRef.current = height;
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".tour-root")) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const max = Math.round(window.innerHeight * 0.7);
      const next = Math.min(max, Math.max(160, d.startH + (d.startY - e.clientY)));
      setHeight(next);
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      saveInspectorHeight(heightRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="dev-inspector"
      id="dev-inspector"
      role="dialog"
      aria-modal="false"
      aria-label="Inspector"
      style={{ height }}
    >
      <button
        type="button"
        className="dev-resizer"
        aria-label="Resize inspector"
        onPointerDown={(e) => {
          e.preventDefault();
          drag.current = { startY: e.clientY, startH: height };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
      />
      <header className="dev-head">
        <div>
          <h2 className="pane-title">Inspector</h2>
          <p className="dev-sub">
            What went to the LLM and to Jev. Keys never appear here.
          </p>
        </div>
        <div className="dev-head-actions">
          <button type="button" className="btn tiny" onClick={() => clearDevLogs()}>
            Clear
          </button>
          <button type="button" className="btn tiny" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div className="dev-grid">
        <Column channel="llm" title="To LLM" calls={calls} />
        <Column channel="jev" title="To Jev" calls={calls} />
      </div>
    </div>,
    document.body,
  );
}
