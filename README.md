# Talk to Jev

Wire a cheap LLM to [TypeSafe Jev](https://jevai.dev/) with **one OpenRouter key**.

Jev is not a chatbot. It is a System One decision model: you send `state` plus typed questions (`choice` / `noul` / `score`) and get probabilities back. The LLM talks. Jev judges. This app is the wire.

Local: [http://127.0.0.1:5182](http://127.0.0.1:5182)

## Run

1. Put `OPENROUTER_API_KEY=` in `.env.local` (create the file if it is missing).
2. `npm install`
3. `npm run dev`
4. Open the Workshop. Optional: `JEV_MODEL` and `LLM_MODEL` in the same env file.

## Jev docs in this repo

Official pages are snapshotted under `docs/jev/`. Refresh them:

- In the app: **Update Jev docs**
- CLI: `npm run update-jev-docs`

Contract: `docs/SPEC.md`.
