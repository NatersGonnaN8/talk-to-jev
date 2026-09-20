# Talk to Jev — SPEC

**Status:** v0.8 — 2026-09-19  
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
| **LLM** | `deepseek/deepseek-v4-flash` | `POST /api/v1/chat/completions` | Talk. Draft. Propose Jev questions. Explain answers. |
| **Jev** | `typesafe/jev-1.13` | `POST /api/alpha/decisions` | Typed snap decisions: **choice**, **noul**, **score**. Never prose. |

Jev is TypeSafe’s first **System One** model. It is **not** a chatbot. You send `state` + typed `questions`; it returns `answers` with probabilities. Named after Jevons. Official docs live in this repo under `docs/jev/` and can be refreshed in one click.

The LLM is the cheap prose half. Jev is the cheap decision half. The app is the wire between them.

**Weather is one use case, not the product.** Nater (2026-09-19): “Weather is literally one use case.” Nine of the ten snaps are **operator / business** decisions. Live conditions come from **Open-Meteo** (free, no API key), fetched server-side, and written into **Jev’s case** **only for the Jacket preset**. Still **one OpenRouter key**.

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
- Do not send weather to a third model. Open-Meteo → Jev’s case → Jev / LLM.
- Attached / converted files stay in the **browser**. Do **not** upload them to a new server store, a SaaS converter, write them into `.env` / `.env.local`, or commit user files. Do **not** dump the official `docs/jev/` snapshot into Jev’s case (Docs is the snapshot; attach is **local user files**). PDF convert is **pdf.js text layer only** — no OCR, no images, no cloud.

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
- If OpenRouter is missing, the UI says so and both Ask buttons stay disabled with a reason. Never log any key.
- **Load weather** and sample presets do **not** need any API key.

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

Shared **Jev’s case** (the Jev `state`) sits in a ticket strip at the top. Both models see it. This is **not** the **Use Cases** gallery.

| Action | What happens |
|---|---|
| **Ask the LLM** | Chat completions. System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. Jev’s case text (including any weather block and any **attach** blocks from local files) is the current state. |
| **Ask Jev** | Decisions API. `state` = Jev’s case text (same string: situation, weather block, attached blocks), plus optional `{ transcript }` of the LLM thread. `questions` = the editor on the Jev pane. If any question **id is blank**, show a clear **inline** error on that card and **do not** call Jev. Never silently invent an id (`q_*`, random suffixes, or similar). |
| **Propose questions** | LLM is asked to return a JSON `questions` map for this case. Valid maps replace (or merge into) the Jev editor. Invalid JSON stays in chat as prose. Skip entries with a blank id — do not mint a placeholder id for them. If the user then **Ask Jev** with a still-blank id, same inline error as above. |
| **Feed Jev → LLM** | Inject a user-visible note into the LLM thread summarizing typed answers (choice / noul / score / confidence). Next LLM turn sees it. |
| **Load weather** | **Jacket preset only.** Server fetches Open-Meteo for the ticket location. Current conditions + a short forecast are written into a marked **weather block** on Jev’s case. Does not call Jev or the LLM. Hidden on business presets. |
| **Sample case** | One click (Workshop chip **or** Use Cases card) loads the same `src/samples.ts` preset: Jev’s case situation (weather placeholder **only** on Jacket), Jev questions, short label. Clears prior Jev answers and the LLM thread so the last case cannot leak. |

Code owns routing. The UI shows probabilities; it does not pretend a typed answer is “correct.”

**Landing preset (first-open and New chat):** **Invoice exception** (`invoice`) — a business chip. Not Jacket. Not the old one-line “My card was charged twice” demo. That chip is visually on. See §12.

---

## 6. Pages

Global chrome (all pages):

- Left: product name **Talk to Jev** (links home Workshop)
- Nav: **Workshop** | **Use Cases** | **Docs** | **Settings** | **Convert**
- **Convert** sits **after** Settings. Visible label **Convert**; `title` and accessible name **Convert to Markdown**. Route `/convert`.
- Right: **Tour** (Help — restarts the first-run coach overlay), **History** (Workshop only — opens the local thread drawer), **key pill** (status text; shortcut to Settings — see **Chrome key pill**), **Update Jev docs**
- No native textarea resize grips. Pane widths use a custom vertical splitter (quiet mill/pine seam — not a dashed orange hatch).
- No native `<dialog>` / iframe for the coach. See §6.4.

### Chrome key pill → Settings

The right-side key-status pill is a **shortcut to Settings** (`/settings`). It is not a second Settings label — nav already has **Settings**. Visible text stays the OpenRouter key status. Never rename the pill to the word “Settings.”

| State | Visible text | `title` (and accessible name) |
|---|---|---|
| checking | `Checking key…` | Checking OpenRouter key — open Settings |
| ready | `Key ready` | OpenRouter key is on the server — open Settings |
| missing | `Need OpenRouter key` | Need OpenRouter key — paste in Settings |
| error | `Key check failed` | Could not check OpenRouter key — open Settings |

Behavior (every state, including checking / missing / error):

- Real `<button type="button">` — not a dead `<span>`. Keyboard: Enter / Space, same as any button.
- Cursor `pointer`.
- Click (and keyboard activate) uses the same route as the Settings nav item: `/settings`.
- Missing-key title tells you to **paste in Settings**. Ready / checking / error titles still say this opens Settings.

### 6.1 Workshop — `/`

**Job:** talk to the LLM, talk to Jev, pass work across the wire.

Layout (desktop):

```
[ chrome ]
[ JEV’S CASE TICKET ]
  [ samples: 10 chips — 9 business + Jacket ]
  [ location field + Load weather ]   ← Jacket only; hidden on business chips
  [ include-chat checkbox ]
  [ Add .md + attached-file chips ]
  [ shared state textarea ]
  [ drop .md into Jev’s case; convert formats go to the Convert tab ]
[ LLM pane | splitter | JEV pane ]
```

**Jev’s case** (the state ticket — **not** Use Cases cards)

- Label: **Jev’s case** (this is Jev’s `state`)
- Checkbox **Include LLM chat in Jev state** (default on)
- **Samples** row: ten one-click chips (see §12). Active chip is visually on. **First-open** and **New chat** load **Invoice exception** (`invoice`) — a business snap — not Jacket.
- **Weather row:** shown **only** when the active preset is **Jacket?** (`jacket`). Location field (default **Columbus, OH**) + **Load weather**. **Hide** the row on the nine business presets (do not leave a disabled weather form that still makes the Workshop look like a weather app). Accepts a city / “City, ST” (Open-Meteo geocoding) or `lat, lon`. Loading does not require the OpenRouter key.
- Textarea, `resize: none`, fills the ticket. **Load weather** (Jacket only) replaces the marked weather block (or prepends one).
- **Add .md** (file picker, `accept=".md,.markdown,text/markdown"`, multiple): local user markdown is inserted into Jev’s case as `state`. Official `docs/jev/` snapshot stays in Docs; do not auto-insert it. There is **no** Convert to Markdown button on this ticket — that UI lives on the **Convert** tab (§6.6 / §16).
- **Drag-and-drop** onto the whole Jev’s case ticket (including the textarea). **Mix:** `.md` / `.markdown` stay on Workshop and go **into Jev’s case**. Convert formats **navigate to `/convert`** (the Convert tab) with **per-file progress**. Do not dump convert UI back into the case row. Unsupported types: inline error on the ticket. See **§15** and **§16**.
- Attached names list near the ticket. Remove one = strip that attach block. Weather / situation text stay.
- Helper: “Jev judges this. The LLM can draft it. Drop .md into Jev’s case. txt / html / docx / pdf go to Convert.” On Jacket only, add: “Weather is Open-Meteo input, not a model.”
- After a successful weather load, a one-line status under the row: resolved place + now summary (e.g. `Columbus, Ohio · 72°F · Partly cloudy`). Toast on failure.
- Size-cap attachments so a huge dump cannot freeze the UI. See **§15**. Convert caps: **§16**.
- Tip on **Add .md** is fully opaque, flip above/below so it stays on-screen. Convert-file tips live on `/convert`.

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
  - **Add question** inserts a new card with an **empty id**. The user types the id. Do **not** auto-generate `q_*` / random suffixes. Only **user-added** cards start blank — presets keep their real ids (`wear_jacket`, business ids, and the rest in `src/samples.ts`).
  - Id input placeholder: `question id` (a hint, not a fake value). The field value stays empty until they type.
  - New-card defaults (empty editor UX): type `noul`, empty instructions, empty true/false criteria. Switching type uses the same empty choice (two blank option rows) / score (Low / Medium / High) / noul defaults as today.
  - Choice: option key + description rows (add/remove). 1–255 options in spirit; UI allows at least 2.
  - Score: ordered level lines (min 2)
  - Noul: optional true / false criteria
  - Blank id on **Ask Jev** (or sending the editor through the propose → ask flow): inline error on the card, do not call Jev, do not invent an id.
- **Ask Jev**
- Answers: one card per question
  - Choice: selected option, probability bars, confidence stamp
  - Noul: 0–1 meter (P(true), not a separate confidence)
  - Score: numeric score, level legend, probability bars, confidence
- Usage line: input tokens + cost when OpenRouter returns them
- Empty answers: “Define questions, then ask Jev.”

**Splitter:** drag the shared vertical edge between LLM and Jev. Not a native resize handle. Nater (2026-09-19): the old style looked like “a sick candy cane” — dashed orange hatch on cream with a pine stripe. **Visual:** a thin, quiet mill/pine divider (hit target stays wide enough to grab). Rest: 1px `--line` seam, mill-floor gutter, `cursor: col-resize`. Hover / while dragging: the seam widens slightly to pine so it reads as a handle — no dashed circus stripe, no orange/blue hatch, no garnish. Hidden on mobile; panes stack full width. `resize: none` on textareas; never CSS `resize` for layout. Convert is **not** a third Workshop pane — it is its own tab (§6.6). That page may use the same quiet splitter between its file list and preview.

**History** (local threads, overlay drawer — not a permanent sidebar):

- Chrome **History** opens a left drawer over the Workshop (sage mill, like the Docs rail). Backdrop click or Escape closes it. No native resize grips.
- **New chat** — save the open thread if it has anything worth keeping, then start the landing workshop (**Invoice exception** + its questions, empty LLM thread, no Jev answers, that chip on).
- **Clear current** — empty the open LLM thread and last Jev answers; keep the case ticket, include-chat checkbox, and question editor.
- Click a past thread to restore it: LLM messages, case text, include-chat, Jev questions, last Jev answers (if any), and selected sample preset id.
- Title: auto from the first user line, else the case’s first line, else “Untitled case”. Optional rename (pencil); a renamed title stays until the user edits it again.
- Each row shows the title plus a timestamp (`updatedAt`).
- Delete one thread (trash). Deleting the open thread returns to the **Invoice exception** landing. Deleting the last thread leaves that landing, not a ghost list item.
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

### 6.3 Use Cases — `/use-cases` (`/cases` alias)

**Job:** show the **same ten** sample snaps that Workshop loads — **nine business** + **one weather** (Jacket). One list in `src/samples.ts`. Do not invent a second catalog.

Layout:

```
[ chrome ]
[ manila intro slip — 9 operator snaps + Jacket ]
[ 10 case cards ]
```

Intro slip: nine operator snaps plus one weather case. Same list as the Workshop chips. Jev returns `choice` / `noul` / `score` — not a chatbot. Open-Meteo is optional input on Jacket only.

Each card: **label** (same as the Workshop chip), one-line **pitch**, chips for which Jev types it uses (`choice` / `noul` / `score`). The Jacket card may stamp **weather**; business cards do not. Clicking the card (or **Open in Workshop**) goes to `/` with `?case=<id>` and loads **the same preset** as the Workshop chip: situation + questions, clear answers + LLM thread, mark that sample active. Workshop with no `?case=` still lands on **Invoice exception**.

The ten ids, labels, and question maps **are §12**. This page is the gallery; Workshop chips are the compact picker. One module: `src/samples.ts`.

Visual: mill floor, manila cards, blueprint type chips, pine ink. Slick and usable. Tips (type-chip explanations) are **opaque**, stay fully on-screen, and **flip** (below if there is room; above if the card is low — never under sticky chrome). No native resize on this page.

### 6.4 Coach overlay (first-run / Tour)

**Job:** walk a new visitor around the Workshop. Custom product overlay — not a native dialog, not an iframe.

**When it opens**

- First visit on this origin: if `localStorage["talk-to-jev:tutorial-done"]` is unset, open after paint on Workshop.
- Chrome **Tour** restarts from the first available step even after done. Refresh must not nag once Skip or Done has fired.
- Escape matches **Skip**.

**Look and placement**

- `position: fixed`, z-index **above** chrome (20) and History (30) — use **80+**.
- Spotlight / hole around the real control when a target exists (Jev’s case, Ask Jev, etc.).
- Coach **card** is fully opaque (manila `#F3E7D3` or blueprint `#C9DCE8`, pine ink, mill floor). No translucent fill.
- Chrome is sticky at the top, so prefer **below** the target or **center** of the remaining viewport. Flip above only if the card would clip the bottom. Clamp every edge on-screen.
- No native resize grips. Slick: sage mill / manila / blueprint, usable, no garnish.

**Controls:** **Back** / **Next** / **Skip** / **Done** (Done replaces Next on the last available step). Skip and Done both write `talk-to-jev:tutorial-done` = `1`. Never store `OPENROUTER_API_KEY` (or any secret) in this key.

**Steps** (each is independent). If the target is missing because a sibling page/control has not landed, **skip that step** — do not block the tour.

1. **Welcome** — two AIs, one OpenRouter key. The LLM talks. Jev does not write.
2. **Jev’s case** — this slip is Jev `state`. Drop `.md` here; other files open the **Convert** tab.
3. **LLM pane** — prose / draft / chat.
4. **Jev pane** — typed `choice` / `noul` / `score` + **Ask Jev**.
5. **Propose Jev questions** / **Feed Jev to LLM** if those buttons exist.
6. **Use Cases** — nine operator snaps plus one weather case (Jacket), same list as Workshop chips.
7. **Docs** — eyeball (nice Markdown) vs code (raw snapshot). May navigate to `/docs`.
8. **Settings** BYOK if that page exists (optional later: OpenAI, Anthropic, Tavily, Brave — still no keys in the browser).
9. **Convert** — chrome **Convert** tab (`/convert`). Drop txt / html / docx / pdf here, or onto Jev’s case (that still opens this tab). Files stay in the browser.
10. **History** if the chrome control exists.
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

Each row, in this order: **OpenRouter**, **OpenAI**, **Anthropic**, **Tavily**, **Brave**.

- Label + short why (OpenRouter = LLM + Jev today; others unused until search / direct models land)
- Password-style input + **Save** (no native resize grips)
- Status **Key ready** / **missing** without revealing the value. Ready may show last-4 only
- Tips (status / last-4 help) are **opaque**, fully on-screen, and **flip** (below if there is room; above if the row is low — never under sticky chrome)

Saving one row POSTs `/api/settings` `{ id, value }` and writes that env var on the server. Empty save clears the slot. Clear the input after a successful save. OpenRouter still powers LLM + Jev; do not wire Tavily / Brave / OpenAI / Anthropic live calls in MVP.

### 6.6 Convert — `/convert`

Nater (2026-09-19): “Move the Convert to Markdown button to a separate tab at the top next to Settings.” Chrome order is Settings, then **Convert**.

**Job:** turn local txt / html / docx / pdf into markdown **in this browser**. Then **Add to the LLM**, **Add to Jev’s case**, **Download**, or **Save as MD**. Files never leave the machine.

Layout:

```
[ chrome ]
[ manila intro slip ]
[ drop / choose files | quiet splitter | preview + actions ]
```

- Full Convert to Markdown UI — not a half-pane on Workshop, not a button on Jev’s case.
- Drop zone + file picker (`accept` for `.txt,.html,.htm,.docx,.pdf,.doc` plus matching MIME types, `multiple`).
- Per-file progress. 64k / 32k TypeSafe note. Preview textarea `resize: none`.
- Actions on the selected resulting MD: **Add to the LLM** / **Add to Jev’s case** / **Download** / **Save as MD**.
- Quiet custom splitter between the file list and the preview (same mill/pine seam as Workshop). Hidden on mobile; stack.
- Tips opaque, flip, fully on-screen.
- Leave via chrome nav. Jobs stay if the operator switches tabs and comes back (Workshop stays mounted too).
- Dropping convert formats onto **Jev’s case** still **navigates here** with those files queued. `.md` on Jev’s case never opens this tab.

Libraries, caps, and never-list: **§16**.

---

## 7. API (local Vite middleware)

All JSON unless noted. Never echo the API key. Never dump upstream bodies that might contain secrets. Bind `127.0.0.1` only; do **not** set wide-open CORS (`Access-Control-Allow-Origin: *`). Same-origin UI does not need CORS.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, hasKey, keys: { openrouter, openai, anthropic, tavily, brave }, jevModel, llmModel, docs: { files, fetchedAt } }`. All key fields are booleans. `hasKey` === `keys.openrouter`. Never last-4, never the secret. |
| GET | `/api/settings` | `{ ok, keys: [{ id, env, label, why, required, present, last4 }] }`. `last4` is four characters or `null`. Never the full key. May append empty unused slots to `.env.local` (does not change existing values). |
| POST | `/api/settings` | Body `{ id, value }`. `id` is `openrouter` \| `openai` \| `anthropic` \| `tavily` \| `brave`. Writes `.env.local`. Empty `value` clears that key. Response same shape as GET. **Never log the body.** Never echo `value`. |
| POST | `/api/llm` | Body: `{ messages, state, jevAnswers?, mode?: "chat" \| "propose-questions" }`. Streams OpenRouter SSE (`text/event-stream`). |
| POST | `/api/jev` | Body: `{ state, questions, transcript? }`. JSON Decisions response (or `{ ok:false, message }`). |
| GET | `/api/docs` | Index of snapshot files |
| GET | `/api/docs/file` | Query `path` relative to `docs/jev`. Reject `..` |
| POST | `/api/docs/update` | Run the snapshotter; return `{ ok, fetched, failed, files }` |
| GET | `/api/weather` | Open-Meteo proxy. Query `q` (city or `lat,lon`) or `latitude`+`longitude`. Default `q=Columbus, OH`. Returns `{ ok, place, current, daily, hourly, text, json }`. `text` is the Jev’s case weather block. No OpenRouter key. |
| GET | `/api/geo` | Open-Meteo geocoding helper. Query `q`. Returns `{ ok, results: [{ name, admin1, country, latitude, longitude }] }`. Optional; **Load weather** may geocode internally. |

Errors: 501 missing key, 400 bad body, 404 unknown place, 502 upstream. Messages may say “Jev request failed” without dumping upstream secrets. Weather errors must not mention OpenRouter. `POST /api/jev` and `POST /api/llm` return 501 when the key is missing. Error strings that look like keys (`Bearer`, `sk-or-`, `OPENROUTER_API_KEY`) are replaced with a generic failure. Jev success JSON is `ok`, `model`, `answers`, `usage` — do not spread the raw upstream object.

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

Signature: **Jev’s case** as a physical slip the two instruments share. Probability is a filled bar, not a pie.

Slick = sharp, usable, no garnish. Tooltips (if any) stay fully on-screen, opaque, flip placement. The Workshop pane splitter is a **quiet divider**, not decoration.

---

## 9. LLM system contract

The LLM is told, every request:

- It is the prose half of Talk to Jev, not Jev.
- Jev does not chat. Propose **atomic** questions (one snap judgment each).
- Prefer many small questions in one Jev call.
- Question ids are for code; put the full question in `instructions`.
- When `mode` is `propose-questions`, reply with **only** a JSON object of questions (`type`, `instructions`, `criteria`).
- Primer from `docs/jev/primer.md` is attached (truncated if huge).
- A `## Weather` block in the case is observational Open-Meteo input. Do not invent a weather API call. Do not pretend to be Jev.
- `<!-- attach:start … -->` blocks are **user-provided** markdown the operator dropped into Jev’s case (or added from Convert to Markdown). Treat them as part of `state`. Do not fetch files. Do not invent a docs-snapshot dump.

---

## 10. Local chat history (storage)

**Key:** `talk-to-jev:chats`  
**Shape:** v1 JSON in `localStorage`. Browser only. No accounts, no server DB, no new API.

**Key:** `talk-to-jev:tutorial-done`  
**Shape:** `"1"` after Skip or Done on the coach overlay. Absent = first-run. Restart via chrome **Tour**. Never stores keys.

```
{
  v: 1,
  activeId: string | null,
  chats: ChatThread[]   // newest-updated first; cap 50
}

ChatThread:
  id, title, titleLocked, createdAt, updatedAt
  messages            // LLM thread: { role: "user"|"assistant", content }[]
  state               // Jev’s case text
  includeChat         // Include LLM chat in Jev state
  questions           // Jev question editor
  answers             // last Jev answers or null
  jevMeta             // usage line if any
  samplePresetId      // §12 preset id; landing `invoice` is the empty default (not a ghost thread)
```

Attached `.md` lives **inside** `state` (marked blocks). No extra history field, no file blobs, no keys from `.env`.

Rules:

- Cap **50** threads (keep the active thread; drop the oldest `updatedAt` first).
- Do **not** write `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, env, health, or Settings payloads into this key.
- Corrupt or unknown `v` → start empty (do not throw).
- Quota errors: drop oldest inactive threads and retry; never crash the Workshop.
- Composer draft and pane split are not required to persist.
- Empty untouched **landing** (Invoice exception, `samplePresetId` `invoice` or null, no messages, no answers, questions unchanged) is **not** stored as a ghost thread. A thread is written once it has messages, a renamed title, a non-landing case, non-landing questions, Jev answers, or a **non-landing** sample preset (including Jacket).

---

## 11. Weather input (Open-Meteo)

Provider: **Open-Meteo** Forecast API + Geocoding API. No API key. CC BY 4.0 attribution in the weather block and a short UI hint. Server-side fetch only (Vite middleware). The browser never talks to Open-Meteo directly in MVP (keeps one network story: UI → local `/api/*`).

**Workshop chrome:** location field + **Load weather** render **only** on Jacket (`jacket`). `/api/weather` stays for that case. Business presets never show the weather row — the Workshop must not look like a weather app.

**Default place:** Columbus, Ohio, United States (`39.9612, -82.9988`). Nate can change the location field to another city (`Nashville, TN`) or coordinates (`36.16, -86.78`).

**Units (US default):** °F, mph, inches. Timezone: `auto` from Open-Meteo.

**What loads into Jev state**

Jev’s case owns a marked block:

```
<!-- weather:start -->
…human-readable conditions + compact JSON…
<!-- weather:end -->
```

**Load weather** replaces that span in place. If the markers are missing, the block is prepended. The Situation / rest of the case is not wiped.

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

## 15. Jev’s case attachments (.md → Jev state)

Nater (2026-09-19): “can we add .md files to the case for jev?” **Yes.** Local markdown becomes part of **Jev’s case** — the same `state` string sent to `POST /api/alpha/decisions`. This is **not** a chatbot file-chat feature (no separate file pane, no model that “reads attachments” besides Jev/LLM seeing the case text).

**Workshop**

- Control **Add .md**: hidden file picker, `accept=".md,.markdown,text/markdown"`, `multiple`.
- **Drag-and-drop** onto **Jev’s case** (the whole slip, including the textarea).
- Multiple files OK. Re-adding the **same sanitized filename** **replaces** that attach block. New names **append** (do not clobber the situation or the weather block).
- List attached names near the ticket. Remove one = strip that file’s attach block only.
- **Mix drops:** `.md` / `.markdown` attach immediately (stay on Workshop). Convert formats (`.txt`, `.html`, `.htm`, `.docx`, `.pdf`, `.doc`) **open the Convert tab** (`/convert`, §16) — they are **not** an error. Truly unsupported types: short **inline** error (`role="alert"`), not `window.alert`.
- Tip on **Add .md**: fully opaque, flip above/below so it stays on-screen, never a translucent fill.

**Markers** (HTML comments in Jev’s case text):

```
<!-- attach:start filename.md -->
…file text…
<!-- attach:end filename.md -->
```

Sanitized basename only (no path). Strip control characters and `--` so the comment stays valid. Do not read `.env` / `.env.local` on this path — only `File` objects the user picked or dropped.

**Caps (do not freeze the UI)**

- **256 KiB** per file (byte size) before read
- **200,000 characters** per file after read
- **12** attach blocks per Jev’s case

Over-cap files are skipped with an inline error. Remaining valid files still insert.

**Never**

- Upload to a new server store or add an attach API
- Write attached text into `.env` / `.env.local`
- Commit user files into the repo
- Auto-insert the official `docs/jev/` snapshot into Jev’s case (Docs overlay already has that)

---

## 12. Ten sample cases (Workshop presets)

One-click chips on **Jev’s case** **and** cards on **Use Cases**. Same ten. One module: `src/samples.ts`. Do not fork a second catalog.

Nater (2026-09-19): weather is **literally one use case**. The other nine are **business / operator** snaps — real tickets and memos (amounts, SLA, customer tier, policy quotes), not lifestyle weather, not sports-weather, not “festival in the rain.” Mix Jev primitives **choice**, **noul**, and **score** across the set (not all noul). Cheap LLM can still draft; Jev returns probabilities.

Each preset is a product contract: **id**, **short label**, **pitch**, **kind** (`business` | `weather`), **situation** (case text), **Jev questions** (2–4, with ids / types / option keys). Clicking a chip or a Use Cases card:

- Writes the situation into Jev’s case textarea (weather placeholder **only** on Jacket)
- Replaces the Jev question editor
- Clears last Jev answers and the LLM thread (the previous case must not leak if “Include LLM chat” is on)
- Marks that chip active
- Shows or hides the weather row from **kind** (Jacket only)
- Does **not** fetch weather until **Load weather** on Jacket (offline-safe; live weather is the upgrade)

**Landing:** first-open Workshop and New chat load **Invoice exception** (`invoice`). That chip is on. Jacket remains available as one chip/card.

| # | id | Chip | Kind | Mix |
|---|---|---|---|---|
| 1 | `invoice` | Invoice exception | business | AP. Pay / hold / reject. choice + noul + score. **Landing.** |
| 2 | `ticket` | Ticket route | business | Queue. billing / engineering / success / spam. |
| 3 | `lead` | Lead qualify | business | Book demo / nurture / disqualify. |
| 4 | `refund` | Refund call | business | Full / partial / deny. |
| 5 | `hire` | Hire screen | business | Advance / hold / pass. |
| 6 | `launch` | Launch go/no-go | business | Ship / wait / rollback plan. |
| 7 | `chargeback` | Chargeback | business | Accept / represent / block. |
| 8 | `vendor` | Vendor risk | business | Sign / redline / walk. |
| 9 | `moderate` | Moderate | business | Go live / edit / kill. |
| 10 | `jacket` | Jacket? | weather | Outdoor layer. Open-Meteo optional. **The one weather case.** |

### 12.1 Invoice exception (landing)

AP queue. INV-18442, Northwind Logistics LLC, Net-30, 3 years, no prior disputes. Invoice $18,640 vs PO-9921 $16,200 (+15.1%). Fuel surcharge $1,980 not on PO; pallet repair $460 with a carrier claim. Policy AP-4.2: auto-pay ≤ $250 or ≤ 2%; hold 2–5% or $250–$2,000; reject or amend above that. Fuel needs a signed addendum (none on file). Buyer: pay fuel if verbal winter band, do not pay pallet. Vendor dunning 8 days past terms. SLA: AP close Friday 5pm ET.

- `action` **choice** — `pay` / `hold` / `reject`
- `within_policy` **noul** — Is paying this invoice as-is within AP-4.2? true: within policy; false: exception needs hold or reject
- `exception_risk` **score** — Routine / Watch / Material

### 12.2 Ticket route

Zendesk #482911, 14m old, Enterprise ARR $94k, first-response SLA 1h. Subject mixes production webhook 500s and a duplicate $2,400 invoice. Three similar 5xx tickets in 40m. Duplicate Stripe charge id. Sender matches account owner. Queues: billing / engineering / success / spam.

- `queue` **choice** — `billing` / `engineering` / `success` / `spam`
- `urgent` **noul** — Does this need Sev-1 / immediate attention? true: production or enterprise-at-risk now; false: can wait the SLA
- `severity` **score** — Low / Medium / Sev-1

### 12.3 Lead qualify

HubSpot D-44190. Harbor & Pine Credit Union, ~$2.1B assets, VP Operations, DNA core. Inbound: decision engine for loan exception queues, budget this FY, demo Thursday. ICP: CU/community bank $500M–$10B, ops/risk buyer, exception or KYC queues. They asked for on-prem; we are cloud + VPC only.

- `disposition` **choice** — `book_demo` / `nurture` / `disqualify`
- `icp_fit` **noul** — Does this account match ICP? true: ICP; false: out of ICP
- `intent` **score** — Cold / Warm / Hot

### 12.4 Refund call

Stripe $247 annual renewal, order ORD-77120, Maya Chen, 11 months, lifetime $1,104, two small prior refunds, risk 12/100. Renewed 19h ago; 3 logins this period. Policy R-3: full if unused or 14-day new-customer window (she is not new). Partial: unused months minus consumed month if cancel within 7 days of renewal. Deny: abuse, >2 refunds/year, or fully consumed. Chargeback threat is not itself a deny.

- `decision` **choice** — `full` / `partial` / `deny`
- `policy_allows_full` **noul** — Does R-3 allow a full refund here? true: full is in policy; false: it is not
- `abuse_risk` **score** — Clean / Watch / Abuse

### 12.5 Hire screen

SWE-II Decision Systems. Jordan Hale, 4.5 years, fintech routing rules (Rails), claims a “System-One-style classifier” but described sklearn + Slack bot. Comp $165k + 0.15% (band $140–170k, 0.08–0.20%). Musts: production backend, judgment-under-uncertainty, tradeoffs. Auto-pass: cannot discuss a real production system, or >$190k. Interviewer: strong communicator, light systems design.

- `outcome` **choice** — `advance` / `hold` / `pass`
- `meets_musts` **noul** — Do they meet the must-have scorecard? true: yes; false: no
- `fit` **score** — Weak / Mixed / Strong

### 12.6 Launch go/no-go

billing-vats 2.12.0, ship window today 16:00–18:00 ET, PDF engine for EU VAT invoices (~1,100 Friday). Open P1: umlauts as `?` on the tagged worker image; fix is on a newer untagged build. Rollback: feature flag off, tested <2m. Go: no P1 on the artifact we ship. Wait: retag. Rollback-plan: ship a known P1 only with a documented revert (legal has not asked).

- `call` **choice** — `ship` / `wait` / `rollback_plan`
- `artifact_ready` **noul** — Is the tagged artifact ready to ship? true: the SHA/tag we would ship is clean of P1; false: it is not
- `readiness` **score** — Blocked / Fragile / Ready

### 12.7 Chargeback

Stripe dispute $1,890, reason fraudulent, due 6 days. New account, 40-seat annual, CVV fail, no 3DS, Lagos datacenter ASN, data export 12k rows, then dispute. Policy: represent if strong fulfillment + real-org use; accept if CVV fail + new + export + no 3DS; block if scrape/fraud pattern.

- `action` **choice** — `accept` / `represent` / `block`
- `fraud_likely` **noul** — Is this likely fraud rather than a confused customer? true: fraud pattern; false: could be a real dispute
- `evidence_strength` **score** — Thin / Mixed / Strong

### 12.8 Vendor risk

Northwind Observability, $86k year 1, auto-renew. Liability cap 3 months fees. They want unlimited indemnity from us on customer content. SOC 2 Type II expired 4 months, no bridge letter. Training-on-customer-data unless an unattached exhibit. PROC-9: no unlimited outbound indemnity; no expired SOC 2 without a bridge; training opt-out required in the DPA. Walk if two of three fail and spend >$50k.

- `action` **choice** — `sign` / `redline` / `walk`
- `policy_clear` **noul** — Can we sign this paper as-is under PROC-9? true: clear to sign; false: not clear
- `risk` **score** — Acceptable / Elevated / Deal-breaker

### 12.9 Moderate

Trust & Safety PUB-90331. Pro creator, 2 prior strikes (medical-misinfo + spam). 42s video: peptide stack “cured my cousin’s tumor,” sales link, stock-photo watermark. Policy P-4 Health: no unproven cancer-treatment claims; no sales links on health claims; first cancer-claim strike = kill + 7-day feature ban. SLA 15 minutes. Would run next to a hospital advertiser.

- `action` **choice** — `go_live` / `edit` / `kill`
- `policy_violation` **noul** — Does this violate P-4 Health as posted? true: violation; false: can stand
- `harm` **score** — Low / Medium / Severe

### 12.10 Jacket? (the one weather case)

15–20 minute outdoor errand (coffee / walk). Judge jacket vs no jacket from the weather block plus this outing. Not a packing essay. Situation includes the Open-Meteo placeholder; live weather is optional via **Load weather**.

- `wear_jacket` **noul** — Should they wear a jacket for this outing given the weather? true: jacket is warranted; false: comfortable without one
- `layer` **choice** — `tee` / `light_layer` / `insulated` / `rain_shell`

Each situation in `src/samples.ts` must match this contract (ids, types, option keys). Copy may be slightly warmer than this SPEC outline; question **ids** and **types** must not drift. Business situations must read like tickets/memos (enough state for Jev) and must **not** require live weather.

Use Cases (`/use-cases`) renders the same ten as cards. Workshop chips and Use Cases cards share this module.


---

## 13. Verification

Before calling Workshop done:

1. Health pill shows key state accurately
2. Send an LLM message; streamed reply appears
3. Ask Jev on the landing **Invoice exception**; three answers render (choice / noul / score)
4. Propose questions replaces or fills the editor
5. Feed Jev → LLM injects a visible note
6. Docs page lists snapshot files; open one
7. Update Jev docs button completes and the list refreshes
8. Splitter drags; textareas have no native corner grip. Splitter reads as a thin quiet seam (not a dashed orange candy-cane stripe); hover/drag shows a slightly wider pine handle
9. `/docs` deep link works after refresh
10. Docs overlay: eyeball shows rendered Markdown; code icon shows raw source; tips stay fully visible
11. `/use-cases` shows **10** cards (9 business + Jacket, not ten weather titles); `/cases` is the same page
12. Click a card: Workshop loads that case + questions (`?case=` in the URL)
13. `/api/health` JSON has `hasKey` / `keys.*` booleans only — no key material in the body
14. Tips on Use Cases cards stay fully visible (flip, opaque)
15. Send an LLM message, refresh: the thread is still in History and the transcript restores
16. Click a past thread to restore case + questions + last Jev answers
17. New chat returns to Invoice exception; the previous thread remains in the list
18. Delete one thread; it is gone after refresh
19. `localStorage["talk-to-jev:chats"]` has no API key
20. First-open Workshop: **Invoice exception** chip is on; weather row is **hidden**. Jacket chip shows the weather row; switching back to a business chip hides it again
21. On Jacket: **Load weather** (default Columbus, OH) fills Jev’s case weather block; status line shows place + now; no OpenRouter key required
22. Pick at least two **business** chips plus Jacket: Jev’s case + Jev questions swap; Ask Jev returns typed answers
23. On Jacket: changing the location field and loading again replaces the weather block without wiping the Situation
24. `/docs` overlay still works after the Workshop weather work
25. First visit (or clear `talk-to-jev:tutorial-done`): coach overlay appears on Workshop; card fully on-screen and opaque
26. Next walks at least 3 steps; Back returns; missing targets (Use Cases / Settings / weather if hidden on a business preset) are skipped, not crashed
27. Skip dismisses; refresh does not reopen the overlay
28. Chrome **Tour** restarts the overlay; Docs eyeball/code step still keeps that view overlay fully visible
29. `/settings` loads; OpenRouter shows Key ready (not the secret); unused slots show missing if empty
30. Saving an empty unused key (e.g. OpenAI) does not echo a full key in the UI or JSON
31. `GET /api/settings` has `present` / `last4` only — no full key
32. Chrome key pill (checking / ready / missing / error) is a real button with `cursor: pointer`; click and keyboard go to `/settings`; `title` mentions Settings on every state (missing: paste in Settings); visible label stays the key status, not the word Settings
33. `localStorage["talk-to-jev:chats"]` still has no API key after using Settings
34. **Add question** inserts a card whose id field is **empty** (placeholder `question id`, not `q_*`). Typing an id works. **Ask Jev** with that field still blank shows an inline error and does not invent an id or call Jev. Preset ids (`wear_jacket`, business ids) stay filled.
35. Ticket label reads **Jev’s case** (not **Case**). Use Cases gallery title stays **Use Cases**.
36. **Add .md** (or drop `.md` onto Jev’s case) inserts a marked attach block into the textarea; chips list the filename. Ask Jev / the LLM see that text as `state`.
37. Drop a **mix** (`.md` + `.txt` or `.pdf`): markdown attaches on Workshop; the **Convert** tab (`/convert`) opens for the rest with per-file progress. A truly unsupported type shows an inline error on the ticket (no native `alert`). A huge markdown file (over the §15 cap) is rejected without freezing the UI.
38. Remove a chip: that attach block is gone; weather / situation text stay.
39. Re-adding the same filename replaces that attach block (does not duplicate it).
40. Opening Docs does **not** dump the official snapshot into Jev’s case. Attach is local user files only.
41. Drop `.txt` / `.html` / `.docx` / `.pdf` onto Jev’s case: the **Convert** tab (`/convert`) opens (not a half-pane on Workshop, not a case-row button). Per-file progress. Resulting MD can **Add to the LLM**, **Add to Jev’s case**, **Download**, **Save as MD**. Chrome nav is Workshop | Use Cases | Docs | Settings | **Convert** (Convert after Settings; visible label Convert; title/aria Convert to Markdown).
42. PDF: text layer via **pdfjs-dist** in the browser. No network upload of the file. A scan / image-only PDF errors **scan / no selectable text**. Convert page footnotes Pandoc as a heavier local option.
43. `.doc` (legacy): Convert page says **save as .docx** (no cheap browser path).
44. Convert page shows Jev token copy from TypeSafe (`docs/jev/typesafe/models.md`): **~64,000 tokens per request**; **32k** for state + longest question. Warn if converted MD would blow 32k; block **Add to Jev’s case** if it would blow 64k. Download / Save still work.
45. Convert page textareas `resize: none`. Tips opaque and fully on-screen. Workshop still has the quiet LLM \| Jev splitter (not candy-cane). Convert page uses the same quiet splitter between file list and preview.
46. Jev’s case toolbar has **Add .md** only — no Convert to Markdown chrome button in that row. `.md` drop stays on Workshop (attach chips).

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

If any fail: **keep private**, fix what we can, report. LICENSE is MIT, copyright Nathan Utley, 2026.

---

## 16. Convert to Markdown (client-side)

Nater (2026-09-19): drop files on **Jev’s case**. Markdown goes into Jev state. Other text-ish files open the **Convert** tab (`/convert`). Same day: move the Convert to Markdown **button** off the case ticket onto that chrome tab (after Settings). PDFs are **text layer only** via OSS **pdf.js** (`pdfjs-dist`) in the browser. **No images, no OCR, no upload to a SaaS converter.** Files never leave the machine.

### Drop mix (Jev’s case ticket)

| Kind | Extensions / types | Behavior |
|---|---|---|
| Markdown | `.md`, `.markdown`, `text/markdown` | Drop **into Jev’s case** as attach blocks. **Stay on Workshop.** |
| Convert | `.txt`, `.html`, `.htm`, `.docx`, `.pdf` | Navigate to **`/convert`**. Per-file progress. |
| Legacy Word | `.doc` (OLE / `application/msword`) | Navigate to `/convert` with an error: **save as .docx**. No cheap reliable browser path for OLE `.doc`. |
| Mix | markdown + convert | Markdown attaches on Workshop; convert files open the Convert tab. |
| Other | anything else | Inline error on the ticket (`role="alert"`). Not `alert()`. |

**Add .md** stays markdown-only on the ticket. **Do not** put a Convert to Markdown button back on Jev’s case.

**Convert to Markdown** control lives on `/convert`: file picker `accept` for `.txt,.html,.htm,.docx,.pdf,.doc` plus matching MIME types, `multiple`. Drop zone on that page too. Does not attach until an action.

Drag-and-drop onto the **whole Jev’s case ticket** still works: convertables **open the Convert tab**. `.md` does not.

### Convert page (`/convert`)

Full page — not a half Workshop board.

Eyebrow / heading: **Convert to Markdown**. Chrome nav label: **Convert**.

Per-file row: filename, status (queued / reading / converting / done / error), progress (PDF = page n of m). Select a done file to preview resulting MD.

Quiet custom splitter (same mill/pine seam as LLM \| Jev — not a dashed orange hatch) between the file list and the preview. Hidden on mobile; panes stack. `resize: none` on the preview textarea.

**Actions** on the selected resulting MD:

| Action | What |
|---|---|
| **Add to the LLM** | Insert a user-visible note into the LLM thread with the markdown. Does **not** auto-call the LLM. |
| **Add to Jev’s case** | Merge as an attach block (same markers as §15). Same replace-same-name / cap rules. |
| **Download** | Browser download of the `.md`. |
| **Save as MD** | `showSaveFilePicker` when the browser has it; otherwise same as Download. |

Leave via chrome nav. Switching away does not have to wipe jobs. A later drop on this page or on Jev’s case can append jobs.

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
- Resulting MD: **200,000 characters** to **Add to Jev’s case** (same as §15). Download / Save / Add to the LLM may still use a larger preview; warn if over.
- Never upload. Never a convert API. Never read `.env` / `.env.local`.

### Jev token window (TypeSafe snapshot)

Source of truth: [`docs/jev/typesafe/models.md`](jev/typesafe/models.md) (fetched 2026-09-19):

- **64k tokens per request** (`state` + all questions combined)
- **32k tokens** for `state` plus the **single longest question**

OpenRouter’s Jev 1.13 listing in this snapshot still says **32,000** context — treat that as **stale vs TypeSafe**. UI copy: **Jev context window ~64,000 tokens** (TypeSafe), with a note that **state + longest question** is **32k**.

Rough estimate: `ceil(chars / 4)`. Show estimated tokens on the Convert page for the resulting MD.

- **Warn** if the MD (or MD + current Jev’s case) would exceed **32k** (state + longest question).
- **Error** (block **Add to Jev’s case**) if the MD alone, or MD + current case, would exceed **64k**. Download / Save / Add to the LLM still allowed.

### Never

- Images into Jev
- OCR / Tesseract / cloud PDF APIs
- New upload endpoint
- Secrets in convert output or history

