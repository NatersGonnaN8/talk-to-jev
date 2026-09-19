import { useRef, useState, type ReactNode } from "react";
import { SAMPLES, type SampleId } from "./samples";
import type { QuestionType } from "./types";

const TYPE_TIP: Record<QuestionType, string> = {
  choice: "Pick one option. Jev returns probabilities.",
  noul: "Yes/no as P(true), from 0 to 1.",
  score: "Ordered levels plus a numeric score.",
};

function FlipTip({ text, children }: { text: string; children: ReactNode }) {
  const host = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<"below" | "above">("below");
  const [shift, setShift] = useState(0);

  const measure = () => {
    const t = tip.current;
    const h = host.current;
    if (!t || !h) return;
    const hr = h.getBoundingClientRect();
    const chrome = 64;
    const need = Math.max(t.offsetHeight, 28) + 10;
    const spaceBelow = window.innerHeight - hr.bottom;
    const spaceAbove = hr.top - chrome;
    if (spaceBelow >= need) setPlace("below");
    else if (spaceAbove >= need) setPlace("above");
    else setPlace(spaceBelow >= spaceAbove ? "below" : "above");
    const tr = t.getBoundingClientRect();
    const pad = 8;
    let dx = 0;
    if (tr.left + shift < pad) dx = pad - tr.left;
    else if (tr.right + shift > window.innerWidth - pad) {
      dx = window.innerWidth - pad - tr.right;
    }
    setShift(dx);
  };

  return (
    <span
      className="flip-host"
      ref={host}
      onMouseEnter={measure}
      onFocus={measure}
    >
      {children}
      <span
        ref={tip}
        className={`flip-tip ${place}`}
        role="tooltip"
        style={{ transform: `translateX(${shift}px)` }}
      >
        {text}
      </span>
    </span>
  );
}

export function UseCasesPage({
  onOpen,
}: {
  onOpen: (id: SampleId) => void;
}) {
  return (
    <main className="use-cases">
      <section className="cases-intro">
        <span className="eyebrow">Ten snaps</span>
        <h1>Use Cases</h1>
        <p>
          Nine operator snaps plus one weather case — the same list as the
          Workshop chips. Click a card to load the case and Jev questions.
          Jev is not a chatbot — it returns choice, noul, and score. Open-Meteo
          is optional input on Jacket only, not a third model.
        </p>
      </section>
      <ul className="case-grid">
        {SAMPLES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="case-card"
              onClick={() => onOpen(s.id)}
            >
              <span className="case-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2>{s.label}</h2>
              <p className="case-pitch">{s.pitch}</p>
              <div className="type-chips">
                {s.kind === "weather" ? (
                  <span className="kind-chip weather">weather</span>
                ) : null}
                {s.types.map((t) => (
                  <FlipTip key={t} text={TYPE_TIP[t]}>
                    <span className={`type-chip ${t}`}>
                      {t}
                    </span>
                  </FlipTip>
                ))}
              </div>
              <span className="case-go">Open in Workshop</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
