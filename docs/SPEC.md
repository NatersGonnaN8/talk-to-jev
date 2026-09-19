# Talk to Jev — SPEC

**Status:** v0.4 — 2026-09-19  
**Product:** Talk to Jev  
**Folder:** `C:\Users\uttle\Projects\Talk to Jev`  
**GitHub:** `talk-to-jev` (public only after the §14 security checklist)  
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

**Weather is input, not a third model.** Live conditions come from **Open-Meteo** (free, no API key), fetched server-side, and written into the Case ticket as Jev `state` (and therefore LLM context). Still **one OpenRouter key**.

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
- Do not send weather to a third model. Open-Meteo → Case ticket → Jev / LLM.

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

Shared **case** (the Jev `state`) sits in a ticket strip at the top. Both models see it.

| Action | What happens |
|---|---|
| **Ask the LLM** | Chat completions. System prompt includes `primer.md` so the LLM knows Jev’s contract (state + questions, not chat). Optional: last Jev answers. Case text (including any weather block) is the current case. |
| **Ask Jev** | Decisions API. `state` = case text, plus optional `{ transcript }` of the LLM thread. `questions` = the editor on the Jev pane. |
| **Propose questions** | LLM is asked to return a JSON `questions` map for this case. Valid maps replace (or merge into) the Jev editor. Invalid JSON stays in chat as prose. |
| **Feed Jev → LLM** | Inject a user-visible note into the LLM thread summarizing typed answers (choice / noul / score / confidence). Next LLM turn sees it. |
| **Load weather** | Server fetches Open-Meteo for the ticket location. Current conditions + a short forecast are written into a marked **weather block** on the Case ticket. Does not call Jev or the LLM. |
| **Sample case** | One click (Workshop chip **or** Use Cases card) loads the same `src/samples.ts` preset: Case situation (weather placeholder), Jev questions, short label. Clears prior Jev answers and the LLM thread so the last case cannot leak. |

Code owns routing. The UI shows probabilities; it does not pretend a typed answer is “correct.”

Default demo case and questions (official-shaped):

- State: `My card was charged twice. Please help ASAP.`
- `department` choice: billing / technical / sales
- `urgent` noul
- `frustration` score: Calm / Frustrated / Very angry

---

## 6. Pages

Global chrome (all pages):

- Left: product name **Talk to Jev** (links home Workshop)
- Nav: **Workshop** | **Use Cases** | **Docs** (and **Settings** only if that page exists)
- Right: **Tour** (Help — restarts the first-run coach overlay), **History** (Workshop only — opens the local thread drawer), key pill (`Key ready` / `Need OpenRouter key`), **Update Jev docs**
- No native textarea resize grips. Pane widths use a custom vertical splitter.
- No native `<dialog>` / iframe for the coach. See §6.4.

### 6.1 Workshop — `/`

**Job:** talk to the LLM, talk to Jev, pass work across the wire.

Layout (desktop):

```
[ chrome ]
[ CASE TICKET ]
  [ samples: 10 chips ]
  [ location field + Load weather ]
  [ include-chat checkbox ]
  [ shared state textarea ]
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

### 6.3 Use Cases — `/use-cases` (`/cases` alias)

**Job:** show the **same ten** sample snaps that Workshop loads. One list in `src/samples.ts`. Do not invent a second catalog.

Layout:

```
[ chrome ]
[ manila intro slip ]
[ 10 case cards ]
```

Each card: **label** (same as the Workshop chip), one-line **pitch**, chips for which Jev types it uses (`choice` / `noul` / `score`). Clicking the card (or **Open in Workshop**) goes to `/` with `?case=<id>` and loads **the same preset** as the Workshop chip: situation + questions, clear answers + LLM thread, mark that sample active. Default billing-ticket demo stays the Workshop empty state when no `?case=` is set.

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
- Spotlight / hole around the real control when a target exists (Case, Ask Jev, etc.).
- Coach **card** is fully opaque (manila `#F3E7D3` or blueprint `#C9DCE8`, pine ink, mill floor). No translucent fill.
- Chrome is sticky at the top, so prefer **below** the target or **center** of the remaining viewport. Flip above only if the card would clip the bottom. Clamp every edge on-screen.
- No native resize grips. Slick: sage mill / manila / blueprint, usable, no garnish.

**Controls:** **Back** / **Next** / **Skip** / **Done** (Done replaces Next on the last available step). Skip and Done both write `talk-to-jev:tutorial-done` = `1`. Never store `OPENROUTER_API_KEY` (or any secret) in this key.

**Steps** (each is independent). If the target is missing because a sibling page/control has not landed, **skip that step** — do not block the tour.

1. **Welcome** — two AIs, one OpenRouter key. The LLM talks. Jev does not write.
2. **Case ticket** — this slip is Jev `state`.
3. **LLM pane** — prose / draft / chat.
4. **Jev pane** — typed `choice` / `noul` / `score` + **Ask Jev**.
5. **Propose Jev questions** / **Feed Jev to LLM** if those buttons exist.
6. **Use Cases** tab if it exists.
7. **Docs** — eyeball (nice Markdown) vs code (raw snapshot). May navigate to `/docs`.
8. **Settings** BYOK if that page exists (optional later: OpenAI, Anthropic, Tavily, Brave — still no keys in the browser).
9. **History** if the chrome control exists.
10. **Load weather** if that control exists (Open-Meteo input, not a third model).

**Code:** `src/tutorial.ts` (step list + storage helpers) and `src/TutorialOverlay.tsx`. Hook live controls with `data-tutorial` attributes. Overlay may switch Workshop ↔ Docs for those steps, then continue.

**Do not:** use `<dialog>`, an iframe, `resize:` other than `none`, or a translucent card.

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
| GET | `/api/weather` | Open-Meteo proxy. Query `q` (city or `lat,lon`) or `latitude`+`longitude`. Default `q=Columbus, OH`. Returns `{ ok, place, current, daily, hourly, text, json }`. `text` is the Case weather block. No OpenRouter key. |
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
- A `## Weather` block in the case is observational Open-Meteo input. Do not invent a weather API call. Do not pretend to be Jev.

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
  state               // Case ticket text
  includeChat         // Include LLM chat in Jev state
  questions           // Jev question editor
  answers             // last Jev answers or null
  jevMeta             // usage line if any
  samplePresetId      // weather/sample preset id if that UI exists; else null
```

Rules:

- Cap **50** threads (keep the active thread; drop the oldest `updatedAt` first).
- Do **not** write `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`, env, health, or Settings payloads into this key.
- Corrupt or unknown `v` → start empty (do not throw).
- Quota errors: drop oldest inactive threads and retry; never crash the Workshop.
- Composer draft and pane split are not required to persist.
- Empty untouched defaults are **not** stored as ghost threads. A thread is written once it has messages, a renamed title, a non-default case, non-default questions, Jev answers, or a sample preset.

---

## 11. Weather input (Open-Meteo)

Provider: **Open-Meteo** Forecast API + Geocoding API. No API key. CC BY 4.0 attribution in the weather block and a short UI hint. Server-side fetch only (Vite middleware). The browser never talks to Open-Meteo directly in MVP (keeps one network story: UI → local `/api/*`).

**Default place:** Columbus, Ohio, United States (`39.9612, -82.9988`). Nate can change the location field to another city (`Nashville, TN`) or coordinates (`36.16, -86.78`).

**Units (US default):** °F, mph, inches. Timezone: `auto` from Open-Meteo.

**What loads into Jev state**

The Case ticket owns a marked block:

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

## 12. Ten sample cases (Workshop presets)

One-click chips on the Case ticket **and** cards on **Use Cases**. Same ten. Each preset is a product contract: **id**, **short label**, **pitch**, **situation** (case text with a weather placeholder), **Jev questions**. All ten are weather-shaped. Clicking a chip or a Use Cases card:

- Writes the situation into the Case textarea (placeholder weather block included)
- Replaces the Jev question editor
- Clears last Jev answers and the LLM thread (the previous case must not leak if “Include LLM chat” is on)
- Marks that chip active
- Does **not** fetch weather until **Load weather** (so a preset still works offline; live weather is the upgrade)

Initial Workshop load stays the support-ticket demo (not a chip). None of the ten replace that default until clicked.

Chip labels (keep these names unless a later SPEC edit renames them):

| # | id | Chip | Mix |
|---|---|---|---|
| 1 | `jacket` | Jacket? | Practical. Noul + layer choice. |
| 2 | `run` | Run go/no-go | Practical. Outdoor run vs treadmill. |
| 3 | `rain-delay` | Rain delay | Practical. School / rec sports call. |
| 4 | `patio` | Patio dinner | Practical. Eat out vs stay in. |
| 5 | `garden` | Water the garden | Practical. Water vs skip for rain. |
| 6 | `commute` | Bike vs bus | Practical. Commute mode. |
| 7 | `grill` | Grill tonight? | Practical. Cook outside. |
| 8 | `storm` | Storm prep | Practical. Windows / cushions / watch. |
| 9 | `festival` | Harvest festival | Fun. TypeSafe/Jev NPC town call. |
| 10 | `travel` | Travel day | Practical. Fly / drive / delay. |

### 12.1 Jacket?

Situation: 15–20 minute outdoor errand (coffee / walk). Judge jacket vs no jacket from weather + outing.

- `wear_jacket` **noul** — Should they wear a jacket for this outing given the weather? true: jacket is warranted; false: comfortable without one.
- `layer` **choice** — `tee` / `light_layer` / `insulated` / `rain_shell`

### 12.2 Run go/no-go

Situation: planned outdoor run (~45 min). Safety and comfort, not a coaching essay.

- `go_outside` **noul** — Is it reasonable to run outdoors now?
- `plan` **choice** — `outdoor_run` / `treadmill` / `wait_for_break` / `skip`
- `conditions` **score** — Great / OK / Poor / Unsafe

### 12.3 Rain delay

Situation: youth rec / school outdoor game this afternoon. Field call.

- `delay_game` **noul** — Should the game be delayed or called for weather?
- `call` **choice** — `play` / `delay` / `move_indoors` / `cancel`
- `field` **score** — Dry / Damp / Unsafe

### 12.4 Patio dinner

Situation: dinner plans with friends; patio is the preference.

- `worth_going_out` **noul** — Worth leaving the house for dinner given the weather?
- `venue` **choice** — `outdoor_patio` / `indoor_table` / `takeout` / `stay_in`

### 12.5 Water the garden

Situation: backyard vegetables, evening watering habit.

- `water_today` **noul** — Should they water the garden today?
- `timing` **choice** — `water_now` / `water_evening` / `skip_rain_coming` / `skip_already_wet`

### 12.6 Bike vs bus

Situation: 3-mile commute, bike is the default in decent weather.

- `bike_ok` **noul** — Is biking this commute reasonable in this weather?
- `mode` **choice** — `bike` / `bus` / `drive` / `wfh`

### 12.7 Grill tonight?

Situation: weeknight dinner, charcoal/gas grill on a deck.

- `grill` **noul** — Should they grill outdoors tonight?
- `plan` **choice** — `grill_now` / `grill_later` / `indoor_cook` / `takeout`

### 12.8 Storm prep

Situation: house with open windows and porch cushions; a system is in the forecast.

- `close_windows` **noul** — Should they close windows and bring loose things in now?
- `prep` **choice** — `none` / `close_and_stow` / `full_storm_prep`
- `urgency` **score** — Calm / Watch / Act now

### 12.9 Harvest festival (fun)

Situation: TypeSafe-games / Jev NPC energy. A town crier asks whether to hold the harvest festival in the square this afternoon. Jev is the town’s snap-judgment engine, not a novelist.

- `hold_festival` **noul** — Should the town hold the harvest festival in the square this afternoon?
- `venue` **choice** — `town_square` / `guild_hall` / `postpone_dawn` / `cancel_season`
- `omen` **score** — Fair winds / Uneasy sky / Ill omen

### 12.10 Travel day

Situation: morning departure, could fly, drive, or wait a day. Judge disruption from weather, not airline politics.

- `leave_today` **noul** — Should they leave today given the weather?
- `mode` **choice** — `fly` / `drive` / `delay_until_clear` / `cancel`
- `disruption` **score** — Smooth / Bumps / Severe

Each situation file in `src/samples.ts` must match this contract (ids, types, option keys). Copy may be slightly warmer than this SPEC outline; question **ids** and **types** must not drift.

Use Cases (`/use-cases`) renders the same ten as cards. Workshop chips and Use Cases cards share this module.

---

## 13. Verification

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
11. `/use-cases` shows **10** cards; `/cases` is the same page
12. Click a card: Workshop loads that case + questions (`?case=` in the URL)
13. `/api/health` JSON has `hasKey` / `keys.*` booleans only — no key material in the body
14. Tips on Use Cases cards stay fully visible (flip, opaque)
15. Send an LLM message, refresh: the thread is still in History and the transcript restores
16. Click a past thread to restore case + questions + last Jev answers
17. New chat starts a blank workshop; the previous thread remains in the list
18. Delete one thread; it is gone after refresh
19. `localStorage["talk-to-jev:chats"]` has no API key
20. **Load weather** (default Columbus, OH) fills the Case ticket weather block; status line shows place + now; no OpenRouter key required
21. Pick at least two sample chips: Case + Jev questions swap; Ask Jev returns typed answers
22. Changing the location field and loading again replaces the weather block without wiping the Situation
23. `/docs` overlay still works after the Workshop weather work
24. First visit (or clear `talk-to-jev:tutorial-done`): coach overlay appears on Workshop; card fully on-screen and opaque
25. Next walks at least 3 steps; Back returns; missing targets (Use Cases / Settings / weather if not landed) are skipped, not crashed
26. Skip dismisses; refresh does not reopen the overlay
27. Chrome **Tour** restarts the overlay; Docs eyeball/code step still keeps that view overlay fully visible

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
