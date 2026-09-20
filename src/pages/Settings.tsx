import { useCallback, useEffect, useState } from "react";
import { getSettings, saveSetting } from "../api";
import type { KeyStatus } from "../types";
import { FlipTip } from "../FlipTip";

export function SettingsPage({
  onToast,
  onSaved,
}: {
  onToast: (s: string) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getSettings();
      setKeys(data.keys);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (id: string) => {
    setBusy(id);
    try {
      const data = await saveSetting(id, drafts[id] ?? "");
      setKeys(data.keys);
      setDrafts((d) => ({ ...d, [id]: "" }));
      const row = data.keys.find((k) => k.id === id);
      onToast(
        row?.present
          ? `${row.label} key saved on this machine.`
          : `${row?.label ?? "Key"} cleared.`,
      );
      await onSaved();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="settings" data-tutorial="settings-page">
      <section className="settings-intro">
        <span className="eyebrow">Bring your own keys</span>
        <h1 className="pane-title">Settings</h1>
        <p>
          Keys stay on this computer in gitignored <code>.env.local</code>. The
          browser never stores them. OpenRouter runs the LLM and Jev today. The
          other slots wait for search and direct models.
        </p>
      </section>
      {err ? <p className="empty">{err}</p> : null}
      <ul className="key-list">
        {keys.map((k) => (
          <li
            key={k.id}
            className={k.id === "openrouter" ? "key-row live" : "key-row"}
          >
            <header className="key-head">
              <div>
                <h2 className="pane-title">{k.label}</h2>
                <p className="key-why">{k.why}</p>
                <code>{k.env}</code>
              </div>
              <FlipTip
                text={
                  k.present
                    ? "Full key stays on the server. Last four only."
                    : "No key on the server for this slot."
                }
              >
                <span
                  className={k.present ? "pill ready" : "pill missing"}
                  tabIndex={0}
                >
                  {k.present
                    ? `Key ready${k.last4 ? ` · ${k.last4}` : ""}`
                    : "Missing"}
                </span>
              </FlipTip>
            </header>
            <form
              className="key-form"
              onSubmit={(e) => {
                e.preventDefault();
                void onSave(k.id);
              }}
            >
              <input
                type="password"
                name={`key-${k.id}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  k.present ? "Paste a new key, or save empty to clear" : "Paste key"
                }
                value={drafts[k.id] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [k.id]: e.target.value }))
                }
                aria-label={`${k.label} API key`}
              />
              <button
                className="btn solid"
                type="submit"
                disabled={busy !== null}
              >
                {busy === k.id ? "Saving…" : "Save"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
