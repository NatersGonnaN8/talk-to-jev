# Talk to Jev — Tour copy

**This is the file to open in chat** when editing walkthrough text.

Live overlay **imports** `src/tutorial.ts` (`TUTORIAL_STEPS` + `TUTORIAL_UI`). Keep this markdown **1:1** with that module. If they drift, `src/tutorial.ts` wins in the running app — paste the same strings there so Nate’s edits ship.

Storage: `localStorage["talk-to-jev:tutorial-done"]` = `"1"` after Skip or Done. Chrome **Tour** restarts. Escape matches Skip (dismiss + mark done). Missing targets skip that step; they do not block the tour.

---

## Chrome

| Control | Copy |
|---|---|
| Header button | Tour |
| Aria-label | Start tour |

## Card chrome

| Control | Copy |
|---|---|
| Kicker | `Tour · {n} / {total}` |
| Skip | Skip |
| Back | Back |
| Next | Next |
| Done | Done (replaces Next on the last available step) |

---

## Steps (11)

Each step is independent. **page** is where the overlay navigates. **hooks** are `data-tutorial` ids (first match wins). **selectors** / **texts** are fallbacks.

### 1. Two AIs, one key

- **id:** `welcome`
- **page:** workshop
- **target:** none (centered welcome — no spotlight)

Talk to Jev wires a cheap LLM (it talks) to Jev (it does not write). One OpenRouter key runs chat completions and the Decisions API. Jev is System One: state plus typed questions, then probabilities — not a chatbot.

### 2. Jev’s State

- **id:** `case`
- **page:** workshop
- **hooks:** `case`
- **selectors:** `.ticket`

This slip is Jev state. New State starts a blank workshop — not a preset. Preset States loads one of the ten snaps. History is on this row, not in the header. Drop .md here; other files open Convert. Jacket can add Open-Meteo weather.

### 3. The LLM pane talks

- **id:** `llm`
- **page:** workshop
- **hooks:** `llm`
- **selectors:** `.pane.llm`

Manila side: draft the state, ask how to phrase a question, or chat. This is the prose half. While it works you get mill thinking, real thoughts if the model streams them, and tool cards when it writes Jev’s State or questions — not a JSON dump. Inspector (in this pane-head, off until you toggle it) always records what went to the LLM and to Jev. Jev never writes in this thread.

### 4. Jev’s Questions

- **id:** `jev`
- **page:** workshop
- **hooks:** `jev`, `ask-jev`, `feed-jev`
- **selectors:** `.pane.jev`

Jev’s Questions: choice, noul, or score — not essays. Add questions, then Ask Jev. Send answers to LLM sits next to Ask Jev and sends typed answers to the LLM immediately. You get probabilities, not a paragraph.

### 5. Pass work across the wire

- **id:** `wire`
- **page:** workshop
- **hooks:** `wire`
- **selectors:** `.pane.llm .row-actions`

Propose Jev questions asks the LLM to fill the q-cards with tools (not a JSON dump in chat). Random state (left of Agentic loop) invents a mill once. Agentic loop runs N LLM↔Jev turns on the current mill. Inspector is on this mill row. Send answers to LLM lives on Jev’s Questions, next to Ask Jev — after Jev answers, it sends those typed results to the LLM immediately.

### 6. Example Uses

- **id:** `use-cases`
- **page:** use-cases
- **hooks:** `use-cases`, `use-cases-page`
- **texts:** Example Uses

Nine operator snaps plus Jacket — the same list as Workshop Preset States. Open a card to load the state and Jev questions.

### 7. Docs: Nice, Code, Iframe

- **id:** `docs`
- **page:** docs
- **hooks:** `update-docs`, `docs-view`, `docs`
- **selectors:** `.doc-overlay`
- **texts:** Docs

Official Jev docs live in this repo. **Update Jev docs** is on this page (not the header). Open a page, then Nice view, Code view, or the boxed-i Iframe when the live page will actually embed. Iframe hides for primer and sites that block framing.

### 8. Settings — bring your own key

- **id:** `settings`
- **page:** settings
- **hooks:** `settings-page`, `settings`
- **texts:** Settings

Paste your OpenRouter key here. It stays on the server — never in git, never in the browser. Optional later: OpenAI, Anthropic, Tavily, Brave. They are saved only until those features land.

### 9. Convert to Markdown

- **id:** `convert`
- **page:** convert
- **hooks:** `convert-page`, `convert`, `convert-nav`
- **texts:** Convert

Chrome Convert opens this tab. Drop txt, html, docx, or pdf here — or onto Jev’s State, which brings you here. Files stay in the browser. Add the markdown to the LLM, to Jev’s State, or save it.

### 10. History stays on this machine

- **id:** `history`
- **page:** workshop
- **hooks:** `history`
- **texts:** History

History lives on Jev’s State, not in the header. Threads stay in this browser’s localStorage. Refresh restores them. Keys are never stored here.

### 11. Load weather

- **id:** `weather`
- **page:** workshop
- **hooks:** `weather`
- **texts:** Load weather

Jacket is the one weather snap. Load weather writes Open-Meteo into that ticket. Other snaps are operator decisions — no weather field.
