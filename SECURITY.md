# Security Policy

Talk to Jev is a **local** workshop. The Vite UI and API bind `127.0.0.1:5182` only. Bring-your-own keys live in gitignored `.env.local` on the operator's machine. They never go to the browser, this GitHub repo, or a hosted backend.

## Reporting a vulnerability

Report privately via [GitHub Security Advisories](https://github.com/NatersGonnaN8/talk-to-jev/security/advisories/new). Do **not** open a public issue for a security finding.

**Never paste API keys** (OpenRouter, OpenAI, Anthropic, Tavily, Brave, or any other secret) into issues, pull requests, screenshots, logs, or advisories. If a key may have leaked, rotate it at the provider and save the new value in **Settings** (or `.env.local`). `env.local.template` is empty slots only.

## Threat model (local CSRF / BYOK)

The attacker is **a web page in the operator's own browser**, not a remote host. `127.0.0.1` is unreachable from the internet; a tab is not. A malicious page can POST to `http://127.0.0.1:5182/api/settings` or `/api/llm` and swap the OpenRouter key or burn credits even though CORS is off — `cors: false` only blocks *reading* responses, not *sending*. The local server therefore refuses cross-site `/api/*` requests (**403**) and non-JSON POST bodies (**415**). Same-origin UI and tools with neither `Origin` nor `Sec-Fetch-Site` (curl, address bar) still work. See [`docs/SPEC.md`](docs/SPEC.md) §7 (API / CSRF gate) and §14 (open-source gate).

## Hosted copy

A hosted copy may run at `https://jev.effortlessinnovations.com`, only behind the site's single login (Authelia, admin group, two-factor). It runs read-only for keys (`JEV_READONLY_KEYS=1`): the OpenRouter key lives in a root-only env file on the server, is never in the image or the bundle, and the Settings page cannot change it. The same CSRF, JSON-only, size and host gates apply. The container publishes no port; only Traefik reaches it. See `docs/SPEC.md` §7.
