# Talk to Jev

Wire a cheap LLM to [TypeSafe Jev](https://jevai.dev/) with **one OpenRouter key**.

**Jev is not a chatbot.** It is TypeSafe’s first **System One** model: you send `state` plus typed questions (`choice` / `noul` / `score`) and get **probabilities** back. The LLM talks, drafts, and proposes questions. Jev judges. This app is the wire between them.

Local: [http://127.0.0.1:5182](http://127.0.0.1:5182)  
Repo: [talk-to-jev](https://github.com/NatersGonnaN8/talk-to-jev)

---

## Two minutes

1. Clone this repo. `npm install`.
2. `npm run dev` — Vite UI + API on **port 5182** (`127.0.0.1` only).
3. Open the app. Paste your [OpenRouter](https://openrouter.ai/) key in **Settings**. That writes gitignored `.env.local` on the server. The browser never sees the key.
4. Workshop: **Jev’s case** is Jev **state**. Manila pane = LLM. Blueprint pane = **Ask Jev**. Drop `.md` into Jev’s case; txt / html / docx / pdf open the **Convert** tab (PDF text layer stays in the browser).

Optional: create `.env.local` yourself with `OPENROUTER_API_KEY=` (same file Settings writes). Do not put the key in git, in the browser, or in a Vite `VITE_` variable.

A first-run **Tour** overlay walks the Workshop. Skip once and it stays dismissed. Chrome **Tour** starts it again.

---

## One key, two AIs

| Side | Default model | OpenRouter route | Job |
|---|---|---|---|
| **LLM** | `deepseek/deepseek-v4-flash` | `POST /api/v1/chat/completions` | Talk. Draft. Propose Jev questions. |
| **Jev** | `typesafe/jev-1.13` | `POST /api/alpha/decisions` | Typed snap decisions. Never prose. |

That **one OpenRouter key** runs both. Settings can also store OpenAI, Anthropic, Tavily, and Brave for later — they are **not called** in this MVP.

Weather is **Open-Meteo** input (free, no key) on the **Jacket** preset only — not a third model. Nine of the ten snaps are operator / business decisions.

---

## Pages

| Page | Path | What it is |
|---|---|---|
| **Workshop** | `/` | **Jev’s case** + LLM pane + **Jev’s Questions**. First-open is an **empty** Workshop. **New Case** starts another empty Workshop (does **not** load Invoice). **Preset Cases** (9 business + Jacket), **History** on that row. **Load weather** on Jacket only. **Ask Jev**, **Propose Jev questions** (tools fill the q-cards), **Feed Jev to LLM**. Drop `.md` into Jev’s case; other files open the **Convert** tab. |
| **Use Cases** | `/use-cases` (`/cases`) | Same ten snaps as Workshop **Preset Cases**: nine operator cases plus Jacket. |
| **Docs** | `/docs` | In-repo Jev snapshot. Eyeball = nice Markdown; code icon = raw source. |
| **Settings** | `/settings` | BYOK. Paste keys; they stay in `.env.local` on this machine. |
| **Convert** | `/convert` | Convert txt / html / docx / pdf to markdown in this browser. Add to the LLM, add to Jev’s case, download, or save as MD. |
| **History** | Jev’s case row | Local threads in `localStorage` (this browser only). Not a server. Not in the header. |

Chrome **Tour** restarts the coach overlay. **Update Jev docs** refreshes `docs/jev/`. History is on **Jev’s case**, not next to Tour.

---

## Run

```bash
npm install
npm run dev
```

Then [http://127.0.0.1:5182](http://127.0.0.1:5182).

`.env.local` (gitignored):

```
OPENROUTER_API_KEY=
JEV_MODEL=typesafe/jev-1.13
LLM_MODEL=deepseek/deepseek-v4-flash
```

Prefer **Settings** in the UI to paste the OpenRouter key. Optional later slots: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`.

Refresh the official Jev docs snapshot:

- In the app: **Update Jev docs**
- CLI: `npm run update-jev-docs`

Contract: [`docs/SPEC.md`](docs/SPEC.md).

---

## Security

- Keys never go in git. `.env.local` is gitignored.
- Keys never go to the browser (not HTML, not JS bundles, not `localStorage`, not `/api/health` JSON).
- History is local (`talk-to-jev:chats`). It must not contain secrets.
- The Tour flag is `talk-to-jev:tutorial-done` — also not a place for keys.
- Bind is `127.0.0.1` only. No wide-open CORS.

---

## License

MIT. Copyright Nathan Uttley, 2026. See [LICENSE](LICENSE). The [`docs/jev`](docs/jev/README.md) snapshot is third-party copyright, not MIT.
