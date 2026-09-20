# Talk to Jev — handoff

**2026-09-19** — BYOK Settings live. GitHub is **public** (https://github.com/NatersGonnaN8/talk-to-jev). Local `http://127.0.0.1:5182`. Use Cases: `http://127.0.0.1:5182/use-cases`. Settings: `http://127.0.0.1:5182/settings`.

## What it is

Two AIs through **OpenRouter**. LLM talks (`deepseek/deepseek-v4-flash`). Jev judges (`typesafe/jev-1.13` Decisions API). Shared **Case** ticket is Jev `state`. Ten snaps: **nine operator decisions** plus **Jacket** (Open-Meteo, the one weather case). Workshop lands on **Invoice exception**.

## Keys (BYOK)

Paste in **Settings** — not a template file. Keys write to gitignored `.env.local` on the **server**. Browser never stores raw keys in localStorage.

| Env | Today |
|---|---|
| `OPENROUTER_API_KEY` | Required for LLM + Jev |
| `OPENAI_API_KEY` | Saved only |
| `ANTHROPIC_API_KEY` | Saved only |
| `TAVILY_API_KEY` | Saved only |
| `BRAVE_API_KEY` | Saved only |

Contributors: empty slots in `env.local.template`. Never commit `.env.local`. Never `VITE_` prefixes.

`GET /api/health` → booleans only (`hasKey`, `keys.*`). `GET /api/settings` → present + last-4, never the full key.

## How to try

1. Open `http://127.0.0.1:5182/settings`. OpenRouter should show **Key ready** (not the secret).
2. Workshop lands on **Invoice exception**. **Preset Cases** holds the operator snaps; **Jacket** is the weather case (**Load weather** → **Ask Jev**). **New Case** resets the workshop. **History** is on that row.
3. Docs overlay still on `/docs`. History is local-only (Jev’s case row). Tour is chrome **Tour**. Copy: `docs/TOUR.md` (live import: `src/tutorial.ts`).

## How to start the tour

- First visit (no `talk-to-jev:tutorial-done`): overlay opens on Workshop.
- Anytime: chrome **Tour**.
- Reset: clear that localStorage key, refresh. Skip / Done writes `"1"` so refresh does not nag.

## GitHub safety (2026-09-19)

- `.env` / `.env.local` are gitignored and **not tracked**. Not on GitHub.
- History has env **names** in docs/code, not key **values** (`sk-or-v1-` count 0).
- Repo flipped **public** after the §14 checklist: gitignore, history scan, health/settings JSON, README, and client bundle.

## Do next

- Keep `.env.local` gitignored. Rotate the OpenRouter key if it ever leaked outside this machine.
- Search / direct OpenAI / Anthropic / Tavily / Brave are **not** wired yet — Settings is the home.
- Pin Jev 1.13 unless Nate asks for latest.

SPEC: `docs/SPEC.md` (v0.10) §6.1 case tools, §12, §14.
