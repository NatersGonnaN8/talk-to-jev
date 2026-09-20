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

### 2. Jev’s case is Jev state

- **id:** `case`
- **page:** workshop
- **hooks:** `case`
- **selectors:** `.ticket`

This slip is Jev state. New Case starts a blank workshop — not a preset. Preset Cases loads one of the ten snaps. History is on this row, not in the header. Drop .md here; other files open Convert. Jacket can add Open-Meteo weather.

### 3. The LLM pane talks

- **id:** `llm`
- **page:** workshop
- **hooks:** `llm`
- **selectors:** `.pane.llm`

Manila side: draft the case, ask how to phrase a question, or chat. This is the prose half. While it works you get mill thinking, real thoughts if the model streams them, and tool cards when it writes Jev’s case or questions — not a JSON dump. Jev never writes in this thread.

### 4. Jev’s Questions

- **id:** `jev`
- **page:** workshop
- **hooks:** `jev`, `ask-jev`
- **selectors:** `.pane.jev`

Jev’s Questions: choice, noul, or score — not essays. Add questions, then Ask Jev. You get probabilities, not a paragraph.

### 5. Pass work across the wire

- **id:** `wire`
- **page:** workshop
- **hooks:** `wire`
- **selectors:** `.pane.llm .row-actions`

Propose Jev questions asks the LLM to fill the q-cards with tools (not a JSON dump in chat). After Jev answers, Feed Jev to LLM drops those typed results into the chat.

### 6. Use Cases

- **id:** `use-cases`
- **page:** use-cases
- **hooks:** `use-cases`, `use-cases-page`
- **texts:** Use Cases

Nine operator snaps plus Jacket — the same list as Workshop Preset Cases. Open a card to load the case and Jev questions.

### 7. Docs: Nice, Code, Iframe

- **id:** `docs`
- **page:** docs
- **hooks:** `docs-view`, `docs`
- **selectors:** `.doc-overlay`
- **texts:** Docs

Official Jev docs live in this repo. Open a page, then Nice view, Code view, or the boxed-i Iframe for the live source. Iframe stays off for local primer pages.

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

Chrome Convert opens this tab. Drop txt, html, docx, or pdf here — or onto Jev’s case, which brings you here. Files stay in the browser. Add the markdown to the LLM, to Jev’s case, or save it.

### 10. History stays on this machine

- **id:** `history`
- **page:** workshop
- **hooks:** `history`
- **texts:** History

History lives on Jev’s case, not in the header. Threads stay in this browser’s localStorage. Refresh restores them. Keys are never stored here.

### 11. Load weather

- **id:** `weather`
- **page:** workshop
- **hooks:** `weather`
- **texts:** Load weather

Jacket is the one weather case. Load weather writes Open-Meteo into that ticket. Other snaps are operator decisions — no weather field.
