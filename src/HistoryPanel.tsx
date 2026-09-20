import { useEffect, useRef, useState } from "react";
import type { ChatStore, ChatThread } from "./history";

export function HistoryPanel({
  open,
  onClose,
  store,
  onNew,
  onClear,
  onSelect,
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  store: ChatStore;
  onNew: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      return;
    }
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (editingId) setEditingId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editingId, onClose]);

  if (!open) return null;

  const beginRename = (chat: ChatThread) => {
    setEditingId(chat.id);
    setDraftTitle(chat.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    onRename(editingId, draftTitle);
    setEditingId(null);
  };

  return (
    <div className="hist-layer">
      <button
        type="button"
        className="hist-backdrop"
        aria-label="Close history"
        onClick={onClose}
      />
      <aside className="hist-drawer" id="workshop-history" role="dialog" aria-label="Chat history">
        <header className="hist-head">
          <div>
            <h2 className="pane-title">History</h2>
            <p className="hist-sub">This browser only</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn tiny"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="hist-actions">
          <button type="button" className="btn solid" onClick={onNew}>
            New chat
          </button>
          <button type="button" className="btn ghost" onClick={onClear}>
            Clear current
          </button>
        </div>
        {store.chats.length === 0 ? (
          <p className="empty hist-empty">
            Send a message or change the case — threads stay on this machine.
          </p>
        ) : (
          <ul className="hist-list">
            {store.chats.map((chat) => {
              const on = chat.id === store.activeId;
              const renaming = editingId === chat.id;
              return (
                <li key={chat.id} className={on ? "hist-item on" : "hist-item"}>
                  {renaming ? (
                    <form
                      className="hist-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename();
                      }}
                    >
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={commitRename}
                        aria-label="Thread title"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="hist-pick"
                      onClick={() => onSelect(chat.id)}
                    >
                      <strong>{chat.title}</strong>
                      <span>{formatStamp(chat.updatedAt)}</span>
                    </button>
                  )}
                  <div className="hist-row-actions">
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => beginRename(chat)}
                      aria-label={`Rename ${chat.title}`}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => onDelete(chat.id)}
                      aria-label={`Delete ${chat.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function formatStamp(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
