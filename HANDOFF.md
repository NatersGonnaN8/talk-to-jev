# Talk to Jev — handoff

**2026-09-19** — Weather + ten sample snaps live. Private GitHub https://github.com/NatersGonnaN8/talk-to-jev. Local `http://127.0.0.1:5182`.

## What it is

Two AIs, **one OpenRouter key**. LLM talks (`deepseek/deepseek-v4-flash`). Jev judges (`typesafe/jev-1.13` Decisions API). Shared **Case** ticket is Jev `state`.

**Weather is input, not a third model.** [Open-Meteo](https://open-meteo.com) (free, no key) is fetched server-side (`GET /api/weather`). **Load weather** writes current + a short forecast into the Case ticket. Default place: Columbus, OH (change the field to another city or `lat, lon`).

Ten snaps live in `src/samples.ts` (Workshop chips **and** Use Cases cards, same list):

1. Jacket?
2. Run go/no-go
3. Rain delay
4. Patio dinner
5. Water the garden
6. Bike vs bus
7. Grill tonight?
8. Storm prep
9. Harvest festival (fun / TypeSafe-games NPC)
10. Travel day

## How to try them

1. Open `http://127.0.0.1:5182` (Key ready pill).
2. Click a chip, or **Use Cases** → a card (`/use-cases`, `/cases` alias).
3. **Load weather** (default Columbus, OH). Jev state gets a marked Open-Meteo block.
4. **Ask Jev** — typed choice / noul / score, not prose.

Docs overlay (eyeball / code) is still on `/docs`. History is local-only.

## Do next

- Keep `.env.local` as the only key file. Never `VITE_OPENROUTER_API_KEY`.
- Refresh docs after TypeSafe ships notes: button or `npm run update-jev-docs`.
- Pin Jev 1.13 unless Nate asks for latest.

SPEC: `docs/SPEC.md` (v0.3).
