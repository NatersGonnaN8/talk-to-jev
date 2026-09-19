# Talk to Jev — handoff

**2026-09-19** — MVP live. Private GitHub https://github.com/NatersGonnaN8/talk-to-jev. Local `http://127.0.0.1:5182`.

## What it is

Two AIs, one OpenRouter key. LLM (`deepseek/deepseek-v4-flash` chat completions) talks. Jev (`typesafe/jev-1.13` Decisions API) judges. Shared **Case** ticket is Jev `state`. Docs snapshot in `docs/jev/` with **Update Jev docs**.

## Do next

- Keep `.env.local` as the only key file.
- Refresh docs after TypeSafe ships notes: button or `npm run update-jev-docs`.
- Pin Jev 1.13 unless Nate asks for latest.

SPEC: `docs/SPEC.md`.
