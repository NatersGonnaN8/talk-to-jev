# Talk to Jev

**Jev decides. The LLM talks. One OpenRouter key.**

This is a local **prototype** for riding the [Jev](https://jevai.dev/) wave: wire a cheap LLM to TypeSafe’s **System One** model without paying a wrapper tax.

**Jev is not a chatbot and not an LLM.** You send `state` plus typed questions (`choice` / `noul` / `score`) to TypeSafe’s Decisions API. You get **probabilities** back. Named after Jevons. Pin: `typesafe/jev-1.13`.

The LLM (default `deepseek/deepseek-v4-flash`) drafts, chats, and proposes those questions. It must not invent Jev’s answers.

One [OpenRouter](https://openrouter.ai/) **bring-your-own-key** runs both. Keys stay on this machine. Cheap production — not a $20/month demo of somebody else’s model.

In-app **Docs** (`/docs`) is the checked-in official snapshot. **Update Jev docs** lives on that page.

---

## 30 seconds

| | |
|---|---|
| **What** | Local workshop: mill ticket (**Jev’s State**) + manila LLM pane + blueprint **Jev’s Questions**. |
| **Loop** | LLM tools write state/questions. **Ask Jev** (or **Agentic loop**) hits Decisions. Typed answers can go straight back to the LLM. |
| **Cost** | Jev snaps are fractions of a cent. The LLM is a floor model. No premium wrapper. |
| **Not this** | Not hosted. Not multi-user. Not a TypeSafe-native key. Not poems/code from Jev. Not a SaaS. |

Weather is **one** example (Jacket + free Open-Meteo). Nine of the ten snaps are operator decisions.

---

## The loop

The LLM never answers a Jev question itself. It has tools to **read** the current pane, write state/questions, and ask Jev — and the server refuses to let it fake Jev’s answers:

| Tool | Does |
|---|---|
| `read_jev_workshop` | Returns the current **Jev’s State** text + current questions map (same shapes the write tools consume). Call this **before** writing. No args. Does not call Jev. |
| `set_jev_state` | Writes **Jev’s State** — the TypeSafe `state` Jev judges (not a “case”). |
| `set_jev_questions` | Replaces the typed questions. Real snake_case ids only. `choice` options become `"1"`, `"2"`, … with descriptions as values; `score` is an ordered legend; `noul` is optional `{ true, false }`. Blank ids are dropped, never invented. |
| `ask_jev` | `POST /api/alpha/decisions` with the current state + questions. Only runs when every id is real. Returns probabilities, not prose. |

The server refuses `set_jev_state` / `set_jev_questions` / `POST /api/jev` when the payload is sexual violence, rape, sexual exploitation of minors, or graphic violent harm (Jev has no conscience — it will score whatever is listed). Refund and abuse-risk tickets still work.

**Agentic loop** (LLM pane) runs *N* turns on the current state:

```text
turn 1     LLM ─read_jev_workshop─▶ current pane (before any write)
           LLM ─set_jev_questions─▶ editor
           LLM ─ask_jev───────────▶ Jev ─answers + probabilities─▶ LLM     (forced: tool_choice=ask_jev, then "required" until Jev has answered)
turn 2…N   typed answers are summarized into the next You bubble ─▶ LLM reasons, may re-ask Jev
last turn  LLM writes the operator analysis from Jev’s numbers — it may not invent probabilities
```

Honest shape: only **turn 1 is guaranteed** to hit Jev. Turns 2…*N* run in chat mode with the answers fed back, so the LLM re-asks only when it decides a new option or question is needed. Every request and response is visible in the **Inspector** (LLM pane, off by default): model, mode, tools, the exact Decisions payload, and Jev’s `usage.cost`.

Measured on the **Refund call** preset, 2 turns: one Jev call, 1,725 input tokens, **$0.00007**; `decision` → option 2 at 100%, `policy_allows_full` → P(true) 0.06, `abuse_risk` → 0.98 on a 0–2 legend. Server: `server/llm.ts` (tool loop, max 8 rounds per turn, SSE), `server/jev.ts`, `server/questions.ts`. Client: `src/agenticLoop.ts`, `runAgenticLoop` in `src/App.tsx`.

---

## Run locally

Port **5182** is this app (`127.0.0.1` only, `strictPort`).

```bash
git clone https://github.com/NatersGonnaN8/talk-to-jev.git
cd talk-to-jev
npm install
npm run dev
```

Open [http://127.0.0.1:5182](http://127.0.0.1:5182).

1. **Settings** — paste your OpenRouter key. That writes gitignored **`.env.local`** on the server. The browser never sees the key. Do **not** put it in a `VITE_` variable or in git.
2. **Workshop** — first open is empty. **Preset States** (or **Example Uses**) loads one of ten snaps. **Ask Jev**. Talk in the LLM pane.
3. Optional: **Docs**, **Convert**, **Tour**.

You can also create `.env.local` yourself (same file Settings writes):

```
OPENROUTER_API_KEY=
JEV_MODEL=typesafe/jev-1.13
LLM_MODEL=deepseek/deepseek-v4-flash
```

Empty slots for later (saved only, **not called** in this prototype): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`.

A first-run **Tour** walks the Workshop. Skip once and it stays dismissed. Chrome **Tour** starts it again.

---

## Pages

| Page | Path | What |
|---|---|---|
| **Workshop** | `/` | Jev’s State + LLM + Jev’s Questions. **New State** is empty (not Invoice). **Preset States**, **History** on that row. **Ask Jev** / **Send answers to LLM**. LLM pane: **Random state**, **Agentic loop**, **Propose Jev questions**, **Inspector**. Drop `.md` into Jev’s State; other files open Convert. |
| **Example Uses** | `/use-cases` | Same ten snaps as Preset States. |
| **Docs** | `/docs` | In-repo Jev snapshot. Eyeball = Nice Markdown; code icon = raw. **Update Jev docs** is on this page (not the header). CLI: `npm run update-jev-docs`. |
| **Settings** | `/settings` | BYOK + standing **LLM instructions** (browser only, not a key). |
| **Convert** | `/convert` | txt / html / docx / pdf → markdown **in this browser**. Add to the LLM, add to Jev’s State, or save. |

History is localStorage on this origin (`talk-to-jev:chats`). Not a server. Keys never belong there.

Contract: [`docs/SPEC.md`](docs/SPEC.md).

---

## What it is / isn’t

**Is:** an OSS prototype so you can feel System One next to a cheap LLM, on your laptop, with your key.

**Isn’t:** production SaaS, accounts, billing, search, direct OpenAI/Anthropic calls, OCR, a second weather API, or “Jev the chatbot.” Jev 1.13 is pinned; this app does not silently follow `jev-latest`.

Some floor models put reasoning in a **Thoughts** channel and leave the pane body thin. That is the model, not an app bug.

---

## Security

- Keys live in gitignored `.env.local`. Never commit them.
- The browser never gets raw keys (not HTML, not JS, not `localStorage`, not `/api/health`).
- Bind is `127.0.0.1` only. Cross-site POSTs to `/api/*` are refused (**403**). JSON bodies only (**415**). Cap **2 MiB** (**413**).
- The attacker is **a tab in your browser**, not the public internet.

---

## License

MIT. Copyright (c) 2026 **Nathan Uttley**. See [LICENSE](LICENSE).

The [`docs/jev`](docs/jev/README.md) snapshot is third-party prose (TypeSafe, OpenRouter, Cloudflare, Pydantic) — **not** covered by this MIT license. Refresh it from the Docs page or `npm run update-jev-docs`.
