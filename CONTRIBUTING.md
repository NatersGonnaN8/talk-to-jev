# Contributing

## Contract first

[`docs/SPEC.md`](docs/SPEC.md) is the product contract. Read it before changing behavior. Code trails written decisions — if a change does not line up with the SPEC, update the SPEC in the same change set.

## Dev

- Node + npm. `npm install`, then `npm run dev`.
- App and API: [http://127.0.0.1:5182](http://127.0.0.1:5182). Port **5182**, bind **loopback only** (`127.0.0.1`, `strictPort`). Do not `--host` / `0.0.0.0`.
- Keys: paste in **Settings**, or copy `env.local.template` → `.env.local` with empty-or-your values. Never commit `.env.local`. Never prefix keys with `VITE_`. Never put secrets in issues, PRs, logs, `localStorage`, or the client bundle.
- Typecheck + production build: `npm run build`.

## Before a PR

1. `npm run build` is green.
2. No secrets, no `.env.local`, no user files.
3. Behavior matches [`docs/SPEC.md`](docs/SPEC.md).
