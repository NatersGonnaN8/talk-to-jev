import { useEffect, useState } from "react";
import { getUsage } from "./api";
import { GITHUB_URL, lastFour, useByokKey, usePublicInfo } from "./publicMode";

const HIDE_KEY = "talk-to-jev:public-banner-hidden";

function readHidden(): boolean {
  try {
    return sessionStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Explains how to use the hosted copy: your own key, the free tier when it is on, or GitHub. Shown only on the public site. */
export function PublicBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const pub = usePublicInfo();
  const key = useByokKey();
  const [hidden, setHidden] = useState(readHidden);
  const [left, setLeft] = useState<{ llm: number; jev: number } | null>(null);
  const free = pub.freeAvailable;

  useEffect(() => {
    if (!pub.public || !free || key) {
      setLeft(null);
      return;
    }
    let alive = true;
    const load = () => {
      getUsage()
        .then((u) => {
          if (alive && u.free) setLeft({ llm: u.free.llmLeft, jev: u.free.jevLeft });
        })
        .catch(() => {
          /* the banner is only a hint */
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pub.public, free, key]);

  if (!pub.public) return null;

  const setHide = (next: boolean) => {
    setHidden(next);
    try {
      sessionStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  };

  const label = free ? "Free tier and your own key" : "Your own OpenRouter key";
  // With no key and no free tier nothing runs, so the banner cannot be hidden then.
  const canHide = Boolean(key) || free;

  if (hidden && canHide) {
    return (
      <div className="public-banner is-compact" role="region" aria-label={label}>
        <span>{key ? `Using your own key (${lastFour(key)})` : "Free tier"}</span>
        <button type="button" className="btn ghost" onClick={() => setHide(false)}>
          Details
        </button>
      </div>
    );
  }

  return (
    <div className="public-banner" role="region" aria-label={label}>
      {key ? (
        <p>
          <strong>Using your own OpenRouter key ({lastFour(key)}).</strong> Any model, billed to
          you by OpenRouter. The key stays in this browser.
        </p>
      ) : free ? (
        <p>
          <strong>Free to try, no login.</strong> Free models, a daily limit shared by everyone,
          and free providers may log prompts.
          {left ? (
            <>
              {" "}
              Left for you today: {left.llm} chat, {left.jev} Jev.
            </>
          ) : null}{" "}
          Any model and no limit: use your own OpenRouter key. On your own machine: GitHub.
        </p>
      ) : (
        <p>
          <strong>Bring your own OpenRouter key to start.</strong> Paste it in Settings. It stays
          in this browser, goes only to OpenRouter through this site, and is billed to you. Or run
          the app on your own machine from GitHub.
        </p>
      )}
      <div className="public-banner-actions">
        <button type="button" className="btn solid" onClick={onOpenSettings}>
          {key ? "Change key" : free ? "Use your own key" : "Add your key"}
        </button>
        <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          Get it on GitHub
        </a>
        {canHide ? (
          <button type="button" className="btn ghost" onClick={() => setHide(true)}>
            Hide
          </button>
        ) : null}
      </div>
    </div>
  );
}
