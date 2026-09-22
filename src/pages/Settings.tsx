import { useCallback, useEffect, useState } from "react";
import { fetchOpenRouterModels, getSettings, saveSetting } from "../api";
import { HIGHLIGHT_LLM_PICKER, readLlmCatalog, writeLlmCatalog } from "../llmModel";
import {
  LLM_INSTRUCTIONS_MAX,
  readLlmInstructions,
  writeLlmInstructions,
} from "../llmInstructions";
import type { KeyStatus } from "../types";
import { FlipTip } from "../FlipTip";
import { LlmModelPicker } from "../LlmModelPicker";

export function SettingsPage({
  onToast,
  onSaved,
  onPickModel,
}: {
  onToast: (s: string) => void;
  onSaved: () => void | Promise<void>;
  onPickModel: () => void;
}) {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [polled, setPolled] = useState(() => readLlmCatalog().length > 0);
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
    setInstructions(readLlmInstructions());
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

  const onCheckModels = async () => {
    setChecking(true);
    try {
      const models = await fetchOpenRouterModels();
      const count = writeLlmCatalog(models);
      setPolled(count > 0);
      onToast(
        count
          ? `Loaded ${count} models into the Workshop picker.`
          : "OpenRouter returned no chat models.",
      );
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load models");
    } finally {
      setChecking(false);
    }
  };

  const onSelectModel = () => {
    try {
      sessionStorage.setItem(HIGHLIGHT_LLM_PICKER, "1");
    } catch {
      /* */
    }
    onPickModel();
    window.setTimeout(() => {
      window.dispatchEvent(new Event(HIGHLIGHT_LLM_PICKER));
    }, 40);
  };

  const onSaveInstructions = () => {
    const next = writeLlmInstructions(instructions);
    setInstructions(next);
    onToast(
      next ? "LLM instructions saved." : "LLM instructions cleared.",
    );
  };

  return (
    <main className="settings" data-tutorial="settings-page">
      <section className="settings-intro">
        <span className="eyebrow">Bring your own key</span>
        <h1 className="pane-title">Settings</h1>
        <p>
          One OpenRouter key stays on this computer in gitignored{" "}
          <code>.env.local</code>. The browser never stores it. That key runs
          the LLM and Jev. Standing LLM instructions live in this browser, not
          in that file.
        </p>
      </section>
      {err ? <p className="empty">{err}</p> : null}
      <ul className="key-list">
        {keys
          .filter((k) => k.id === "openrouter")
          .map((k) => (
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
                disabled={busy !== null || checking}
              >
                {busy === k.id ? "Saving…" : "Save"}
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={!k.present || busy !== null || checking}
                onClick={() => void onCheckModels()}
              >
                {checking ? "Getting…" : "Get current models"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {polled ? (
        <p className="models-polled" role="status">
          Current models polled. Select your model in the Workshop.
          <button className="btn solid" type="button" onClick={onSelectModel}>
            Select your model
          </button>
        </p>
      ) : null}
      <section className="llm-model-card">
        <header className="key-head">
          <div>
            <h2 className="pane-title">LLM model</h2>
            <p className="key-why">
              OpenRouter chat model for the Workshop LLM. Jev stays pinned.
            </p>
          </div>
        </header>
        <LlmModelPicker tip="OpenRouter chat model for the Workshop LLM. Jev stays typesafe/jev-1.13." />
      </section>
      <section className="llm-instructions">
        <header className="key-head">
          <div>
            <h2 className="pane-title">LLM instructions</h2>
            <p className="key-why">
              These go with every LLM request. They are not shown as chat
              bubbles.
            </p>
          </div>
        </header>
        <form
          className="llm-instructions-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveInstructions();
          }}
        >
          <textarea
            name="llm-instructions"
            rows={8}
            maxLength={LLM_INSTRUCTIONS_MAX}
            spellCheck
            placeholder="Optional. Empty is off."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            aria-label="LLM instructions"
          />
          <button className="btn solid" type="submit">
            Save
          </button>
        </form>
      </section>
    </main>
  );
}
