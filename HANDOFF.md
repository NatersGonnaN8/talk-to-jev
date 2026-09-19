# Talk to Jev — handoff

**2026-09-19** — Local Workshop history + Use Cases + OSS gate. GitHub `NatersGonnaN8/talk-to-jev` (public only if the SPEC open-source checklist passed). Local `http://127.0.0.1:5182`. Use Cases: `http://127.0.0.1:5182/use-cases` (`/cases` alias).

## What it is

Two AIs, one OpenRouter key. LLM talks (`deepseek/deepseek-v4-flash` chat completions). Jev judges (`typesafe/jev-1.13` Decisions API). Shared **Case** ticket is Jev `state`. Weather is Open-Meteo input (no extra key). Ten sample snaps live in `src/samples.ts` — Workshop chips and **Use Cases** cards are the same list.

## Chat history (this browser only)

- Chrome **History** (Workshop) opens a sage drawer. New chat, Clear current, click to restore, Rename, Delete.
- Stored in `localStorage` key **`talk-to-jev:chats`** (v1 JSON, cap 50). Code: `src/history.ts` + `src/HistoryPanel.tsx`.
- Restores the LLM thread, case text, include-chat, Jev questions, last Jev answers, and sample preset id.
- No accounts, no server DB, **no API keys** in that JSON. Refresh keeps the list.

## Do next

- Keep `.env.local` as the only key file. Never `VITE_OPENROUTER_API_KEY`. Never put keys in localStorage.
- Refresh docs after TypeSafe ships notes: button or `npm run update-jev-docs`.
- Pin Jev 1.13 unless Nate asks for latest.
- If GitHub is still private, a checklist item failed — read the last agent report before flipping visibility.

SPEC: `docs/SPEC.md` (v0.3). License: MIT, Nathan Utley 2026.
