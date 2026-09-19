# Talk to Jev — SPEC

**Status:** v0.3 — 2026-09-19  
**Product:** Talk to Jev  
**Folder:** `C:\Users\uttle\Projects\Talk to Jev`  
**GitHub:** private `talk-to-jev`  
**Local:** Vite UI + API on `http://127.0.0.1:5182` (`strictPort`)

This file is the contract. Code trails these decisions.

---

## 1. What it is

An MVP workshop that **wires two different AIs** through **one OpenRouter key**:

| Side | Model (default) | OpenRouter route | Job |
|---|---|---|---|
| **LLM** | `deepseek/deepseek-v4-flash` | `POST /api/v1/chat/completions` | Talk. Draft. Propose Jev questions. Explain answers. |
| **Jev** | `typesafe/jev-1.13` | `POST /api/alpha/decisions` | Typed snap decisions: **choice**, **noul**, **score**. Never prose. |

Jev is TypeSafe’s first **System One** model. It is **not** a chatbot. You send `state` + typed `questions`; it returns `answers` with probabilities. Named after Jevons. Official docs live in this repo under `docs/jev/` and can be refreshed in one click.

The LLM is the cheap prose half. Jev is the cheap decision half. The app is the wire between them.

**Weather is input, not a third model.** Live conditions come from **Open-Meteo** (free, no API key), fetched server-side, and written into the Case ticket as Jev `state` (and therefore LLM context). Still **one OpenRouter key**.

---

## 2. Non-goals (MVP)

- No TypeSafe-native key (`TYPESAFE_API_KEY`). OpenRouter only.
- No images/audio/video into Jev (Jev is text/JSON only).
- No accounts, no server-side history, no sending threads to a new backend.
- Workshop history is **this browser’s localStorage only** (this machine, this origin). Refresh restores it.
- Never persist `OPENROUTER_API_KEY` or any secret in localStorage / history JSON.
- No multi-user, no deploy, no billing UI.
- Do not call Jev via chat completions (that 400s). Do not ask Jev to write poems or code.

---

## 3. Auth and models

- **One secret:** `OPENROUTER_API_KEY` in gitignored `.env.local`.
- `.env.local` **wins** over a Windows user-level `OPENROUTER_API_KEY` (that env var can be stale and 401).
- Key stays on the **server** (Vite middleware). The browser never sees it.
- Optional overrides in `.env.local`:
  - `JEV_MODEL` default `typesafe/jev-1.13` (pin; do not silently follow `~typesafe/jev-latest` in MVP)
  - `LLM_MODEL` default `deepseek/deepseek-v4-flash`
- If the key is missing, the UI says so and both Ask buttons stay disabled with a reason. Never log the key.
- **Load weather** and sample presets do **not** need the OpenRouter key.

Referer headers on outbound OpenRouter calls:

- `HTTP-Referer`: `http://127.0.0.1:5182`
- `X-OpenRouter-Title`: `Talk to Jev`

---

## 4. Jev docs in the repo

### Stored snapshot

`docs/jev/` is a **checked-in snapshot** of official Jev / System One documentation so the app (and the LLM) can know it offline.

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

1. **UI:** header button **Update Jev docs** on every page → `POST /api/docs/update` → rewrite snapshot → toast with counts.
2. **CLI:** `npm run update-jev-docs`

Failed fetches are recorded in the index; a partial update is still committed-worthy. The button does not require the OpenRouter key (docs are public).

---

## 5. How the two AIs are wired

Shared **case** (the Jev `state`) sits in a ticket strip at the top. Both models see it.

| Action | What happens |
|---|---|
| **Ask the LLM** | Chat completions. System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. Case text (including any weather block) is the current case. |
| **Ask Jev** | Decisions API. `state` = case text, plus optional `{ transcript }` of the LLM thread. `questions` = the editor on the Jev pane. |
| **Propose questions** | LLM is asked to return a JSON `questions` map for this case. Valid maps replace (or merge into) the Jev editor. Invalid JSON stays in chat as prose. |
| **Feed Jev → LLM** | Inject a user-visible note into the LLM thread summarizing typed answers (choice / noul / score / confidence). Next LLM turn sees it. |
| **Load weather** | Server fetches Open-Meteo for the ticket location. Current conditions + a short forecast are written into a marked **weather block** on the Case ticket. Does not call Jev or the LLM. |
| **Sample case** | One click loads a preset: Case situation (weather placeholder), Jev questions, short label. Clears prior Jev answers and the LLM thread so the last case cannot leak. |

Code owns routing. The UI shows probabilities; it does not pretend a typed answer is “correct.”

Default demo case and questions (official-shaped):

- State: `My card was charged twice. Please help ASAP.`
- `department` choice: billing / technical / sales
- `urgent` noul
- `frustration` score: Calm / Frustrated / Very angry

---

## 6. Pages

Global chrome (both pages):

- Left: product name **Talk to Jev** (links home)
- Nav: **Workshop** | **Docs**
- Right: **History** (Workshop only — opens the local thread drawer), key pill (`Key ready` / `Need OpenRouter key`), **Update Jev docs**
- No native textarea resize grips. Pane widths use a custom vertical splitter.

### 6.1 Workshop — `/`

**Job:** talk to the LLM, talk to Jev, pass work across the wire.

Layout (desktop):

```
[ chrome ]
[ CASE TICKET — shared state textarea + include-chat checkbox ]
[ LLM pane | splitter | JEV pane ]
```

**Case ticket**

- Label: **Case** (this is Jev’s `state`)
- Checkbox **Include LLM chat in Jev state** (default on)
- **Samples** row: ten one-click chips (see §12). Active chip is visually on. The initial load is still the support-ticket demo (not one of the ten).
- **Weather row:** location field (default **Columbus, OH**) + **Load weather**. Accepts a city / “City, ST” (Open-Meteo geocoding) or `lat, lon`. Loading does not require the OpenRouter key.
- Textarea, `resize: none`, fills the ticket. **Load weather** replaces the marked weather block (or prepends one).
- Helper: “Jev judges this. The LLM can draft it. Weather is Open-Meteo input, not a model.”
- After a successful load, a one-line status under the row: resolved place + now summary (e.g. `Columbus, Ohio · 72°F · Partly cloudy`). Toast on failure.

**LLM pane** (manila / prose)

- Eyebrow: `LLM` + model id
- Scrollable transcript (user / assistant)
- Composer: textarea (`resize: none`) + **Send**
- Secondary: **Propose Jev questions**
- After Jev has answered: **Feed Jev to LLM**
- Empty: “Draft the case, or ask how to phrase a Jev question.”

**Jev pane** (blueprint / typed)

- Eyebrow: `JEV` + model id
- Question editor: add / remove questions
  - Fields: id, type (`choice` | `noul` | `score`), instructions
  - Choice: option key + description rows (add/remove). 1–255 options in spirit; UI allows at least 2.
  - Score: ordered level lines (min 2)
  - Noul: optional true / false criteria
- **Ask Jev**
- Answers: one card per question
  - Choice: selected option, probability bars, confidence stamp
  - Noul: 0–1 meter (P(true), not a separate confidence)
  - Score: numeric score, level legend, probability bars, confidence
- Usage line: input tokens + cost when OpenRouter returns them
- Empty answers: “Define questions, then ask Jev.”

**Splitter:** drag the shared vertical edge. Not a native resize handle.

**History** (local threads, overlay drawer — not a permanent sidebar):

- Chrome **History** opens a left drawer over the Workshop (sage mill, like the Docs rail). Backdrop click or Escape closes it. No native resize grips.
- **New chat** — save the open thread if it has anything worth keeping, then start a blank workshop (default case + default questions, empty LLM thread, no Jev answers).
- **Clear current** — empty the open LLM thread and last Jev answers; keep the case ticket, include-chat checkbox, and question editor.
- Click a past thread to restore it: LLM messages, case text, include-chat, Jev questions, last Jev answers (if any), and selected sample preset id when weather/samples exist.
- Title: auto from the first user line, else the case’s first line, else “Untitled case”. Optional rename (pencil); a renamed title stays until the user edits it again.
- Each row shows the title plus a timestamp (`updatedAt`).
- Delete one thread (trash). Deleting the open thread starts a blank workshop. Deleting the last thread leaves an empty workshop, not a ghost list item.
- Survives refresh. Does not sync across browsers or machines.

**Mobile:** stack Case → LLM → Jev. Splitter hidden; panes full width. History drawer uses most of the viewport width.

### 6.2 Docs — `/docs`

**Job:** read the stored Jev docs; refresh them.

Layout:

```
[ chrome ]
[ search + file list | document ]
```

- Left: filterable list from `GET /api/docs` (path, title, source, fetched_at)
- Right: the selected file (`GET /api/docs/file?path=`)
- **View overlay** (sticky, top-right of the document pane — not a second chrome bar): two icon buttons
  - **Eyeball** — nice view: rendered Markdown (strip YAML frontmatter; GFM tables/code). Default for `.md`
  - **Code** — source view: raw file in `Fragment Mono`
- Overlay tips are opaque, sit **below** the icons (overlay is at the top; flip would clip under chrome), and stay fully on-screen
- JSON files still get both modes; nice view pretty-prints JSON
- Empty pane (no file yet): no overlay; “Pick a page from the snapshot.”
- **Update Jev docs** in chrome (same as Workshop)
- Empty snapshot: explain the button / `npm run update-jev-docs`

---

## 7. API (local Vite middleware)

All JSON unless noted. Never echo the API key.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, hasKey, jevModel, llmModel, docs: { files, fetchedAt } }` |
| POST | `/api/llm` | Body: `{ messages, state, jevAnswers?, mode?: "chat" \| "propose-questions" }`. Streams OpenRouter SSE (`text/event-stream`). |
| POST | `/api/jev` | Body: `{ state, questions, transcript? }`. JSON Decisions response (or `{ ok:false, message }`). |
| GET | `/api/docs` | Index of snapshot files |
| GET | `/api/docs/file` | Query `path` relative to `docs/jev`. Reject `..` |
| POST | `/api/docs/update` | Run the snapshotter; return `{ ok, fetched, failed, files }` |
| GET | `/api/weather` | Open-Meteo proxy. Query `q` (city or `lat,lon`) or `latitude`+`longitude`. Default `q=Columbus, OH`. Returns `{ ok, place, current, daily, hourly, text, json }`. `text` is the Case weather block. No OpenRouter key. |
| GET | `/api/geo` | Open-Meteo geocoding helper. Query `q`. Returns `{ ok, results: [{ name, admin1, country, latitude, longitude }] }`. Optional; **Load weather** may geocode internally. |

Errors: 501 missing key, 400 bad body, 404 unknown place, 502 upstream. Messages may say “Jev request failed” without dumping upstream secrets. Weather errors must not mention OpenRouter.

---

## 8. Visual bar

Workshop, not a generic AI dashboard.

- Floor: sage mill `#DCE6D8`
- Ink: `#142018`
- LLM slip: manila `#F3E7D3`
- Jev slip: blueprint `#C9DCE8`
- Wire / pine: `#2F5D4A`
- Probability fill: industrial orange `#E06B2A`
- Type: **Bricolage Grotesque** (display), **Public Sans** (body), **Fragment Mono** (ids, JSON, meters)

Signature: the **case ticket** as a physical slip the two instruments share. Probability is a filled bar, not a pie.

Slick = sharp, usable, no garnish. Tooltips (if any) stay fully on-screen, opaque, flip placement.

---

## 9. LLM system contract

The LLM is told, every request:

- It is the prose half of Talk to Jev, not Jev.
- Jev does not chat. Propose **atomic** questions (one snap judgment each).
- Prefer many small questions in one Jev call.
- Question ids are for code; put the full question in `instructions`.
- When `mode` is `propose-questions`, reply with **only** a JSON object of questions (`type`, `instructions`, `criteria`).
- Primer from `docs/jev/primer.md` is attached (truncated if huge).

---

## 10. Local chat history (storage)

**Key:** `talk-to-jev:chats`  
**Shape:** v1 JSON in `localStorage`. Browser only. No accounts, no server DB, no new API.

```
{
  v: 1,
  activeId: string | null,
  chats: ChatThread[]   // newest-updated first; cap 50
}

ChatThread:
  id, title, titleLocked, createdAt, updatedAt
  messages            // LLM thread: { role: "user"|"assistant", content }[]
  state               // Case ticket text
  includeChat         // Include LLM chat in Jev state
  questions           // Jev question editor
  answers             // last Jev answers or null
  jevMeta             // usage line if any
  samplePresetId      // weather/sample preset id if that UI exists; else null
```

Rules:

- Cap **50** threads (keep the active thread; drop the oldest `updatedAt` first).
- Do **not** write `OPENROUTER_API_KEY`, env, or health into this key.
- Corrupt or unknown `v` → start empty (do not throw).
- Quota errors: drop oldest inactive threads and retry; never crash the Workshop.
- Composer draft and pane split are not required to persist.
- Empty untouched defaults are **not** stored as ghost threads. A thread is written once it has messages, a renamed title, a non-default case, non-default questions, Jev answers, or a sample preset.

---

## 11. Verification

Before calling Workshop done:

1. Health pill shows key state accurately
2. Send an LLM message; streamed reply appears
3. Ask Jev on the default case; three answers render (choice / noul / score)
4. Propose questions replaces or fills the editor
5. Feed Jev → LLM injects a visible note
6. Docs page lists snapshot files; open one
7. Update Jev docs button completes and the list refreshes
8. Splitter drags; textareas have no native corner grip
9. `/docs` deep link works after refresh
10. Docs overlay: eyeball shows rendered Markdown; code icon shows raw source; tips stay fully visible
11. Send an LLM message, refresh: the thread is still in History and the transcript restores
12. Click a past thread to restore case + questions + last Jev answers
13. New chat starts a blank workshop; the previous thread remains in the list
14. Delete one thread; it is gone after refresh
15. `localStorage["talk-to-jev:chats"]` has no API key
11. **Load weather** (default Columbus, OH) fills the Case ticket weather block; status line shows place + now; no OpenRouter key required
12. Pick at least two sample chips: Case + Jev questions swap; Ask Jev returns typed answers
13. Changing the location field and loading again replaces the weather block without wiping the Situation
14. `/docs` overlay still works after the Workshop weather work
