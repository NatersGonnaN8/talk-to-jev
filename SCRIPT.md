# Talk to Jev — spoken script

**Author:** Nathan Uttley  
**GitHub:** [NatersGonnaN8](https://github.com/NatersGonnaN8) · repo [`talk-to-jev`](https://github.com/NatersGonnaN8/talk-to-jev)  
**Length target:** ~8 minutes (~1,050–1,150 words at ~140 wpm)  
**Copyright (c) 2026 Nathan Uttley**

Spoken first person. Stage directions in brackets only when something should be on screen.

---

## Script

**[0:00]**  
Hey — I’m Nathan Uttley. I go by Nater online. GitHub is NatersGonnaN8.

Jev just dropped. TypeSafe’s System One model. Everyone’s posting demos and takes, and the hype is still warm. I built this over a weekend so you can get a glance — not the last word, not the definitive mill. Just inspiration. Feet wet. Then you go build your own.

**[0:45]**  
The app is called Talk to Jev. It’s a local workshop on your laptop. Two different AIs, one OpenRouter key. Bring your own key — paste it in Settings, it lands in gitignored `.env.local` on the server. The browser never sees the raw key. Cheap production, not a wrapper tax on somebody else’s model.

**[1:15]**  
First, what Jev actually is — because the name makes people think chatbot.

Jev is not an LLM. It’s TypeSafe’s first System One model. Named after Jevons. You send it a `state` — the situation you want judged — plus typed questions. It does not write poems or code. It returns typed answers with probabilities over the options you listed.

Three primitives. **Choice:** pick among listed options — probability mass over those options only. **Noul:** true or false — you get P(true) between zero and one. **Score:** an ordered legend — how urgent, how risky, how frustrated — levels you define.

That’s System One: fast, structured decisions software can use directly. The LLM half still talks. Jev snaps.

**[2:15]**  
Why that’s cool, with numbers I can actually stand behind.

On OpenRouter, as of September twenty-first, twenty twenty-six, `typesafe/jev-1.13` is listed at about four point two cents per million input tokens, and output is free. TypeSafe’s own model card in the docs snapshot says the same ballpark — charged on input, output free. Released September eighteenth, twenty twenty-six. TypeSafe also documents a sixty-four-k token request budget, with thirty-two-k for the state plus the longest question. OpenRouter’s card shows a thirty-two-k context figure — I’m not going to paper over that difference; check the doc you care about when you ship.

In this repo’s README I measured a Refund-call preset, two turns: one Jev call, seventeen hundred twenty-five input tokens, seven hundredths of a mill — that’s dollars, not cents. Fractions of a cent for a real decision snap. That’s the point. AI should not be expensive to get real production.

**[3:15]**  
[Show Workshop — Jev’s State ticket on top, LLM left, Jev’s Questions right]

Okay — walk the app.

Top is **Jev’s State** — the cream ticket. That’s what Jev judges. Markdown paints there — bold, lists, the works — so you’re not staring at raw asterisks. Click in and edit in place. Drop a `.md` onto the ticket and it goes in. Other formats? Convert tab — that stays on this machine. No cloud converter, no upload farm.

Under the ticket: two panes. Left — manila LLM. Right — blueprint **Jev’s Questions**.

One OpenRouter key runs both. Jev is pinned to `typesafe/jev-1.13`. No Jev model picker in the composer — Jev is the star and stays put. The LLM default is `deepseek/deepseek-v4-flash`. The model picker sits **left of Send**. Swap floor models without opening env files.

**[4:15]**  
[Point at LLM tool cards / composer]

The LLM doesn’t invent Jev’s answers. It has tools. `read_jev_workshop` reads the current state plus questions — call that before you write both sides. Or query one side: `read_jev_state`, `read_jev_questions`. Then `set_jev_state`, `set_jev_questions`, and `ask_jev`. Read before write. That’s intentional — the LLM should see what’s already on the mill before it overwrites anything. Tool cards show up in the thread — short confirmations, not a JSON dump as the product.

On the Jev side: **Ask Jev**. That hits the Decisions API — not chat completions. You get probability bars, confidence, score chrome numbered one, two, three like a human counts. Choice options are numbered one, two, three on the card — those numbers are the keys sent to Jev. The descriptions are human prose — “full refund,” “store credit” — spaces stay spaces. Not snake_case poems. When you’ve got answers, **Send answers to LLM** sits left of Ask Jev and pipes the typed summary straight into the thread.

**[5:15]**  
[Open Preset States or Example Uses]

**Preset States** on the ticket row, or **Example Uses** in the nav — same ten snaps. Nine are operator or business tickets. Weather is one use case — Jacket pulls free Open-Meteo into the state. Not the whole product.

**History** is browser-only. This machine, this origin, localStorage. Not a server inbox. Refresh keeps it. Keys never belong there. Convert is its own tab — txt, html, docx, pdf text layer to markdown, all local. Add that markdown to Jev’s State or the LLM when you’re ready.

There’s also Random state — invent a short scenario once and stop — and Agentic loop if you want N turns of LLM talking to Jev on whatever’s already on the panes. Fun for practice. Still not deep serious work.

One hard line: Jev has no conscience — it will score whatever options you list. So the mill holds a violence gate and refuses to hand Jev graphic violent options. That’s it. Refund and abuse-risk tickets still work.

**[6:15]**  
So what’s the practice?

Clone it. Paste your OpenRouter key. Load a Preset State. Hit Ask Jev. Watch the bars. Talk to the cheap LLM — let it propose questions, let it read the pane first, then send answers back. Feel the loop: prose model drafts, System One decides. Toggle Inspector if you want to see the exact Decisions payload and the cost line when OpenRouter returns it.

This is feet wet. A weekend glance at how Jev works. Inspiration for your own apps. Labeled prototype on purpose. People will play this at higher levels — I don’t claim this mill beats them. Go build yours. Wire state and questions into your own code. Own the workflow. Don’t rent a hype wrapper at ten times the model.

**[7:30]**  
Repo is public: github.com/NatersGonnaN8/talk-to-jev. MIT. I’m Nathan Uttley. Bring your own key. Keys in `.env.local`. Run local on loopback — one twenty-seven dot zero dot zero dot one, port fifty-one eighty-two. Docs page has the official Jev snapshot if you want to read TypeSafe without leaving the app.

That’s Talk to Jev — a weekend workshop so you can see System One next to an LLM, pay what the models cost, and get inspired enough to ship something of your own.

Thanks for watching. Go get your feet wet.

**[≈8:15]**

---

## Delivery notes

| Beat | Timecode | Focus |
|---|---|---|
| Hook | 0:00 | Jev drop / glance not last word |
| What Jev is | 0:45–2:15 | System One; choice / noul / score |
| Verified figures | 2:15 | OpenRouter $0.042/M in, $0 out (2026-09-21); TypeSafe 64k / 32k; README $0.00007 sample |
| Walk the app | 3:15–6:15 | Panes, key, picker, tools, Ask Jev, presets, paint, convert, history |
| Practice + close | 6:15–8:15 | Feet wet → build your own; repo; BYOK |

**Sources used (do not invent beyond these):** `docs/SPEC.md`, `README.md`, `docs/jev/typesafe/concepts/system-one.md`, `docs/jev/typesafe/models.md`, `docs/jev/openrouter/jev-1.13.md`, OpenRouter `typesafe/jev-1.13` listing checked 2026-09-21.
