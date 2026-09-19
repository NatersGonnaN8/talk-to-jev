# Talk to Jev — handoff

**2026-09-19** — README + first-run **Tour** overlay. Private GitHub https://github.com/NatersGonnaN8/talk-to-jev. Local `http://127.0.0.1:5182`.

## What it is

Two AIs, **one OpenRouter key**. LLM talks (`deepseek/deepseek-v4-flash`). Jev judges (`typesafe/jev-1.13` Decisions API). Jev is **not** a chatbot. Shared **Case** ticket is Jev `state`.

**Settings** (`/settings`) is the BYOK paste place. Keys write to gitignored `.env.local` on the server. Optional later slots (saved, not called): OpenAI, Anthropic, Tavily, Brave.

**Weather is input, not a third model.** Open-Meteo, server-side, **Load weather** into the Case ticket.

**Tour:** first visit (no `localStorage["talk-to-jev:tutorial-done"]`) opens a custom coach overlay on Workshop. Chrome **Tour** restarts it. Skip / Done persist the flag. Code: `src/tutorial.ts` + `src/TutorialOverlay.tsx`.

## Pages

Workshop `/` · Use Cases `/use-cases` · Docs `/docs` (eyeball / code) · Settings `/settings` · History (Workshop drawer)

## How to start the tour

1. Open `http://127.0.0.1:5182`
2. First visit: overlay appears. Or chrome **Tour**.
3. To reset: clear `talk-to-jev:tutorial-done` in this origin’s localStorage, then refresh (or click **Tour**).

## Do next

- Keep `.env.local` gitignored. Never `VITE_` keys. Never commit secrets.
- Pin Jev 1.13 unless Nate asks for latest.
- Public GitHub only after SPEC §14 checklist.

SPEC: `docs/SPEC.md` (v0.4). README is the OSS 2-minute path.
