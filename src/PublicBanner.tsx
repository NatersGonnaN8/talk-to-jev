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

/** Explains the three ways to use the hosted copy. Shown only on the public site. */
export function PublicBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const pub = usePublicInfo();
  const key = useByokKey();
  const [hidden, setHidden] = useState(readHidden);
  const [left, setLeft] = useState<{ llm: number; jev: number } | null>(null);

  useEffect(() => {
    if (!pub.public || key) {
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
  }, [pub.public, key]);

  if (!pub.public) return null;

  const setHide = (next: boolean) => {
    setHidden(next);
    try {
      sessionStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  };

  if (hidden) {
    return (
      <div className="public-banner is-compact" role="region" aria-label="Free tier and your own key">
        <span>{key ? `Using your own key (${lastFour(key)})` : "Free tier"}</span>
        <button type="button" className="btn ghost" onClick={() => setHide(false)}>
          Details
        </button>
      </div>
    );
  }

  return (
    <div className="public-banner" role="region" aria-label="Free tier and your own key">
      {key ? (
        <p>
          <strong>Using your own OpenRouter key ({lastFour(key)}).</strong> Any model, no daily
          limit, billed to you by OpenRouter. The key stays in this browser.
        </p>
      ) : (
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
      )}
      <div className="public-banner-actions">
        <button type="button" className="btn solid" onClick={onOpenSettings}>
          {key ? "Change key" : "Use your own key"}
        </button>
        <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          Get it on GitHub
        </a>
        <button type="button" className="btn ghost" onClick={() => setHide(true)}>
          Hide
        </button>
      </div>
    </div>
  );
}
