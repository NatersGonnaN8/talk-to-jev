# Talk to Jev — SPEC

**Status:** v0.1 — 2026-09-19  
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

---

## 2. Non-goals (MVP)

- No TypeSafe-native key (`TYPESAFE_API_KEY`). OpenRouter only.
- No images/audio/video into Jev (Jev is text/JSON only).
- No accounts, no persistence beyond the current browser tab (refresh clears the workshop).
- No multi-user, no deploy, no billing UI.
- Do not call Jev via chat completions (that 400s). Do not ask Jev to write poems or code.

---

## 3. Auth and models

- **One secret:** `OPENROUTER_API_KEY` in gitignored `.env.local`.
- Key stays on the **server** (Vite middleware). The browser never sees it.
- Optional overrides in `.env.local`:
  - `JEV_MODEL` default `typesafe/jev-1.13` (pin; do not silently follow `~typesafe/jev-latest` in MVP)
  - `LLM_MODEL` default `deepseek/deepseek-v4-flash`
- If the key is missing, the UI says so and both Ask buttons stay disabled with a reason. Never log the key.

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
| **Ask the LLM** | Chat completions. System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. |
| **Ask Jev** | Decisions API. `state` = case text, plus optional `{ transcript }` of the LLM thread. `questions` = the editor on the Jev pane. |
| **Propose questions** | LLM is asked to return a JSON `questions` map for this case. Valid maps replace (or merge into) the Jev editor. Invalid JSON stays in chat as prose. |
| **Feed Jev → LLM** | Inject a user-visible note into the LLM thread summarizing typed answers (choice / noul / score / confidence). Next LLM turn sees it. |

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
- Right: key pill (`Key ready` / `Need OpenRouter key`), **Update Jev docs**
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
- Textarea, `resize: none`, fills the ticket
- Checkbox **Include LLM chat in Jev state** (default on)
- Helper: “Jev judges this. The LLM can draft it.”

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

**Mobile:** stack Case → LLM → Jev. Splitter hidden; panes full width.

### 6.2 Docs — `/docs`

**Job:** read the stored Jev docs; refresh them.

Layout:

```
[ chrome ]
[ search + file list | document ]
```

- Left: filterable list from `GET /api/docs` (path, title, source, fetched_at)
- Right: rendered markdown of the selected file (`GET /api/docs/file?path=`)
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

Errors: 501 missing key, 400 bad body, 502 upstream. Messages may say “Jev request failed” without dumping upstream secrets.

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

## 10. Verification

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
