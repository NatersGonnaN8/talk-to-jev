# Talk to Jev — handoff

**2026-09-20** — Public on GitHub (https://github.com/NatersGonnaN8/talk-to-jev). Local `http://127.0.0.1:5182`. Contract: `docs/SPEC.md` (read it first — it is the source of truth; this file is the short orientation).

## What it is

Two AIs through **one OpenRouter key**. LLM talks (`deepseek/deepseek-v4-flash`, chat/completions with tools). Jev judges (`typesafe/jev-1.13`, Decisions API — not an LLM). **Jev’s State** is Jev `state`; **Jev’s Questions** is the typed `questions` map. The LLM mutates both through tools and calls `ask_jev`; Jev returns probabilities; the answers round-trip into the next LLM turn. README and SPEC §5 have the shape.

## Pages

Workshop `/` · Example Uses `/use-cases` · Docs `/docs` · Settings `/settings` · Convert `/convert`. History lives on the Jev’s State row (localStorage only). Inspector is on the LLM pane-head (off by default; logs every `/api/llm` and `/api/jev` payload, never keys).

## Keys (BYOK)

Paste in **Settings**. Keys write to gitignored `.env.local` on the server. Browser never sees a raw key. `GET /api/health` → booleans. `GET /api/settings` → present + last-4. Never `VITE_` prefixes. Never open a template file for Nater to paste into — `.env.local` or Settings.

| Env | Today |
|---|---|
| `OPENROUTER_API_KEY` | Required for LLM + Jev |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `TAVILY_API_KEY` / `BRAVE_API_KEY` | Saved only, not called |

## Security posture (verified live 2026-09-20)

- CSRF gate on every `/api/*`: foreign `Origin` or cross-site `Sec-Fetch-Site` → **403**. Non-JSON POST → **415**. Body over 2 MiB → **413**. Foreign `Host` → **403** (Vite `allowedHosts`). Docs path traversal → **404**. Same-origin JSON POST → **200**; header-less GET (curl) → **200**.
- Bind `127.0.0.1`, `strictPort 5182`, `cors: false`. Rendered docs pass through DOMPurify.
- History scan: no key-shaped strings outside base64 blobs in mirrored docs; no `.env*` ever tracked. `npm audit` 0. Bundle has no key material.
- Threat model and reporting: `SECURITY.md`. Full gate: SPEC §7, §14.

Re-run those probes before any future security claim. Do not relax the gate or add `Access-Control-Allow-Origin`.

## Working here

- SPEC first. If Nater says something the SPEC does not, update SPEC in the same change set.
- `npm run build` (typechecks both tsconfigs + Vite build) must be green before a commit that touches code. CI runs the same on push/PR.
- `npm run dev` is usually already running in a Cursor terminal on 5182 (`strictPort`) — check before starting another.
- Conventional commits, why-focused. Stage only your files; other agent sessions may have `docs/SPEC.md` dirty at the same time.
- Refresh the third-party docs snapshot with **Update Jev docs** on the **Docs** page (not the header) or `npm run update-jev-docs`; commit as `chore:`. `docs/jev/` is not MIT — see `docs/jev/README.md`.
- Pin Jev 1.13 unless Nater asks for latest. Slow models only for subagents (Grok 4.6 extra high, Fast off).

## Open decisions (Nater’s call)

- `docs/SPEC.md` line 5 shows the Windows folder path (`C:\Users\uttle\…`).
- Default weather location is `Columbus, OH` (`server/weather.ts`, `src/weather.ts`, SPEC §6.1 / §11 / §13).

## Not wired yet

Search, direct OpenAI / Anthropic. Settings stores the keys; nothing calls them.
