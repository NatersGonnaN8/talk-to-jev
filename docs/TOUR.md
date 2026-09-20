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

## Steps (14)

Each step is independent. **page** is where the overlay navigates. **hooks** are `data-tutorial` ids (first match wins). **selectors** / **texts** are fallbacks.

LLM pane buttons sit after the LLM pane step, left to right: Random state, Agentic loop, Propose Jev questions, Inspector. Spotlight those buttons — not `.row-actions` (`data-tutorial="wire"` stays on the row; it is not a Tour step).

### 1. Two AIs, one key

- **id:** `welcome`
- **page:** workshop
- **target:** none (centered welcome — no spotlight)

Talk to Jev wires an LLM that chats to Jev which decides using a single OpenRouter key. This Workshop is a quick at-a-glance of what Jev is — inspiration, not the last mill.

### 2. Jev’s State

- **id:** `case`
- **page:** workshop
- **hooks:** `case`
- **selectors:** `.ticket`

This is Jev's state: the briefing from which Jev makes decisions. New State starts a blank workshop — not a preset. Preset States loads one of the ten prewritten example uses (states). Drop .md here; other text files can be dropped to convert them to markdown.

### 3. The LLM pane talks

- **id:** `llm`
- **page:** workshop
- **hooks:** `llm`
- **selectors:** `.pane.llm`

The LLM talks to Jev with six tools: read_jev_workshop (reads the current pane), read_jev_state (queries Jev's State), read_jev_questions (queries Jev's Questions), set_jev_state (writes Jev's state), set_jev_questions (writes Jev's questions), ask_jev (asks Jev to answer the questions).

### 4. Random state

- **id:** `random-state`
- **page:** workshop
- **hooks:** `random-state`
- **texts:** Random state

This invents a short fake ticket so you can try the pane without writing one. It does not call Jev — Ask Jev still does that.

### 5. Agentic loop

- **id:** `agentic-loop`
- **page:** workshop
- **hooks:** `agentic-loop`
- **texts:** Agentic loop

A few LLM turns on this ticket — questions, then Jev, then talk from the numbers. You pick how many (1–10, default 3); empty pane disables it.

### 6. Propose Jev questions

- **id:** `propose-questions`
- **page:** workshop
- **hooks:** `propose-questions`
- **texts:** Propose Jev questions

Have the LLM write typed questions for whatever is in Jev’s State right now.

### 7. Inspector

- **id:** `inspector`
- **page:** workshop
- **hooks:** `inspector`
- **texts:** Inspector

The raw To LLM / To Jev payloads. Keys never show up here — Close it if it covers Send.

### 8. Jev’s Questions

- **id:** `jev`
- **page:** workshop
- **hooks:** `jev`, `ask-jev`, `feed-jev`
- **selectors:** `.pane.jev`

Question types Jev answers: choice (rice or noodles?), noul (probability, 0-1), or score (How mad is the customer? 1: not mad, 2: mildly mad, 3: livid). Add questions, then Ask Jev. Send answers to LLM sits next to Ask Jev and sends typed answers to the LLM immediately for greater cooperation between multiple AI types.

### 9. Example Uses

- **id:** `use-cases`
- **page:** use-cases
- **hooks:** `use-cases`, `use-cases-page`
- **texts:** Example Uses

Nine operator snaps plus Jacket — the same list as Workshop Preset States. Open a card to load the state and Jev questions.

### 10. Docs: Nice, Code, Iframe

- **id:** `docs`
- **page:** docs
- **hooks:** `docs-view`, `update-docs`, `docs`
- **selectors:** `.doc-overlay`
- **texts:** Docs

Official Jev docs live in this repo. Update Jev docs is on this page (not the header). Open a page, then Nice view, Code view, or the boxed-i Iframe when the live page will actually embed. Iframe hides for primer and sites that block framing.

### 11. Settings — bring your own key

- **id:** `settings`
- **page:** settings
- **hooks:** `settings-page`, `settings`
- **texts:** Settings

Paste your OpenRouter key here. It stays on the server — never in git, never in the browser. Optional later: OpenAI, Anthropic, Tavily, Brave. They are saved only until those features land.

### 12. Convert to Markdown

- **id:** `convert`
- **page:** convert
- **hooks:** `convert-page`, `convert`, `convert-nav`
- **texts:** Convert

Chrome Convert opens this tab. Drop txt, html, docx, or pdf here — or onto Jev’s State, which brings you here. Files stay in the browser. Add the markdown to the LLM, to Jev’s State, or save it.

### 13. History stays on this machine

- **id:** `history`
- **page:** workshop
- **hooks:** `history`
- **texts:** History

History lives on Jev’s State, not in the header. Threads stay in this browser’s localStorage. Refresh restores them. Keys are never stored here.

### 14. Load weather

- **id:** `weather`
- **page:** workshop
- **hooks:** `weather`
- **texts:** Load weather

Jacket is the one weather snap. Load weather writes Open-Meteo into that ticket. Other snaps are operator decisions — no weather field.
