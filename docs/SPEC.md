# Talk to Jev — SPEC

**Status:** v0.26 — 2026-09-20  
**Product:** Talk to Jev  
**Folder:** `C:\Users\uttle\Projects\Talk to Jev`  
**GitHub:** public [`talk-to-jev`](https://github.com/NatersGonnaN8/talk-to-jev) (flipped 2026-09-19 after the §14 security checklist)  
**Local:** Vite UI + API on `http://127.0.0.1:5182` (`strictPort`, bind `127.0.0.1` only)

This file is the contract. Code trails these decisions.

---

## 1. What it is

An MVP workshop that **wires two different AIs** through **one OpenRouter key**:

| Side | Model (default) | OpenRouter route | Job |
|---|---|---|---|
| **LLM** | `deepseek/deepseek-v4-flash` | `POST /api/v1/chat/completions` | Talk. Draft. **Tools** write Jev’s State and Jev’s Questions. **Random state** invents a mill once. **Agentic loop** is the N-turn LLM↔Jev loop on the current mill. Explain answers. Never a JSON dump as the product. |
| **Jev** | `typesafe/jev-1.13` | `POST /api/alpha/decisions` | Typed snap decisions: **choice**, **noul**, **score**. Never prose. |

Jev is TypeSafe’s first **System One** model. It is **not** a chatbot. You send `state` + typed `questions`; it returns `answers` with probabilities. Named after Jevons. Official docs live in this repo under `docs/jev/` and can be refreshed in one click.

The LLM is the cheap prose half. Jev is the cheap decision half. The app is the wire between them.

**Names (2026-09-20).** TypeSafe’s contract is **state** (what Jev judges) + typed **questions**. Official snapshot: `docs/jev/typesafe/concepts/state.md` and `docs/jev/typesafe/introduction.md`. The mill ticket **Jev’s State** is that `state`. Gallery chrome is **Example Uses** (not “Use Cases”) so it does not collide with Jev state. Tool name `set_jev_case` and URL `?case=` stay unless client+server both change.

**Weather is one use case, not the product.** Nater (2026-09-19): “Weather is literally one use case.” Nine of the ten snaps are **operator / business** decisions. Live conditions come from **Open-Meteo** (free, no API key), fetched server-side, and written into **Jev’s State** **only for the Jacket preset**. Still **one OpenRouter key**.

---

## 2. Non-goals (MVP)

- No TypeSafe-native key (`TYPESAFE_API_KEY`). OpenRouter only.
- No images/audio/video into Jev (Jev is text/JSON only).
- No accounts, no server-side history, no sending threads to a new backend.
- Workshop history is **this browser’s localStorage only** (this machine, this origin). Refresh restores it.
- Never persist `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, or any other secret in localStorage / history JSON. Chat history is local; keys are not.
- OpenAI / Anthropic / Tavily / Brave may be **saved** in Settings (BYOK). They are **not called** in MVP. OpenRouter still powers the LLM and Jev.
- No multi-user, no deploy, no billing UI.
- Do not call Jev via chat completions (that 400s). Do not ask Jev to write poems or code.
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
  - `LLM_MODEL` default `deepseek/deepseek-v4-flash`
- If OpenRouter is missing, **Settings** says so and both Ask buttons stay disabled with a reason. Chrome has **no** key-status pill. Never log any key. Never show the full key in the UI.
- **Load weather** and sample presets do **not** need any API key.

Referer headers on outbound OpenRouter calls:

- `HTTP-Referer`: `http://127.0.0.1:5182`
- `X-OpenRouter-Title`: `Talk to Jev`

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

1. **UI:** header button **Update Jev docs** on every page → `POST /api/docs/update` → rewrite snapshot → toast with counts. After a **successful** update, refresh the Docs list **and** re-fetch the currently selected page (same slug/path, cache-bust so the reader is not leftover bytes). Keep that page selected if it still exists. If it vanished, clear to the empty picker. If the Tour overlay is open, still reload the doc behind it.
2. **CLI:** `npm run update-jev-docs`

Failed fetches are recorded in the index; a partial update is still committed-worthy. The button does not require the OpenRouter key (docs are public).

---

## 5. How the two AIs are wired

Shared **Jev’s State** (the Jev `state`) sits in a ticket strip at the top. Both models see it. This is **not** the **Example Uses** gallery.

| Action | What happens |
|---|---|
| **Ask the LLM** | Chat completions **with tools** (`POST /api/v1/chat/completions`). System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. Jev’s State text (including any weather block and any **attach** blocks from local files) is the current state. The cheap LLM **must use tools** to mutate the Workshop — it does **not** paste a questions/state JSON blob into the chat as the product. Short confirmation in the thread. |
| **Ask Jev** | Decisions API. `state` = Jev’s State text (same string: situation, weather block, attached blocks), plus optional `{ transcript }` of the LLM thread. `questions` = the editor on **Jev’s Questions**. If any question **id is blank**, show a clear **inline** error on that card and **do not** call Jev. Never silently invent an id (`q_*`, random suffixes, or similar). The LLM may call the same path via the `ask_jev` tool when the editor is **clean**. |
| **Propose questions** | Button **Propose Jev questions** (and chat like “send it to state and propose Jev questions”). The LLM **must** call tools: `set_jev_questions` always for this intent; `set_jev_case` when the user asked to write the ticket. Valid maps **replace** the question cards immediately. Chat shows a **short confirmation**, not the JSON. Skip entries with a blank id — do not mint a placeholder. Do **not** call `ask_jev` from this button — leave **Ask Jev** as the click. If the user then **Ask Jev** with a still-blank id, same inline error as above. |
| **Feed Jev → LLM** | Reverse wire. Build a user-visible summary of typed answers (choice / noul / score / confidence) and **immediately stream** `/api/llm` on the **same path as Send** (SSE: delta / thought / tool / done). Show the You bubble, then mill thinking / the streamed assistant reply. Do **not** park the note for a second Send click. Do **not** insert a canned assistant one-liner. Disabled when there are no Jev answers yet (do not fake a send). Does **not** go through LLM tools. Nater (2026-09-20): pass immediately to the LLM, same path as hitting Send. **Random state** analysis and **Agentic loop** later turns use this same send-now path so Jev’s typed answers round-trip into the next LLM turn. |
| **Random state** | LLM pane-head mill row, **left of Agentic loop**. Label **Random state** (mixed case, Public Sans like `.nav-btn` — not ALL CAPS, not a stamp). Click **runs once** — **no** turn-count popover, **no** “How many turns”. Invents a short scenario → `set_jev_case` → 3–5 mixed questions (`set_jev_questions`) → `ask_jev` → feed typed answers to the LLM for a short analysis → **stop**. Does **not** continue into turn 2…N. Does **not** load a Preset States snap. Unlock when that one-shot finishes or errors. Nater (2026-09-20): split from the bundled mill. |
| **Agentic loop** | LLM pane-head mill row, **right of Random state**, **left of Propose Jev questions**. Label **Agentic loop** (mixed case, Public Sans like `.nav-btn`). This is the N-turn LLM↔Jev loop **only**. It uses the **current** mill (preset, operator-written, or whatever Random state just invented). It does **not** invent a new random state. Click opens the mill popover: **How many turns do you want to do?** with options **3** through **10**, default **3**. Opaque mill card, fully on-screen, flip above/below, high z-index. **Confirm** starts N `/api/llm` SSE sessions; **Cancel** (or Escape / outside click) aborts — no run. Mill may show **Turn k of N**. Unlock when the loop finishes or errors. If there is no state / no real-id questions: **disable** and mill-warn — do **not** silently invent. Random state is the invent path. Nater (2026-09-20). |
| **Load weather** | **Jacket preset only.** Server fetches Open-Meteo for the ticket location. Current conditions + a short forecast are written into a marked **weather block** on Jev’s State. Does not call Jev or the LLM. Hidden on business presets. |
| **Sample state** | One pick (**Preset States** menu **or** Example Uses card) loads the same `src/samples.ts` preset: Jev’s State situation (weather placeholder **only** on Jacket), Jev questions, short label. Clears prior Jev answers and the LLM thread so the last state cannot leak. |
| **New State** | Full Workshop reset to an **empty** Workshop. Saves the open thread if it is worth keeping, then loads **no** Preset States item (not `invoice`, not Jacket, not any other sample id). Clears Jev’s State text, attached `.md` chips, Jev questions (one blank-id noul card), Jev answers, the LLM thread, and weather chrome. Strips `?case=` from the URL. **Preset States** shows none selected. Not History **Clear current**. |

Code owns routing. The UI shows probabilities; it does not pretend a typed answer is “correct.”

**Empty Workshop (first-open with no active thread, and New State):** no sample id. Jev’s State textarea empty. One blank-id noul question (same as **Add question**). No Jev answers. Empty LLM thread. Weather row hidden. **Preset States** none selected. **Invoice exception** stays in the catalog — pick it from **Preset States**, Example Uses, or `?case=invoice`. It is not the empty session. Nater (2026-09-20), on **New State**: “somehow this brings it to preset case about the invoices, fix please.” See §12.

### 5.1 Random state — invent once, then stop

A **turn** is one `/api/llm` SSE session: one You bubble plus one assistant stream (thoughts / tool cards / prose). During a turn the LLM may call `set_jev_case`, `set_jev_questions`, and `ask_jev`. **`ask_jev` actually POSTs `/api/jev`** (same Decisions path as the **Ask Jev** button). Typed answers apply to the Jev pane immediately.

**Random state** is **not** the N-turn loop. Click runs this one-shot, then **stops**. Two `/api/llm` sessions, no turn picker:

1. **Invent.** LLM invents a **short** imaginary scenario (just enough facts to judge) → `set_jev_case` fills Jev’s State. Then **3–5** atomic questions, **at least one noul, one score, and one choice** → `set_jev_questions` (real **snake_case** ids; choice keys become mill numbers `"1"` / `"2"` / …; **descriptions are the values**). Then `ask_jev`. Mode on this request: `random-case`. After tools, a short confirmation — not a novel.
2. **Analysis.** Feed Jev’s typed answers to the LLM (send-now path, mode `chat`) for a **short analysis**. Then **stop**. Do **not** continue into turn 2…N. Do **not** ask “How many turns”.

Code: `runRandomState` — its own entry point. Do not share a runner flag with Agentic loop.

Idle mill row shows **Random state**. While this run is in flight the mill slot shows mill thinking (**Thinking**), not Turn k of N. Unlock when the one-shot finishes or errors.

### 5.2 Agentic loop — N-turn LLM↔Jev on the current mill

**Agentic loop** is the N-turn loop **only**. It uses whatever is already on the mill: a Preset States snap, operator-written state/questions, or the mill **Random state** just invented. It does **not** invent a new random state (`set_jev_case` must not replace the ticket with fiction).

If Jev’s State is empty **or** there is no real-id question: disable **Agentic loop** and mill-warn (opaque FlipTip / toast: needs state and questions). Do **not** silently call Random state’s invent path.

Click opens the mill popover **How many turns do you want to do?** Options **3–10**, default **3**. Opaque mill card (`#F3E7D3`), fully on-screen, flip, high z-index. Confirm starts; Cancel aborts.

Chosen count **N** is **3–10**. That many `/api/llm` SSE sessions run. Typed answers **round-trip into the next turn**: the next `/api/llm` body includes `jevAnswers`, and the user message is the **Feed Jev send-now** note (typed summary streamed on the same path as Send — not a canned assistant one-liner). The operator does not type between turns.

1. **Turn 1.** Use the **current** state + questions. Call `ask_jev`. Mode on this request: `agentic-loop`. Do not invent a scenario. May call `set_jev_questions` only if the editor is dirty or a new option is needed, then `ask_jev`.
2. **Turns 2 … N−1.** LLM may refine questions, `ask_jev` again if it needs a new snap, then reason about the probabilities. Each of these starts with the Feed Jev send-now note from the latest answers (mode `chat`). Do not invent a new random state.
3. **Turn N (last).** Analysis for the operator. Do not invent Jev answers. Prefer not to call `ask_jev` unless the pane still has none.

**Jev awareness (every mill action, including chat):** Jev **cannot invent answers that were not given**. Choice = listed options only (mill numbers + those descriptions). Noul = P(true) in [0, 1]. Score = one of the legend levels. A new option is a new question map: `set_jev_questions` then `ask_jev` again — never claim Jev picked something that was not on the card.

Idle mill row shows **Agentic loop** next to Random state. While the loop is in flight the mill slot shows mill thinking (**Turn k of N**). Unlock when the loop finishes or errors.

Code: `runAgenticLoop(n)` — a second entry point, not a flag on `runRandomState`. Tools stay `set_jev_case` / `set_jev_questions` / `ask_jev`.

---

## 6. Pages

Global chrome (all pages):

- Left: product name **Talk to Jev** (links home Workshop)
- Nav: **Workshop** | **Example Uses** | **Docs** | **Settings** | **Convert**
- **Convert** sits **after** Settings. Visible label **Convert**; `title` and accessible name **Convert to Markdown**. Route `/convert`.
- Right: **Tour** (Help — restarts the first-run coach overlay), **Update Jev docs** (after success: refresh the Docs catalog and the open reader — §6.2)
- **History is not in chrome-right.** It lives on the **Jev’s State** row only (Workshop). Same local-thread drawer. Tour / Update Jev docs stay in the header. **Inspector** lives on the LLM pane (§6.7), not in chrome.
- **No chrome key-status pill** (no Key ready / Need key / Checking…). Keys live in **Settings** (nav tab + `/settings`). `/api/health` still runs so Ask buttons can lock when OpenRouter is missing. Never show the full key.
- No native textarea resize grips. Pane widths use a custom vertical splitter (quiet mill/pine seam — not a dashed orange hatch).
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
  [ shared state textarea ]
  [ drop .md into Jev’s State; convert formats go to the Convert tab ]
  [ LLM pane | splitter | Jev’s Questions pane ]
```

- **Viewport panes (2026-09-20).** Nater selected `article.pane.llm` (measured ~2086px tall vs vh 1243, `overflow: visible`, `maxHeight: none`; window/page grew with the thread). Chrome stays. **Jev’s State** ticket stays **above**. `.board` fills the **remaining viewport** (`100dvh` minus chrome minus ticket) — **not** document-tall. Each pane is a column: **pane-head stays put**. LLM **thread** is the scroller (`overflow-y: auto`). Jev **q-list + answers** share one inner scroller (`.jev-scroll`, `overflow-y: auto`). Window `scrollY` stays ~0 while those lists scroll. Custom panes — no native `resize` grips. Same pattern as Docs `.doc-list`.

**Jev’s State** (the state ticket — **not** Example Uses cards)

- Label: **Jev’s State** (this is Jev’s `state`). Ticket heading is `h2.pane-title` — **same size as Jev’s Questions** (1.05rem / 16.8px, weight 650, letter-spacing 0.01em, mixed case). **Not** an uppercase wide-tracking stamp (`JEV’S STATE`). Nater (2026-09-20): he despises that blocky look. Same day: match pane-title size for same-tier headers.
- Checkbox **Include LLM chat in Jev state** (default on)
- **State tools** row — **three** controls. **Do not** show the ten snaps as a chip row. Nater (2026-09-19): scribble on the Invoice exception … Jacket? pills; replace them.
  1. **New State** — full reset of the Workshop to **empty**: Jev’s State text (blank), attached `.md` chips, Jev questions (one blank-id noul card; do not mint a real id), Jev answers, LLM chat, weather chrome hidden, `?case=` stripped. Save the open thread if it is worth keeping (existing history rule). **No** sample id — **Preset States** shows **none selected**. Do **not** load Invoice exception or any other preset. Include-chat on. Not a half-reset. History **Clear current** still only empties the LLM thread and last Jev answers. Nater (2026-09-20): New State must not bring the invoices preset.
  2. **Preset States** — one pill that opens a list (opaque dropdown / popover — slick, usable, flip fully on-screen). The ten snaps still exist (9 business + Jacket) in `src/samples.ts`. Picking one loads state + questions like today (clears answers + LLM thread, marks that preset selected). Example Uses stays the gallery; both stay in sync via that module.
  3. **History** — opens the local thread drawer. **Only** on this row. Not duplicated top-right.
- **Weather row:** shown **only** when the active preset is **Jacket?** (`jacket`). Location field (default **Columbus, OH**) + **Load weather**. **Hide** the row on the nine business presets (do not leave a disabled weather form that still makes the Workshop look like a weather app). Accepts a city / “City, ST” (Open-Meteo geocoding) or `lat, lon`. Loading does not require the OpenRouter key.
- Textarea, `resize: none`, fills the ticket. **Load weather** (Jacket only) replaces the marked weather block (or prepends one).
- **Add .md** (file picker, `accept=".md,.markdown,text/markdown"`, multiple): local user markdown is inserted into Jev’s State as `state`. Official `docs/jev/` snapshot stays in Docs; do not auto-insert it. There is **no** Convert to Markdown button on this ticket — that UI lives on the **Convert** tab (§6.6 / §16).
- **Drag-and-drop** onto the whole Jev’s State ticket (including the textarea). **Mix:** `.md` / `.markdown` stay on Workshop and go **into Jev’s State**. Convert formats **navigate to `/convert`** (the Convert tab) with **per-file progress**. Do not dump convert UI back into the state row. Unsupported types: inline error on the ticket. See **§15** and **§16**.
- Attached names list near the ticket. Remove one = strip that attach block. Weather / situation text stay.
- Helper: “Jev judges this. The LLM can draft it. Drop .md into Jev’s State. txt / html / docx / pdf go to Convert.” On Jacket only, add: “Weather is Open-Meteo input, not a model.”
- After a successful weather load, a one-line status under the row: resolved place + now summary (e.g. `Columbus, Ohio · 72°F · Partly cloudy`). Toast on failure.
- Size-cap attachments so a huge dump cannot freeze the UI. See **§15**. Convert caps: **§16**.
- Tip on **Add .md** is fully opaque, flip above/below so it stays on-screen. Convert-file tips live on `/convert`.

**LLM pane** (manila / prose)

- Heading: `h2.pane-title` **LLM** (acronym as written) — **same size as Jev’s Questions** (1.05rem / 16.8px, weight 650, letter-spacing 0.01em). Model id is subtitle/meta (`code`), not a second heading.
- Scrollable transcript (user / assistant) lives in `.thread` — **that** is the pane scroller, not the window. Composer stays under the thread. Assistant turns are **agentic**, not a single JSON dump in the bubble.
- Composer: textarea (`resize: none`) + **Send**
- Secondary mill row: **Random state**, **Agentic loop**, **Propose Jev questions**, **Feed Jev to LLM**, **Inspector** (§6.7). Public Sans like `.nav-btn`. Pane-title size only on headers. Mixed case, never ALL CAPS CSS.
- After Jev has answered: **Feed Jev to LLM**. Click builds the Jev-answers user message and **immediately POSTs** `/api/llm` (same `sendLlm` / SSE path as **Send**). The composer may stay empty; **Send** stays disabled until they type. Show the You bubble, then mill thinking / streamed assistant reply. Do **not** wait for a second click. Do **not** insert a canned “Got Jev’s typed answers…” assistant line. If there are no Jev answers yet, keep the button disabled (do not fake a send). **Random state** analysis and **Agentic loop** later turns reuse this send-now path.
- **Random state:** click runs the invent one-shot (§5.1). No popover.
- **Agentic loop** mill popover: **How many turns do you want to do?** Options **3–10**, default **3**. Confirm starts; Cancel aborts. No ALL CAPS. Opaque, flip, fully on-screen, high z-index. See §5.2. Disabled / mill-warn when the mill has no state or no real-id questions.
- Empty: “Draft the state, or ask how to phrase a Jev question.”
- **Send** streams `/api/llm` SSE into the open assistant turn. Keep the user + assistant pair on screen. History persist / preset reload must not wipe an in-flight or just-finished turn. **Feed Jev to LLM** uses this same stream.
  - `{ type: "thought", text }` — incremental **actual** reasoning from OpenRouter (`reasoning`, `reasoning_content`, or `reasoning_details` text/summary). Accumulate `text`. Never invent thoughts. Encrypted / `[REDACTED]` chunks are not thoughts.
  - `{ type: "delta", text, replace? }` — incremental assistant prose. Accumulate `text` (this is **not** OpenAI `choices[0].delta.content`). If `replace` is true, that turn’s prose becomes `text` (used when a question-list dump is swapped for a short confirmation).
  - `{ type: "tool", id, name, status: "running"|"done", ok?, argsSummary, resultSummary?, ... }` — apply immediately. On `done` + `ok`, `set_jev_case` / `set_jev_questions` / `ask_jev` still update the ticket, q-cards, or Jev answers. The **transcript** shows a tool card, not the JSON.
  - `{ type: "error", message }` stays **in that assistant bubble**. `{ type: "done" }` ends the stream.
- **Thinking chrome.** While `/api/llm` is in flight, the open assistant turn shows a slick mill **thinking** state (telegraph stamps + a pine nib on a manila track — custom CSS, not a stock spinner-only afterthought). Show it before the first prose token and while thoughts are streaming. Hide it in the bubble once assistant prose is on screen (tool cards may already be visible). Also show the same mill in the LLM **pane-head mill slot** (idle that slot is **Random state** + **Agentic loop**, left of **Propose Jev questions**) for the whole in-flight window so it stays on-screen when the last bubble is below the fold. During an **Agentic loop** run the mill label is **Turn k of N**. During **Random state**, Send, or other LLM work the mill label is **Thinking** (Propose uses **Proposing**). `prefers-reduced-motion: reduce` → static pine bar, no motion. Nater (2026-09-20): “add a nice thinking animation to LLM, stream the actual thoughts if possible in a nice collapsible agentic UI, and add nice tool calls as well.”
- **Thoughts block.** If any thought text arrived, show a collapsible mill aside (pine left rule, manila fill, Public Sans **Thoughts** — same family as `.nav-btn`, not Fragment Mono). **Open while streaming / still thinking** so live thought text is visible (the operator can still collapse mid-stream). **When that thought group completes** (the mill already reads **Thoughts done** — the same moment `.llm-agent-toggle` leaves the streaming meta: assistant prose started on that bubble, or that bubble’s SSE stream ended): **auto-collapse** that mill. `button.llm-agent-toggle` is `aria-expanded=false`, chevron ▸, body hidden. Default closed once done. The operator may click to expand. Auto-collapse runs **once at the done transition** for that bubble — do **not** re-collapse on later parent re-renders if they opened it. Each assistant bubble is independent (Random state / Agentic loop / multi-turn): a finished thought group collapses when *that* group is done, not only the latest. History restore of a finished turn starts collapsed (already done). Do **not** collapse tool cards (`Jev’s State` / `set_jev_case`, Ask Jev, and the rest) — only `.llm-thoughts`. If the floor model (`deepseek/deepseek-v4-flash` by default) has no reasoning channel, keep thinking chrome and **hide** an empty thoughts block — do not fake copy. Nater (2026-09-20): after a stream finishes, Thoughts often stayed expanded; the mill should start collapsed when done.
- **Tool cards.** Each call is a collapsible mill card: tool name (plus a short human label), stamp Running / Done / Failed, short args summary, short result. Not a questions-map table in the bubble. Propose / “send it to state” must look like `set_jev_*` tool use. Cards persist on the message in History. `ask_jev` args summary reads **Current state + questions** (not “case”). Tool **ids** stay `set_jev_case` / `set_jev_questions` / `ask_jev` — do not rename the LLM tool contract.
- **Inspector** toggle sits in this pane-head (after Feed Jev). Mixed case, Public Sans like `.btn.ghost` / `.nav-btn`. Not ALL CAPS. Opaque FlipTip. See §6.7. The log panel is a **fixed bottom overlay** (not a flex sibling of `.board`, so viewport pane-scroll stays). Not chrome-right, not Settings.

**Jev pane** (blueprint / typed) — header `article.pane.jev > header.pane-head`

- Heading: **Jev’s Questions** (not all-caps `JEV`)
- Subtitle / meta: model id (`typesafe/jev-1.13` by default). Keep it as meta, not a second heading.
- Keep **Ask Jev**
- Question cards + answers scroll together in `.jev-scroll` under the pane-head (Ask Jev stays put). Do **not** grow `article.pane.jev` past the board.
- Question editor: add / remove questions
  - Fields: id, type (`choice` | `noul` | `score`), instructions
  - **Add question** inserts a new card with an **empty id**. The user types the id. Do **not** auto-generate `q_*` / random suffixes. Only **user-added** cards start blank — presets keep their real ids (`wear_jacket`, business ids, and the rest in `src/samples.ts`). After click, focus the new card’s **id** input (caret ready to type; `document.activeElement` is that field, not the Add question button). `useEffect` + `requestAnimationFrame` on the new card uid. First-open / New State’s already-blank card does **not** steal focus on load.
  - Id input placeholder: `question id` (a hint, not a fake value). The field value stays empty until they type.
  - Question **id** is an editable label, not a React identity. Each q-card keeps a **stable uid** as its React `key` so typing does not remount the input or steal focus (`document.activeElement` must stay the field). Renaming an id updates that card **in place** — do not delete-and-insert under the new string (that remounts after one character). Blank **Add question** still starts with an empty id (internal map key may be `__blank__:uuid`). Nater (2026-09-20): typing into `vendor_claim_valid` / `action` dropped focus after one character because `key={id}`.
  - **Space → `_` (snake_case typing).** ASCII space in the question **id** input and in each choice **option description** input becomes `_` as you type (paste included). Instructions textarea stays **prose** (spaces stay spaces). Score level labels and noul true/false criteria stay prose. Nater (2026-09-20).
  - **TypeSafe snapshot (`docs/jev`) — what actually has to be spaceless.** Question **ids** and Choice **option names** (criteria **keys**) are JSON map keys (`questions` / `criteria`). Examples are snake_case with no spaces (`department`, `is_urgent`, `returns`, `wear_jacket`). The autoresearch cookbook slugifies names to `[a-z0-9_]` because they become question ids. The SDK/API does **not** reject spaces in string **values**: `instructions` and option **descriptions** are typically prose (“Which team should handle this?”, “Exchanges, wrong or damaged items”). Workshop still snake-cases **option description** typing because there is no option-key box — the description field is what the operator types on each row. Positional keys `"1"`, `"2"`, … stay the keys sent to Jev.
  - New-card defaults (empty editor UX): type `noul`, empty instructions, empty true/false criteria. Switching type to **choice** starts two rows numbered **1** and **2** (empty descriptions). Score stays Low / Medium / High. Noul stays empty true/false criteria.
  - **Choice options: no option-key text box.** Do not mint `option_a` and do not type `1` into an input. Show a slick **1-based number to the left** of each option description (1, 2, 3, 4 — never 0). That number **is** the choice key passed to Jev (`"1"`, `"2"`, …). Users only fill the description. **Add option** appends a new numbered row; remove/reorder keeps numbers in visual order. Each option row keeps a **stable uid** as its React `key` (not the displayed number, not a typed key). LLM `set_jev_questions` may still emit semantic option keys (`refund` / `deny`, `pay` / `hold`); rewrite those to positional numbers **on the card** and **when sending to Jev**. No key field → nothing to steal focus. Nater (2026-09-20): option keys were a second focus-stealing field; positional numbers replace them.
  - **Choice criteria sent to Jev (2026-09-20).** TypeSafe Choice is a map of **option name → description**; both go to the model. Our names are the mill numbers. The Decisions payload must be positional keys → **description text**: `{ "1": "papaya", "2": "banana" }`, never `{ "1": "1" }` (description = key) and never empty values when the card has text. Score still sends ordered legend strings (Jev answers `0 Low` / `1 Medium` / `2 High`). Do not bring back the option-key input. Do not stop Space → `_` on description typing.
  - **Add option** after click: focus the **new** row’s description input (`document.activeElement` is `Option N description`, not the Add option button). `useEffect` + `requestAnimationFrame` on the new option uid. Nater (2026-09-20): Add option left focus on the button so he could not type immediately.
  - Score: ordered level lines (min 2)
  - Noul: optional true / false criteria
  - Blank id on **Ask Jev** (or sending the editor through the propose → ask flow): inline error on the card, do not call Jev, do not invent an id.
- **Ask Jev**
- Answers: one card per question
  - Choice: selected option, probability bars, confidence stamp. Bar labels are **`1 papaya`** (positional number + description) — the same pattern as score **`0 Low`**. Jev’s choice answer is keyed by the option **name** only (`"1"`); it does not return a legend. The Workshop joins the description from the criteria we sent (and persists that as `legend` on the choice answer). Bare `1` / `2` / `3` with no description is a bug.
  - Noul: 0–1 meter (P(true), not a separate confidence)
  - Score: numeric score, level legend, probability bars, confidence (`0 Low` / `1 Medium` / `2 High`)
- Usage line: input tokens + cost when OpenRouter returns them
- Empty answers: “Define questions, then ask Jev.”

**Splitter:** drag the shared vertical edge between LLM and Jev. Not a native resize handle. Nater (2026-09-19): the old style looked like “a sick candy cane” — dashed orange hatch on cream with a pine stripe. **Visual:** a thin, quiet mill/pine divider (hit target stays wide enough to grab). Rest: 1px `--line` seam, mill-floor gutter, `cursor: col-resize`. Hover / while dragging: the seam widens slightly to pine so it reads as a handle — no dashed circus stripe, no orange/blue hatch, no garnish. Hidden on mobile; panes stack full width. `resize: none` on textareas; never CSS `resize` for layout. Convert is **not** a third Workshop pane — it is its own tab (§6.6). That page may use the same quiet splitter between its file list and preview.

**History** (local threads, overlay drawer — not a permanent sidebar):

- **Jev’s State row History** opens a left drawer over the Workshop (sage mill, like the Docs rail). Backdrop click or Escape closes it. No native resize grips. Drawer behavior (localStorage) is unchanged; only the **opener** moved off chrome-right.
- Chrome-right stays **Tour** / **Update Jev docs**. Do not duplicate History there.
- Drawer **New chat** — same full reset as row **New State**: save the open thread if it has anything worth keeping, then start an **empty** Workshop (no sample id, blank state text, one blank-id question, empty LLM thread, no Jev answers, **Preset States** none selected).
- **Clear current** — empty the open LLM thread and last Jev answers; keep the state ticket, include-chat checkbox, and question editor. This is the half-reset. **New State** is not this.
- Click a past thread to restore it: LLM messages, state text, include-chat, Jev questions (including blank-id `__blank__:…` cards), last Jev answers (if any), jevMeta, and selected sample preset id. Apply the **disk** copy of that thread; do not persist the open empty pane over it first.
- Title: auto from the first user line, else the state’s first line, else “Untitled state”. Optional rename (pencil); a renamed title stays until the user edits it again.
- Each row shows the title plus a timestamp (`updatedAt`).
- Delete one thread (trash). Deleting the open thread returns to the **empty** Workshop (same as **New State**). Deleting the last thread leaves that empty Workshop, not a ghost list item.
- Survives refresh. Reload hydrates the last `activeId` **before** any persist write: Jev’s State, LLM transcript, questions, answers, jevMeta, include-chat. Do **not** mint a new empty thread on boot. Do **not** let a leftover `?case=` replace that restored thread — only an in-session **Preset States** / Example Uses pick (session nonce) loads a preset. New State parks the open thread if it is worth keeping and starts blank **without** destroying other saved chats. Nater (2026-09-20): history for Jev’s State, LLM, and Jev’s questions wasn’t being saved / restored.
- Does not sync across browsers or machines.

**Mobile:** stack State → LLM → Jev. Splitter hidden; panes full width. History drawer uses most of the viewport width.

### 6.2 Docs — `/docs`

**Job:** read the stored Jev docs; refresh them.

Layout:

```
[ chrome ]                                          ← stays
[ search + sort + type chips (pinned in rail)
  file list scrolls inside the rail  |  [fold] |  reader ]
```

- Left: filterable list from `GET /api/docs` (path, title, source, fetched_at)
- Right: the selected file (`GET /api/docs/file?path=`)
- First paint may flash empty until `GET /api/docs` returns. Empty snapshot (after that fetch): explain **Update Jev docs** / `npm run update-jev-docs`.
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
- **Sanitizer (2026-09-20).** Nice-view HTML is `marked` then **DOMPurify** (`src/markdown.ts` `toNiceHtml`). The `docs/jev/` snapshot is untrusted third-party input: XSS on this origin can POST `/api/settings` same-origin (the CSRF gate does not stop same-origin). Use a real sanitizer — never a hand-rolled tag strip list. HTML profile only (no SVG/MathML). Forbid `style`, `form`, `svg`, `base`, `template`; drop `srcdoc` and `data:` URLs. Keep the `toNiceHtml(raw, path)` API so the Docs overlay does not grow a second sanitizer.
- Empty pane (no file yet): no overlay; “Pick a page from the snapshot.”
- **Update Jev docs** in chrome (same as Workshop). After a **successful** update: refetch `GET /api/docs` **and**, if a page is selected, refetch `GET /api/docs/file?path=` for that same path with cache-bust so the reader is not leftover bytes. Stay on that page if it still exists. If the path vanished, clear to the empty picker. If the Tour overlay is open, still reload the doc behind it.
- Empty snapshot: explain the button / `npm run update-jev-docs`

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

1. **Welcome** — two AIs, one OpenRouter key. The LLM talks. Jev does not write.
2. **Jev’s State** — this slip is Jev `state`. Drop `.md` here; other files open the **Convert** tab.
3. **LLM pane** — prose / draft / chat. Thinking chrome while it works; real thoughts if the model streams them; tool cards for Workshop mutations. **Inspector** (in this pane-head) shows logged `/api/llm` and `/api/jev` request/response JSON when toggled; recording never stops.
4. **Jev’s Questions** pane — typed `choice` / `noul` / `score` + **Ask Jev**.
5. **Propose Jev questions** (tools fill the q-cards) / **Feed Jev to LLM** (sends typed answers to the LLM immediately) / **Random state** (invent once) / **Agentic loop** (turn picker on the current mill) if those buttons exist.
6. **Example Uses** — nine operator snaps plus one weather snap (Jacket), same list as Workshop **Preset States**.
7. **Docs** — Nice view (rendered Markdown), Code view (raw snapshot), boxed-i Iframe **only when the live page will embed**. May navigate to `/docs`.
8. **Settings** BYOK if that page exists (optional later: OpenAI, Anthropic, Tavily, Brave — still no keys in the browser).
9. **Convert** — chrome **Convert** tab (`/convert`). Drop txt / html / docx / pdf here, or onto Jev’s State (that still opens this tab). Files stay in the browser.
10. **History** if the Jev’s State row control exists (not chrome-right).
11. **Load weather** if that control is **visible** (Jacket preset only; Open-Meteo input, not a third model). Skip when the weather row is hidden on a business preset.

**Code:** `src/tutorial.ts` (step list + storage helpers) and `src/TutorialOverlay.tsx`. Hook live controls with `data-tutorial` attributes. Overlay may switch Workshop ↔ Docs for those steps, then continue.

**Copy (2026-09-19):** All overlay walkthrough text lives in **one** module: `src/tutorial.ts` (`TUTORIAL_STEPS` titles/bodies plus `TUTORIAL_UI` chrome/controls). The overlay and the chrome **Tour** button **import** that module — it is the live source of truth, not a dump. Human-readable twin for chat and copy edits: [`docs/TOUR.md`](TOUR.md) (keep 1:1 with `src/tutorial.ts`). Do not leave tour strings inline in `App.tsx`.

**Do not:** use `<dialog>`, an iframe, `resize:` other than `none`, or a translucent card.

### 6.5 Settings — `/settings`

**Job:** BYOK home. Paste provider keys. Keys stay on this machine in gitignored `.env.local`. The browser never stores raw keys in localStorage.

Layout:

```
[ chrome ]
[ manila intro slip ]
[ five key rows ]
```

Page title **Settings** (`h1.pane-title`) matches **Jev’s Questions** size. Key-row names (`h2.pane-title`) are the same tier. Kicker `.eyebrow` (**Bring your own keys**) stays smaller.

Each row, in this order: **OpenRouter**, **OpenAI**, **Anthropic**, **Tavily**, **Brave**.

- Label + short why (OpenRouter = LLM + Jev today; others unused until search / direct models land)
- Password-style input + **Save** (no native resize grips)
- Status **Key ready** / **missing** without revealing the value. Ready may show last-4 only
- Tips (status / last-4 help) are **opaque**, fully on-screen, and **flip** (below if there is room; above if the row is low — never under sticky chrome)

Saving one row POSTs `/api/settings` `{ id, value }` and writes that env var on the server. Empty save clears the slot. Clear the input after a successful save. OpenRouter still powers LLM + Jev; do not wire Tavily / Brave / OpenAI / Anthropic live calls in MVP.

**No payload inspector here.** Keys-only. Logs live on the Workshop LLM pane (§6.7). Never log `POST /api/settings` bodies.

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

- LLM pane-head, **after** Feed Jev to LLM. Label **Inspector** (mixed case, Public Sans like `.nav-btn` / `.btn.ghost` — not ALL CAPS, not a stamp, not Bricolage). `aria-pressed` tracks open. `aria-controls` the panel. Opaque FlipTip (fully on-screen, flip above/below, pine-ink fill `#142018`): “Always recording. Keys never appear here.”
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
  - **Logged (redacted):** `/api/llm` request `{ messages, state, questions, jevAnswers, includeTranscript, mode }` and a useful response (reply / thoughts char count / tool summaries, plus inspect `sent`/`received` when the server emits it). `/api/jev` request `{ state, questions, transcript?, includeTranscript? }` and response `{ ok, model, answers, usage }` or `{ ok: false, message }`.
  - **Never logged:** API keys, `.env.local`, Settings POST bodies, health/settings last-4, Authorization headers.

**Do not** put this control on Settings. **Do not** put it in chrome-right (that stays Tour / Update Jev docs).

---

## 7. API (local Vite middleware)

All JSON unless noted. Never echo the API key. Never dump upstream bodies that might contain secrets. Bind `127.0.0.1` only; do **not** set wide-open CORS (`Access-Control-Allow-Origin: *`). Same-origin UI does not need CORS.

**CSRF gate (2026-09-19).** `cors: false` only stops other sites from *reading* responses; a malicious page in the operator's browser can still *send* a preflight-free POST to `127.0.0.1:5182` and swap the OpenRouter key or burn credits. So every `/api/*` request is refused with **403** when `Sec-Fetch-Site` is present and not `same-origin` / `none`, or when `Origin` is present and is not `http(s)://<Host>` (Host is trusted because Vite `allowedHosts` already 403s foreign hosts). POST bodies must be `Content-Type: application/json` or the server returns **415** (cross-site preflight-free POSTs can only be `text/plain` / form types). Requests with neither header (curl, address bar, same-origin GET) pass. Never relax this to `Access-Control-Allow-Origin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, hasKey, keys: { openrouter, openai, anthropic, tavily, brave }, jevModel, llmModel, docs: { files, fetchedAt } }`. All key fields are booleans. `hasKey` === `keys.openrouter`. Never last-4, never the secret. |
| GET | `/api/settings` | `{ ok, keys: [{ id, env, label, why, required, present, last4 }] }`. `last4` is four characters or `null`. Never the full key. May append empty unused slots to `.env.local` (does not change existing values). |
| POST | `/api/settings` | Body `{ id, value }`. `id` is `openrouter` \| `openai` \| `anthropic` \| `tavily` \| `brave`. Writes `.env.local`. Empty `value` clears that key. Response same shape as GET. **Never log the body.** Never echo `value`. |
| POST | `/api/llm` | Body: `{ messages, state, questions?, jevAnswers?, includeTranscript?, mode?: "chat" \| "propose-questions" \| "random-case" \| "agentic-loop" }`. Streams `text/event-stream`. Server runs an OpenRouter **tool loop** (key stays server-side). OpenRouter chat is requested with `stream: true` so thoughts and tokens can paint mid-round. Send `include_reasoning: true` (legacy; same as `reasoning: {}`) so models that expose reasoning will; if that 400s, retry the round without it. Do **not** send a high `reasoning.effort` on the cheap floor model. Each SSE `data` line is JSON: `{ type: "thought", text }` (omit if the model streams none — never fake), `{ type: "delta", text, replace? }` (`replace: true` replaces that turn’s accumulated prose), `{ type: "tool", id, name, status: "running"\|"done", ok?, argsSummary, resultSummary?, state?, questions?, answers?, model?, usage?, message? }`, `{ type: "inspect", channel: "llm"\|"jev", phase: "request"\|"response", title?, sent?, received? }` (redacted payload log — no keys; primer truncated), `{ type: "error", message }`, `{ type: "done" }`. Emit `status: "running"` when a tool’s arguments are ready, then `status: "done"` after execute (same `id`). Tool names: `set_jev_case`, `set_jev_questions`, `ask_jev`. `ask_jev` reuses the Decisions call (`POST /api/jev` path). Include latest `jevAnswers` on later turns so results round-trip. `argsSummary` / `resultSummary` are short (ids, char counts) — not a questions JSON dump. Never echo the key. Never dump a questions map as the chat product. The browser always records scrubbed `/api/llm` and nested `/api/jev` shapes in `talk-to-jev:dev-logs` (§6.7). |
| POST | `/api/jev` | Body: `{ state, questions, transcript? }`. JSON Decisions response (or `{ ok:false, message }`). Same path the `ask_jev` tool uses. |
| GET | `/api/docs` | Index of snapshot files |
| GET | `/api/docs/file` | Query `path` relative to `docs/jev`. Reject `..` |
| GET | `/api/docs/embed` | Query `url` = the live https source. `{ ok, embed, src }`. `embed: false` when X-Frame-Options / CSP would blank the iframe, or the URL is not a catalog source. No keys. |
| POST | `/api/docs/update` | Run the snapshotter; return `{ ok, fetched, failed, files }` |
| GET | `/api/weather` | Open-Meteo proxy. Query `q` (city or `lat,lon`) or `latitude`+`longitude`. Default `q=Columbus, OH`. Returns `{ ok, place, current, daily, hourly, text, json }`. `text` is the Jev’s State weather block. No OpenRouter key. |
| GET | `/api/geo` | Open-Meteo geocoding helper. Query `q`. Returns `{ ok, results: [{ name, admin1, country, latitude, longitude }] }`. Optional; **Load weather** may geocode internally. |

Errors: 403 cross-site, 413 body over **2 MiB**, 415 non-JSON body, 501 missing key, 400 bad body, 404 unknown place, 502 upstream. Messages may say “Jev request failed” without dumping upstream secrets. Weather errors must not mention OpenRouter. `POST /api/jev` and `POST /api/llm` return 501 when the key is missing. Error strings that look like keys (`Bearer`, `sk-or-`, `OPENROUTER_API_KEY`) are replaced with a generic failure. Jev success JSON is `ok`, `model`, `answers`, `usage` — do not spread the raw upstream object.

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
  - **Same-tier headers** — `h2.pane-title` “Jev’s Questions” is the size reference: Public Sans, **1.05rem / 16.8px**, weight **650**, letter-spacing **0.01em**, mixed case (`text-transform: none`). Same tier = other pane titles and page/section headers: LLM pane **LLM**, ticket **Jev’s State**, LLM **Inspector** panel heading, Convert **Files** / **Markdown**, History drawer title, Tour card titles, page titles **Example Uses** / **Settings** / **Convert to Markdown**, Example Uses card titles, Settings key names. Do **not** bump body, `.nav-btn`, or buttons to this size.
  - **Everything else** — Public Sans like `.nav-btn` (Workshop, Example Uses, Docs): LLM chat, question instructions, chrome labels, chips, kickers, mill labels, option mill numbers, Convert pane-head `.pane-meta`, Inspector column labels **To LLM** / **To Jev**. Kickers (`.eyebrow`) stay **smaller** than pane-title (mixed case, ~0.78rem, weight ~650, tracking ~0.01em).
  - **Fragment Mono** only for **real code**: question ids, model ids, env names, JSON (including Inspector request/response), Docs Code view, markdown `code`/`pre`, convert preview. Not for product chrome labels, thoughts kickers, type chips, stamps, Inspector chrome, or Convert pane-head helpers. `<code>` / `<pre>` wrap real code only — do not use them as a chrome wrapper.
  - **Never stylistic ALL CAPS** — no `text-transform: uppercase` on UI chrome. Acronyms as written (LLM, JSON, API) are fine.
- **Never font** (Nater 2026-09-20): **Bricolage Grotesque** is banned. So are **Cabinet Grotesk**, **Fraunces**, and that **whole blocky style** — quirky/wonky/naive grotesques, and all-caps + wide-tracking UI chrome. Do not load Bricolage “just for the wordmark.”

### 8.1 Scrollbars (Nater 2026-09-20)

Nater despises the **white Windows native track** on Jev’s State, the LLM thread, and Jev’s Questions. No Talk to Jev scroller may show that chrome.

**Where:** every overflow scroller — Workshop (Jev’s State textarea, `.thread`, `.jev-scroll`, composer / question textareas, thoughts), Docs (`.doc-list`, Nice / Code `.doc-view`, `pre` in Nice view), Convert (file list + preview), Settings / Example Uses if the page scrolls, History drawer, Preset States / Agentic loop popovers, Inspector lists + JSON, tour if it scrolls. Horizontal overflow gets the same treatment (arrows left/right). Native `resize` stays `none`.

**Paint:**

- **Track / gutter:** fully invisible. Transparent. No white, no grey trough, no reserved `scrollbar-gutter` that shoves layout.
- **Thumb and arrow buttons:** mill green. Wish color is `--floor` (`#dce6d8`, the Jev’s Questions / app wash). Pure `--floor` vanishes on the Jev pane (also floor). **One token for every bar:** `--scroll-thumb: color-mix(in srgb, var(--floor) 30%, var(--pine) 70%)` — still that mill green, darkened toward `--pine` (`#2f5d4a`) just enough to grab on floor **and** manila. Never white / grey Windows chrome. Never a rainbow of thumbs.
- Arrow glyphs (the chevron) may use `--ink` so the triangle reads on the green button. Button fill stays `--scroll-thumb`.

**Visibility (required, not optional):**

- Default: thumb + arrows **opacity 0** (fully gone).
- **Mouseover the scrollbar or the scrollable region** (the region must count — an invisible bar cannot be hovered): **fully opaque** for the whole hover.
- **mouseover false:** stay **fully opaque for 1.0s**, then **fade to opacity 0 over the next 1.0s**. No other timings.
- **Active scrolling** (wheel / trackpad / drag / keyboard-driven `scroll` on that host): same stay-visible rules, then the same 1s hold + 1s fade after scroll and hover have both ended.

**Implementation:** custom **overlay** bars (thumb + top/bottom arrows; left/right when `overflow-x` scrolls). Chromium `::-webkit-scrollbar-button` cannot do transparent track + green thumb + green arrows + 1s hold + 1s fade. Hide native bars (`scrollbar-width: none`, webkit width 0). Overlay does not reserve a white gutter. Click arrow to step, drag thumb, click track to page. Keyboard still scrolls the real overflow element. Dedicated CSS/JS (`src/scrollbars.css`, `src/scrollbars.ts`) — do not fold this into unrelated inspector styles.

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
  1. **`set_jev_case`** — write Jev’s State (the ticket / `state` string).
  2. **`set_jev_questions`** — replace typed questions. Shape matches `src/types.ts` / the editor: `choice` (option description in visual order; keys become 1-based `"1"`, `"2"`, …), `noul` (optional true/false criteria), `score` (ordered legend strings). Real ids. Instructions on every kept question. Semantic choice keys (`refund`/`deny`) are rewritten to positional numbers on the card and when calling Jev.
  3. **`ask_jev`** — only if state + questions are **clean** (at least one real-id question, no blank ids in the payload). Calls existing `/api/jev` (OpenRouter Decisions). If not clean: tools 1–2 only, and tell the operator to click **Ask Jev** (except **random-case** and **agentic-loop** modes: keep using tools until `ask_jev` succeeds or rounds run out). Typed answers in the tool result **and** on the SSE event must round-trip: the UI applies them, and the **next** `/api/llm` turn sends `jevAnswers` plus the Feed Jev send-now user note.
- After tools: a **short confirmation**. The UI already shows the ticket and q-cards.
- Never invent Jev probabilities. Only mention typed answers if `ask_jev` just returned them or Latest Jev answers are in this prompt. **Jev cannot invent answers that were not given.** Choice = listed options only; noul = P(true); score = legend levels. New option → `set_jev_questions` then `ask_jev` again.
- When `mode` is `propose-questions`, **must** call `set_jev_questions`. Do not call `ask_jev` from that button. Do not reply with JSON only.
- When `mode` is `random-case`, **must** call `set_jev_case` (short invented scenario), `set_jev_questions` (3–5 mixed types: at least one noul, one score, one choice; snake_case ids; mill-number choice keys), then `ask_jev`. Do not wait for the operator. Do not reply with JSON only. After tools, a short confirmation is enough — analysis is the next Feed Jev turn, then **stop**. This mode is invent-once, not the N-turn loop.
- When `mode` is `agentic-loop`, use the **current** Jev’s State and questions. Do **not** invent a new scenario. Do **not** call `set_jev_case` to replace the ticket with fiction. If questions are clean, **must** call `ask_jev`. May call `set_jev_questions` only if the editor is dirty or a new option is needed, then `ask_jev`. Do not wait for the operator. Do not reply with JSON only.
- Chat like “send it to state and propose Jev questions” must call `set_jev_case` and `set_jev_questions` (same apply path).
- **Feed Jev to LLM** is the reverse wire — a user note in the thread that **immediately streams** `/api/llm` (same path as Send). Not a tool. Not a canned assistant one-liner. **Random state** analysis and **Agentic loop** turns after the first use this path so answers reach the LLM.
- Primer from `docs/jev/primer.md` is attached (truncated if huge).
- A `## Weather` block in Jev’s State is observational Open-Meteo input. Do not invent a weather API call. Do not pretend to be Jev.
- `<!-- attach:start … -->` blocks are **user-provided** markdown the operator dropped into Jev’s State (or added from Convert to Markdown). Treat them as part of `state`. Do not fetch files. Do not invent a docs-snapshot dump.

### 9.1 Tool arguments (server validates)

OpenAI-style tools on the chat-completions call. The server executes them, then SSE-emits so the UI applies immediately.

**`set_jev_case`**

```
{ "state": "<full Jev state text>" }
```

**`set_jev_questions`** — replace the editor. Map of id → question (array of `{ id, type, … }` is also accepted). Skip blank ids.

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

**`ask_jev`** — `{}`. Uses the working state + working questions from this request (after any `set_*` in the same loop). Choice keys in that call are the positional numbers. If not clean: `{ ok: false }` to the model; do not call Decisions; the operator clicks **Ask Jev** (random-case and agentic-loop modes keep trying tools). On success, the tool payload includes `answers` so the model can reason in-loop, and the SSE event carries those answers so the **next client turn** can send `jevAnswers` + the Feed Jev note.

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
- **Drag-and-drop** onto **Jev’s State** (the whole slip, including the textarea).
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

- Writes the situation into Jev’s State textarea (weather placeholder **only** on Jacket)
- Replaces the Jev question editor
- Clears last Jev answers and the LLM thread (the previous state must not leak if “Include LLM chat” is on)
- Marks that preset selected in the menu
- Shows or hides the weather row from **kind** (Jacket only)
- Does **not** fetch weather until **Load weather** on Jacket (offline-safe; live weather is the upgrade)

**Empty Workshop:** first-open (no active thread) and **New State** load **no** preset. Invoice exception (`invoice`) is catalog item 1 — pick it from **Preset States**, Example Uses, or `?case=invoice`. It is **not** selected on the empty Workshop. Jacket remains available in the menu and as a Example Uses card.

| # | id | Label | Kind | Mix |
|---|---|---|---|---|
| 1 | `invoice` | Invoice exception | business | AP. Pay / hold / reject. choice + noul + score. |
| 2 | `ticket` | Ticket route | business | Queue. billing / engineering / success / spam. |
| 3 | `lead` | Lead qualify | business | Book demo / nurture / disqualify. |
| 4 | `refund` | Refund call | business | Full / partial / deny. |
| 5 | `hire` | Hire screen | business | Advance / hold / pass. |
| 6 | `launch` | Launch go/no-go | business | Ship / wait / rollback plan. |
| 7 | `chargeback` | Chargeback | business | Accept / represent / block. |
| 8 | `vendor` | Vendor risk | business | Sign / redline / walk. |
| 9 | `moderate` | Moderate | business | Go live / edit / kill. |
| 10 | `jacket` | Jacket? | weather | Outdoor layer. Open-Meteo optional. **The one weather snap.** |

### 12.1 Invoice exception

AP queue. INV-18442, Northwind Logistics LLC, Net-30, 3 years, no prior disputes. Invoice $18,640 vs PO-9921 $16,200 (+15.1%). Fuel surcharge $1,980 not on PO; pallet repair $460 with a carrier claim. Policy AP-4.2: auto-pay ≤ $250 or ≤ 2%; hold 2–5% or $250–$2,000; reject or amend above that. Fuel needs a signed addendum (none on file). Buyer: pay fuel if verbal winter band, do not pay pallet. Vendor dunning 8 days past terms. SLA: AP close Friday 5pm ET.

- `action` **choice** — `1` Pay the invoice as billed / `2` Hold for buyer / `3` Reject and require a corrected invoice
- `within_policy` **noul** — Is paying this invoice as-is within AP-4.2? true: within policy; false: exception needs hold or reject
- `exception_risk` **score** — Routine / Watch / Material

### 12.2 Ticket route

Zendesk #482911, 14m old, Enterprise ARR $94k, first-response SLA 1h. Subject mixes production webhook 500s and a duplicate $2,400 invoice. Three similar 5xx tickets in 40m. Duplicate Stripe charge id. Sender matches account owner. Queues: billing / engineering / success / spam.

- `queue` **choice** — `1` billing / `2` engineering / `3` success / `4` spam
- `urgent` **noul** — Does this need Sev-1 / immediate attention? true: production or enterprise-at-risk now; false: can wait the SLA
- `severity` **score** — Low / Medium / Sev-1

### 12.3 Lead qualify

HubSpot D-44190. Harbor & Pine Credit Union, ~$2.1B assets, VP Operations, DNA core. Inbound: decision engine for loan exception queues, budget this FY, demo Thursday. ICP: CU/community bank $500M–$10B, ops/risk buyer, exception or KYC queues. They asked for on-prem; we are cloud + VPC only.

- `disposition` **choice** — `1` book demo / `2` nurture / `3` disqualify
- `icp_fit` **noul** — Does this account match ICP? true: ICP; false: out of ICP
- `intent` **score** — Cold / Warm / Hot

### 12.4 Refund call

Stripe $247 annual renewal, order ORD-77120, Maya Chen, 11 months, lifetime $1,104, two small prior refunds, risk 12/100. Renewed 19h ago; 3 logins this period. Policy R-3: full if unused or 14-day new-customer window (she is not new). Partial: unused months minus consumed month if cancel within 7 days of renewal. Deny: abuse, >2 refunds/year, or fully consumed. Chargeback threat is not itself a deny.

- `decision` **choice** — `1` full / `2` partial / `3` deny
- `policy_allows_full` **noul** — Does R-3 allow a full refund here? true: full is in policy; false: it is not
- `abuse_risk` **score** — Clean / Watch / Abuse

### 12.5 Hire screen

SWE-II Decision Systems. Jordan Hale, 4.5 years, fintech routing rules (Rails), claims a “System-One-style classifier” but described sklearn + Slack bot. Comp $165k + 0.15% (band $140–170k, 0.08–0.20%). Musts: production backend, judgment-under-uncertainty, tradeoffs. Auto-pass: cannot discuss a real production system, or >$190k. Interviewer: strong communicator, light systems design.

- `outcome` **choice** — `1` advance / `2` hold / `3` pass
- `meets_musts` **noul** — Do they meet the must-have scorecard? true: yes; false: no
- `fit` **score** — Weak / Mixed / Strong

### 12.6 Launch go/no-go

billing-vats 2.12.0, ship window today 16:00–18:00 ET, PDF engine for EU VAT invoices (~1,100 Friday). Open P1: umlauts as `?` on the tagged worker image; fix is on a newer untagged build. Rollback: feature flag off, tested <2m. Go: no P1 on the artifact we ship. Wait: retag. Rollback-plan: ship a known P1 only with a documented revert (legal has not asked).

- `call` **choice** — `1` ship / `2` wait / `3` rollback plan
- `artifact_ready` **noul** — Is the tagged artifact ready to ship? true: the SHA/tag we would ship is clean of P1; false: it is not
- `readiness` **score** — Blocked / Fragile / Ready

### 12.7 Chargeback

Stripe dispute $1,890, reason fraudulent, due 6 days. New account, 40-seat annual, CVV fail, no 3DS, Lagos datacenter ASN, data export 12k rows, then dispute. Policy: represent if strong fulfillment + real-org use; accept if CVV fail + new + export + no 3DS; block if scrape/fraud pattern.

- `action` **choice** — `1` accept / `2` represent / `3` block
- `fraud_likely` **noul** — Is this likely fraud rather than a confused customer? true: fraud pattern; false: could be a real dispute
- `evidence_strength` **score** — Thin / Mixed / Strong

### 12.8 Vendor risk

Northwind Observability, $86k year 1, auto-renew. Liability cap 3 months fees. They want unlimited indemnity from us on customer content. SOC 2 Type II expired 4 months, no bridge letter. Training-on-customer-data unless an unattached exhibit. PROC-9: no unlimited outbound indemnity; no expired SOC 2 without a bridge; training opt-out required in the DPA. Walk if two of three fail and spend >$50k.

- `action` **choice** — `1` sign / `2` redline / `3` walk
- `policy_clear` **noul** — Can we sign this paper as-is under PROC-9? true: clear to sign; false: not clear
- `risk` **score** — Acceptable / Elevated / Deal-breaker

### 12.9 Moderate

Trust & Safety PUB-90331. Pro creator, 2 prior strikes (medical-misinfo + spam). 42s video: peptide stack “cured my cousin’s tumor,” sales link, stock-photo watermark. Policy P-4 Health: no unproven cancer-treatment claims; no sales links on health claims; first cancer-claim strike = kill + 7-day feature ban. SLA 15 minutes. Would run next to a hospital advertiser.

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
5. Feed Jev → LLM with live Jev answers: You bubble appears, `/api/llm` returns 200 SSE, mill thinking, then a streamed assistant reply (not a canned one-liner). Composer may stay empty; Send stays disabled until they type. With no Jev answers, the button stays disabled.
6. Docs page lists snapshot files; open one. Type chips appear (from snapshot paths). Toggle A→Z / Z→A; click a type (e.g. `cloudflare`) and `cloudflare/jev.md` stays selectable. Search still AND-filters. Reload keeps sort + tags + rail collapsed (`talk-to-jev:docs-rail`). Filtering out the open page keeps the reader, hides that row. The rail is viewport-tall; the file list scrolls **inside** the aside; window `scrollY` stays ~0. Chevron swipe-out hides the rail (reader full remaining width); swipe-in restores it.
7. Update Jev docs button completes and the list refreshes; if a page was open, that page’s markdown reloads (same path) or the empty picker if the path is gone. Tour overlay still reloads the doc behind it.
8. Splitter drags; textareas have no native corner grip. Splitter reads as a thin quiet seam (not a dashed orange candy-cane stripe); hover/drag shows a slightly wider pine handle
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
26. Next walks at least 3 steps; Back returns; missing targets (Example Uses / Settings / weather if hidden on a business preset) are skipped, not crashed
27. Skip dismisses; refresh does not reopen the overlay
28. Chrome **Tour** restarts the overlay; Docs eyeball/code step still keeps that view overlay fully visible
29. `/settings` loads; OpenRouter shows Key ready (not the secret); unused slots show missing if empty
30. Saving an empty unused key (e.g. OpenAI) does not echo a full key in the UI or JSON
31. `GET /api/settings` has `present` / `last4` only — no full key
32. Chrome right-side has Tour / Update Jev docs only — **no** History, **no** Inspector, **no** Key ready / Need OpenRouter key / Checking key… / Key check failed pill. **History** is on the Jev’s State row. **Inspector** is on the LLM pane-head (starts off). Nav **Settings** and `/settings` remain the key home.
33. `localStorage["talk-to-jev:chats"]` still has no API key after using Settings
34. **Add question** inserts a card whose id field is **empty** (placeholder `question id`, not `q_*`) and puts the caret in that id field. Typing several characters into a blank or filled id (e.g. `action`, `vendor_claim_valid`) keeps focus — the field does not deselect after one character. Space in the id field inserts `_` (`wear jacket` → `wear_jacket`). **Ask Jev** with that field still blank shows an inline error and does not invent an id or call Jev. Preset ids (`wear_jacket`, business ids) stay filled. Instructions textarea still accepts spaces.
35. Ticket heading reads **Jev’s State** (`h2.pane-title`, not **Case**, not uppercase **JEV’S STATE**). Same Public Sans **size** as **Jev’s Questions** (1.05rem / 650 / 0.01em). Product mark **Talk to Jev** stays larger (1.25rem / 700). Example Uses gallery title stays **Example Uses** at that same pane-title size. Nav **Workshop / Example Uses / Docs** stay `.nav-btn` size — not header size.
36. **Add .md** (or drop `.md` onto Jev’s State) inserts a marked attach block into the textarea; chips list the filename. Ask Jev / the LLM see that text as `state`.
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
49. Jev pane heading reads **Jev’s Questions**; LLM pane heading reads **LLM**; both are `h2.pane-title` at the same size. The model id is the subtitle/meta; **Ask Jev** remains.
50. Choice card: slick **1-based** numbers (1, 2, 3) to the left of descriptions; **no** Option key input (do not mint `option_a`, do not type `1` into a box). **Add option** shows 4 and moves focus to **Option 4 description** (not the Add option button). Space in that description inserts `_`. **Ask Jev** payload uses those numeric keys with the **description as the value** (`"1": "papaya"`, not `"1": "1"`). LLM semantic keys (`refund`/`deny`) rewrite to `"1"`/`"2"` on the card and in the Jev payload; descriptions stay. Choice answer bars read `1 papaya` (number + description), matching score `0 Low`. Description typing keeps focus.
51. Send a short prompt that should tool-call into Jev’s State (or **Propose Jev questions**): mill thinking shows while `/api/llm` is in flight; if OpenRouter streams reasoning, the Thoughts block is open and fills; when that group is done (**Thoughts done**), it auto-collapses (`aria-expanded=false`); the operator can expand it and a later parent re-render does not force it shut; `set_jev_case` / `set_jev_questions` appear as tool cards (Running then Done) and stay independently open/closed (this rule does not collapse them); the ticket/q-cards update; the bubble’s prose is a short confirmation, not a markdown table of questions. Refresh restores thoughts + tool cards on that assistant turn — thoughts start collapsed because they are already done. If the floor model has no reasoning channel, thinking still runs and Thoughts stays hidden.
52. Docs Iframe: open Introduction (TypeSafe, `X-Frame-Options: DENY`): boxed-i is **hidden**; Nice (or Code) is the view; no mill “won’t embed” dead end. Open `primer.md`: Iframe is hidden (no source). A page that *can* embed still shows boxed-i and loads the live site. No keys in the iframe URL. No native resize grips. Rail chevron collapses/expands with animation; refresh keeps collapsed.
53. **Random state:** **New State** (empty Workshop) → **Random state** (mill row, left of Agentic loop, mixed-case Public Sans) — **no** turn popover. Jev’s State fills (`set_jev_case`). Q-cards show mixed types (at least one noul, one score, one choice; mill numbers; snake_case ids). `ask_jev` POSTs `/api/jev`. Answers return; a later `/api/llm` SSE streams a short analysis on the Feed Jev send-now path (not a canned one-liner). Then **stop** — no turn 2…N, mill does **not** show Turn k of N. Thoughts mill auto-collapses when that group is done. Workshop **unlocks** when done.
53a. **Agentic loop:** mill already has state + real-id questions (preset, operator-written, or after Random state). **Agentic loop** (right of Random state) → pick **3** turns → **Confirm**. Does **not** invent a new random state. N `/api/llm` sessions. `ask_jev` POSTs `/api/jev` and answers round-trip. Mill shows **Turn k of 3**. Last turn is analysis. Each finished turn’s Thoughts mill auto-collapses when *that* group is done. Workshop **unlocks** when done. Popover **Cancel** does not start a run. Tip/popover stays fully on-screen, opaque, no ALL CAPS. Empty mill: **Agentic loop** is disabled / mill-warns — does not invent.
54. Workshop with a long LLM thread **and** several q-cards: `article.pane.llm` and `article.pane.jev` stay inside the viewport (pane `bottom` ≤ `innerHeight`; document does **not** grow to ~2000px). Pane-heads stay put. `.thread` and `.jev-scroll` each have `overflow-y: auto` and scroll independently. Window `scrollY` stays ~0. No native `resize` grips.
55. Load Workshop: LLM pane-head shows **Inspector** (mixed case). Panel is off (no request JSON on screen). Toggle on: bottom overlay, two columns **To LLM** / **To Jev**, Fragment Mono JSON. Tip opaque and on-screen. Toggle off. Send a short LLM message **or** Ask Jev (or a tool `ask_jev`): `localStorage["talk-to-jev:dev-logs"]` grows even while closed. Refresh: toggle still off; opening it shows the last calls. No API key / last-4 / `sk-or-` in the panel or that key. Settings has no inspector. Chrome-right has no Inspector. `ask_jev` tool card args read **Current state + questions**. Workshop panes still fill the viewport (overlay is not a flex sibling).
56. Nav **Example Uses** (not Use Cases). Ticket **Jev’s State**, **New State**, **Preset States**. Mill row **Random state**, **Agentic loop**, Propose, Feed, Inspector. Convert **Add to Jev’s State**.
57. Overflow scrollers (Jev’s State textarea, `.thread`, `.jev-scroll`, Docs `.doc-list` / Nice view, Convert, History, Inspector JSON, and the rest in §8.1) show **no white native track**. Hover the region: mill-green thumb + arrows fully opaque. Leave: stay opaque **1.0s**, then fade **1.0s**. Idle: opacity 0. No reserved white gutter. Native `resize` still `none`.

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

