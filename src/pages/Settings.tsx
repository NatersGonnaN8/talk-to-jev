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
import {
  GITHUB_URL,
  byokRemembered,
  clearByokKey,
  lastFour,
  looksLikeKey,
  saveByokKey,
  useByokKey,
} from "../publicMode";

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
  const [readOnly, setReadOnly] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const byokKey = useByokKey();
  const [byokDraft, setByokDraft] = useState("");
  const [remember, setRemember] = useState(byokRemembered);
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
      setReadOnly(Boolean(data.readOnly));
      setIsPublic(Boolean(data.public));
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

  const onSaveByok = async () => {
    if (!looksLikeKey(byokDraft)) {
      onToast("That does not look like an OpenRouter key. Paste the whole key.");
      return;
    }
    saveByokKey(byokDraft, remember);
    setByokDraft("");
    onToast("Your key is saved in this browser. Any model, no daily limit.");
    await onSaved();
  };

  const onClearByok = async () => {
    clearByokKey();
    setByokDraft("");
    setRemember(false);
    onToast("Your key is removed from this browser. Back on the free tier.");
    await onSaved();
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
        <span className="eyebrow">
          {isPublic ? "Free tier or your own key" : "Bring your own key"}
        </span>
        <h1 className="pane-title">Settings</h1>
        {isPublic ? (
          <p>
            You can use the free tier with no key. To use any OpenRouter model
            with no daily limit, paste your own OpenRouter key below. Standing
            LLM instructions live in this browser.
          </p>
        ) : (
          <p>
            One OpenRouter key stays on this computer in gitignored{" "}
            <code>.env.local</code>. The browser never stores it. That key runs
            the LLM and Jev. Standing LLM instructions live in this browser, not
            in that file.
          </p>
        )}
      </section>
      {err ? <p className="empty">{err}</p> : null}
      {isPublic ? (
        <section className="key-row live" data-tutorial="byok-card">
          <header className="key-head">
            <div>
              <h2 className="pane-title">Your OpenRouter key</h2>
              <p className="key-why">
                Optional. Billed to you by OpenRouter. It stays in this browser
                and goes to this site only as a request header, used for that
                one request. It is never stored on the server or logged. No key
                yet? Create one at openrouter.ai/keys and set a credit limit on
                it. Prefer your own machine?{" "}
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  Get it on GitHub
                </a>
                .
              </p>
            </div>
            <span
              className={byokKey ? "pill ready" : "pill missing"}
              tabIndex={0}
            >
              {byokKey ? `Key ready · ${lastFour(byokKey)}` : "Free tier"}
            </span>
          </header>
          <form
            className="key-form byok-form"
            onSubmit={(e) => {
              e.preventDefault();
              void onSaveByok();
            }}
          >
            <input
              type="password"
              name="byok-key"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={byokKey ? "Paste a new key to replace it" : "Paste your OpenRouter key"}
              value={byokDraft}
              onChange={(e) => setByokDraft(e.target.value)}
              aria-label="Your OpenRouter API key"
            />
            <button className="btn solid" type="submit" disabled={checking}>
              Save key
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!byokKey}
              onClick={() => void onClearByok()}
            >
              Remove key
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!byokKey || checking}
              onClick={() => void onCheckModels()}
            >
              {checking ? "Getting…" : "Get current models"}
            </button>
          </form>
          <label className="byok-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
              }}
            />
            <span>
              Remember on this device. The key then stays in this browser's
              local storage until you remove it. Leave this off on a shared
              computer. Off means it is forgotten when you close the tab.
            </span>
          </label>
        </section>
      ) : null}
      <ul className="key-list">
        {(isPublic ? [] : keys)
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
                if (!readOnly) void onSave(k.id);
              }}
            >
              {readOnly ? (
                <p className="key-why">
                  This key is set on the server. It can't be changed here.
                </p>
              ) : (
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
              )}
              {readOnly ? null : (
              <button
                className="btn solid"
                type="submit"
                disabled={busy !== null || checking}
              >
                {busy === k.id ? "Saving…" : "Save"}
              </button>
              )}
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
