# Talk to Jev — SPEC

**Status:** v0.46 — 2026-09-20  
**Product:** Talk to Jev  
**Position:** Weekend OSS Workshop — at-a-glance of **how Jev works**; practice LLM + Jev, then go build your own; labeled **prototype** / **inspiration**; not deep serious work, not the last mill  
**Folder:** `C:\Users\uttle\Projects\Talk to Jev`  
**GitHub:** public [`talk-to-jev`](https://github.com/NatersGonnaN8/talk-to-jev) (flipped 2026-09-19 after the §14 security checklist)  
**Local:** Vite UI + API on `http://127.0.0.1:5182` (`strictPort`, bind `127.0.0.1` only)

This file is the contract. Code trails these decisions.

---

## 1. What it is

Talk to Jev is a **weekend OSS Workshop** so you can **see at a glance how Jev works**. Jev is about a week old (as of 2026-09-20). This is **not** the definitive app and **not** deep serious work. It is a labeled **prototype** and **inspiration**: practice working with an **LLM + Jev**, get inspired for **your own apps**, get your feet wet, learn a different type of AI, **then go build it on your own**. Not the last mill, not a claim to beat every higher-level player. People at higher levels will exist; this repo does not have the AI bandwidth to keep up with all of them. Nater (2026-09-20, presenting): not the definitive app; inspiration; not the final answer by any means. Same day (metric for “show a basic preliminary”): weekend Workshop to see at a glance how Jev works; practice LLM + Jev; feet wet; go build it on your own.

An MVP workshop that **wires two different AIs** through **one OpenRouter key**:

| Side | Model (default) | OpenRouter route | Job |
|---|---|---|---|
| **LLM** | `deepseek/deepseek-v4-flash` | `POST /api/v1/chat/completions` | Talk. Draft. **Tools** read the current pane (`read_jev_workshop`), or query one side (`read_jev_state` / `read_jev_questions`), then write Jev’s State and Jev’s Questions. **Random state** invents onto the panes once. **Agentic loop** is the N-turn LLM↔Jev loop on the current panes. Explain answers. Never a JSON dump as the product. |
| **Jev** | `typesafe/jev-1.13` | `POST /api/alpha/decisions` | Typed snap decisions: **choice**, **noul**, **score**. Never prose. |

Jev is TypeSafe’s first **System One** model. It is **not** a chatbot. You send `state` + typed `questions`; it returns `answers` with probabilities. Named after Jevons. Official docs live in this repo under `docs/jev/` and can be refreshed in one click.

The LLM is the cheap prose half. Jev is the cheap decision half. The app is the wire between them.

**Names (2026-09-20).** TypeSafe’s contract is **state** (what Jev judges) + typed **questions**. Official snapshot: `docs/jev/typesafe/concepts/state.md` and `docs/jev/typesafe/introduction.md`. The mill ticket **Jev’s State** is that `state`. Gallery chrome is **Example Uses** (not “Use Cases”) so it does not collide with Jev state. LLM tool **`set_jev_state`** writes that `state` (not a “case”). Questions tool stays `set_jev_questions`. Ask stays `ask_jev`. Combined read stays **`read_jev_workshop`** (current ticket + questions, no args). Split reads (same day): **`read_jev_state`** queries the current Jev’s State ticket only; **`read_jev_questions`** queries Jev’s Questions only. Mill cards: **Jev’s State** / **Jev’s Questions** (same labels as the writes; the tool id is the read vs write). Descriptions use **query**. Do **not** name them `set_jev_case`. Do **not** add a second combined reader. URL query `?case=` stays (preset id, not the tool). Nater (2026-09-20): “Redo set Jev's Case tool, because isn't the state the definitive doc answer from TypeSafe? Isn't it supposed to be the state, not case?” Same day: “add a feature where the llm checks the questions and state before make changes!” Same day: “did you add query current state and query Jev's questions? Did you get that into the tools? Yeah, we're going to need some more tools. I think we should add those.”

**Weather is one use case, not the product.** Nater (2026-09-19): “Weather is literally one use case.” Nine of the ten snaps are **operator / business** decisions. Live conditions come from **Open-Meteo** (free, no API key), fetched server-side, and written into **Jev’s State** **only for the Jacket preset**. Still **one OpenRouter key**.

---

## 2. Non-goals (MVP)

- No TypeSafe-native key (`TYPESAFE_API_KEY`). OpenRouter only.
- No images/audio/video into Jev (Jev is text/JSON only).
- No accounts, no server-side history, no sending threads to a new backend.
- Workshop history is **this browser’s localStorage only** (this machine, this origin). Refresh restores it.
- Standing **LLM instructions** (Settings) persist in this browser’s localStorage (`talk-to-jev:llm-instructions`). They are **not** a secret: not `.env.local`, not a `VITE_` public env, not `/api/settings`. Empty / whitespace-only = off.
- Never persist `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, or any other secret in localStorage / history JSON. Chat history and LLM instructions are local; keys are not.
- OpenAI / Anthropic / Tavily / Brave may be **saved** in Settings (BYOK). They are **not called** in MVP. OpenRouter still powers the LLM and Jev.
- No multi-user, no deploy, no billing UI.
- Do not call Jev via chat completions (that 400s). Do not ask Jev to write poems or code.
- No Jev model picker on the LLM composer or Settings. Jev stays `typesafe/jev-1.13` (or `JEV_MODEL`). The composer select is OpenRouter **chat** models only.
- No second weather API key, no paid weather wrapper. Weather is Open-Meteo (free, no key), server-side only.
- Do not send weather to a third model. Open-Meteo → Jev’s State → Jev / LLM.
- Attached / converted files stay in the **browser**. Do **not** upload them to a new server store, a SaaS converter, write them into `.env` / `.env.local`, or commit user files. Do **not** dump the official `docs/jev/` snapshot into Jev’s State (Docs is the snapshot; attach is **local user files**). PDF convert is **pdf.js text layer only** — no OCR, no images, no cloud.

---

## 3. Auth and models

**Bring your own keys (BYOK).** Keys live on the **server** in gitignored `.env.local`. Never commit that file. The browser never sees raw keys (not in HTML, JS bundles, localStorage, or API JSON). Paste in **Settings** (`/settings`) — that POSTs `/api/settings` and writes `.env.local`. Contributors may copy `env.local.template` (empty values, comments only). Do **not** use `.env.example` as a paste target.

Env names (standard):

| Slot | Env | MVP |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | **Required** for LLM + Jev |
| OpenAI | `OPENAI_API_KEY` | Saved only; unused until direct models land |
| Anthropic | `ANTHROPIC_API_KEY` | Saved only; unused until direct models land |
| Tavily | `TAVILY_API_KEY` | Saved only; unused until search lands |
| Brave | `BRAVE_API_KEY` | Saved only; unused until search lands |

- Never prefix these with `VITE_` (Vite would ship them to the browser).
- `.env.local` **wins** over a Windows user-level `OPENROUTER_API_KEY` (that env var can be stale and 401). Unused slots stay as empty `KEY=` lines.
- `/api/health` returns booleans only (`hasKey` = OpenRouter present; `keys.openrouter|openai|anthropic|tavily|brave`) — never the secret, never a prefix, never last-4.
- `GET /api/settings` returns present/absent plus **last-4** when present. Never the full key.
- `POST /api/settings` writes one slot. Never log the body. Empty `value` clears that slot (writes empty).
- Optional overrides in `.env.local`:
  - `JEV_MODEL` default `typesafe/jev-1.13` (pin; do not silently follow `~typesafe/jev-latest` in MVP)
  - `LLM_MODEL` default `deepseek/deepseek-v4-flash` — **server fallback** when `POST /api/llm` omits `model` or the body id is invalid. Not the operator picker.
- **Workshop LLM chat model** is an OpenRouter chat id, picked in the LLM composer (**left of Send**) and on Settings with the **same persist**. Default **`deepseek/deepseek-v4-flash`**. Persist: `localStorage["talk-to-jev:llm-model"]` (this origin; not git, not `.env.local`, not a `VITE_` env, not `/api/settings`, not `talk-to-jev:chats`). Missing / corrupt / Jev-shaped id → that default. **Not a Jev picker.** Jev stays `typesafe/jev-1.13` (or `JEV_MODEL`). Nater (2026-09-20): “we really, really need is to be able to just quickly and easily change models for the LLM. Obviously Jev is the star but we want to be able to change, so put the little standard model picker right here please, to the left of the send button.”
- If OpenRouter is missing, **Settings** says so and both Ask buttons stay disabled with a reason. Chrome has **no** key-status pill. Never log any key. Never show the full key in the UI.
- **Load weather** and sample presets do **not** need any API key.

Referer headers on outbound OpenRouter calls:

- `HTTP-Referer`: `http://127.0.0.1:5182`
- `X-Title`: `Talk to Jev` (OpenRouter’s documented app-name header)

---

## 4. Jev docs in the repo

### Stored snapshot

`docs/jev/` is a **checked-in snapshot** of official Jev / System One documentation so the app (and the LLM) can know it offline. The snapshot is third-party prose (TypeSafe, OpenRouter, Cloudflare, Pydantic), not covered by this repo's MIT license.

Sources (refresh pulls these):

1. **TypeSafe docs** — crawl `https://docs.typesafe.ai/llms.txt` and fetch every listed `.md` page into `docs/jev/typesafe/…`
2. **jevai.dev** home
3. **OpenRouter** Jev 1.13, Jev latest, and Decisions API reference
4. **TypeSafe launch post** — System One & Jev
5. **Pydantic TypeSafe (Jev)** page
6. **Cloudflare Workers AI Jev** page

Each file starts with a YAML-ish header: `source`, `fetched_at`. `docs/jev/INDEX.md` lists every file, status, and timestamp. `docs/jev/primer.md` is a size-capped concatenation of the conceptual pages used as LLM context.

### One-click update

Two ways, same code (`scripts/update-jev-docs.mjs`):

1. **UI:** **Update Jev docs** on the **Docs** page (`/docs`) — not chrome-right, not a lonely header action. Same `POST /api/docs/update` → rewrite snapshot → toast with counts. After a **successful** update, refresh the Docs list **and** re-fetch the currently selected page (same slug/path, cache-bust so the reader is not leftover bytes). Keep that page selected if it still exists. If it vanished, clear to the empty picker. If the Tour overlay is open, still reload the doc behind it.
2. **CLI:** `npm run update-jev-docs`

Failed fetches are recorded in the index; a partial update is still committed-worthy. The button does not require the OpenRouter key (docs are public).

---

## 5. How the two AIs are wired

Shared **Jev’s State** (the Jev `state`) sits in a ticket strip at the top. Both models see it. This is **not** the **Example Uses** gallery.

| Action | What happens |
|---|---|
| **Ask the LLM** | Chat completions **with tools** (`POST /api/v1/chat/completions`). System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. **Settings LLM instructions** (when saved and non-empty) are prepended **once** in that same system message — not a You bubble, not concatenated onto the user string. Jev’s State text (including any weather block and any **attach** blocks from local files) is the current state. The cheap LLM **must use tools** to mutate the Workshop — it does **not** paste a questions/state JSON blob into the chat as the product. Short confirmation in the thread. |
| **Ask Jev** | Decisions API. **Not an LLM.** `state` = Jev’s State text (same string: situation, weather block, attached blocks), plus optional `{ transcript }` of the LLM thread. `questions` = the editor on **Jev’s Questions**. Settings **LLM instructions** do **not** go on this payload (button or `ask_jev` tool). If any question **id is blank**, show a clear **inline** error on that card and **do not** call Jev. Never silently invent an id (`q_*`, random suffixes, or similar). The LLM may call the same path via the `ask_jev` tool when the editor is **clean**. |
| **Propose questions** | Button **Propose Jev questions** (and chat like “send it to state and propose Jev questions”). Hits `/api/llm` (mode `propose-questions`) so **LLM instructions** apply the same way as Send. The LLM **must** call tools: **`read_jev_workshop` before** any write in that turn; `set_jev_questions` always for this intent; `set_jev_state` when the user asked to write the ticket. Valid maps **replace** the question cards immediately. Chat shows a **short confirmation**, not the JSON. Skip entries with a blank id — do not mint a placeholder. Do **not** call `ask_jev` from this button — leave **Ask Jev** as the click. If the user then **Ask Jev** with a still-blank id, same inline error as above. |
| **Send answers to LLM** | Reverse wire. **Chrome:** **Jev’s Questions** pane-head (`article.pane.jev`), immediately **left of Ask Jev**, same row as the title. **Not** on the LLM pane. Build a user-visible summary of typed answers (choice / noul / score / confidence) and **immediately stream** `/api/llm` on the **same path as Send** (SSE: delta / thought / tool / done) — **LLM instructions** included. Show the You bubble, then mill thinking / the streamed assistant reply. Do **not** park the note for a second Send click. Do **not** insert a canned assistant one-liner. Disabled when there are no Jev answers yet (do not fake a send). FlipTip + `title` when disabled: **Ask Jev first — nothing to send.** When enabled: **Sends Jev’s answers into the LLM thread.** Does **not** go through LLM tools. Nater (2026-09-20): pass immediately to the LLM, same path as hitting Send. Same day: selected the then-**Feed Jev to LLM** control on the LLM pane and said **move this to Jev’s side**. Same day: selected the Jev pane-head ghost and wrote **send answers to LLM** — chrome **Send answers to LLM** (mixed case, capital S, never ALL CAPS). **Random state** analysis and **Agentic loop** later turns use this same send-now path so Jev’s typed answers round-trip into the next LLM turn. |
| **Random state** | LLM pane-head row, **left of Agentic loop**. Label **Random state** (mixed case, Public Sans like `.nav-btn` — not ALL CAPS, not a stamp). Click **runs once** — **no** turn-count popover, **no** “How many turns”. **`read_jev_workshop` first** (empty or leftover is the check) → invents a short scenario → `set_jev_state` → 3–5 mixed questions (`set_jev_questions`) → **stop**. One `/api/llm` invent session carries **LLM instructions**. Does **not** call `ask_jev`. Does **not** send typed answers for analysis. Asking Jev is the mill **Ask Jev** button (and **Agentic loop** if that still asks). Does **not** continue into turn 2…N. Does **not** load a Preset States snap. Unlock when that one-shot finishes or errors. Nater (2026-09-20): split from the bundled mill. Same day: selected the Random You bubble and dropped ask-Jev from this button. |
| **Agentic loop** | LLM pane-head row, **right of Random state**, **left of Propose Jev questions**. Label **Agentic loop** (mixed case, Public Sans like `.nav-btn`). This is the N-turn LLM↔Jev loop **only**. It uses the **current** panes (preset, operator-written, or whatever Random state just invented). It does **not** invent a new random state. Click opens the mill popover: **How many turns do you want to do?** (mixed case, never ALL CAPS) with Public Sans chips **1** through **10** in that order, default **3** (not 1; last pick is not persisted). Opaque mill card, fully on-screen, flip above/below, high z-index. **Confirm** starts N `/api/llm` SSE sessions (each with **LLM instructions**); **Cancel** (or Escape / outside click) aborts — no run. Mill may show **Turn k of N**. Unlock when the loop finishes or errors. If there is no state / no real-id questions: **disable** and mill-warn — do **not** silently invent. Random state is the invent path. Nater (2026-09-20): selected mill option **3** and wrote **add 1 2**. |
| **Load weather** | **Jacket preset only.** Server fetches Open-Meteo for the ticket location. Current conditions + a short forecast are written into a marked **weather block** on Jev’s State. Does not call Jev or the LLM. Hidden on business presets. |
| **Sample state** | One pick (**Preset States** menu **or** Example Uses card) loads the same `src/samples.ts` preset: Jev’s State situation (weather placeholder **only** on Jacket), Jev questions, short label. Clears prior Jev answers and the LLM thread so the last state cannot leak. |
| **New State** | Full Workshop reset to an **empty** Workshop. Saves the open thread if it is worth keeping, then loads **no** Preset States item (not `invoice`, not Jacket, not any other sample id). Clears Jev’s State text, attached `.md` chips, Jev questions (one blank-id noul card), Jev answers, the LLM thread, and weather chrome. Strips `?case=` from the URL. **Preset States** shows none selected. Not History **Clear current**. |

Code owns routing. The UI shows probabilities; it does not pretend a typed answer is “correct.”

**Empty Workshop (first-open with no active thread, and New State):** no sample id. Jev’s State empty (placeholder **What Jev should judge**). One blank-id noul question (same as **Add question**). No Jev answers. Empty LLM thread. Weather row hidden. **Preset States** none selected. **Invoice exception** stays in the catalog — pick it from **Preset States**, Example Uses, or `?case=invoice`. It is not the empty session. Nater (2026-09-20), on **New State**: “somehow this brings it to preset case about the invoices, fix please.” See §12.

### 5.1 Random state — invent once, then stop

A **turn** is one `/api/llm` SSE session: one You bubble plus one assistant stream (thoughts / tool cards / prose). During chat or **Agentic loop**, the LLM may call `read_jev_workshop`, `read_jev_state`, `read_jev_questions`, `set_jev_state`, `set_jev_questions`, and `ask_jev`. **Before** `set_jev_state`, it calls `read_jev_workshop` or `read_jev_state` in that turn. **Before** `set_jev_questions`, it calls `read_jev_workshop` or `read_jev_questions`. Combined read still covers both sides. **`ask_jev` actually POSTs `/api/jev`** (same Decisions path as the **Ask Jev** button). Typed answers apply to the Jev pane immediately. The three read tools do **not** call Jev.

**Random state** is **not** the N-turn loop and **not** Ask Jev. Click runs **one** `/api/llm` invent session, then **stops**. No turn picker. No second analysis SSE.

1. **Invent.** Call **`read_jev_workshop` first** (empty New State or leftover ticket is the check — still call it). Then the LLM invents a **short** imaginary scenario (just enough facts to judge) → `set_jev_state` fills Jev’s State. Then **3–5** atomic questions, **at least one noul, one score, and one choice** → `set_jev_questions` (real **snake_case** ids; choice keys become mill numbers `"1"` / `"2"` / …; **descriptions are free human text** — spaces stay spaces). Mode on this request: `random-case`. Tools on this path: **`read_jev_workshop`, `set_jev_state`, and `set_jev_questions`**. Do **not** call `ask_jev`. Do **not** wait for Jev answers. After tools, a short confirmation — not a novel. Then **stop**. Do **not** continue into turn 2…N. Do **not** ask “How many turns”.

Nater (2026-09-20): selected the Random state You bubble (`pre` inside `div.bubble.user`) and asked to take out the ask-Jev instructions — the LLM was not reliably following them. Asking Jev is the mill **Ask Jev** button (and **Agentic loop** if that still asks).

**Visible You bubble** (the user message; code: `randomStateInventPrompt`):

> Random state. Call read_jev_workshop first (empty or leftover is the check). Invent a short imaginary scenario (just enough to judge), call set_jev_state, then set_jev_questions with 3–5 atomic questions (at least one noul, one score, and one choice; snake_case ids; choice descriptions as human values with spaces — mill numbers are the keys). Do not paste JSON in the chat. Do not start a multi-turn loop.

That prompt must **not** say `ask_jev` / ask Jev / stop after Jev answers / wait for Jev / “do not wait for me” (that last sentence only sequenced `ask_jev`).

Code: `runRandomState` — its own entry point. One invent SSE, then unlock. Do not share a runner flag with Agentic loop. Do not auto-invoke `ask_jev` after tools. Do not auto-send Jev answers for analysis.

Idle pane row shows **Random state**. While this run is in flight the pane slot shows mill thinking (**Thinking**), not Turn k of N. Unlock when the one-shot finishes, errors, or the operator hits composer **Stop**.

### 5.2 Agentic loop — N-turn LLM↔Jev on the current panes

**Agentic loop** is the N-turn loop **only**. It uses whatever is already on the panes: a Preset States snap, operator-written state/questions, or the pane **Random state** just invented. It does **not** invent a new random state (`set_jev_state` must not replace the ticket with fiction). If it will call `set_jev_state` or `set_jev_questions`, it reads first in that turn (`read_jev_workshop`, or `read_jev_state` / `read_jev_questions` for one side). After a read, still do not overwrite the current ticket with fiction.

If Jev’s State is empty **or** there is no real-id question: disable **Agentic loop** and mill-warn (opaque FlipTip / toast: needs state and questions). Do **not** silently call Random state’s invent path.

Click opens the mill popover **How many turns do you want to do?** (mixed case). Options **1–10** as Public Sans mill chips (`1 2 3 … 10`), default selected **3**. Do not default to 1. Do not persist the last pick. Opaque mill card (`#F3E7D3`), fully on-screen, flip, high z-index. Confirm starts; Cancel aborts. Nater (2026-09-20): selected option **3** and wrote **add 1 2**.

Chosen count **N** is **1–10**. The runner must **not** clamp 1 or 2 up to 3. That many `/api/llm` SSE sessions run. Typed answers **round-trip into the next turn**: the next `/api/llm` body includes `jevAnswers`, and the user message is the **Send answers to LLM send-now** note (typed summary streamed on the same path as Send — not a canned assistant one-liner). The operator does not type between turns.

**Random state** and **Agentic loop** stay separate buttons and separate runners. Empty mill still disables Agentic loop.

1. **Turn 1.** Use the **current** state + questions. Call `ask_jev`. Mode on this request: `agentic-loop`. Do not invent a scenario. May call `set_jev_questions` only if the editor is dirty or a new option is needed, then `ask_jev` — and **`read_jev_workshop` before that write**. When **N is 1**, this is the only session — then stop (no later analysis SSE).
2. **Turns 2 … N−1** (only when **N ≥ 3**). LLM may refine questions (`read_jev_workshop` first), `ask_jev` again if it needs a new snap, then reason about the probabilities. Each of these starts with the Send answers to LLM send-now note from the latest answers (mode `chat`). Do not invent a new random state.
3. **Turn N (last)** when **N ≥ 2**. Analysis for the operator. Do not invent Jev answers. Prefer not to call `ask_jev` unless the pane still has none. When **N is 2**, Turn 2 is this last/analysis session.

**Jev awareness (every mill action, including chat):** Jev **cannot invent answers that were not given**. Choice = listed options only (mill numbers + those descriptions). Noul = P(true) in [0, 1]. Score = one of the legend levels. A new option is a new question map: `set_jev_questions` then `ask_jev` again — never claim Jev picked something that was not on the card.

Idle pane row shows **Agentic loop** next to Random state. While the loop is in flight the pane slot shows mill thinking (**Turn k of N**). Unlock when the loop finishes, errors, or the operator hits composer **Stop**.

Code: `runAgenticLoop(n)` — a second entry point, not a flag on `runRandomState`. Tools: `read_jev_workshop` / `read_jev_state` / `read_jev_questions` / `set_jev_state` / `set_jev_questions` / `ask_jev`. Do not add a second combined reader. Do not invent a confirm-before-write UI.

### 5.3 Standing LLM instructions (Settings)

Nater (2026-09-20): “in settings, let there be a user prompt with instructions that is inserted into every message to the LLM, or however it works.”

**Name in UI + SPEC:** **LLM instructions** (not “User prompt”). These are standing operator instructions for the cheap prose model.

**Where they go**

- On every `POST /api/llm` that has a non-empty saved value: include them **once** in the existing OpenRouter **system** message (the mill already builds one system slot with primer / state / questions / mode). Prepend a short labeled block at the **start** of that system content so Inspector’s truncated mill system still shows them.
- Client body field: `instructions` (string). Read from localStorage **at send time** (Workshop stays mounted behind Settings). Whitespace-only is treated as empty and **omitted**.
- Server trims; empty / missing / non-string = off (no extra block). Cap **8,000** characters (slice). Do **not** also concatenate onto each user string (that double-pays tokens). Do **not** unshift a duplicate system message when the mill system already carries the block. Incoming transcript `messages[]` still accepts only `user` / `assistant` — drop client `system` roles so this cannot be smuggled twice.
- **Do not** paste them into the visible LLM thread as a You bubble (or an assistant bubble).

**Where they do not go**

- **Ask Jev** (`POST /api/jev`) and the `ask_jev` tool’s Decisions payload. Jev is not an LLM.
- `.env.local`, `VITE_` env, `/api/settings`, health JSON, chat history JSON (`talk-to-jev:chats`).

**Every LLM entry point** (all share `streamLlm` → `/api/llm`): **Send**, **Send answers to LLM**, **Propose Jev questions**, **Random state** (invent once), **Agentic loop** (every turn). Each of those POSTs the current picker `model` (same persist). Changing the picker does not rewrite in-flight SSE — that turn already sent an id.

**Inspector:** the `/api/llm` client log includes `instructions` when present. The SSE `inspect` `sent` object includes `instructions` (same string) plus the system message that starts with the standing block. Empty / off: no `instructions` field and no extra system section. Never log keys.

### 5.3a LLM chat model picker (composer + Settings)

Nater (2026-09-20) circled the LLM composer, **left of Send**, and asked for the little standard model picker there. **Jev is not this control.**

**Job:** swap the OpenRouter **chat** model for `/api/llm` without opening `.env.local`. Cheap production-capable floor models (DeepSeek Flash, Gemini Flash Lite, Qwen3 32B, …). Do **not** default to an expensive frontier model. Do **not** list `typesafe/jev-1.13` / `typesafe/jev-latest` / any `typesafe/jev*`.

**Chrome**

- **Workshop LLM composer** (`article.pane.llm > form.composer`): native `<select>` immediately **left of Send** (and left of **Stop** while streaming). Textarea stays first (`resize: none`). Compact. Public Sans, mixed case, **never** ALL CAPS, **never** Bricolage. Fragment Mono only for the pane-head model **id** subtitle. User chrome is **pane**, not mill stamp.
- Option labels are short mixed-case names (e.g. **DeepSeek V4 Flash**). Values are OpenRouter ids. Catalog (MVP, cheapest-first after the default pin): `deepseek/deepseek-v4-flash` (default), `deepseek/deepseek-v4.1-flash`, `google/gemini-2.5-flash-lite`, `google/gemini-2.5-flash`, `qwen/qwen3-32b`, `meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4.1-mini`, `anthropic/claude-3.5-haiku`. If persist or `LLM_MODEL` is a valid chat slug not in that list, append it as an extra option (label = id). Do **not** fetch the full OpenRouter catalog in MVP.
- Accessible name **LLM model**. Opaque FlipTip (fully on-screen, flip above/below, pine-ink `#142018`): **OpenRouter chat model for this pane. Jev stays typesafe/jev-1.13.**
- LLM pane-head `<code>` subtitle shows this **picked** chat id (not only the env `LLM_MODEL` from `/api/health`). Jev’s Questions subtitle stays the Jev pin.
- **Settings** (`/settings`): mill card **LLM model** below the key rows, above **LLM instructions**. Same `<select>`, same persist, same catalog — **one source of truth**, not two independent pickers. Change applies immediately (no extra Save). Helper: **OpenRouter chat model for the Workshop LLM. Jev stays pinned.**

**While streaming**

- Picker stays in the composer row, **disabled** (the in-flight `/api/llm` already chose a model). **Stop** stays clickable. Unlock when the stream ends, errors, or Stop. Propose / Random state / Agentic loop / Ask Jev busy uses the same lock as Send.

**Persist / wire**

- Key: `talk-to-jev:llm-model` = the OpenRouter id string. Never a secret. Never write to `.env.local`. Workshop stays mounted behind Settings — both UIs read/write this key (same-tab custom event so they agree without reload).
- `POST /api/llm` body field `model` (string). `streamLlm` sends the picker id on every LLM entry point. Server: valid chat slug wins; omit / empty / invalid / `typesafe/jev*` → `LLM_MODEL` or `deepseek/deepseek-v4-flash`. Inspector **To LLM** logs `model` on the client body and inspect `sent.model`.

### 5.4 Violence gate (2026-09-20)

Nater (2026-09-20): a mill card listed a sexual-violence choice option; Jev put ~39% mass on it vs ~48% on refuse. **YES PLEASE** block that class from the mill. He was **testing**. Do **not** scold the floor LLM in this SPEC, in prompts, or in tool errors.

**Jev has no conscience.** It is System One: it assigns probability over the listed options. If a blocked option is on the card, it will put mass on it. That is expected model behavior, not a Jev bug. The mill must never write those options onto the panes and must never POST them to `/api/jev`.

**Blocked class** (ticket `state`, question ids, instructions, and criteria — including choice option descriptions): sexual violence, rape, sexual exploitation of minors, or graphic violent harm. Do **not** put graphic examples in this SPEC or in tests — abstract fixtures only (category words).

**Narrow:** refund, abuse-risk, chargeback, T&S “kill the post”, and similar **operator / business** tickets stay allowed. Do not treat the words abuse, harm, kill (as take-down), or a violence-policy classification label as this class by themselves.

**Server (source of truth).** Code: `server/violenceGate.ts`.

- `set_jev_state` / `set_jev_questions`: if the payload matches, return a tool error `{ ok: false, code: "blocked-violence", message }`. Do **not** mutate the working copy. Do **not** SSE-apply `state` / `questions`. Panes stay as they were. Tool `message` (to the LLM): **Rejected. Write operator-appropriate questions. Do not list violence as options.**
- `POST /api/jev` and `ask_jev`: same match on ticket `state` + `questions` (**not** the LLM transcript). **400** `{ ok: false, code: "blocked-violence", message }`. Do **not** call OpenRouter / Decisions. Operator `message`: **These questions are not allowed. Use operator-appropriate options — no violence.** Jev’s Questions shows that string as an **inline** error (same `.inline-error` as blank ids) — mixed case, Public Sans, never ALL CAPS. User-facing copy says **questions** / **options**, not mill.
- `callJev` refuses the same class before fetch (backstop so nothing in this class reaches Decisions).

**Prompt (short, not a sermon):** operator-appropriate questions; do not list violence as options. No LLM-shaming.

**Verify** with unit tests on the matcher (`npm test`). Do **not** Ask Jev on a live poisoned card.

---

## 6. Pages

Global chrome (all pages):

- Left: product name **Talk to Jev** (links home Workshop)
- Nav: **Workshop** | **Example Uses** | **Docs** | **Settings** | **Convert**
- **Convert** sits **after** Settings. Visible label **Convert**; `title` and accessible name **Convert to Markdown**. Route `/convert`.
- Right: **Tour** only (Help — restarts the first-run coach overlay). **Update Jev docs** is **not** in the header. It lives on the **Docs** page (§6.2).
- **History is not in chrome-right.** It lives on the **Jev’s State** row only (Workshop). Same local-thread drawer. Chrome-right is **Tour** only. **Inspector** lives on the LLM pane (§6.7), not in chrome. **Update Jev docs** lives on `/docs`.
- **No chrome key-status pill** (no Key ready / Need key / Checking…). Keys live in **Settings** (nav tab + `/settings`). `/api/health` still runs so Ask buttons can lock when OpenRouter is missing. Never show the full key.
- No native textarea resize grips. Pane widths use a custom vertical splitter (quiet mill/pine seam — not a dashed orange hatch). Jev’s State vs the board uses a custom **horizontal** splitter on the shared edge (same mill/pine seam, `row-resize`).
- No native `<dialog>` / iframe for the coach. See §6.4.

### 6.1 Workshop — `/`

**Job:** talk to the LLM, talk to Jev, pass work across the wire.

Layout (desktop):

```
[ chrome ]
[ Jev’s State ticket ]
  [ New State | Preset States | History ]
  [ location field + Load weather ]   ← Jacket only; hidden on business presets
  [ include-chat checkbox ]
  [ Add .md + attached-file chips ]
  [ painted State ticket — click to edit in place ]
  [ drop .md into Jev’s State; convert formats go to the Convert tab ]
[ horizontal splitter — drag grows/shrinks Jev’s State ]
[ LLM pane | vertical splitter | Jev’s Questions pane ]
```

- **Viewport panes (2026-09-20).** Nater selected `article.pane.llm` (measured ~2086px tall vs vh 1243, `overflow: visible`, `maxHeight: none`; window/page grew with the thread). Chrome stays. **Jev’s State** ticket stays **above**. `.board` fills the **remaining viewport** (`100dvh` minus chrome minus ticket) — **not** document-tall. Each pane is a column: **pane-head stays put**. LLM **thread** is the scroller (`overflow-y: auto`). Jev **q-list + answers** share one inner scroller (`.jev-scroll`, `overflow-y: auto`). Window `scrollY` stays ~0 while those lists scroll. Custom panes — no native `resize` grips. Same pattern as Docs `.doc-list`.
- **Ticket / board split (2026-09-20).** Nater drew the shared edge between **Jev’s State** (`section.ticket`) and the board (`section.board` = LLM + Jev’s Questions) and asked for a **drag bar** there. Custom **horizontal** pane-side resizer on that edge — pointer-drag, `role="separator"` `aria-orientation="horizontal"`. Never CSS `resize`, never a native corner grip. Dragging **grows/shrinks Jev’s State height**; the board **fills the leftover workshop column**. LLM and Jev’s Questions stay a **side-by-side row** and both inherit that leftover height. Do **not** grow `document` / window scroll. Existing viewport clip + `.thread` / `.jev-scroll` mill overlay scrollbars stay. Persist integer px in `localStorage["talk-to-jev:ticket-height"]` (this origin). Reload restores it. Corrupt / missing → **314** (the natural ticket height before the bar). Ticket min **220px** (header + tools + some ticket body). Board min **240px** (pane-heads + some thread / questions). When the column is too short for both mins, **board min wins** and the ticket may go below 220. Window resize reclamps the **display** height; it does **not** overwrite the stored desired height. Keyboard on the focused separator: ArrowUp / ArrowLeft shrink the ticket **16px**; ArrowDown / ArrowRight grow it **16px**; Shift multiplies to **64px**; Home / End jump to the current min / max. `aria-valuenow` / `min` / `max` track the ticket height. Visual: same quiet mill/pine seam as the LLM \| Jev splitter — 8px hit target, 1px `--line` rest, mill-floor gutter, `cursor: row-resize`; hover / drag / `:active` widens the seam to pine. No visible label (no ALL CAPS, no Bricolage). Hidden **not** on mobile — only the **vertical** LLM \| Jev splitter hides when panes stack.

**Jev’s State** (the state ticket — **not** Example Uses cards)

- Label: **Jev’s State** (this is Jev’s `state`). Ticket heading is `h2.pane-title` — **same size as Jev’s Questions** (1.05rem / 16.8px, weight 650, letter-spacing 0.01em, mixed case). **Not** an uppercase wide-tracking stamp (`JEV’S STATE`). Nater (2026-09-20): he despises that blocky look. Same day: match pane-title size for same-tier headers.
- Checkbox **Include LLM chat in Jev state** (default on)
- **State tools** row — **three** controls. **Do not** show the ten snaps as a chip row. Nater (2026-09-19): scribble on the Invoice exception … Jacket? pills; replace them.
  1. **New State** — full reset of the Workshop to **empty**: Jev’s State text (blank), attached `.md` chips, Jev questions (one blank-id noul card; do not mint a real id), Jev answers, LLM chat, weather chrome hidden, `?case=` stripped. Save the open thread if it is worth keeping (existing history rule). **No** sample id — **Preset States** shows **none selected**. Do **not** load Invoice exception or any other preset. Include-chat on. Not a half-reset. History **Clear current** still only empties the LLM thread and last Jev answers. Nater (2026-09-20): New State must not bring the invoices preset.
  2. **Preset States** — one pill that opens a list (opaque dropdown / popover — slick, usable, flip fully on-screen). The ten snaps still exist (9 business + Jacket) in `src/samples.ts`. Picking one loads state + questions like today (clears answers + LLM thread, marks that preset selected). Example Uses stays the gallery; both stay in sync via that module.
  3. **History** — opens the local thread drawer. **Only** on this row. Not duplicated top-right.
- **Weather row:** shown **only** when the active preset is **Jacket?** (`jacket`). Location field (default **Columbus, OH**) + **Load weather**. **Hide** the row on the nine business presets (do not leave a disabled weather form that still makes the Workshop look like a weather app). Accepts a city / “City, ST” (Open-Meteo geocoding) or `lat, lon`. Loading does not require the OpenRouter key.
- **State editor (2026-09-20).** Nater selected `textarea.case` (placeholder **What Jev should judge**) and `article.pane.llm`: State showed literal `**Every single day**`; the LLM pane showed literal `**Jev has spoken!**`. Native textarea cannot paint bold. Same day: “when we click into state/vs unfocus it is bad/good” — unfocus (painted cream ticket) is **good**; click-into that dumped raw markdown (`**hello**` asterisks, native textarea cliff) is **bad**. **Ticket (focused and not):** the cream ticket **renders** CommonMark-ish markdown (`**bold**`, italics, lists, links, inline code) through `src/markdown.ts` (`marked` + **DOMPurify** — same sanitizer as Docs Nice, **not** a second Docs iframe). Public Sans for that prose. Fragment Mono only for real `code` / `pre`. Empty ticket shows the placeholder **What Jev should judge**. **Click / focus** puts a caret **in the painted ticket** (`div.case.case-read.md-prose`, `contenteditable`, `resize: none`). Do **not** swap to a raw-source `textarea`. Matching a textarea’s font while still showing `**stars**` is not the bar. Blur serializes painted HTML back to markdown (`fromProseHtml`) and re-paints. Persist is still the **raw markdown string** in `talk-to-jev:chats` (do not store a second HTML copy). **Drop .md** still works on the whole ticket (focused or not). **Load weather** (Jacket only) replaces the marked weather block (or prepends one). LLM + ticket markdown is **untrusted** — never a hand-rolled tag strip. No ALL CAPS. No Bricolage. No TipTap / CodeMirror unless already in `package.json`.
- **Add .md** (file picker, `accept=".md,.markdown,text/markdown"`, multiple): local user markdown is inserted into Jev’s State as `state`. Official `docs/jev/` snapshot stays in Docs; do not auto-insert it. There is **no** Convert to Markdown button on this ticket — that UI lives on the **Convert** tab (§6.6 / §16).
- **Drag-and-drop** onto the whole Jev’s State ticket (painted, focused or not). **Mix:** `.md` / `.markdown` stay on Workshop and go **into Jev’s State**. Convert formats **navigate to `/convert`** (the Convert tab) with **per-file progress**. Do not dump convert UI back into the state row. Unsupported types: inline error on the ticket. See **§15** and **§16**.
- Attached names list near the ticket. Remove one = strip that attach block. Weather / situation text stay.
- Helper: “Jev judges this. The LLM can draft it. Drop .md into Jev’s State. txt / html / docx / pdf go to Convert.” On Jacket only, add: “Weather is Open-Meteo input, not a model.”
- After a successful weather load, a one-line status under the row: resolved place + now summary (e.g. `Columbus, Ohio · 72°F · Partly cloudy`). Toast on failure.
- Size-cap attachments so a huge dump cannot freeze the UI. See **§15**. Convert caps: **§16**.
- Tip on **Add .md** is fully opaque, flip above/below so it stays on-screen. Convert-file tips live on `/convert`.

**LLM pane** (manila / prose)

- Heading: `h2.pane-title` **LLM** (acronym as written) — **same size as Jev’s Questions** (1.05rem / 16.8px, weight 650, letter-spacing 0.01em). Model id is subtitle/meta (`code`), not a second heading — the **picked** OpenRouter chat id from §5.3a (default `deepseek/deepseek-v4-flash`), not Jev’s pin.
- Scrollable transcript (user / assistant) lives in `.thread` — **that** is the pane scroller, not the window. Composer stays under the thread. Assistant turns are **agentic**, not a single JSON dump in the bubble.
- **Chat markdown (2026-09-20).** User and assistant **prose** in `.thread` bubbles renders the same CommonMark-ish markdown (bold, italics, lists, links, inline code) — `marked` then **DOMPurify** (`toProseHtml` in `src/markdown.ts`). Not a Docs Nice iframe. Do **not** dump that prose in a chrome `<pre>` (native pre cannot paint `**bold**`; SPEC §8 `<pre>` is for real code). Thoughts mill, tool cards, and ids stay as now (Fragment Mono only for real code / tool names). Copy/select of rendered text stays usable. Streaming `delta`s re-render incrementally; **do not** yank `.thread` scroll (sticky-follow only near bottom — this section). Public Sans for rendered prose. Never ALL CAPS. Never Bricolage. Composer textarea stays raw markdown while typing (`resize: none`).
- **LLM thread scroll while streaming (2026-09-20).** Nater: “make it so that the LLM, when it streams, doesn't force the scroll to the bottom. Make it so that we can scroll separately from it streaming.” Scroll root is `article.pane.llm` → `div.thread` (`overflow-y: auto`). The pane itself is overflow hidden; `html` / `body` overflow hidden. **Do not** yank `scrollTop` to `scrollHeight` on every stream token, thought, tool card, or content update. **Do not** `scrollIntoView` the last bubble. **Do not** scroll the window. **Sticky follow:** if the operator is already at/near the bottom (distance-from-bottom ≤ **40px**), following new tokens is OK and slick. If they have scrolled up (not near bottom), leave their `scrollTop` alone until they return near the bottom (that re-pins). Same rule when Thoughts expand/collapse during a stream — those height changes must not yank the thread if they are reading above. Starting a new LLM turn (Send / Send answers to LLM / Propose / Random state / an Agentic loop turn) may pin **once** so the new You + assistant pair is in view; after that, only sticky follow. Overlay mill-green scrollbars (`.mill-bar` / `is-on` / `is-fade`) stay. Jev `.jev-scroll` is unchanged. No CSS `resize`. No native grips.
- Composer: textarea (`resize: none`) + compact **LLM model** `<select>` immediately **left of Send** + **Send** when idle; **Stop** (filled square in a circle) in the Send slot while `/api/llm` is streaming. Picker stays left of Stop and is **disabled** for that stream. See **Composer Stop** and §5.3a. Not a Jev picker.
- Secondary pane row: **Random state**, **Agentic loop**, **Propose Jev questions**, **Inspector** (§6.7). **No** Send answers to LLM on this pane. Public Sans like `.nav-btn`. Pane-title size only on headers. Mixed case, never ALL CAPS CSS. Tour spotlights **those four buttons** (left to right) — `data-tutorial` on the real control, not the pane-head and not a ghost `.row-actions` hole. Keep existing `data-tutorial="wire"` on `.row-actions`; that hook is not a Tour step anymore.
- **Random state:** click runs the invent one-shot (§5.1). No popover.
- **Agentic loop** mill popover: **How many turns do you want to do?** Options **1–10**, default **3**. Confirm starts; Cancel aborts. No ALL CAPS. Public Sans chips. Opaque, flip, fully on-screen, high z-index. See §5.2. Disabled / mill-warn when the panes have no state or no real-id questions.
- Empty: “Draft the state, or ask how to phrase a Jev question.”
- **Send** streams `/api/llm` SSE into the open assistant turn. A new turn may pin the thread once so the new pair is in view; streaming tokens must **not** keep forcing the thread to the bottom (sticky follow only — see the scroll contract above). History persist / preset reload must not wipe an in-flight or just-finished turn. **Send answers to LLM** uses this same stream. While that stream is in flight, the composer slot is **Stop**, not a disabled **Thinking…**.
  - `{ type: "thought", text }` — incremental **actual** reasoning from OpenRouter (`reasoning`, `reasoning_content`, or `reasoning_details` text/summary). Accumulate `text`. Never invent thoughts. Encrypted / `[REDACTED]` chunks are not thoughts.
  - `{ type: "delta", text, replace? }` — incremental assistant prose. Accumulate `text` (this is **not** OpenAI `choices[0].delta.content`). If `replace` is true, that turn’s prose becomes `text` (used when a question-list dump is swapped for a short confirmation, or when DeepSeek DSML leaked into a partial stream and the server swaps in the stripped prose). **Never** accumulate DSML / function-call XML into the bubble — the server strips it before `delta` (see **DSML** below).
  - `{ type: "tool", id, name, status: "running"|"done", ok?, argsSummary, resultSummary?, ... }` — apply immediately. On `done` + `ok`, `set_jev_state` / `set_jev_questions` / `ask_jev` still update the ticket, q-cards, or Jev answers. **`read_jev_workshop` / `read_jev_state` / `read_jev_questions` do not mutate** the panes — card only. The **transcript** shows a tool card, not the JSON.
  - `{ type: "error", message }` stays **in that assistant bubble**. `{ type: "done" }` ends the stream.
- **Thinking chrome.** While `/api/llm` is in flight, the open assistant turn shows a slick mill **thinking** state (telegraph stamps + a pine nib on a manila track — custom CSS, not a stock spinner-only afterthought). Show it before the first prose token and while thoughts are streaming. Hide it in the bubble once assistant prose is on screen (tool cards may already be visible). Also show the same mill in the LLM **pane-head slot** (idle that slot is **Random state** + **Agentic loop**, left of **Propose Jev questions**) for the whole in-flight window so it stays on-screen when the last bubble is below the fold. During an **Agentic loop** run the mill label is **Turn k of N**. During **Random state**, Send, or other LLM work the mill label is **Thinking** (Propose uses **Proposing**). `prefers-reduced-motion: reduce` → static pine bar, no motion. Nater (2026-09-20): “add a nice thinking animation to LLM, stream the actual thoughts if possible in a nice collapsible agentic UI, and add nice tool calls as well.” Pane-head mill thinking is **not** the abort control — that is composer **Stop**.
- **Composer Stop (2026-09-20).** Nater selected the LLM composer **Send** (it had become a disabled **Thinking…**) and asked for the usual chat stop: a **square in a circle**.
  - **Idle / empty:** keep **Send** as now. Disabled when the composer is empty, or when Workshop is locked for a missing OpenRouter key or a **non-LLM** busy (Ask Jev / weather). Mixed case, Public Sans, `.btn.solid`. Never ALL CAPS. Never the word THINKING on this control.
  - **Streaming:** while `/api/llm` is in flight through this pane’s LLM busy flag (**Send**, **Send answers to LLM**, **Propose Jev questions**, **Random state**, **Agentic loop**), replace **Send** / **Thinking…** with a **Stop** control in that same composer slot (`article.pane.llm > form.composer`). The **LLM model** select stays **left of Stop** and is **disabled** for that stream (in-flight already chose a model). **Disabled Thinking… is not the stop affordance** — the operator must be able to click Stop. Ask Jev stays **Ask Jev** / **Asking…** on the Jev pane; do not redesign that.
  - **Icon:** filled square inside a circle (ChatGPT / Claude / Cursor-style). The **circle is the button** (`.btn.solid`, mill orange `#E06B2A`, ~32px tall so it sits like Send). The **square is the glyph** (inline SVG, `currentColor` — white on the solid fill). Icon-only face — no **Stop** / **THINKING** word on the button. Accessible name and `title`: **Stop** (mixed case). `type="button"` so it does not submit the form. Focusable; Enter / Space activate. No native CSS `resize`. No Bricolage. No `text-transform: uppercase`.
  - **Click Stop:** abort the in-flight `/api/llm` fetch/SSE with `AbortController` (`streamLlm` takes the signal). Partial assistant text **stays**. Thoughts and tool cards already on that turn stay. Busy ends. Composer returns to **Send**. Do not wipe Jev’s State, questions, answers, or the thread. Do not scroll the window. Thread sticky-follow (this section) is unchanged. Quiet mill toast **Stopped.** — not a modal, not a scary error toast, do not overwrite the assistant bubble with “aborted” / “The user aborted a request”. **Random state** / **Agentic loop:** abort the current SSE **and** do not start the next turn.
  - **Server:** when the client disconnects (Node/Vite request `close`), stop consuming the OpenRouter chat body for that round (abort the upstream fetch). Do not keep burning tokens after Stop. Do **not** change the CSRF gate.
- **Thoughts block.** If any thought text arrived, show a collapsible mill aside (pine left rule, manila fill, Public Sans **Thoughts** — same family as `.nav-btn`, not Fragment Mono). **Open while streaming / still thinking** so live thought text is visible (the operator can still collapse mid-stream). **When that thought group completes** (the mill already reads **Thoughts done** — the same moment `.llm-agent-toggle` leaves the streaming meta: assistant prose started on that bubble, or that bubble’s SSE stream ended): **auto-collapse** that mill. `button.llm-agent-toggle` is `aria-expanded=false`, chevron ▸, body hidden. Default closed once done. The operator may click to expand. Auto-collapse runs **once at the done transition** for that bubble — do **not** re-collapse on later parent re-renders if they opened it. Each assistant bubble is independent (Random state / Agentic loop / multi-turn): a finished thought group collapses when *that* group is done, not only the latest. History restore of a finished turn starts collapsed (already done). Do **not** collapse tool cards (`Jev’s State` / `set_jev_state`, Ask Jev, and the rest) — only `.llm-thoughts`. If the floor model (`deepseek/deepseek-v4-flash` by default) has no reasoning channel, keep thinking chrome and **hide** an empty thoughts block — do not fake copy. Nater (2026-09-20): after a stream finishes, Thoughts often stayed expanded; the mill should start collapsed when done.
- **Tool cards.** Each call is a collapsible mill card: tool name (plus a short human label), stamp Running / Done / Failed, short args summary, short result. Not a questions-map table in the bubble. Propose / “send it to state” must look like `set_jev_*` tool use (and often a **`read_jev_workshop` card first**). Cards persist on the message in History. `ask_jev` and `read_jev_workshop` args summaries read **Current state + questions** (not “case”). `read_jev_state` args: **Current Jev’s State**. `read_jev_questions` args: **Current Jev’s Questions**. Tool **ids** are `read_jev_workshop` / `read_jev_state` / `read_jev_questions` / `set_jev_state` / `set_jev_questions` / `ask_jev`. Human label for `set_jev_state` and `read_jev_state` is **Jev’s State**. Human label for `set_jev_questions` and `read_jev_questions` is **Jev’s Questions**. Human label for `read_jev_workshop` is **Read pane**. Keys never appear on the card.
- **DSML / function-call XML (2026-09-20).** Nater circled DeepSeek DSML in the LLM **pane** (`< | DSML | tool_calls>` / `<|DSML|` / similar fence) and asked: “why are we seeing this instead of nice formatting like everything else?” That markup is **assistant `content`**, not OpenRouter `tool_calls`. The mill already has tool cards (`Jev’s State` / `ask_jev` Done). **Do not** show DSML as grey code, a `pre` dump, or markdown code. Strip it in the **server stream** (`server/dsml.ts` via `server/llm-stream.ts`) so `delta` and the final message never include those tags. If a DSML `invoke` names `ask_jev` / `set_jev_state` / `set_jev_questions` / `read_jev_workshop` / `read_jev_state` / `read_jev_questions` and that tool was **not** already in this round’s `tool_calls`, honor it as that mill tool (card + execute). If it was already executed, **drop the markup only**. Floor models may still emit junk — hide it; do **not** loop. Incomplete fences: hide from the opener to the end of that chunk. Inspector may **note** that DSML was stripped (invoke names only, not the raw XML). Keys never appear. User-facing **pane**. Never ALL CAPS. Public Sans chrome. Do not fold this into the markdown-render pass on the bubble.
- **Inspector** toggle sits in this pane-head (after Propose Jev questions). Mixed case, Public Sans like `.btn.ghost` / `.nav-btn`. Not ALL CAPS. Opaque FlipTip. See §6.7. The log panel is a **fixed bottom overlay** (not a flex sibling of `.board`, so viewport pane-scroll stays). Not chrome-right, not Settings.

**Jev pane** (blueprint / typed) — header `article.pane.jev > header.pane-head`

- Heading: **Jev’s Questions** (not all-caps `JEV`)
- Subtitle / meta: model id (`typesafe/jev-1.13` by default). Keep it as meta, not a second heading.
- Same pane-head row, **right side:** **Send answers to LLM** (ghost) immediately **left of Ask Jev** (solid). Public Sans like `.btn.ghost` / `.nav-btn` — not pane-title size, never ALL CAPS, never Bricolage, Fragment Mono only for the model id.
- **Send answers to LLM.** Reverse wire from this pane. Disabled until there is a Jev result (`title` + opaque FlipTip: **Ask Jev first — nothing to send.** — fully on-screen, flip, pine-ink `#142018`). Enabled `title`: **Sends Jev’s answers into the LLM thread.** Click builds the Jev-answers user message and **immediately POSTs** `/api/llm` (same `sendLlm` / SSE path as **Send**). The composer may stay empty; **Send** stays disabled until they type. Show the You bubble, then mill thinking / streamed assistant reply. Do **not** wait for a second click. Do **not** insert a canned “Got Jev’s typed answers…” assistant line. Do **not** park a You-bubble. **Agentic loop** later turns reuse this send-now path. **Random state** does not — it invents and stops. Nater (2026-09-20): move this to Jev’s side.
- Keep **Ask Jev** (far right of this pane-head).
- Question cards + answers scroll together in `.jev-scroll` under the pane-head (Send answers to LLM + Ask Jev stay put). Do **not** grow `article.pane.jev` past the board.
- Question editor: add / remove questions
  - Fields: id, type (`choice` | `noul` | `score`), instructions
  - **Add question** inserts a new card with an **empty id**. The user types the id. Do **not** auto-generate `q_*` / random suffixes. Only **user-added** cards start blank — presets keep their real ids (`wear_jacket`, business ids, and the rest in `src/samples.ts`). After click, focus the new card’s **id** input (caret ready to type; `document.activeElement` is that field, not the Add question button). `useEffect` + `requestAnimationFrame` on the new card uid. First-open / New State’s already-blank card does **not** steal focus on load.
  - Id input placeholder: `question id` (a hint, not a fake value). The field value stays empty until they type.
  - Question **id** is an editable label, not a React identity. Each q-card keeps a **stable uid** as its React `key` so typing does not remount the input or steal focus (`document.activeElement` must stay the field). Renaming an id updates that card **in place** — do not delete-and-insert under the new string (that remounts after one character). Blank **Add question** still starts with an empty id (internal map key may be `__blank__:uuid`). Nater (2026-09-20): typing into `vendor_claim_valid` / `action` dropped focus after one character because `key={id}`.
  - **Space → `_` (snake_case typing) — question ids only.** ASCII space in the question **id** input becomes `_` as you type (paste included). **Choice option descriptions are free human text** (spaces stay spaces). Do **not** replace space with `_` on those inputs, on LLM `set_jev_questions` apply, or on propose-questions. Instructions textarea stays **prose**. Score level labels stay prose. Noul **keys** stay `true` / `false`; their criteria values stay prose. Nater (2026-09-20): selected Option 1 description (`you've_never_met_het`) and asked “do these need to be snake case? if not, remove snake (_) on space”. They do not. Existing underscored tickets stay until edited — do not mass-mutate.
  - **TypeSafe snapshot (`docs/jev`) — what actually has to be spaceless.** Question **ids** and Choice **option names** (criteria **keys**) are JSON map keys (`questions` / `criteria`). Examples are snake_case with no spaces (`department`, `is_urgent`, `returns`, `wear_jacket`). The autoresearch cookbook slugifies names to `[a-z0-9_]` because they become question ids. The SDK/API does **not** reject spaces in string **values**: `instructions` and option **descriptions** are typically prose (“Which team should handle this?”, “Exchanges, wrong or damaged items”). Workshop does **not** snake-case option description typing — those fields are the values, not keys. Positional keys `"1"`, `"2"`, … stay the keys sent to Jev.
  - New-card defaults (empty editor UX): type `noul`, empty instructions, empty true/false criteria. Switching type to **choice** starts two rows numbered **1** and **2** (empty descriptions). Score stays Low / Medium / High. Noul stays empty true/false criteria.
  - **Choice options: no option-key text box.** Do not mint `option_a` and do not type `1` into an input. Show a slick **1-based number to the left** of each option description (1, 2, 3, 4 — never 0). That number **is** the choice key passed to Jev (`"1"`, `"2"`, …). Users only fill the description. **Add option** appends a new numbered row; remove/reorder keeps numbers in visual order. Each option row keeps a **stable uid** as its React `key` (not the displayed number, not a typed key). LLM `set_jev_questions` may still emit semantic option keys (`refund` / `deny`, `pay` / `hold`); rewrite those to positional numbers **on the card** and **when sending to Jev**. No key field → nothing to steal focus. Nater (2026-09-20): option keys were a second focus-stealing field; positional numbers replace them.
  - **Choice criteria sent to Jev (2026-09-20).** TypeSafe Choice is a map of **option name → description**; both go to the model. Our names are the mill numbers. The Decisions payload must be positional keys → **description text**: `{ "1": "papaya", "2": "banana" }`, never `{ "1": "1" }` (description = key) and never empty values when the card has text. Score still sends ordered legend strings (array). Do not bring back the option-key input. Do **not** snake_case option descriptions.
  - **Add option** after click: focus the **new** row’s description input (`document.activeElement` is `Option N description`, not the Add option button). `useEffect` + `requestAnimationFrame` on the new option uid. Nater (2026-09-20): Add option left focus on the button so he could not type immediately.
  - **Score levels: 1-based in the Workshop (2026-09-20).** Ordered level lines (min 2). Visible indexes on the q-card are **1, 2, 3, …** (never 0) — same human counting as choice mill numbers. **Add level** appends the next human number. TypeSafe Score stays 0-based on `/api/jev` (criteria array; answer `legend` / `probabilities` keys `"0"`, `"1"`, … and `score`); chrome display is wire index + 1. Do not rewrite the Decisions payload to 1-based. Nater (2026-09-20): “these count 0-9, count like a human please.”
  - Noul: optional true / false criteria
  - Blank id on **Ask Jev** (or sending the editor through the propose → ask flow): inline error on the card, do not call Jev, do not invent an id.
- **Ask Jev**
- Answers: one card per question
  - Choice: selected option, probability bars, confidence stamp. Bar labels are **`1 papaya`** (positional number + description) — the same pattern as score **`1 Low`**. Jev’s choice answer is keyed by the option **name** only (`"1"`); it does not return a legend. The Workshop joins the description from the criteria we sent (and persists that as `legend` on the choice answer). Bare `1` / `2` / `3` with no description is a bug.
  - Noul: 0–1 meter (P(true), not a separate confidence)
  - Score: numeric score, level legend, probability bars, confidence (`1 Low` / `2 Medium` / `3 High`). Chrome score stamp and legend keys are **wire + 1**; Inspector JSON and `/api/jev` stay 0-based.
- Usage line: input tokens + cost when OpenRouter returns them
- Empty answers: “Define questions, then ask Jev.”

**Splitters:** custom pane-side resizers — never native handles, never CSS `resize` for layout. `resize: none` stays on textareas.

- **Horizontal (ticket / board).** Shared edge between **Jev’s State** and the LLM + Jev’s Questions board. See **Ticket / board split** above. `cursor: row-resize`. Stays on mobile.
- **Vertical (LLM \| Jev).** Drag the shared vertical edge between LLM and Jev. Nater (2026-09-19): the old style looked like “a sick candy cane” — dashed orange hatch on cream with a pine stripe. **Visual:** a thin, quiet mill/pine divider (hit target stays wide enough to grab). Rest: 1px `--line` seam, mill-floor gutter, `cursor: col-resize`. Hover / while dragging: the seam widens slightly to pine so it reads as a handle — no dashed circus stripe, no orange/blue hatch, no garnish. Hidden on mobile; panes stack full width.

Convert is **not** a third Workshop pane — it is its own tab (§6.6). That page may use the same quiet **vertical** splitter between its file list and preview.

**History** (local threads, overlay drawer — not a permanent sidebar):

- **Jev’s State row History** opens a left drawer over the Workshop (sage mill, like the Docs rail). Backdrop click or Escape closes it. No native resize grips. Drawer behavior (localStorage) is unchanged; only the **opener** moved off chrome-right.
- Chrome-right stays **Tour** only. Do not duplicate History there. Do not put **Update Jev docs** back in the header.
- Drawer **New chat** — same full reset as row **New State**: save the open thread if it has anything worth keeping, then start an **empty** Workshop (no sample id, blank state text, one blank-id question, empty LLM thread, no Jev answers, **Preset States** none selected).
- **Clear current** — empty the open LLM thread and last Jev answers; keep the state ticket, include-chat checkbox, and question editor. This is the half-reset. **New State** is not this.
- Click a past thread to restore it: LLM messages, state text, include-chat, Jev questions (including blank-id `__blank__:…` cards), last Jev answers (if any), jevMeta, and selected sample preset id. Apply the **disk** copy of that thread; do not persist the open empty pane over it first.
- Title: auto from the first user line, else the state’s first line, else “Untitled state”. Optional rename (pencil); a renamed title stays until the user edits it again.
- Each row shows the title plus a timestamp (`updatedAt`).
- Delete one thread (trash). Deleting the open thread returns to the **empty** Workshop (same as **New State**). Deleting the last thread leaves that empty Workshop, not a ghost list item.
- Survives refresh. Reload hydrates the last `activeId` **before** any persist write: Jev’s State, LLM transcript, questions, answers, jevMeta, include-chat. Do **not** mint a new empty thread on boot. Do **not** let a leftover `?case=` replace that restored thread — only an in-session **Preset States** / Example Uses pick (session nonce) loads a preset. New State parks the open thread if it is worth keeping and starts blank **without** destroying other saved chats. Nater (2026-09-20): history for Jev’s State, LLM, and Jev’s questions wasn’t being saved / restored.
- Does not sync across browsers or machines.

**Mobile:** stack State → LLM → Jev. Vertical LLM \| Jev splitter hidden; panes full width. Horizontal ticket / board splitter stays. History drawer uses most of the viewport width.

### 6.2 Docs — `/docs`

**Job:** read the stored Jev docs; refresh them.

Layout:

```
[ chrome ]                                          ← stays; chrome-right = Tour only
[ Docs toolbar — Update Jev docs ]
[ search + sort + type chips (pinned in rail)
  file list scrolls inside the rail  |  [fold] |  reader ]
```

- Left: filterable list from `GET /api/docs` (path, title, source, fetched_at)
- Right: the selected file (`GET /api/docs/file?path=`)
- First paint may flash empty until `GET /api/docs` returns. Empty snapshot (after that fetch): explain **Update Jev docs** on this page / `npm run update-jev-docs`.
- **Viewport rail (2026-09-20).** Nater selected `aside.doc-rail` (measured height ~6131): the rail grew with every snapshot page instead of staying in the viewport. Chrome stays. `main.docs` is a row under chrome filling the **remaining viewport** — **not** document-tall. `aside.doc-rail` is a viewport-height column. Search + sort + type chips stay pinned at the **top of the rail**. The file list (`.doc-list`) is the scroller (`overflow-y: auto`). The reader (Nice / Code / Iframe) fills the remaining column and also stays in the viewport. Custom pane — no native resize grips. If a tip is added on chips/sort: fully on-screen, opaque (FlipTip).
- **Master–detail swipe (2026-09-20).** Classic side master–detail for `aside.doc-rail` vs the reader. A mill chevron on the **shared edge** (custom pane control — **not** a native `resize` grip, **not** `col-resize`): **open** = rail in; **closed** = rail slides out and the reader takes the remaining width. Animate `transform` / width — not a hard jump. `prefers-reduced-motion: reduce` → no motion, still toggles. Persist collapsed in `talk-to-jev:docs-rail`. Accessible: real `<button>`, `aria-expanded`, `aria-controls` the rail, keyboard (Enter/Space). When closed, the rail is `inert` / not tabbable; focus returns to the chevron. Tip on the chevron is opaque and fully on-screen (FlipTip). Default **open**.

**Rail sort + type tags (2026-09-20).** Nater: the Docs rail needs ascending/descending **and** filter tags per doc type — not only Search snapshot plus a flat list.

- **Sort:** custom control (not a native resize grip, not a native `<select>`). Toggles **A→Z** / **Z→A** by **title**, with **path** as the tiebreak. Default A→Z. The list is the sorted result of the current search+tag filter.
- **Type tags:** chips above the list (slick mill/pine — manila/pine ink, not candy). One chip per type that appears in the loaded snapshot, A→Z by type id, with a readable count of pages of that type that also match the current search. Clicking a chip **toggles** it. **Multi-select OR** of types: a page shows if its type is in the active set. Empty tag set = all types. A **Clear** control (only when any tag is on) turns that set empty.
- **Search** still **AND**-filters the visible list (path / title / source) after the type OR.
- **Types are derived from snapshot paths** — do **not** invent a second catalog or hand-maintained map. Rules:
  - Root `primer.md` → `primer`
  - Root `INDEX.md` / `README*` / `manifest.json` → `snapshot`
  - Any path segment `cookbooks` → `cookbook`
  - Any path segment `sdk`, or basename `sdk.md` → `sdk`
  - Otherwise the **first path segment** (`cloudflare`, `openrouter`, `typesafe`, `jevai`, `pydantic`, `typesafe-site`, …)
- **Selected page vs filter:** if the open page still matches search+tags, it stays selected and listed. If the operator filters it out, **keep it in the reader** (do not unload) but **do not list it in the rail** — the list is the filter, not a ghost selected row. Clearing search/tags restores the row, still selected. Clicking another listed page replaces the selection as usual.
- **Persist** this browser: `localStorage["talk-to-jev:docs-rail"]` = `{ v: 1, sort: "asc"|"desc", tags: string[], collapsed: boolean }`. Reload keeps sort + active tags + rail open/closed. Never store keys. Corrupt JSON → A→Z, no tags, rail **open**. Do not prune persisted tags against an empty first-paint catalog (wait until `GET /api/docs` has files).
- Keep `.doc-link` rows in `aside.doc-rail` inside `.doc-list` (the inner scroller). Search / sort / chips are **not** inside that scroller. No native textarea/pane resize on this page. If a tip is added on the rail, it must be opaque and fully on-screen (FlipTip); prefer labeled controls over tips that would clip inside the scrolling rail.
- **View overlay** (sticky, top-right of the document pane — not a second chrome bar): segmented icon buttons. Keep the name **Nice view** (Nater 2026-09-20: calling it Nice view is cute — do not rename).
  1. **Eyeball — Nice view** — rendered Markdown (strip YAML frontmatter; GFM tables/code). **Default.**
  2. **Code view** — snapshot source: raw file in `Fragment Mono` (these pages are markdown).
  3. **Boxed i — Iframe** — the **live source page** in an iframe. Icon is a literal **i in a box** (not a globe / browser chrome cliché). **Only render this control when the page can actually embed.**
- **Iframe src** is the snapshot page’s `source` (catalog `GET /api/docs` and/or the file header). **https only.** If the catalog URL path ends in `.md`, load the same URL **without** `.md` so Mintlify / HTML docs render the live page (the `.md` form is the snapshot fetch). Never put keys in the iframe URL (reject key-shaped query/path). `http:`, `javascript:`, `data:`, and non-URLs do not embed.
- **Hide Iframe when it will not embed (2026-09-20).** Nater: “really slick” — **do not show a dead Iframe control.** Hide the boxed-i button entirely when that page cannot embed: no https source (primer / INDEX / README / manifest / empty); known `X-Frame-Options: DENY` / `SAMEORIGIN` / CSP `frame-ancestors` block from `/api/docs/embed`; or after a **failed embed** for that origin or page. Persist blocks in `localStorage["talk-to-jev:docs-embed-block"]` so we do not keep offering it. Probe on select (before offering the button) — do not flash a control that then vanishes. If the operator is already on Iframe when it fails, **snap back to Nice view** and hide the button. Keep Nice + Code. Do **not** leave the mill “This page won’t embed.” card as the reader (no cream-on-cream empty state, no dead-end default). If a page *can* embed, keep the button.
- **Embed sandbox.** Prefer an **unsandboxed** third-party iframe (separate origin, so it is not an XSS gadget against this origin). Do **not** set `sandbox` so tight it blanks a willing page. Do **not** combine `allow-same-origin` + `allow-scripts` (that would make a sandboxed frame scriptable against our origin).
- The app may **HEAD** (GET if HEAD 405s) that same https catalog URL — **no cookies, no keys** — to read X-Frame-Options / CSP and hide Iframe instead of showing a blank frame. Only probe URLs that already appear as a snapshot `source` (or its live `.md`-stripped form). Private/loopback hosts are refused.
- **Persist** last view in this browser: `localStorage["talk-to-jev:docs-view"]` = `"nice"` \| `"code"` \| `"iframe"`. Default **nice**. Never store keys. Corrupt / missing → nice. If the last mode is iframe and this page cannot embed, **show Nice** (not a blank frame, not the mill dead-end) and leave the stored mode as iframe so the next page that *can* embed still opens live.
- Overlay tips are opaque (`#142018` fill), sit **below** the icons (overlay is at the top; flip would clip under chrome), and stay fully on-screen
- JSON files still get Nice + Code; nice view pretty-prints JSON. Iframe follows the same source rules as markdown pages.
- **Sanitizer (2026-09-20).** Nice-view HTML is `marked` then **DOMPurify** (`src/markdown.ts` `toNiceHtml`). The `docs/jev/` snapshot is untrusted third-party input: XSS on this origin can POST `/api/settings` same-origin (the CSRF gate does not stop same-origin). Use a real sanitizer — never a hand-rolled tag strip list. HTML profile only (no SVG/MathML). Forbid `style`, `form`, `svg`, `base`, `template`; drop `srcdoc` and `data:` URLs. Keep the `toNiceHtml(raw, path)` API so the Docs overlay does not grow a second sanitizer. **Same pipeline for Workshop prose (2026-09-20):** `toProseHtml` is the shared `marked` + DOMPurify path for **LLM user/assistant bubbles** and **Jev’s State read view**. LLM chat and ticket markdown are untrusted the same way. Do not invent a second sanitizer or a Docs Nice iframe for those panes.
- Empty pane (no file yet): no overlay; “Pick a page from the snapshot.”
- **Update Jev docs** is the **primary** control on this page — a Docs toolbar above the rail + reader (stays visible when the rail is collapsed). Mixed case, Public Sans like `.btn.ghost` / `.nav-btn`. Never ALL CAPS. `data-tutorial="update-docs"` (Tour must target this control, not a ghost header button). Click → `POST /api/docs/update` (same snapshotter as `npm run update-jev-docs`). Toast with counts (app-level). After a **successful** update: refetch `GET /api/docs` **and**, if a page is selected, refetch `GET /api/docs/file?path=` for that same path with cache-bust so the reader is not leftover bytes. Stay on that page if it still exists. If the path vanished, clear to the empty picker. If the Tour overlay is open, still reload the doc behind it. **Do not** put this button in chrome-right.
- Empty snapshot: explain this page’s button / `npm run update-jev-docs`

### 6.3 Example Uses — `/use-cases` (`/cases` alias)

**Job:** show the **same ten** sample snaps that Workshop loads — **nine business** + **one weather** (Jacket). One list in `src/samples.ts`. Do not invent a second catalog.

Layout:

```
[ chrome ]
[ manila intro slip — 9 operator snaps + Jacket ]
[ 10 snap cards ]
```

Intro slip: nine operator snaps plus one weather snap. Same list as the Workshop **Preset States** menu. Page title **Example Uses** (`h1.pane-title`) matches **Jev’s Questions** size — not the product mark. Card titles are the same pane-title tier. Kickers (`.eyebrow`, e.g. **Ten snaps**) stay smaller. Jev returns `choice` / `noul` / `score` — not a chatbot. Open-Meteo is optional input on Jacket only.

Each card: **label** (same as the Preset States item), one-line **pitch**, chips for which Jev types it uses (`choice` / `noul` / `score`). The Jacket card may stamp **weather**; business cards do not. Clicking the card (or **Open in Workshop**) goes to `/` with `?case=<id>` and loads **the same preset** as the menu: situation + questions, clear answers + LLM thread, mark that sample selected. Workshop with no `?case=` and no active history thread is the **empty** Workshop (Invoice is not auto-loaded).

The ten ids, labels, and question maps **are §12**. This page is the gallery; Workshop **Preset States** is the compact picker. One module: `src/samples.ts`.

Visual: mill floor, manila cards, blueprint type chips, pine ink. Slick and usable. Tips (type-chip explanations) are **opaque**, stay fully on-screen, and **flip** (below if there is room; above if the card is low — never under sticky chrome). No native resize on this page.

### 6.4 Coach overlay (first-run / Tour)

**Job:** walk a new visitor around the Workshop. Custom product overlay — not a native dialog, not an iframe.

**When it opens**

- First visit on this origin: if `localStorage["talk-to-jev:tutorial-done"]` is unset, open after paint on Workshop.
- Chrome **Tour** restarts from the first available step even after done. Refresh must not nag once Skip or Done has fired.
- Escape matches **Skip**.

**Look and placement**

- `position: fixed`, z-index **above** chrome (20) and History (30) — use **80+**.
- Spotlight / hole around the real control when a target exists (Jev’s State, Ask Jev, etc.).
- Coach **card** is fully opaque (manila `#F3E7D3` or blueprint `#C9DCE8`, pine ink, mill floor). No translucent fill.
- Chrome is sticky at the top, so prefer **below** the target or **center** of the remaining viewport. Flip above only if the card would clip the bottom. Clamp every edge on-screen.
- No native resize grips. Slick: sage mill / manila / blueprint, usable, no garnish.

**Controls:** **Back** / **Next** / **Skip** / **Done** (Done replaces Next on the last available step). Skip and Done both write `talk-to-jev:tutorial-done` = `1`. Never store `OPENROUTER_API_KEY` (or any secret) in this key.

**Steps** (each is independent). If the target is missing because a sibling page/control has not landed, **skip that step** — do not block the tour.

Nater (2026-09-20) selected the four LLM pane-head buttons (left to right) and said: “add these to the tour, 1-2 sentences and sounds like a human not AI.” They sit in the **LLM-pane stretch** after the LLM pane step, before Jev’s Questions — toolbar order, not dumped at the end. Spotlight the **button**, never a ghost pane-head / whole `.row-actions` hole.

Exact live copy + hooks (keep 1:1 with `src/tutorial.ts` / [`docs/TOUR.md`](TOUR.md)):

1. **Welcome** (`welcome`) — no spotlight. *Talk to Jev wires an LLM that chats to Jev which decides using a single OpenRouter key.*
2. **Jev’s State** (`case` → `data-tutorial="case"`). Live body is Nater’s walk copy in `src/tutorial.ts`.
3. **LLM pane** (`llm` → `data-tutorial="llm"`). Tools: `read_jev_workshop`, `read_jev_state`, `read_jev_questions`, `set_jev_state`, `set_jev_questions`, `ask_jev`. Live body is Nater’s walk copy.
4. **Random state** (`random-state` → `data-tutorial="random-state"` on the LLM pane **Random state** `button.btn.ghost` in `.llm-mill-slot`). Title **Random state**. Body: *This invents a short fake ticket so you can try the pane without writing one. It does not call Jev — Ask Jev still does that.* One invent SSE; writes state + 3–5 questions; does **not** call `ask_jev`.
5. **Agentic loop** (`agentic-loop` → `data-tutorial="agentic-loop"` on `button.btn.ghost.mill-loop-btn`, `aria-controls=agentic-loop-popover`). Title **Agentic loop**. Body: *A few LLM turns on this ticket — questions, then Jev, then talk from the numbers. You pick how many (1–10, default 3); empty pane disables it.* Turn 1 forced `ask_jev`.
6. **Propose Jev questions** (`propose-questions` → `data-tutorial="propose-questions"` on that `button.btn.ghost` in `.row-actions`). Title **Propose Jev questions**. Body: *Have the LLM write typed questions for whatever is in Jev’s State right now.*
7. **Inspector** (`inspector` → `data-tutorial="inspector"` on the Inspector `button.btn.ghost`, `aria-controls=dev-inspector`). Title **Inspector**. Body: *The raw To LLM / To Jev payloads. Keys never show up here — Close it if it covers Send.*
8. **Jev’s Questions** (`jev` → `jev` / `ask-jev` / `feed-jev`). Typed `choice` / `noul` / `score` + **Ask Jev**. **Send answers to LLM** sits next to Ask Jev. Live body is Nater’s walk copy.
9. **Example Uses** — nine operator snaps plus one weather snap (Jacket), same list as Workshop **Preset States**.
10. **Docs** — Nice view (rendered Markdown), Code view (raw snapshot), boxed-i Iframe **only when the live page will embed**. **Update Jev docs** is on this page (toolbar), not the header. May navigate to `/docs`.
11. **Settings** BYOK if that page exists (optional later: OpenAI, Anthropic, Tavily, Brave — still no keys in the browser).
12. **Convert** — chrome **Convert** tab (`/convert`). Drop txt / html / docx / pdf here, or onto Jev’s State (that still opens this tab). Files stay in the browser.
13. **History** if the Jev’s State row control exists (not chrome-right).
14. **Load weather** if that control is **visible** (Jacket preset only; Open-Meteo input, not a third model). Skip when the weather row is hidden on a business preset.

There is **no** bundled “Pass work across the wire” step. Keep `data-tutorial="wire"` on `.row-actions` so older hooks still resolve; Tour does not spotlight that wrapper.

**Code:** `src/tutorial.ts` (step list + storage helpers) and `src/TutorialOverlay.tsx`. Hook live controls with `data-tutorial` attributes. Overlay may switch Workshop ↔ Docs for those steps, then continue.

**Copy (2026-09-19):** All overlay walkthrough text lives in **one** module: `src/tutorial.ts` (`TUTORIAL_STEPS` titles/bodies plus `TUTORIAL_UI` chrome/controls). The overlay and the chrome **Tour** button **import** that module — it is the live source of truth, not a dump. Human-readable twin for chat and copy edits: [`docs/TOUR.md`](TOUR.md) (keep 1:1 with `src/tutorial.ts`). Do not leave tour strings inline in `App.tsx`.

**Do not:** use `<dialog>`, an iframe, `resize:` other than `none`, or a translucent card.

### 6.5 Settings — `/settings`

**Job:** BYOK home **and** standing LLM instructions. Paste provider keys. Keys stay on this machine in gitignored `.env.local`. The browser never stores raw keys in localStorage. LLM instructions are **not** a key — they persist in this browser only.

Layout:

```
[ chrome ]
[ manila intro slip ]
[ five key rows ]
[ LLM model mill card ]
[ LLM instructions mill card ]
```

Page title **Settings** (`h1.pane-title`) matches **Jev’s Questions** size. Key-row names, the **LLM model** section title, and the **LLM instructions** section title (`h2.pane-title`) are the same tier. Kicker `.eyebrow` (**Bring your own keys**) stays smaller. Public Sans; mixed case; **never** Bricolage; **never** `text-transform: uppercase`; **never** wide-tracking stamps. Fragment Mono only on real env ids (`OPENROUTER_API_KEY`, …).

Each key row, in this order: **OpenRouter**, **OpenAI**, **Anthropic**, **Tavily**, **Brave**.

- Label + short why (OpenRouter = LLM + Jev today; others unused until search / direct models land)
- Password-style input + **Save** (no native resize grips)
- Status **Key ready** / **missing** without revealing the value. Ready may show last-4 only
- Tips (status / last-4 help) are **opaque**, fully on-screen, and **flip** (below if there is room; above if the row is low — never under sticky chrome)

Saving one key row POSTs `/api/settings` `{ id, value }` and writes that env var on the server. Empty save clears the slot. Clear the input after a successful save. OpenRouter still powers LLM + Jev; do not wire Tavily / Brave / OpenAI / Anthropic live calls in MVP.

**LLM model** (mill card below the key list, above **LLM instructions** — same card chrome as a key row, not a second page):

- Heading **LLM model** (`h2.pane-title`, same size as OpenRouter / Settings).
- Helper (Public Sans, mute, like `.key-why`): **OpenRouter chat model for the Workshop LLM. Jev stays pinned.**
- Native `<select>` — **same catalog and persist as the composer picker** (`talk-to-jev:llm-model`). Immediate write on change (no Save). Public Sans, mixed case, `resize: none` on any sibling textarea. Opaque FlipTip, fully on-screen, flip. Do **not** fork a second independent picker. Do **not** put Jev ids here. See §5.3a.

**LLM instructions** (mill card below **LLM model** — same card chrome as a key row, not a second page):

- Heading **LLM instructions** (`h2.pane-title`, same size as OpenRouter / Settings).
- Helper (Public Sans, mute, like `.key-why`): **These go with every LLM request. They are not shown as chat bubbles.**
- Multiline textarea, Public Sans, mill/manila field (`#fffdf8`), `resize: none` (no native grip). Overlay mill-green scrollbars if it overflows (§8.1). Cap **8,000** characters.
- **Save** (explicit, same solid button as key rows — not save-on-blur). After save, the textarea **keeps** the text (unlike key inputs, which clear). Empty or whitespace-only save = off: remove the persist key and leave the field blank. Toast: **LLM instructions saved.** / **LLM instructions cleared.**
- Persist: `localStorage["talk-to-jev:llm-instructions"]` = the trimmed string. Missing / corrupt / whitespace = off. Never write this to `.env.local`. Never a `VITE_` env. Unsaved draft in the textarea does **not** apply until **Save**.
- Reload Settings: the saved text is still there. Workshop reads the persist on each `/api/llm` send, so a Settings save applies to the next Send without a full page reload.

**No payload inspector here.** Logs live on the Workshop LLM pane (§6.7). Never log `POST /api/settings` bodies. LLM instructions may appear in Inspector **To LLM** (they are not a key) — still scrub key-shaped substrings.

### 6.6 Convert — `/convert`

Nater (2026-09-19): “Move the Convert to Markdown button to a separate tab at the top next to Settings.” Chrome order is Settings, then **Convert**.

**Job:** turn local txt / html / docx / pdf into markdown **in this browser**. Then **Add to the LLM**, **Add to Jev’s State**, **Download**, or **Save as MD**. Files never leave the machine.

Layout:

```
[ chrome ]
[ manila intro slip ]
[ drop / choose files | quiet splitter | preview + actions ]
```

- Full Convert to Markdown UI — not a half-pane on Workshop, not a button on Jev’s State. Page title **Convert to Markdown** (`h1.pane-title`) and pane heads **Files** / **Markdown** (`h2.pane-title`) match **Jev’s Questions** size. Kicker `.eyebrow` (**In this browser**) stays smaller. Pane-head subtitles (format names, “in this browser · files stay here”) are Public Sans `.pane-meta` — **not** `<code>` / Fragment Mono. Workshop model ids stay `<code>`.
- Drop zone + file picker (`accept` for `.txt,.html,.htm,.docx,.pdf,.doc` plus matching MIME types, `multiple`).
- Per-file progress. 64k / 32k TypeSafe note. Preview textarea `resize: none`.
- Actions on the selected resulting MD: **Add to the LLM** / **Add to Jev’s State** / **Download** / **Save as MD**.
- Quiet custom splitter between the file list and the preview (same mill/pine seam as Workshop). Hidden on mobile; stack.
- Tips opaque, flip, fully on-screen.
- Leave via chrome nav. Jobs stay if the operator switches tabs and comes back (Workshop stays mounted too).
- Dropping convert formats onto **Jev’s State** still **navigates here** with those files queued. `.md` on Jev’s State never opens this tab.

Libraries, caps, and never-list: **§16**.

### 6.7 Inspector (LLM pane)

Nater (2026-09-20): always log LLM and Jev payloads; inspector **hidden by default**; toggle to show; logs persist; never show API keys. Toggle lives on the **LLM pane** (Workshop mill) — not chrome-right, not Settings. Visible name is **Inspector** (not Payloads).

**Toggle**

- LLM pane-head, **after** Propose Jev questions (Send answers to LLM lives on Jev’s Questions, left of Ask Jev). Label **Inspector** (mixed case, Public Sans like `.nav-btn` / `.btn.ghost` — not ALL CAPS, not a stamp, not Bricolage). `aria-pressed` tracks open. `aria-controls` the panel. Opaque FlipTip (fully on-screen, flip above/below, pine-ink fill `#142018`): “Always recording. Keys never appear here.”
- Default **closed**. Do **not** persist open — refresh starts hidden. The toggle itself stays visible so the operator can open it.
- Escape closes the panel when Tour is not open.

**Panel** (only in the DOM while open)

- **Fixed bottom overlay** (`position: fixed`, z-index above Workshop chrome). **Not** a flex sibling of `.board` — viewport pane-scroll (`100dvh` minus chrome minus ticket) stays. Not chrome-right, not Settings.
- Heading **Inspector** is `h2.pane-title` (same size as **LLM** / **Jev’s Questions**). Column labels **To LLM** / **To Jev** are kickers (`.eyebrow`, Public Sans, smaller than pane-title) — not a second display face.
- Custom **top-edge** resizer (no native `resize` grip, no CSS `resize`). Height may persist (`talk-to-jev:dev-inspector-height`). Two columns scroll inside.
- Two columns: **To LLM** (manila) and **To Jev** (blueprint). Newest first. Each call: time, title, request JSON, response JSON (or error). JSON is **Fragment Mono**. Kickers / stamps / buttons are Public Sans.
- **Clear** empties the persist. Empty copy: recording continues while the panel is closed.
- `ask_jev` from the LLM tool loop appears under **To Jev** (same `/api/jev` shape as the Ask Jev button).

**Always record** (even while hidden)

- Every `POST /api/llm` and `POST /api/jev` from this origin. LLM SSE may also emit `{ type: "inspect", channel: "llm"|"jev", phase: "request"|"response", title?, sent?, received? }` so the viewer can see the upstream OpenRouter / Decisions shape (primer truncated, with a char count). The client log still keeps the `/api/llm` or `/api/jev` body.
- Persist: `localStorage["talk-to-jev:dev-logs"]` = `{ v: 1, calls: DevCall[] }`. Cap **40** calls. Drop oldest on quota. Corrupt / missing → empty list. Never store keys.
- Scrub before persist **and** before paint: `sk-or-`, `sk-ant-`, `sk-proj-`, `tvly-`, `BSA…`, `ghp_`, `github_pat_`, `AKIA`, `Bearer` tokens, Authorization / `api_key` / `secret` fields, env assignments (`OPENROUTER_API_KEY=…`). Replace the **whole** match with `[redacted]` — do **not** keep last-4 in the log body. Do not log `POST /api/settings`. Settings last-4 stays on `/settings` only.
- Logged vs not:
  - **Logged (redacted):** `/api/llm` request `{ messages, state, questions, jevAnswers, includeTranscript, mode, model, instructions? }` and a useful response (reply / thoughts char count / tool summaries, plus inspect `sent`/`received` when the server emits it — `sent.model` is the OpenRouter chat id actually used; `sent.instructions` when standing instructions are on). When DeepSeek DSML was stripped from assistant content, the LLM call’s response may include `dsml: { note, invokes }` (names only — not the raw fence). `/api/jev` request `{ state, questions, transcript?, includeTranscript? }` and response `{ ok, model, answers, usage }` or `{ ok: false, message }`. No `instructions` on Jev. Jev `model` is the Decisions pin, not the composer picker.
  - **Never logged:** API keys, `.env.local`, Settings POST bodies, health/settings last-4, Authorization headers.

**Do not** put this control on Settings. **Do not** put it in chrome-right (that stays **Tour** only). **Update Jev docs** is on `/docs`, not here.

---

## 7. API (local Vite middleware)

All JSON unless noted. Never echo the API key. Never dump upstream bodies that might contain secrets. Bind `127.0.0.1` only; do **not** set wide-open CORS (`Access-Control-Allow-Origin: *`). Same-origin UI does not need CORS.

**CSRF gate (2026-09-19).** `cors: false` only stops other sites from *reading* responses; a malicious page in the operator's browser can still *send* a preflight-free POST to `127.0.0.1:5182` and swap the OpenRouter key or burn credits. So every `/api/*` request is refused with **403** when `Sec-Fetch-Site` is present and not `same-origin` / `none`, or when `Origin` is present and is not `http(s)://<Host>` (Host is trusted because Vite `allowedHosts` already 403s foreign hosts). POST bodies must be `Content-Type: application/json` or the server returns **415** (cross-site preflight-free POSTs can only be `text/plain` / form types). Requests with neither header (curl, address bar, same-origin GET) pass. Never relax this to `Access-Control-Allow-Origin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, hasKey, keys: { openrouter, openai, anthropic, tavily, brave }, jevModel, llmModel, docs: { files, fetchedAt } }`. All key fields are booleans. `hasKey` === `keys.openrouter`. Never last-4, never the secret. |
| GET | `/api/settings` | `{ ok, keys: [{ id, env, label, why, required, present, last4 }] }`. `last4` is four characters or `null`. Never the full key. May append empty unused slots to `.env.local` (does not change existing values). |
| POST | `/api/settings` | Body `{ id, value }`. `id` is `openrouter` \| `openai` \| `anthropic` \| `tavily` \| `brave`. Writes `.env.local`. Empty `value` clears that key. Response same shape as GET. **Never log the body.** Never echo `value`. |
| POST | `/api/llm` | Body: `{ messages, state, questions?, jevAnswers?, includeTranscript?, mode?: "chat" \| "propose-questions" \| "random-case" \| "agentic-loop", model?, instructions? }`. `model` is the OpenRouter **chat** id from the composer / Settings picker (§5.3a). Omit / empty / invalid / `typesafe/jev*` → `LLM_MODEL` or `deepseek/deepseek-v4-flash`. Never send Jev on this route. `instructions` is the trimmed Settings **LLM instructions** string (omit or empty = off; cap 8,000). The server prepends it **once** to the mill **system** message — never a user message, never onto each user string, never onto `/api/jev`. Streams `text/event-stream`. Server runs an OpenRouter **tool loop** (key stays server-side). OpenRouter chat is requested with `stream: true` so thoughts and tokens can paint mid-round. Send `include_reasoning: true` (legacy; same as `reasoning: {}`) so models that expose reasoning will; if that 400s, retry the round without it. Do **not** send a high `reasoning.effort` on the cheap floor model. Each SSE `data` line is JSON: `{ type: "thought", text }` (omit if the model streams none — never fake), `{ type: "delta", text, replace? }` (`replace: true` replaces that turn’s accumulated prose), `{ type: "tool", id, name, status: "running"\|"done", ok?, argsSummary, resultSummary?, state?, questions?, answers?, model?, usage?, message? }`, `{ type: "inspect", channel: "llm"\|"jev", phase: "request"\|"response", title?, sent?, received? }` (redacted payload log — no keys; primer truncated), `{ type: "error", message }`, `{ type: "done" }`. Emit `status: "running"` when a tool’s arguments are ready, then `status: "done"` after execute (same `id`). Tool names: `read_jev_workshop`, `read_jev_state`, `read_jev_questions`, `set_jev_state`, `set_jev_questions`, `ask_jev`. `read_jev_workshop` is offered on every `/api/llm` mode (`chat`, `propose-questions`, `random-case`, `agentic-loop`); the server fills it from this request’s `state` + `questions` (no extra OpenRouter or Decisions call). `read_jev_state` and `read_jev_questions` are the one-sided query tools on that same live schema. `random-case` still does not offer `ask_jev`. `ask_jev` reuses the Decisions call (`POST /api/jev` path). Include latest `jevAnswers` on later turns so results round-trip. `argsSummary` / `resultSummary` are short (ids, char counts) — not a questions JSON dump. Never echo the key. Never dump a questions map as the chat product. The browser always records scrubbed `/api/llm` and nested `/api/jev` shapes in `talk-to-jev:dev-logs` (§6.7). **Composer Stop / client disconnect:** aborting the browser fetch (or the Node/Vite request `close`) ends this SSE. The mill must abort the in-flight OpenRouter chat fetch for that round so it stops eating the upstream body. Do not emit a scary `{ type: "error" }` for a user abort. Do **not** change the CSRF gate. |
| POST | `/api/jev` | Body: `{ state, questions, transcript? }`. JSON Decisions response (or `{ ok:false, message }`). Same path the `ask_jev` tool uses. If ticket `state` or `questions` match the §5.4 violence class: **400** `{ ok: false, code: "blocked-violence", message }` — do **not** call OpenRouter. Transcript is not part of the match. |
| GET | `/api/docs` | Index of snapshot files |
| GET | `/api/docs/file` | Query `path` relative to `docs/jev`. Reject `..` |
| GET | `/api/docs/embed` | Query `url` = the live https source. `{ ok, embed, src }`. `embed: false` when X-Frame-Options / CSP would blank the iframe, or the URL is not a catalog source. No keys. |
| POST | `/api/docs/update` | Run the snapshotter; return `{ ok, fetched, failed, files }` |
| GET | `/api/weather` | Open-Meteo proxy. Query `q` (city or `lat,lon`) or `latitude`+`longitude`. Default `q=Columbus, OH`. Returns `{ ok, place, current, daily, hourly, text, json }`. `text` is the Jev’s State weather block. No OpenRouter key. |
| GET | `/api/geo` | Open-Meteo geocoding helper. Query `q`. Returns `{ ok, results: [{ name, admin1, country, latitude, longitude }] }`. Optional; **Load weather** may geocode internally. |

Errors: 403 cross-site, 413 body over **2 MiB**, 415 non-JSON body, 501 missing key, 400 bad body (including §5.4 `blocked-violence`), 404 unknown place, 502 upstream. Messages may say “Jev request failed” without dumping upstream secrets. Weather errors must not mention OpenRouter. `POST /api/jev` and `POST /api/llm` return 501 when the key is missing. Error strings that look like keys (`Bearer`, `sk-or-`, `OPENROUTER_API_KEY`) are replaced with a generic failure. Jev success JSON is `ok`, `model`, `answers`, `usage` — do not spread the raw upstream object.

---

## 8. Visual bar

Workshop, not a generic AI dashboard.

- Floor: sage mill `#DCE6D8`
- Ink: `#142018`
- LLM slip: manila `#F3E7D3`
- Jev slip: blueprint `#C9DCE8`
- Wire / pine: `#2F5D4A`
- Probability fill: industrial orange `#E06B2A`
- Type (Nater 2026-09-20, size match this message):
  - **Two families only.** Load **Public Sans** and **Fragment Mono** — nothing else. Tokens: `--font-ui: "Public Sans", sans-serif` and `--font-code: "Fragment Mono", monospace`. Generic fallbacks `sans-serif` / `monospace` after those names are OK. Do **not** add Inter, system-ui, ui-sans, Georgia, or any third look. Google Fonts `<link>` / CSS `@import` request **only** those two families. Do not load a third face “just for the wordmark.”
  - **Product mark** — `a.mark` “Talk to Jev”: Public Sans, **1.25rem / 20px**, weight **700**, letter-spacing **-0.03em**, mixed case. Higher tier. Do **not** shrink it to pane-title size.
  - **Same-tier headers** — `h2.pane-title` “Jev’s Questions” is the size reference: Public Sans, **1.05rem / 16.8px**, weight **650**, letter-spacing **0.01em**, mixed case (`text-transform: none`). Same tier = other pane titles and page/section headers: LLM pane **LLM**, ticket **Jev’s State**, LLM **Inspector** panel heading, Convert **Files** / **Markdown**, History drawer title, Tour card titles, page titles **Example Uses** / **Settings** / **Convert to Markdown**, Example Uses card titles, Settings key names, Settings **LLM model**, Settings **LLM instructions**. Do **not** bump body, `.nav-btn`, or buttons to this size.
  - **Everything else** — Public Sans like `.nav-btn` (Workshop, Example Uses, Docs): LLM chat (rendered markdown prose in bubbles), Jev’s State ticket prose (focused or not), question instructions, chrome labels, chips, kickers, mill labels, option mill numbers, Convert pane-head `.pane-meta`, Inspector column labels **To LLM** / **To Jev**. Kickers (`.eyebrow`) stay **smaller** than pane-title (mixed case, ~0.78rem, weight ~650, tracking ~0.01em).
  - **Fragment Mono** only for **real code**: question ids, model ids, env names, JSON (including Inspector request/response), Docs Code view, markdown `code`/`pre`, convert preview. Not for product chrome labels, thoughts kickers, type chips, stamps, Inspector chrome, or Convert pane-head helpers. `<code>` / `<pre>` wrap real code only — do not use them as a chrome wrapper.
  - **Never stylistic ALL CAPS** — no `text-transform: uppercase` on UI chrome. Acronyms as written (LLM, JSON, API) are fine.
- **Never font** (Nater 2026-09-20): **Bricolage Grotesque** is banned. So are **Cabinet Grotesk**, **Fraunces**, and that **whole blocky style** — quirky/wonky/naive grotesques, and all-caps + wide-tracking UI chrome. Do not load Bricolage “just for the wordmark.”

### 8.1 Scrollbars (Nater 2026-09-20)

Nater despises the **white Windows native track** on Jev’s State, the LLM thread, and Jev’s Questions. No Talk to Jev scroller may show that chrome.

**Where:** every overflow scroller — Workshop (Jev’s State editor — `.case.case-read` painted ticket, `.thread`, `.jev-scroll`, composer / question textareas, thoughts), Docs (`.doc-list`, Nice / Code `.doc-view`, `pre` in Nice view), Convert (file list + preview), Settings / Example Uses if the page scrolls, History drawer, Preset States / Agentic loop popovers, Inspector lists + JSON, tour if it scrolls. Horizontal overflow gets the same treatment (arrows left/right). Native `resize` stays `none`.

**Paint:**

- **Track / gutter:** fully invisible. Transparent. No white, no grey trough, no reserved `scrollbar-gutter` that shoves layout.
- **Thumb and arrow buttons:** mill green. Wish color is `--floor` (`#dce6d8`, the Jev’s Questions / app wash). Pure `--floor` vanishes on the Jev pane (also floor). **One token for every bar:** `--scroll-thumb: color-mix(in srgb, var(--floor) 30%, var(--pine) 70%)` — still that mill green, darkened toward `--pine` (`#2f5d4a`) just enough to grab on floor **and** manila. Never white / grey Windows chrome. Never a rainbow of thumbs.
- Arrow glyphs (the chevron) may use `--ink` so the triangle reads on the green button. Button fill stays `--scroll-thumb`.

**Visibility (required, not optional)** — Nater (2026-09-20, first): “All of the scroll buttons need to have their disappear logic not tied to my use of that certain window or tab or modal or whatever, but connected to the actual space that the scrollbar takes up itself, okay?” Then: **“scroll bars i mean”** — overlay `.mill-bar` (track + thumb + `.mill-bar-arrow` buttons), not other chrome. Same day, after ddbfd03 / bc2770f: “The mouseover logic isn't connected to the scrollbar area itself. It's connected to the whole entire modal, or whatever's in that scroll area. You didn't fix it.” Rest-state `pointer-events: none` on `.mill-bar` made the ~14px gutter untouchable, so the only reveal path was scrolling **whatever is in that overflow box**. That is not the contract. Same day, selected `div.mill-bar-track` (LLM pane Y overlay) while the bar was `is-on` and he was in the LLM chat, not on the gutter: “this still has a bug where if I click into this module ... then the scroll bar stays even if I move my mouse. the mouseover scroll bar stay logic should only be tied to the bar area itself, not the div or anything else. FIX IT” Then: **“actually pane is better!!”** — user-facing name for those board regions is **pane** (not module, not mill). Click-in-**pane** must not pin.

- **Hover / hold / fade host is the overlay strip’s own box** (~14px: arrows + track + thumb). That box is **hoverable even when faded** (`opacity: 0`). Whenever that axis is needed (`display: flex`), `.mill-bar` has `pointer-events: auto` and an explicit **14px** width (Y) / height (X) — never a full-pane hit box. It is **not** the overflow host, Inspector body, tab, pane, window, `.thread`, `.jev-scroll`, or `.mill-scroll-root`.
- Default: thumb + arrows **opacity 0** (fully gone). Track stays invisible. The 14px strip still hit-tests (`elementFromPoint` on the gutter returns `.mill-bar` or a child).
- **Stay / pin / postpone-fade only while the pointer is inside that axis’s overlay bar box.** Hovering pane **content** (chat text, Jev questions, Settings keys, Docs prose, Inspector body/text) must **not** reveal, pin, or postpone fade.
- **Click into the LLM pane / Jev pane / Inspector body** (or focus a bubble / composer) must **not** leave the bar `is-on`. After that click, moving the mouse still inside that pane but **off** the 14px strip starts the **1.0s hold then 1.0s fade** — same as never clicking. Do **not** treat `:focus-within`, host scroller hover, `pointerenter` on `.thread` / `.jev-scroll` / `article.pane`, or a sticky `hover` flag as pin. Click-induced `scroll` / `scrollIntoView` may **flash** then `scheduleHide` unless `elementFromPoint` is inside **that** `.mill-bar`.
- **Enter the strip** → `is-on`. Stay while the pointer is inside that same `.mill-bar` (arrow ↔ thumb: `relatedTarget` still inside → do not start fade). Reconcile on `pointermove` / `pointerdown` with `elementFromPoint` against **that** `.mill-bar` so a lost `pointerleave` cannot stick `is-on`.
- **Leave the strip onto pane content** → stay **fully opaque for 1.0s**, then **fade to opacity 0 over the next 1.0s**, even if the pointer is still inside the pane / Inspector / modal. Do **not** cancel that fade because they are still over the scrollable content. Moving around in the pane must **not** restart those timers. No other timings. Do **not** restart those timers because Inspector/modal is open or they switched tab. Leaving the pane is **not** the fade trigger; leaving the **bar** is.
- **Show** on scroll (wheel / trackpad / drag / keyboard-driven `scroll`) of **that scroller** is still OK (brief `is-on`), then `scheduleHide` **unless** the pointer is inside **that axis’s** `.mill-bar` (`elementFromPoint` on the live pointer — not a leftover hover flag, not last-known point on the gutter after they clicked the pane). Wheel on pane content must **not** keep bars pinned after the flash+hold if the pointer is not on the strip.
- Hit testing: `pointerenter` / `pointerleave` on **that** `.mill-bar` only, plus document `pointermove` / `pointerdown` to keep that flag honest. No pointerenter / leave / mouseenter on `.thread`, `.jev-scroll`, Inspector overlay, page, host scroller, or `.mill-scroll-root`. `.mill-scroll-root` stays `pointer-events: none`; only the bar children capture. Clicks on pane content **besides** that strip still pass through. Do **not** use `document` / `window` / `visibilitychange` / tab as the hide host.
- Applies to **every** overlay bar in the app (LLM `.thread`, Jev’s Questions `.jev-scroll`, Jev’s State if it overflows, Settings, Docs, Convert, Inspector, History, popovers).
- **Names:** user-facing board regions are **pane** / **panes** (LLM pane, Jev pane). Internal class `.mill-bar` / `#mill-scroll-root` and mill-green token `--scroll-thumb` stay. Do not rename Jev’s State / Jev’s Questions / Random state.

**Implementation:** custom **overlay** bars (thumb + top/bottom arrows; left/right when `overflow-x` scrolls). Chromium `::-webkit-scrollbar-button` cannot do transparent track + green thumb + green arrows + 1s hold + 1s fade. Hide native bars (`scrollbar-width: none`, webkit width 0). Overlay does not reserve a white gutter. Click arrow to step, drag thumb, click track to page. Keyboard still scrolls the real overflow element. Dedicated CSS/JS (`src/scrollbars.css`, `src/scrollbars.ts`) — do not fold this into unrelated inspector styles. Public Sans is unused on bars. Native `resize` stays `none`. No ALL CAPS.

Signature: **Jev’s State** as a physical slip the two instruments share. Probability is a filled bar, not a pie.

Slick = sharp, usable, no garnish. Tooltips (if any) stay fully on-screen, opaque, flip placement. The Workshop pane splitter is a **quiet divider**, not decoration.

---

## 9. LLM system contract

The LLM is the **draft** half. Tools mutate the Workshop. Jev is System One (probabilities). Do not fake Jev answers in chat unless `ask_jev` ran.

The LLM is told, every request:

- It is the prose half of Talk to Jev, not Jev.
- Jev does not chat. Propose **atomic** questions (one snap judgment each).
- Prefer many small questions in one Jev call.
- Question ids are for code; put the full question in `instructions`. Never empty ids (`q_*` placeholders, `__blank__:`, or blank keys). Skip those entries — do not invent an id.
- It has **tools**. Use them. Do **not** paste state JSON or a questions map into the chat as the product.
  1. **`read_jev_workshop`** — no args (`{}`). Returns the **current** Jev’s State text + current questions map as the panes have them (same shapes the write tools consume). Server reads `state` + `questions` from this `/api/llm` body (working copy). Does **not** hit OpenRouter. Does **not** call Jev. Does **not** mutate panes. Inspector / bubble human label: **Read pane**. Args summary: **Current state + questions**. Keys never appear. Combined check before a write that needs both sides (empty New State invent: still OK to read; empty is the check). Tiny on purpose so the floor model (`deepseek-v4-flash`) actually calls it. If it skips once, still ship — do not infinite-retry. Do **not** add another write tool. Do **not** add a second combined reader. Do **not** require operator confirm. Do **not** force an extra `ask_jev` for this check.
  2. **`read_jev_state`** — no args (`{}`). **Query** the current Jev’s State ticket only (the `state` string). Does **not** return questions. Does **not** call Jev. Does **not** mutate panes. Mill card **Jev’s State** (tool id `read_jev_state`). Args: **Current Jev’s State**. Use this when you only need the ticket before `set_jev_state`.
  3. **`read_jev_questions`** — no args (`{}`). **Query** the current Jev’s Questions cards only. Does **not** return the ticket. Does **not** call Jev. Does **not** mutate panes. Mill card **Jev’s Questions** (tool id `read_jev_questions`). Args: **Current Jev’s Questions**. Use this when you only need the cards before `set_jev_questions`.
  4. **`set_jev_state`** — write the TypeSafe **state** (Jev’s State mill ticket). Not a “case”.
  5. **`set_jev_questions`** — replace typed questions. Shape matches `src/types.ts` / the editor: `choice` (option descriptions in visual order; keys become 1-based `"1"`, `"2"`, …), `noul` (optional true/false criteria), `score` (ordered legend strings). Real **snake_case** ids. Choice option **descriptions** are free human text (spaces OK); do not snake_case them. Instructions on every kept question. Semantic choice keys (`refund`/`deny`) are rewritten to positional numbers on the card and when calling Jev.
  6. **`ask_jev`** — only if state + questions are **clean** (at least one real-id question, no blank ids in the payload). Calls existing `/api/jev` (OpenRouter Decisions). If not clean: write tools only, and tell the operator to click **Ask Jev** (except **agentic-loop** mode: keep using tools until `ask_jev` succeeds or rounds run out). **`random-case` does not call `ask_jev`.** Typed answers in the tool result **and** on the SSE event must round-trip: the UI applies them, and the **next** `/api/llm` turn sends `jevAnswers` plus the Send answers to LLM send-now user note.
- Write **operator-appropriate** questions. Do **not** list violence as options. Do **not** put sexual violence, rape, sexual exploitation of minors, or graphic violent harm in state or questions. Short constraint — not a sermon about the LLM.
- After tools: a **short confirmation**. The UI already shows the ticket and q-cards.
- Never invent Jev probabilities. Only mention typed answers if `ask_jev` just returned them or Latest Jev answers are in this prompt. **Jev cannot invent answers that were not given.** Choice = listed options only; noul = P(true); score = legend levels. New option → `set_jev_questions` then `ask_jev` again.
- When `mode` is `propose-questions`, **must** call `read_jev_workshop` then `set_jev_questions`. Do not call `ask_jev` from that button. Do not reply with JSON only.
- When `mode` is `random-case`, **must** call `read_jev_workshop` first (empty or leftover is the check), then `set_jev_state` (short invented scenario) and `set_jev_questions` (3–5 mixed types: at least one noul, one score, one choice; snake_case ids; mill-number choice keys; choice descriptions stay human text with spaces). Do **not** call `ask_jev`. Do not reply with JSON only. After tools, a short confirmation, then **stop**. This mode is invent-once. Asking Jev is the mill **Ask Jev** button (and **agentic-loop**). The server must **not** keep looping until `ask_jev` works, and must **not** offer `ask_jev` on this path.
- When `mode` is `agentic-loop`, use the **current** Jev’s State and questions. Do **not** invent a new scenario. Do **not** call `set_jev_state` to replace the ticket with fiction after a read. If you will write, read first in that turn (`read_jev_workshop`, or `read_jev_state` / `read_jev_questions` for one side). If questions are clean, **must** call `ask_jev`. May call `set_jev_questions` only if the editor is dirty or a new option is needed, then `ask_jev`. Do not wait for the operator. Do not reply with JSON only.
- Chat like “send it to state and propose Jev questions” or “tighten the questions to match the ticket” must read before `set_jev_state` / `set_jev_questions` (`read_jev_workshop`, or the matching one-sided query). Same apply path.
- **Send answers to LLM** is the reverse wire — a user note in the thread that **immediately streams** `/api/llm` (same path as Send). The button lives on **Jev’s Questions**, immediately left of **Ask Jev**. Not a tool. Not a canned assistant one-liner. **Agentic loop** turns after the first use this path so answers reach the LLM. **Random state** does not auto-send answers.
- Primer from `docs/jev/primer.md` is attached (truncated if huge).
- A `## Weather` block in Jev’s State is observational Open-Meteo input. Do not invent a weather API call. Do not pretend to be Jev.
- `<!-- attach:start … -->` blocks are **user-provided** markdown the operator dropped into Jev’s State (or added from Convert to Markdown). Treat them as part of `state`. Do not fetch files. Do not invent a docs-snapshot dump.

### 9.1 Tool arguments (server validates)

OpenAI-style tools on the chat-completions call. The server executes them, then SSE-emits so the UI applies immediately. Offered on `chat`, `propose-questions`, `random-case`, and `agentic-loop` (`random-case` still omits `ask_jev`).

**`read_jev_workshop`** — `{}`. Returns the current ticket text + questions map from this `/api/llm` request (working `state` + `questions`). Same shapes the write tools consume. Does **not** hit OpenRouter. Does **not** mutate panes. SSE: tool card Running / Done only. Keys never in the payload.

**`read_jev_state`** — `{}`. Returns `{ ok: true, state }` — the current ticket string only. Does **not** return questions. Does **not** mutate panes. Mill card **Jev’s State**. Args: **Current Jev’s State**.

**`read_jev_questions`** — `{}`. Returns `{ ok: true, questions }` — the current questions map only. Does **not** return the ticket. Does **not** mutate panes. Mill card **Jev’s Questions**. Args: **Current Jev’s Questions**.

**`set_jev_state`**

```
{ "state": "<full Jev state text>" }
```

If `state` matches §5.4: `{ ok: false, code: "blocked-violence" }` to the model; do **not** write the pane.

**`set_jev_questions`** — replace the editor. Map of id → question (array of `{ id, type, … }` is also accepted). Skip blank ids. If the map matches §5.4: `{ ok: false, code: "blocked-violence" }` to the model; do **not** write the pane.

```
{
  "questions": {
    "action": {
      "type": "choice",
      "instructions": "full question text",
      "criteria": { "pay": "…", "hold": "…", "reject": "…" }
    },
    "within_policy": {
      "type": "noul",
      "instructions": "full question text",
      "criteria": { "true": "…", "false": "…" }
    },
    "exception_risk": {
      "type": "score",
      "instructions": "full question text",
      "criteria": ["Routine", "Watch", "Material"]
    }
  }
}
```

Choice `criteria` in this example may use semantic keys (`pay` / `hold` / `reject`). The editor and the Decisions payload rewrite them to `"1"` / `"2"` / `"3"` in object order. **Descriptions stay as the map values** (`"1": "Pay the invoice as billed"`, not `"1": "1"`). The LLM does not need to number them and must not mint `option_a`.

**`ask_jev`** — `{}`. Uses the working state + working questions from this request (after any `set_*` in the same loop). Choice keys in that call are the positional numbers. If not clean: `{ ok: false }` to the model; do not call Decisions; the operator clicks **Ask Jev** (agentic-loop mode keeps trying tools; **random-case** does not call this tool). If working state + questions match §5.4: `{ ok: false, code: "blocked-violence" }`; do **not** call Decisions. On success, the tool payload includes `answers` so the model can reason in-loop, and the SSE event carries those answers so the **next client turn** can send `jevAnswers` + the Send answers to LLM note.

---

## 10. Local chat history (storage)

**Key:** `talk-to-jev:chats`  
**Shape:** v1 JSON in `localStorage`. Browser only. No accounts, no server DB, no new API.

**Key:** `talk-to-jev:tutorial-done`  
**Shape:** `"1"` after Skip or Done on the coach overlay. Absent = first-run. Restart via chrome **Tour**. Never stores keys.

**Key:** `talk-to-jev:docs-rail`  
**Shape:** `{ v: 1, sort: "asc"|"desc", tags: string[], collapsed: boolean }` for the Docs page rail (title sort + type chips + master–detail open/closed). Browser only. Never stores keys. Corrupt / missing → `sort: "asc"`, `tags: []`, `collapsed: false`.

**Key:** `talk-to-jev:docs-view`  
**Shape:** `"nice"` \| `"code"` \| `"iframe"` for the Docs reader overlay. Browser only. Never stores keys. Corrupt / missing → `"nice"`. If the open page cannot embed, the UI shows Nice (or Code) even when this key is `"iframe"`.

**Key:** `talk-to-jev:docs-embed-block`  
**Shape:** `{ v: 1, urls: string[], origins: string[] }` — live https sources / origins that will not embed (DENY, frame-ancestors, or a failed iframe). Browser only. Never stores keys. Used to hide the boxed-i control so we do not keep offering a dead Iframe.

**Key:** `talk-to-jev:dev-logs`  
**Shape:** `{ v: 1, calls: DevCall[] }` — always-on scrubbed `/api/llm` and `/api/jev` request/response log (cap 40). Browser only. Open/closed is **not** in this key (inspector starts hidden). Height may live in `talk-to-jev:dev-inspector-height`. Never stores keys, last-4, or Settings bodies. Corrupt / missing → empty. See §6.7.

**Key:** `talk-to-jev:ticket-height`  
**Shape:** integer px for **Jev’s State** (`section.ticket`) height on Workshop. Browser only. Never stores keys. Corrupt / missing / out of 80–2000 → **314**. Display height is clamped so the board keeps **240px** when the column allows it. See §6.1.

**Key:** `talk-to-jev:llm-model`  
**Shape:** OpenRouter **chat** model id string (e.g. `deepseek/deepseek-v4-flash`). Browser only. Never a secret. Never Jev (`typesafe/jev*`). Corrupt / missing / Jev-shaped → `deepseek/deepseek-v4-flash`. Composer picker and Settings **LLM model** share this key. Do **not** write it into `talk-to-jev:chats`. See §5.3a.

```
{
  v: 1,
  activeId: string | null,
  chats: ChatThread[]   // newest-updated first; cap 50
}

ChatThread:
  id, title, titleLocked, createdAt, updatedAt
  messages            // LLM thread: { role: "user"|"assistant", content, thoughts?: string, tools?: ChatToolCall[] }[]
                      // ChatToolCall: { id, name, status: "running"|"done", ok?, argsSummary, resultSummary? }
                      // User turns are content-only. Assistant turns may keep thoughts + tool cards across refresh.
  state               // Jev’s State text
  includeChat         // Include LLM chat in Jev state
  questions           // Jev question editor
  answers             // last Jev answers or null
  jevMeta             // usage line if any
  samplePresetId      // §12 preset id, or null on the empty Workshop (New State / first-open)
```

Attached `.md` lives **inside** `state` (marked blocks). No extra history field, no file blobs, no keys from `.env`.

Rules:

- Cap **50** threads (keep the active thread; drop the oldest `updatedAt` first).
- Do **not** write `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, env, health, or Settings payloads into this key.
- Corrupt or unknown `v` → start empty (do not throw).
- Quota errors: drop oldest inactive threads and retry; never crash the Workshop.
- Composer draft and pane split are not required to persist.
- Empty untouched **empty Workshop** (`samplePresetId` null, blank state text, blank/empty questions, no messages, no answers) is **not** stored as a ghost thread. Untouched **Invoice exception** (`samplePresetId` `invoice`, invoice copy, questions unchanged, no messages, no answers) is also **not** stored — loading the demo without working it is not a thread. A thread is written once it has messages, a renamed title, a non-empty state, non-blank questions, Jev answers, `includeChat` off, or a **non-invoice** sample preset (including Jacket).
- Hydrate from this key **before** any persist write. Restore `activeId` on load. Skip the first persist tick so boot / Strict Mode remount cannot mint a blank chat or overwrite a saved thread with an empty snapshot. If the UI snapshot is empty and the active thread is worth keeping, **park** (`activeId` null) — do not wipe `messages` / `state` / `questions` / `answers`.
- Blank-id question map keys (`__blank__:…`) round-trip; restore still shows that card. Attached `.md` lives inside `state` (no extra field).
- **Do not clobber an in-flight or just-finished LLM turn.** Persist the user + assistant pair as soon as Send (or Propose) starts — do not wait for the debounce, and do not restore an older empty snapshot over that pair. A failed stream keeps both messages and puts the error in the assistant bubble. Preset reload (`?case=` / Preset States) may clear the thread only when the operator actually picked a preset, never because a toast callback identity changed.

---

## 11. Weather input (Open-Meteo)

Provider: **Open-Meteo** Forecast API + Geocoding API. No API key. CC BY 4.0 attribution in the weather block and a short UI hint. Server-side fetch only (Vite middleware). The browser never talks to Open-Meteo directly in MVP (keeps one network story: UI → local `/api/*`).

**Workshop chrome:** location field + **Load weather** render **only** on Jacket (`jacket`). `/api/weather` stays for that snap. Business presets never show the weather row — the Workshop must not look like a weather app.

**Default place:** Columbus, Ohio, United States (`39.9612, -82.9988`). Nate can change the location field to another city (`Nashville, TN`) or coordinates (`36.16, -86.78`).

**Units (US default):** °F, mph, inches. Timezone: `auto` from Open-Meteo.

**What loads into Jev state**

Jev’s State owns a marked block:

```
<!-- weather:start -->
…human-readable conditions + compact JSON…
<!-- weather:end -->
```

**Load weather** replaces that span in place. If the markers are missing, the block is prepended. The Situation / rest of the state is not wiped.

The block must include:

- Place name, region, country, lat/lon, timezone
- Observation time
- Current: temp, feels-like, WMO weather text, humidity, wind + gusts, precip, cloud cover
- Today + next 1–2 daily: high/low, precip chance/amount, weather text
- Next ~12 hours: time, temp, precip probability, weather text
- Compact JSON of the same facts (for Jev / the LLM)
- Attribution line: weather data by Open-Meteo.com (CC BY 4.0). Weather is input, not a model.

**Location parsing**

1. `latitude` + `longitude` query params, or
2. `q` matching `lat, lon`, or
3. `q` as a geocoding search (`name` on `https://geocoding-api.open-meteo.com/v1/search`), first result, or
4. Default Columbus, OH

Unknown place → 404 `{ ok:false, message }` (no OpenRouter mention). Upstream failure → 502.

**Not in MVP:** saved locations, maps, radar, air quality, a second paid weather key.

---

## 15. Jev’s State attachments (.md → Jev state)

Nater (2026-09-19): “can we add .md files to the case for jev?” **Yes.** Local markdown becomes part of **Jev’s State** — the same `state` string sent to `POST /api/alpha/decisions`. This is **not** a chatbot file-chat feature (no separate file pane, no model that “reads attachments” besides Jev/LLM seeing the state text).

**Workshop**

- Control **Add .md**: hidden file picker, `accept=".md,.markdown,text/markdown"`, `multiple`.
- **Drag-and-drop** onto **Jev’s State** (the whole slip, including the painted ticket).
- Multiple files OK. Re-adding the **same sanitized filename** **replaces** that attach block. New names **append** (do not clobber the situation or the weather block).
- List attached names near the ticket. Remove one = strip that file’s attach block only.
- **Mix drops:** `.md` / `.markdown` attach immediately (stay on Workshop). Convert formats (`.txt`, `.html`, `.htm`, `.docx`, `.pdf`, `.doc`) **open the Convert tab** (`/convert`, §16) — they are **not** an error. Truly unsupported types: short **inline** error (`role="alert"`), not `window.alert`.
- Tip on **Add .md**: fully opaque, flip above/below so it stays on-screen, never a translucent fill.

**Markers** (HTML comments in Jev’s State text):

```
<!-- attach:start filename.md -->
…file text…
<!-- attach:end filename.md -->
```

Sanitized basename only (no path). Strip control characters and `--` so the comment stays valid. Do not read `.env` / `.env.local` on this path — only `File` objects the user picked or dropped.

**Caps (do not freeze the UI)**

- **256 KiB** per file (byte size) before read
- **200,000 characters** per file after read
- **12** attach blocks per Jev’s State

Over-cap files are skipped with an inline error. Remaining valid files still insert.

**Never**

- Upload to a new server store or add an attach API
- Write attached text into `.env` / `.env.local`
- Commit user files into the repo
- Auto-insert the official `docs/jev/` snapshot into Jev’s State (Docs overlay already has that)

---

## 12. Ten sample states (Workshop presets)

One pick from **Preset States** on **Jev’s State** **and** cards on **Example Uses**. Same ten. One module: `src/samples.ts`. Do not fork a second catalog. Do **not** show the ten as a Workshop chip row — that row is **New State / Preset States / History**.

Nater (2026-09-19): weather is **literally one use case**. The other nine are **business / operator** snaps — real tickets and memos (amounts, SLA, customer tier, policy quotes), not lifestyle weather, not sports-weather, not “festival in the rain.” Mix Jev primitives **choice**, **noul**, and **score** across the set (not all noul). Cheap LLM can still draft; Jev returns probabilities.

Each preset is a product contract: **id**, **short label**, **pitch**, **kind** (`business` | `weather`), **situation** (state text), **Jev questions** (2–4, with ids / types / choice **descriptions**). Choice option keys at runtime are always 1-based positional strings (`"1"`, `"2"`, …) in visual order — never `option_a`, never a typed key field. Sample source may use semantic keys for authoring (`pay` / `hold`); they are rewritten before they reach the card or Jev. Picking a **Preset States** item or a Example Uses card:

- Writes the situation into Jev’s State ticket (weather placeholder **only** on Jacket)
- Replaces the Jev question editor
- Clears last Jev answers and the LLM thread (the previous state must not leak if “Include LLM chat” is on)
- Marks that preset selected in the menu
- Shows or hides the weather row from **kind** (Jacket only)
- Does **not** fetch weather until **Load weather** on Jacket (offline-safe; live weather is the upgrade)

**Empty Workshop:** first-open (no active thread) and **New State** load **no** preset. Invoice exception (`invoice`) is catalog item 1 — pick it from **Preset States**, Example Uses, or `?case=invoice`. It is **not** selected on the empty Workshop. Jacket remains available in the menu and as a Example Uses card.

| # | id | Label | Kind | Mix |
|---|---|---|---|---|
| 1 | `invoice` | Invoice exception | business | AP. Pay / hold / reject. choice + noul + score. |
| 2 | `ticket` | Ticket route | business | Primary queue. billing / engineering / success / spam. |
| 3 | `lead` | Lead qualify | business | Book demo / nurture / disqualify. |
| 4 | `refund` | Refund call | business | Full / partial / deny. |
| 5 | `hire` | Hire screen | business | Advance / hold / pass. |
| 6 | `launch` | Launch go/no-go | business | Ship / wait / rollback plan. |
| 7 | `chargeback` | Chargeback | business | Accept / represent. Block is a separate noul. |
| 8 | `vendor` | Vendor risk | business | Sign / redline / walk. |
| 9 | `moderate` | Moderate | business | Go live / edit / kill. |
| 10 | `jacket` | Jacket? | weather | Outdoor layer. Open-Meteo optional. **The one weather snap.** |

Ten distinct company names. Do not reuse **Northwind**, **Harbor**, or one mill across snaps. Do not use a single country as a fraud tell.

### 12.1 Invoice exception

AP queue. INV-18442, Northwind Logistics LLC, Net-30, 3 years, no prior disputes. Buyer is Ops (inbound freight) — not a retail brand. Invoice $18,640 vs PO-9921 $16,200 (+15.1%). Fuel surcharge $1,980 not on PO; pallet repair $460 with a carrier claim. Policy AP-4.2: auto-pay ≤ $250 or ≤ 2%; hold 2–5% or $250–$2,000; reject or amend above that. Fuel needs a signed addendum (none on file). Buyer: pay fuel if verbal winter band, do not pay pallet. Vendor dunning 8 days past terms. SLA: AP close Friday 5pm ET.

- `action` **choice** — `1` Pay the invoice as billed / `2` Hold for buyer / `3` Reject and require a corrected invoice
- `within_policy` **noul** — Is paying this invoice as-is within AP-4.2? true: within policy; false: exception needs hold or reject
- `exception_risk` **score** — Routine / Watch / Material

### 12.2 Ticket route

Zendesk #482911, 14m old, Fieldwright Cloud, Enterprise ARR $94k, first-response SLA 1h. Subject mixes production webhook 500s and a duplicate $2,400 invoice. Three similar 5xx tickets in 40m. Both invoice PDFs share one Stripe charge id (duplicate document, not a second capture). Sender matches account owner. Choose the **primary** owner — one queue, even though the body has two issues.

- `queue` **choice** — `1` billing / `2` engineering / `3` success / `4` spam
- `urgent` **noul** — Is checkout / production down right now (cannot wait the remaining SLA)? true: production outage now; false: the outage can wait the SLA. Billing duplicate is not this question.
- `severity` **score** — Low / Medium / High (overall business impact, including Enterprise ARR and the billing mess — not a Sev label)

### 12.3 Lead qualify

HubSpot D-44190. Oak & Pine Credit Union, ~$2.1B assets, VP Operations, DNA core. Inbound: decision engine for loan exception queues, budget this FY, demo Thursday. ICP: CU/community bank $500M–$10B, ops/risk buyer, exception or KYC queues. They asked for on-prem; we are cloud + VPC only.

- `disposition` **choice** — `1` book demo / `2` nurture / `3` disqualify
- `icp_fit` **noul** — Does this account match ICP? true: ICP; false: out of ICP
- `intent` **score** — Cold / Warm / Hot

### 12.4 Refund call

Stripe $247 annual renewal, order ORD-77120, Maya Chen, 11 months, lifetime $1,104, two small prior refunds, risk 12/100. Renewed **4 days ago** (within the 7-day partial window). She used the product on 3 calendar days this period (3 logins, 1 export) — not “3 days of use inside 19 hours.” Policy R-3: full if unused, or within the 14-day new-customer window (she is not new). Partial: unused months minus one consumed month if cancel within 7 days of renewal. Deny: abuse, **more than 3 refunds/year** (two prior does not auto-deny), or fully consumed. A chargeback threat does not by itself deny.

- `decision` **choice** — `1` full / `2` partial / `3` deny
- `policy_allows_full` **noul** — Does R-3 allow a full refund here? true: full is in policy; false: it is not
- `abuse_risk` **score** — Clean / Watch / Abuse

### 12.5 Hire screen

SWE-II Decision Systems. Jordan Hale, 4.5 years, fintech routing rules (Rails), claims a “System-One-style classifier” but described sklearn + Slack bot. Comp $165k + 0.15% (band $140–170k, 0.08–0.20%). Musts: production backend, judgment-under-uncertainty, tradeoffs. Auto-pass: cannot discuss a real production system, or >$190k. Interviewer: strong communicator, light systems design. Do **not** put school, citizenship, or work-auth in the state.

- `outcome` **choice** — `1` advance / `2` hold / `3` pass
- `meets_musts` **noul** — Do they meet the must-have scorecard? true: yes; false: no
- `fit` **score** — Weak / Mixed / Strong

### 12.6 Launch go/no-go

billing-vats 2.12.0, ship window today 16:00–18:00 ET, PDF engine for EU VAT invoices (~1,100 Friday). Open P1: umlauts as `?` on the tagged worker image; fix is on a newer untagged build. Rollback: feature flag off, tested <2m. Go: no P1 on the artifact we ship. Wait: retag. Rollback-plan: ship the known P1 anyway with written sign-off — legal has **not** asked us to ship Friday regardless (finance close is Monday).

- `call` **choice** — `1` ship / `2` wait / `3` ship the known P1 with written rollback sign-off
- `artifact_ready` **noul** — Is the tagged artifact ready to ship? true: the SHA/tag we would ship is clean of P1; false: it is not
- `readiness` **score** — Blocked / Fragile / Ready

### 12.7 Chargeback

Stripe dispute $1,890, reason fraudulent, due 6 days. New account, 40-seat annual, CVV fail, no 3DS, datacenter ASN (not residential), card-country ≠ login-country (do **not** name a country), data export 12k rows, then dispute. Policy: represent if strong fulfillment + real-org use; accept (do not fight) if CVV fail + new + export + no 3DS. **Block the account** is a separate call — not a third value of `action`. Block if scrape/fraud pattern, regardless of represent.

- `action` **choice** — `1` accept (do not fight) / `2` represent with compelling evidence
- `fraud_likely` **noul** — Is this likely fraud rather than a confused customer? true: fraud / scrape pattern; false: could be a real dispute
- `block_account` **noul** — Should Risk block the account regardless of representment? true: block; false: leave the account open
- `evidence_strength` **score** — Thin / Mixed / Strong

### 12.8 Vendor risk

Helios Observability, $86k year 1, auto-renew. Liability cap 3 months fees. They want unlimited indemnity from us on customer content. SOC 2 Type II expired 4 months **but a 90-day bridge letter is on file**. Training opt-out **is** in the attached DPA exhibit. PROC-9: no unlimited outbound indemnity; no expired SOC 2 without a bridge; training opt-out required in the DPA. Walk if **two of those three** fail and spend is >$50k. Here only indemnity fails — walk is not mandated; sign as-is is still blocked.

- `action` **choice** — `1` sign / `2` redline / `3` walk
- `policy_clear` **noul** — Can we sign this paper as-is under PROC-9? true: clear to sign; false: not clear
- `risk` **score** — Acceptable / Elevated / Deal-breaker

### 12.9 Moderate

Trust & Safety PUB-90331. Pro creator, 2 prior strikes: **2025 weight-loss supplement misinfo (not a cancer claim)** + 2024 spam. 42s video: peptide stack “cured my cousin’s tumor,” sales link, stock-photo watermark. Policy P-4 Health: no unproven cancer-treatment claims; no sales links on health claims; **first** cancer-claim strike = kill + 7-day feature ban; second cancer-claim = account disable. This is the first cancer-claim, so `kill` (not disable). SLA 15 minutes. Would run next to a hospital advertiser.

- `action` **choice** — `1` go live / `2` edit / `3` kill
- `policy_violation` **noul** — Does this violate P-4 Health as posted? true: violation; false: can stand
- `harm` **score** — Low / Medium / Severe

### 12.10 Jacket? (the one weather snap)

15–20 minute outdoor errand (coffee / walk). Judge jacket vs no jacket from the weather block plus this outing. Not a packing essay. Situation includes the Open-Meteo placeholder; live weather is optional via **Load weather**.

- `wear_jacket` **noul** — Should they wear a jacket for this outing given the weather? true: jacket is warranted; false: comfortable without one
- `layer` **choice** — `1` tee / `2` light layer / `3` insulated / `4` rain shell

Each situation in `src/samples.ts` must match this contract (ids, types, choice descriptions in this order). Copy may be slightly warmer than this SPEC outline; question **ids** and **types** must not drift. Choice keys on the card and in the Jev payload are `"1"`, `"2"`, … in that order. Business situations must read like tickets/memos (enough state for Jev) and must **not** require live weather.

Example Uses (`/use-cases`) renders the same ten as cards. Workshop **Preset States** and Example Uses cards share this module.


---

## 13. Verification

Before calling Workshop done:

1. Chrome has **no** key-status pill. `/settings` OpenRouter row shows **Key ready** / missing (last-4 only when present — never the full key). `/api/health` still returns booleans.
2. Send an LLM message; thinking chrome shows, then streamed reply appears. Thoughts block only if the model streamed real reasoning. While thoughts stream, that mill is open. When it reads **Thoughts done**, that mill is collapsed (`aria-expanded=false`, chevron ▸) unless the operator expanded it after done. Tool calls (if any) are cards, not a JSON dump in the bubble — tool cards are **not** auto-collapsed by this rule.
3. Pick **Invoice exception** from **Preset States**; Ask Jev; three answers render (choice / noul / score)
4. **Propose Jev questions** (and chat that asks to send to state / propose) uses **tools**: Jev’s State and/or q-cards update immediately; the LLM thread is a short confirmation, **not** a JSON dump
5. **Send answers to LLM** is on **Jev’s Questions** pane-head, immediately **left of Ask Jev** (not the LLM pane). With live Jev answers: click sends immediately — You bubble appears, `/api/llm` returns 200 SSE, mill thinking, then a streamed assistant reply (not a canned one-liner). Composer may stay empty; Send stays disabled until they type. With no Jev answers, the button stays disabled (FlipTip **Ask Jev first — nothing to send.**). LLM pane row is **Random state · Agentic loop · Propose Jev questions · Inspector**.
6. Docs page lists snapshot files; open one. Type chips appear (from snapshot paths). Toggle A→Z / Z→A; click a type (e.g. `cloudflare`) and `cloudflare/jev.md` stays selectable. Search still AND-filters. Reload keeps sort + tags + rail collapsed (`talk-to-jev:docs-rail`). Filtering out the open page keeps the reader, hides that row. The rail is viewport-tall; the file list scrolls **inside** the aside; window `scrollY` stays ~0. Chevron swipe-out hides the rail (reader full remaining width); swipe-in restores it.
7. On `/docs`, **Update Jev docs** (Docs toolbar, not the header) completes and the list refreshes; if a page was open, that page’s markdown reloads (same path) or the empty picker if the path is gone. Tour overlay still reloads the doc behind it. Chrome-right has **Tour** only — no Update Jev docs.
8. Splitters drag; textareas have no native corner grip. Both the **horizontal** Jev’s State / board bar and the **vertical** LLM \| Jev bar read as thin quiet mill/pine seams (not a dashed orange candy-cane stripe); hover/drag shows a slightly wider pine handle. Dragging the horizontal bar grows/shrinks Jev’s State; the board fills the leftover column (LLM and Jev stay a row). Refresh restores `talk-to-jev:ticket-height`. Focus the bar and Arrow keys nudge. Window `scrollY` stays ~0.
9. `/docs` deep link works after refresh
10. Docs overlay: Nice view shows rendered Markdown; Code view shows raw snapshot; boxed-i Iframe loads the live https source **only when that page can embed**. Primer / INDEX / README / manifest / TypeSafe DENY: Iframe button is **gone** (not disabled); Nice (or Code) is the view — not “This page won’t embed.” Tips stay fully visible. Reload keeps the last mode (`talk-to-jev:docs-view`) and embed blocks (`talk-to-jev:docs-embed-block`).
11. `/use-cases` shows **10** cards (9 business + Jacket, not ten weather titles); `/cases` is the same page
12. Click a card: Workshop loads that state + questions (`?case=` in the URL)
13. `/api/health` JSON has `hasKey` / `keys.*` booleans only — no key material in the body
14. Tips on Example Uses cards stay fully visible (flip, opaque)
15. Send an LLM message, refresh: the **same** thread is active (not a new blank chat), History still lists it, and the LLM transcript restores with Jev’s State and questions
16. Click a past thread to restore LLM transcript + state + questions (blank-id cards included) + last Jev answers
17. **New State** (and drawer New chat) returns to an **empty** Workshop (blank state, no invoice preset, **Preset States** none selected); the previous thread remains in the list if it was worth keeping
18. Delete one thread; it is gone after refresh
19. `localStorage["talk-to-jev:chats"]` has no API key
20. First-open Workshop (empty history): **Preset States** has **none selected**; weather row is **hidden**; Jev’s State is blank. Jacket from the menu shows the weather row; switching back to a business preset hides it again
21. On Jacket: **Load weather** (default Columbus, OH) fills Jev’s State weather block; status line shows place + now; no OpenRouter key required
22. Pick at least two **business** presets plus Jacket from **Preset States**: Jev’s State + Jev questions swap; Ask Jev returns typed answers
23. On Jacket: changing the location field and loading again replaces the weather block without wiping the Situation
24. `/docs` overlay still works after the Workshop weather work
25. First visit (or clear `talk-to-jev:tutorial-done`): coach overlay appears on Workshop; card fully on-screen and opaque
26. Next walks at least 3 steps; Back returns; missing targets (Example Uses / Settings / weather if hidden on a business preset) are skipped, not crashed. After the LLM pane step, Tour spotlights **Random state**, **Agentic loop**, **Propose Jev questions**, then **Inspector** — the real mill buttons, 1–2 human sentences each, not the whole pane-head.
27. Skip dismisses; refresh does not reopen the overlay
28. Chrome **Tour** restarts the overlay; Docs eyeball/code step still keeps that view overlay fully visible
29. `/settings` loads; OpenRouter shows Key ready (not the secret); unused slots show missing if empty
30. Saving an empty unused key (e.g. OpenAI) does not echo a full key in the UI or JSON
31. `GET /api/settings` has `present` / `last4` only — no full key
32. Chrome right-side has **Tour** only — **no** Update Jev docs, **no** History, **no** Inspector, **no** Key ready / Need OpenRouter key / Checking key… / Key check failed pill. **Update Jev docs** is on `/docs`. **History** is on the Jev’s State row. **Inspector** is on the LLM pane-head (starts off). Nav **Settings** and `/settings` remain the key home, the **LLM model** persist home (same key as the composer picker), **and** the **LLM instructions** home.
33. `localStorage["talk-to-jev:chats"]` still has no API key after using Settings
34. **Add question** inserts a card whose id field is **empty** (placeholder `question id`, not `q_*`) and puts the caret in that id field. Typing several characters into a blank or filled id (e.g. `action`, `vendor_claim_valid`) keeps focus — the field does not deselect after one character. Space in the id field inserts `_` (`wear jacket` → `wear_jacket`). **Ask Jev** with that field still blank shows an inline error and does not invent an id or call Jev. Preset ids (`wear_jacket`, business ids) stay filled. Instructions textarea still accepts spaces.
35. Ticket heading reads **Jev’s State** (`h2.pane-title`, not **Case**, not uppercase **JEV’S STATE**). Same Public Sans **size** as **Jev’s Questions** (1.05rem / 650 / 0.01em). Product mark **Talk to Jev** stays larger (1.25rem / 700). Example Uses gallery title stays **Example Uses** at that same pane-title size. Nav **Workshop / Example Uses / Docs** stay `.nav-btn` size — not header size.
36. **Add .md** (or drop `.md` onto Jev’s State) inserts a marked attach block into the **state string**; chips list the filename. The ticket renders that markdown painted (focused or not). Ask Jev / the LLM see that text as `state`.
37. Drop a **mix** (`.md` + `.txt` or `.pdf`): markdown attaches on Workshop; the **Convert** tab (`/convert`) opens for the rest with per-file progress. A truly unsupported type shows an inline error on the ticket (no native `alert`). A huge markdown file (over the §15 cap) is rejected without freezing the UI.
38. Remove a chip: that attach block is gone; weather / situation text stay.
39. Re-adding the same filename replaces that attach block (does not duplicate it).
40. Opening Docs does **not** dump the official snapshot into Jev’s State. Attach is local user files only.
41. Drop `.txt` / `.html` / `.docx` / `.pdf` onto Jev’s State: the **Convert** tab (`/convert`) opens (not a half-pane on Workshop, not a ticket-row button). Per-file progress. Resulting MD can **Add to the LLM**, **Add to Jev’s State**, **Download**, **Save as MD**. Chrome nav is Workshop | Example Uses | Docs | Settings | **Convert** (Convert after Settings; visible label Convert; title/aria Convert to Markdown).
42. PDF: text layer via **pdfjs-dist** in the browser. No network upload of the file. A scan / image-only PDF errors **scan / no selectable text**. Convert page footnotes Pandoc as a heavier local option.
43. `.doc` (legacy): Convert page says **save as .docx** (no cheap browser path).
44. Convert page shows Jev token copy from TypeSafe (`docs/jev/typesafe/models.md`): **~64,000 tokens per request**; **32k** for state + longest question. Warn if converted MD would blow 32k; block **Add to Jev’s State** if it would blow 64k. Download / Save still work.
45. Convert page textareas `resize: none`. Tips opaque and fully on-screen. Workshop still has the quiet LLM \| Jev splitter (not candy-cane). Convert page uses the same quiet splitter between file list and preview.
46. Jev’s State toolbar has **Add .md** only — no Convert to Markdown chrome button in that row. `.md` drop stays on Workshop (attach chips).
47. Jev’s State tools are **New State**, **Preset States**, **History** — not a row of ten sample chips. Chrome-right has no History button.
48. **New State** clears state text, strips attach chips, resets Jev questions to one blank-id card, clears Jev answers, empties the LLM thread, hides weather chrome, strips `?case=`, and leaves **Preset States** with none selected — it must **not** load Invoice exception. Opening **Preset States** lists all ten snaps; picking one loads like today. **History** on that row still opens the localStorage drawer.
49. Jev pane heading reads **Jev’s Questions**; LLM pane heading reads **LLM**; both are `h2.pane-title` at the same size. The model id is the subtitle/meta; **Ask Jev** remains on the far right; **Send answers to LLM** sits immediately left of it (ghost, Public Sans like `.btn.ghost`).
50. Choice card: slick **1-based** numbers (1, 2, 3) to the left of descriptions; **no** Option key input (do not mint `option_a`, do not type `1` into a box). **Add option** shows 4 and moves focus to **Option 4 description** (not the Add option button). Space in that description inserts `_`. **Ask Jev** payload uses those numeric keys with the **description as the value** (`"1": "papaya"`, not `"1": "1"`). LLM semantic keys (`refund`/`deny`) rewrite to `"1"`/`"2"` on the card and in the Jev payload; descriptions stay. Choice answer bars read `1 papaya` (number + description), matching score `1 Low`. Description typing keeps focus.
50a. Score card: visible level indexes are **1, 2, 3** (not 0, 1, 2). **Add level** shows the next human number. Jev answers for that score show **`1 Low`** (or `1 Clean` / `1 Routine`) as the first legend key — never a lonely **0**. `/api/jev` still sends the ordered legend array and still receives 0-based `legend` / `score`; only the Workshop chrome adds 1.
51. Send a short prompt that should tool-call into Jev’s State (or **Propose Jev questions**): mill thinking shows while `/api/llm` is in flight; if OpenRouter streams reasoning, the Thoughts block is open and fills; when that group is done (**Thoughts done**), it auto-collapses (`aria-expanded=false`); the operator can expand it and a later parent re-render does not force it shut; `set_jev_state` / `set_jev_questions` appear as tool cards (Running then Done) and stay independently open/closed (this rule does not collapse them); the ticket/q-cards update; the bubble’s prose is a short confirmation, not a markdown table of questions. Refresh restores thoughts + tool cards on that assistant turn — thoughts start collapsed because they are already done. If the floor model has no reasoning channel, thinking still runs and Thoughts stays hidden.
51a. **Read before write.** Send “tighten the questions to match the ticket” (or **Propose Jev questions**). Inspector `sent.tools` includes `read_jev_workshop` on chat / propose-questions / random-case / agentic-loop. When the model behaves, a **Read pane** / `read_jev_workshop` card (Running then Done, args **Current state + questions**) appears **before** `set_jev_questions` / `set_jev_state`. Floor model may skip the read once — still ship the tool + prompt; do not infinite-retry. Keys never on the card. Score 1-based chrome and overlay scrollbars unchanged. No extra `ask_jev` for the check.
51b. **Split query tools.** Inspector live `sent.tools` lists `read_jev_state` and `read_jev_questions` alongside `read_jev_workshop` (not only historical `set_jev_case` rows). Send “query current Jev’s State” or “query Jev’s Questions”: mill cards `read_jev_state` / `read_jev_questions` (Running then Done; labels **Jev’s State** / **Jev’s Questions**; args **Current Jev’s State** / **Current Jev’s Questions**). Panes do **not** mutate. No DSML dump. Do **not** wipe the ticket. Do **not** Ask Jev on blocked options. Floor model may skip once.
52. Docs Iframe: open Introduction (TypeSafe, `X-Frame-Options: DENY`): boxed-i is **hidden**; Nice (or Code) is the view; no mill “won’t embed” dead end. Open `primer.md`: Iframe is hidden (no source). A page that *can* embed still shows boxed-i and loads the live site. No keys in the iframe URL. No native resize grips. Rail chevron collapses/expands with animation; refresh keeps collapsed.
53. **Random state:** **New State** (empty Workshop) → **Random state** (pane row, left of Agentic loop, mixed-case Public Sans) — **no** turn popover. Jev’s State fills (`set_jev_state`). Q-cards show mixed types (at least one noul, one score, one choice; mill numbers; snake_case ids). **No** `ask_jev` / `/api/jev` from this click. **No** second `/api/llm` analysis session. You bubble has no ask-Jev / “Stop after Jev answers” sentence. Then **stop** — no turn 2…N, mill does **not** show Turn k of N. Thoughts mill auto-collapses when that group is done. Workshop **unlocks** when done. Operator clicks **Ask Jev** (or Agentic loop) separately.
53a. **Agentic loop:** panes already have state + real-id questions (preset, operator-written, or after Random state). **Agentic loop** (right of Random state) → popover chips **1–10**, default **3** pressed → pick **3** turns → **Confirm**. Does **not** invent a new random state. N `/api/llm` sessions. `ask_jev` POSTs `/api/jev` and answers round-trip. Mill shows **Turn k of 3**. Last turn is analysis. Picking **1** runs one session only (not clamped to 3). Picking **2** runs two. Each finished turn’s Thoughts mill auto-collapses when *that* group is done. Workshop **unlocks** when done. Popover **Cancel** does not start a run. Tip/popover stays fully on-screen, opaque, no ALL CAPS. Empty pane: **Agentic loop** is disabled / mill-warns — does not invent.
54. Workshop with a long LLM thread **and** several q-cards: `article.pane.llm` and `article.pane.jev` stay inside the viewport (pane `bottom` ≤ `innerHeight`; document does **not** grow to ~2000px). Pane-heads stay put. `.thread` and `.jev-scroll` each have `overflow-y: auto` and scroll independently. Window `scrollY` stays ~0. No native `resize` grips.
55. Load Workshop: LLM pane-head shows **Inspector** (mixed case). Panel is off (no request JSON on screen). Toggle on: bottom overlay, two columns **To LLM** / **To Jev**, Fragment Mono JSON. Tip opaque and on-screen. Toggle off. Send a short LLM message **or** Ask Jev (or a tool `ask_jev`): `localStorage["talk-to-jev:dev-logs"]` grows even while closed. Refresh: toggle still off; opening it shows the last calls. No API key / last-4 / `sk-or-` in the panel or that key. Settings has no inspector. Chrome-right has no Inspector. `ask_jev` tool card args read **Current state + questions**. Workshop panes still fill the viewport (overlay is not a flex sibling).
56. Nav **Example Uses** (not Use Cases). Ticket **Jev’s State**, **New State**, **Preset States**. LLM pane row **Random state**, **Agentic loop**, Propose, Inspector. **Send answers to LLM** on Jev’s Questions, left of **Ask Jev**. Convert **Add to Jev’s State**.
57. Overflow scrollers (Jev’s State ticket, `.thread`, `.jev-scroll`, Docs `.doc-list` / Nice view, Convert, History, Inspector JSON, and the rest in §8.1) show **no white native track**. Idle: opacity 0 **but** the ~14px `.mill-bar` strip is still hittable (`pointer-events: auto` whenever `display: flex`). Hover pane **content** / Inspector **body** (chat / questions / keys — not the gutter): bars are **not** revealed or pinned. **Click** inside LLM chat / Jev’s Questions / Inspector body (not the 14px gutter) must **not** leave that bar `is-on`; moving the mouse in the pane still starts hold+fade. Hover that scroller’s own `.mill-bar` strip (even from opacity 0): mill-green thumb + arrows fully opaque (`is-on`). Leave **the strip** onto pane content (even while still in the LLM pane / Inspector / modal): stay opaque **1.0s**, then fade **1.0s**. A wheel on pane content may flash then hold+fade; it must **not** stay `is-on` if the pointer is not on that strip. Opening Inspector or switching Settings mid-fade must **not** reset that bar’s timers. No reserved white gutter. Native `resize` still `none`.
58. Send a long LLM stream. While Thinking… / tokens arrive, scroll `.thread` **up**. `scrollTop` **stays** (does not snap to `scrollHeight` as thoughts / deltas land). If left at/near the bottom, the thread may still follow. Collapsing or expanding Thoughts mid-stream must not yank an unpinned thread. Jev `.jev-scroll` is unchanged. Window `scrollY` stays ~0. Overlay mill bars still work on `.thread`. No native `resize` grip.
59. `/settings` **LLM instructions** mill card sits below **LLM model** (which sits below the key rows). Save a short standing line; reload Settings — text still there (`talk-to-jev:llm-instructions`). Workshop Send: Inspector **To LLM** shows that string once on the `/api/llm` body **and** in inspect `sent.instructions` / the system message start; the visible thread does **not** grow a fake You bubble for it. Empty save: next `/api/llm` has no extra system section and no `instructions` field. **Ask Jev** payload has no `instructions`. Propose / Send answers to LLM / Random state / Agentic loop share the same `streamLlm` injection. Textarea `resize: none`. No Bricolage / ALL CAPS stamp. Not in `.env.local`.
60. Idle LLM composer shows **Send** (disabled when empty). Start a long `/api/llm` stream (Send, or any other LLM busy path that freezes that slot): composer shows **Stop** (filled square in a circle, `aria-label` **Stop**), not a disabled **Thinking…**. Click Stop mid-stream: SSE ends, partial assistant text remains, mill toast **Stopped.**, Send returns, window does not scroll, unpinned `.thread` scroll stays. Idle Send still sends. Ask Jev is unchanged. No CSRF edits. Public Sans / Fragment Mono only.
61. Workshop markdown: put `**hello**` in Jev’s State (or an LLM user/assistant bubble). **Ticket / bubble shows hello in bold**, not asterisks. Click State: still painted bold (caret in the ticket — no `**hello**` asterisks, no textarea dump). Blur: still painted. Refresh: the raw string is still in `talk-to-jev:chats` and still renders. Thoughts mill and tool cards stay as now (not a second Docs iframe). Drop .md still attaches. Streaming deltas do not yank an unpinned `.thread`. No CSRF change.
62. **Violence gate.** `npm test` covers `server/violenceGate.ts`: abstract blocked fixtures fail closed; refund / abuse-risk / “kill the post” fixtures stay allowed. Do **not** Ask Jev on a live poisoned card. A matching `POST /api/jev` is **400** `blocked-violence` (inline error on Jev’s Questions). A matching `set_jev_state` / `set_jev_questions` is a tool error and does **not** write panes. No CSRF change. No `docs/jev` rewrite.
63. LLM composer shows a compact **LLM model** `<select>` **left of Send** (Public Sans, mixed case, not ALL CAPS, not Bricolage). Default `deepseek/deepseek-v4-flash`. No `typesafe/jev*` option. Change to another catalog id; Settings **LLM model** shows the same value (`talk-to-jev:llm-model`). Send a short no-tools “ok”: Inspector **To LLM** / mill `sent.model` is that id (not Jev). Pane-head LLM `<code>` matches. While streaming, picker is **disabled** and **Stop** still works. Reload keeps the pick. Jev pane subtitle stays `typesafe/jev-1.13`. No CSRF change.

---

## 14. Open-source gate (2026-09-19)

Nater wants this public soon (Jev wave). Flip GitHub to **public** only if all are true:

1. `.env.local` is gitignored (`.env` / `.env*`) and was never committed
2. `git log` / history has no API key **values** (env **names** in docs/code are fine)
3. The browser never sees raw keys (not in HTML, JS bundles, health JSON, or settings JSON beyond last-4)
4. README / Settings: paste in `/settings` (or `.env.local`); keys stay on the server; Jev is not a chatbot
5. No secrets in client bundles (`dist/` / network)
6. History JSON in `localStorage` has no API key
7. `env.local.template` (if present) has **empty** values only — never real secrets

If any fail: **keep private**, fix what we can, report. LICENSE is MIT, copyright Nathan Uttley, 2026.

---

## 16. Convert to Markdown (client-side)

Nater (2026-09-19): drop files on **Jev’s State**. Markdown goes into Jev state. Other text-ish files open the **Convert** tab (`/convert`). Same day: move the Convert to Markdown **button** off the state ticket onto that chrome tab (after Settings). PDFs are **text layer only** via OSS **pdf.js** (`pdfjs-dist`) in the browser. **No images, no OCR, no upload to a SaaS converter.** Files never leave the machine.

### Drop mix (Jev’s State ticket)

| Kind | Extensions / types | Behavior |
|---|---|---|
| Markdown | `.md`, `.markdown`, `text/markdown` | Drop **into Jev’s State** as attach blocks. **Stay on Workshop.** |
| Convert | `.txt`, `.html`, `.htm`, `.docx`, `.pdf` | Navigate to **`/convert`**. Per-file progress. |
| Legacy Word | `.doc` (OLE / `application/msword`) | Navigate to `/convert` with an error: **save as .docx**. No cheap reliable browser path for OLE `.doc`. |
| Mix | markdown + convert | Markdown attaches on Workshop; convert files open the Convert tab. |
| Other | anything else | Inline error on the ticket (`role="alert"`). Not `alert()`. |

**Add .md** stays markdown-only on the ticket. **Do not** put a Convert to Markdown button back on Jev’s State.

**Convert to Markdown** control lives on `/convert`: file picker `accept` for `.txt,.html,.htm,.docx,.pdf,.doc` plus matching MIME types, `multiple`. Drop zone on that page too. Does not attach until an action.

Drag-and-drop onto the **whole Jev’s State ticket** still works: convertables **open the Convert tab**. `.md` does not.

### Convert page (`/convert`)

Full page — not a half Workshop board.

Eyebrow / heading: **Convert to Markdown**. Chrome nav label: **Convert**.

Per-file row: filename, status (queued / reading / converting / done / error), progress (PDF = page n of m). Select a done file to preview resulting MD.

Quiet custom splitter (same mill/pine seam as LLM \| Jev — not a dashed orange hatch) between the file list and the preview. Hidden on mobile; panes stack. `resize: none` on the preview textarea.

**Actions** on the selected resulting MD:

| Action | What |
|---|---|
| **Add to the LLM** | Insert a user-visible note into the LLM thread with the markdown. Does **not** auto-call the LLM. |
| **Add to Jev’s State** | Merge as an attach block (same markers as §15). Same replace-same-name / cap rules. |
| **Download** | Browser download of the `.md`. |
| **Save as MD** | `showSaveFilePicker` when the browser has it; otherwise same as Download. |

Leave via chrome nav. Switching away does not have to wipe jobs. A later drop on this page or on Jev’s State can append jobs.

### Libraries (browser, OSS)

| Format | Path |
|---|---|
| `.docx` | **mammoth** → HTML → **turndown** → MD. Skip embedded images (Jev is text-only). |
| `.html` / `.htm` | **turndown** |
| `.txt` | Read as UTF-8 text; treat as markdown (no fake formatting). |
| `.pdf` | **pdfjs-dist** (Mozilla pdf.js). Extract **text items only**. Do not rasterize, do not OCR, do not send the file anywhere. |
| `.doc` | No convert. Message: save as `.docx` and drop again. |

PDF with **no text layer** (scan / image-only): error **scan / no selectable text**. Do not pretend to OCR.

Password-protected PDF: error that it is locked.

Optional UI footnote: heavier local tool = [Pandoc](https://pandoc.org/).

### Caps

- Convert source: **12 MiB** per file, **8** files per batch
- Resulting MD: **200,000 characters** to **Add to Jev’s State** (same as §15). Download / Save / Add to the LLM may still use a larger preview; warn if over.
- Never upload. Never a convert API. Never read `.env` / `.env.local`.

### Jev token window (TypeSafe snapshot)

Source of truth: [`docs/jev/typesafe/models.md`](jev/typesafe/models.md) (fetched 2026-09-19):

- **64k tokens per request** (`state` + all questions combined)
- **32k tokens** for `state` plus the **single longest question**

OpenRouter’s Jev 1.13 listing in this snapshot still says **32,000** context — treat that as **stale vs TypeSafe**. UI copy: **Jev context window ~64,000 tokens** (TypeSafe), with a note that **state + longest question** is **32k**.

Rough estimate: `ceil(chars / 4)`. Show estimated tokens on the Convert page for the resulting MD.

- **Warn** if the MD (or MD + current Jev’s State) would exceed **32k** (state + longest question).
- **Error** (block **Add to Jev’s State**) if the MD alone, or MD + current case, would exceed **64k**. Download / Save / Add to the LLM still allowed.

### Never

- Images into Jev
- OCR / Tesseract / cloud PDF APIs
- New upload endpoint
- Secrets in convert output or history

---

## Remaining (prototype)

Not a new product contract — known leftover work as of **2026-09-20**. Core loop, ten snaps, Docs, Convert, and basic Settings are in. **Do not** treat DeepSeek empty pane prose / answers-in-Thoughts as an app bug. Leftover mill here is still that **weekend Workshop**: at-a-glance of **how Jev works**, practice + inspiration so people go build their own — not a roadmap to the last mill, not deep serious work, not a claim to beat higher-level play. Inspector overlay, Docs first-paint, mill-bar polish, and extra tools are **not** this metric.

### Blocker for a public showcase tweet

A public showcase, when it happens, is that weekend glance — **how Jev works**, as practice and inspiration so people go build their own apps. Do **not** pitch Talk to Jev as the definitive mill, as deep serious work, or as beating every higher-level player.

- **Mill-bar hover** — signed off (2026-09-20). Stay/pin is the **14px `.mill-bar` strip** only. Click-in-**pane** (LLM / Jev / Inspector body) does not pin; moving off the strip starts hold+fade. User-facing board name is **pane**, not mill/module.
- **Nater walks the Tour** — agent-owned copy is in `src/tutorial.ts` + `docs/TOUR.md`. He will personally click through. Do not call the Tour “done” without him.

### Should-do before a comfortable OSS demo

- **Inspector overlay covers LLM Send.** Fixed bottom panel (`z-index: 40`, default height 280px) paints over the composer. Operator must **Close** first. SPEC §6.7 does not yet say the overlay must leave Send clickable; either raise the board bottom while open or shrink the default height.
- **Docs first-paint race.** Rail shows **Loading snapshot…** and the reader **Pick a page** until `GET /api/docs` returns. `ready` avoids a false empty-catalog message; persisted type tags still drive **Clear** before files load. SPEC §6.2 already names the flash.
- **Tour markdown vs live copy.** After v0.38, pane-head buttons are four Tour steps (SPEC §6.4). Keep `docs/TOUR.md` 1:1 with `src/tutorial.ts` (live SoT), including Nater’s walk bodies on `case` / `llm` / `jev`.
- **Open-source pre-flight re-run** before any “we’re clean” claim. **This session (2026-09-20):** no `.env*` ever tracked; HEAD key-shaped hits are scrub **regexes** only (SPEC / `devLog` / settings sanitizer / docsEmbed); `npm audit` **0**; live CSRF: cross-site `text/plain` POST `/api/settings` **403**, same-origin JSON POST **200**, header-less GET `/api/health` **200**, foreign `Host` **403**. Re-run before the next public claim — do not trust this paragraph forever.

### Nater-owned

- **Tour walk** (above) — his click-through, not an agent checkbox.
- **Personal info in the public repo.** `docs/SPEC.md` line 5 folder path `C:\Users\uttle\…` (Windows username). Default weather **Columbus, OH** (`server/weather.ts`, `src/weather.ts`, §6.1 / §11 / §13). Do **not** scrub or change the city unless he says so. Cookbook emails inside `docs/jev/` are upstream TypeSafe examples, not his.

### Nice-to-have / later

- Search, direct OpenAI / Anthropic / Tavily / Brave calls — Settings **saves** those keys; MVP **does not call** them (already §2).
- `SECURITY.md` / `CONTRIBUTING.md` / GitHub Actions `npm run build` already exist.
- Inspector FlipTip can overlap **Jev’s Questions** while the toggle is focused.
- Optional: same-origin JSON `Content-Type` on every POST including `/api/docs/update` (client now sends JSON; server still skips `jsonBody` on that route — do not fold this into the CSRF gate).

### Explicitly not a gap

- DeepSeek (or other floor models) putting reasoning in **Thoughts** and leaving the pane body thin — model channel, not our bug.
- CSRF gate (`dbe5102`) — do not retouch.
- Keys server-side in gitignored `.env.local`; health booleans; settings last-4.
- Core Workshop loop (LLM tools + Ask Jev + Send answers to LLM).
- Violence gate (`server/violenceGate.ts`, SPEC §5.4) — refund / abuse-risk tickets still work; blocked class never reaches Decisions.
- Ten Example Uses / Preset States snaps (reviewed).
- Convert tab (browser-only txt/html/docx/pdf).
- Basic Settings (OpenRouter + unused slots + LLM instructions).
- In-repo `docs/jev/` snapshot + Nice / Code / Iframe.
- README (OSS prototype, `.env.local`, port 5182, Jev pin, Nathan Uttley).
- **Update Jev docs** on the Docs page toolbar (not chrome-right). Chrome-right is **Tour** only.
- `X-Title` OpenRouter header; **2 MiB** `readBody` cap / 413 in SPEC §7.
- Never-font / never ALL CAPS: Public Sans + Fragment Mono only; `text-transform: none` on chrome (no Bricolage, no uppercase stamps).
- DOMPurify on Docs Nice view, LLM bubble prose, and Jev’s State read view (`src/markdown.ts`).

