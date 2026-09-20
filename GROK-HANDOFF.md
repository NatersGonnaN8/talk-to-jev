# Grok handoff — Talk to Jev open-source follow-ups

**Paste this into the other session:**

> Read `GROK-HANDOFF.md` at the repo root of `C:\Users\uttle\Projects\Talk to Jev`, then `docs/SPEC.md`. Work the numbered items in order. Commit after each one (conventional commits, why-focused). Do not touch `vite.config.ts` CSRF code — that is done and verified. Slow models only (Grok 4.6 extra high, Fast off). Nater does not run commands; you do.

---

**Written:** 2026-09-19 by Effy (Claude session), after an open-source security review.
**Repo:** public — https://github.com/NatersGonnaN8/talk-to-jev
**Local:** `npm run dev` → `http://127.0.0.1:5182` (already running in a Cursor terminal; do not start a second one — port 5182 is `strictPort`).
**Contract:** `docs/SPEC.md` (v0.10). SPEC first, then code.

## Already done (do not redo)

- Full git-history secret scan: clean. No `.env*` ever tracked. `npm audit`: 0.
- **CSRF gate** in `vite.config.ts` — commit `dbe5102`. Every `/api/*` request is 403 when `Origin` ≠ `http(s)://<Host>` or `Sec-Fetch-Site` is cross-site; POST bodies must be `application/json` (415). SPEC §7 has the contract. Verified live with 9 probe shapes plus a real same-origin POST from the page.
- SPEC §14 copyright spelling fixed to **Nathan Uttley** (LICENSE and README already had it right).

## Uncommitted work on disk — item 0, do this first

The **New Case / Preset Cases / History** row is already committed and pushed (`63e5029`, `3dabc98`). What remains dirty:

- `docs/jev/**` — 120 files with a refreshed `fetched_at` (snapshot re-run 22:40Z; content mostly identical)

Steps:

1. Run `npm run build` (typechecks both tsconfigs + Vite build). Fix anything red.
2. Quick browser sanity on Workshop `http://127.0.0.1:5182/`: **New Case**, **Preset Cases**, **History** on the case row; chrome-right is only **Tour** / **Update Jev docs**. SPEC §13 items 47–48.
3. Commit the snapshot: `chore: refresh Jev docs snapshot` (docs/jev only).

## Items to do (in order)

### 1. `X-Title` header (bug, not security)

`vite.config.ts` → `orHeaders()` sends `X-OpenRouter-Title`. OpenRouter's documented header is **`X-Title`**. Rename it. Update SPEC §3 "Referer headers" to say `X-Title`. Commit `fix: send X-Title so OpenRouter dashboard shows the app name`.

### 2. Third-party docs copyright note

`docs/jev/` redistributes ~117 pages of TypeSafe / OpenRouter / Cloudflare / Pydantic docs inside an MIT repo. MIT covers Nater's code, not their prose. Add to `docs/jev/README.md`:

> These pages are © their respective owners (TypeSafe, OpenRouter, Cloudflare, Pydantic) and are mirrored here unmodified for offline reference by this app. They are **not** covered by this repo's MIT license. Source URL and fetch time are in each file's header; refresh with **Update Jev docs**.

Add one sentence to the root `README.md` License section pointing at that note. Commit `docs: state that docs/jev snapshot is third-party copyright, not MIT`.

### 3. Personal info in the public repo (Nater's call — ask, then do)

- `docs/SPEC.md` line 5: `**Folder:** C:\Users\uttle\Projects\Talk to Jev` — exposes the Windows username. Suggest replacing with a relative note or deleting the line.
- Default weather location `Columbus, OH` (`server/weather.ts`, `src/weather.ts`, SPEC §6.1 / §11) reveals his city. Suggest a neutral default (e.g. `Chicago, IL`) **only if Nater says yes** — it is a product decision; update SPEC §11 first if changed.

### 4. Harden the docs Markdown sanitizer (low)

`src/markdown.ts` `sanitize()` is hand-rolled: strips `script/iframe/object/embed/link/meta`, `on*`, and `javascript:` URLs, but not `<style>`, `<form>`, `<svg>`, `<base>`, `<template>`, `srcdoc`, or `data:` URLs. Only renders the docs snapshot, so risk is low — but a poisoned upstream page or a malicious PR to `docs/jev/` would XSS on the app origin and could then call `/api/settings` same-origin (the CSRF gate does not stop same-origin). Swap to **DOMPurify** (`npm i dompurify`, `@types/dompurify` if needed), `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`. Keep `marked`. Commit `fix: sanitize rendered docs with DOMPurify`.

### 5. Body size cap (low)

`vite.config.ts` `readBody()` has no limit. Cap at **2 MiB** (`/api/llm` bodies with a 64k-token case are well under that); reject with the existing `HttpError(413, "Body too large.")`. Add `413` to the SPEC §7 error list. Commit `fix: cap /api request bodies at 2 MiB`.

### 6. Open-source hygiene (optional, cheap)

- `SECURITY.md` at root: "Report privately via GitHub Security Advisories. Local dev server only; keys never leave the machine. See SPEC §7 / §14."
- `CONTRIBUTING.md`: SPEC-first, copy `env.local.template` → `.env.local` or use Settings, `npm run build` before PR.
- No CI yet. A single GitHub Actions job running `npm ci && npm run build` on PRs is enough. Private-by-default rules do not apply — repo is already public by Nater's choice.

### 7. Final verification

- `npm run build` green.
- Re-run the CSRF probes (PowerShell 5 — no `??` operator): cross-site `text/plain` POST to `/api/settings` with `Origin: https://evil.example` must be **403**; same-origin JSON POST must be **200**; plain `GET /api/health` with no headers must be **200**.
- SPEC §13 items 1, 13, 29–33, 47–48 in the browser.
- Update `HANDOFF.md` "GitHub safety" section to mention the CSRF gate, then push (`git push origin main`) — Nater wants this repo public and current.

## Do not

- Relax the CSRF gate or add `Access-Control-Allow-Origin`.
- Put keys anywhere but gitignored `.env.local` via Settings. Never open `.env.example`-style files for Nater to paste into.
- Show the ten presets as a chip row again (SPEC §6.1).
- Native `resize`, `<dialog>`, iframes, translucent tooltips (workspace rules).
- Commit `.env.local`, user files, or the untracked probe scripts if any appear.
