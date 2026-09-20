---
source: https://jevai.dev/
fetched_at: 2026-09-20T10:35:52.063Z
---

# Source

https://jevai.dev/

Jev AI Model API Developer Guides & Community
Jev AI Dev◎EnglishEnglish简体中文繁體中文日本語한국어DeutschFrançaisEspañolPortuguêsPolskiDanskNederlandsNorskSvenskaРусскийBahasa IndonesiaไทยTürkçeTiếng ViệtSlovenščinaČeštinaSlovenčinaSuomi
Sign inUse cases

An independent guide and community for developers
Official Jev information: typesafe.ai

# Jev AI model.
From idea to code.
Jev is TypeSafe&#x27;s first System One model. It returns typed decisions and probabilities that software can use. Explore use cases and see how to call it from your code.

Try Jev For free Explore Projects

Choose by task

## A different shape of intelligence.
TypeSafe calls Jev a System One model: it returns typed choices and probabilities instead of generating open-ended text. Compare where that approach fits alongside generative models and rule-based code.

Aspect
Jev
Generative LLMs
Rules-based code

Output
Predefined typed choices, scores, and probabilities
Flexible text, code, or structured output
Deterministic values from explicit conditions

Speed
Optimized for low-latency decisions; TypeSafe reports 70–500 ms in its tests
Depends on model, prompt, and output length
Usually very fast for known conditions

Best fit
Repeatable decisions that require understanding the input
Writing, complex reasoning, and open-ended tasks
Clear conditions with stable definitions

Key limit
Cannot generate free-form text; a typed answer can still be wrong
Flexible outputs may need parsing and validation
Hard to cover every case when the input is ambiguous

iSpeed figures are reported by TypeSafe for particular structured-decision tests. They are not an independent benchmark or a universal speed guarantee. Read the methods

The practical distinctionUse Jev when the answers are known but the input still needs interpretation. Use a generative model to produce new text or code. Write explicit conditions directly in code.

The core idea

## Built for the decisions inside software.
Jev evaluates text or structured data against questions you define. It returns choices, scores, and probabilities your application can use to decide what happens next.

Jev in three stepsIllustrative example · not a live model response
01Customer message“I was charged twice for my subscription. Can you help?”

02Question & choicesWhich team should handle this?

Allowed answers: Billing · Technical · Sales

03Structured resultBillingJev
Example probability 0.92

Your code chooses what happens next

01
### Give it context
Provide the relevant text, JSON state, or a list of text items. Jev currently accepts text, not images, audio, or video.

02
### Define the answer space
Ask for a choice, a score, or a yes/no probability. The available answers are defined before the call.

03
### Let your code decide what comes next
Use the result and its uncertainty to route, review, or act. A valid type does not guarantee a correct judgment.

Based on official TypeSafe documentation

Where it fits

## Small decisions in real workflows.

Jev is designed for focused, repeatable decisions with a defined answer space. These are starting points, not performance promises; test them on your own data.

01↗

### Customer support
Classify complaints and merchant feedback, score urgency, and route each case to the right team. Send uncertain cases to a person.

Example decisionIs this a billing issue or a technical issue?
GitHubTypeSafe Jev Examples

02◎

### Recommendations & ranking
Filter a feed using a user&#x27;s stated preferences, then score candidate items for relevance alongside your own ranking signals.

Example decisionHow relevant is this item to this request?
GitHubJev Search

03⤳

### Agent orchestration
Route requests to a model, tool, or agent; decide when to search; and check whether a result is complete before continuing.

Example decisionShould this request go to a specialist model?
GitHubjev-router

04◇

### Trust & safety
Check messages, code changes, and tool calls against specific rules. Send high-risk or uncertain decisions for human review.

Example decisionDoes this message violate this policy?
GitHubjev-guard

05♟

### Games & simulations
Give Jev the current game state and a bounded list of legal moves to choose the next action for an AI opponent or NPC. Keep rule checks and execution in game code.

Example decisionWhich legal move should this opponent take next?
GitHubHEIST//ONE

06⌂

### Personal automations
Sort email and notifications by your own rules, assess smart-home state, or decide whether a daily routine should run.

Example decisionIs this notification worth interrupting me for now?
GitHubHA-Jev

Projects

Get started

## From curiosity to your first decision.
Start with a narrow judgment that your application already needs. Define the possible answers, then decide in code how to use them.

01
### Pick a decision
Choose one focused question, such as routing a ticket or scoring an item&#x27;s relevance.

02
### Define the choices
Define the input, questions, and allowed answers before calling the API.

03
### Handle uncertainty
Use probabilities and confidence to choose an action, fallback, or human review.

How to integrate

## Add Jev to your code.

This server-side TypeScript example sends a support message and two questions with defined answer formats to Jev 1.13 through OpenRouter. Keep the API key on your server; your application decides how to use the results.

Try Jev For free

Server-side TypeScripttypesafe/jev-1.13

```
`const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY");

const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "typesafe/jev-1.13",
    state: "My card was charged twice. Please help ASAP.",
    questions: {
      department: {
        type: "choice",
        instructions: "Which team should handle this?",
        criteria: {
          billing: "Payments and refunds",
          technical: "Bugs and integrations"
        }
      },
      urgent: {
        type: "noul",
        instructions: "Does this message need urgent attention?"
      }
    }
  })
});

if (!response.ok) throw new Error("Jev request failed: " + response.status);
const {answers} = await response.json();

if (answers.department.choice === "billing" && answers.urgent.noul > 0.8) {
  // Route to the billing review queue.
}`
```

Endpoint`POST /api/alpha/decisions`
Input`state + questions`
Output`answers`

### Read the answer
choice identifies the team. noul returns a value from 0 to 1 for the yes/no question. Your code uses both values with your own routing rules.

### Before using it in production
Before using this in production, test on representative tickets, record the model version, and send uncertain or high-impact cases for human review. The 0.8 value is only an example.

API references: OpenRouter  · TypeSafe

### What each field means
The request defines the questions and answer formats. The response returns a result for each one. Here are the JSON fields used in the example.

#### Request fields
`model`The model ID. This example pins Jev 1.13 so its version is explicit.
`state`The text or structured data to evaluate, such as a support message.
`questions`A map of named decisions. The same names appear under answers.
`type`The answer shape: choice selects an option; noul evaluates a yes/no question.
`instructions`The specific judgment you want the model to make.
`criteria`For choice, the allowed option keys and a short meaning for each.

#### Response fields
`answers`One result per question, returned under the same name.
`choice`The selected option key: the one with the highest probability.
`probabilities`The probability for every choice option; these values sum to 1.
`confidence`A separate confidence value calculated from the probability distribution; it is not the selected option’s probability.
`noul`A number from 0 (no) to 1 (yes) for a yes/no question.

A correctly shaped answer can still be wrong. Test representative cases and set routing thresholds for your own workflow.

Around the model

## What developers are saying.

Explore the main points from the launch discussion, official SDK, and an independent video. Read the context here, then follow the original sources for more detail.

𝕏

### X
TypeSafe shares launch updates and product context on X. Treat posts as the team’s own account of what Jev can do, and check the docs before building around a claim.

View original

### GitHub
The official JavaScript and TypeScript SDK shows the API surface, examples, and release activity. It is the most useful place to inspect how a Jev request is represented in code.

View original
Y

### Hacker News
The launch thread asks where a decision model fits, how to evaluate it, and what to do when a confident answer is wrong. It is a discussion, not a performance test.

View original

ThursdAI · TypeSafe AI

### Jev in practice: a conversation with TypeSafe
TypeSafe&#x27;s Allie Laabs joins ThursdAI to explain System One and Jev&#x27;s Choice, Score, and Noul outputs. The hosts test tweet classification, show a Doom demo, and discuss where Jev can fail.

View original
▶Play the TypeSafe interview

Watch on this page

### Jev explained: structured decisions and their limits
An independent walkthrough by RepoChad covers the output schema, TypeSafe’s speed claims, example demos, and open questions. The video loads only when you choose to play it.

View original
▶Play the Jev overview

Readpodcast AI

### Jev in podcasts, demos, and tests
Readpodcast AI groups a podcast on judgment models, an email-classification demo, and independent tests. Read the transcripts to see what each example shows and where its limits are.

Explore Jev transcripts

T↗
TypeSafe AI · 2026
The people behind Jev

## Make AI decisions easier to use in software.
TypeSafe AI introduced Jev as its first System One model. Its stated goal is to make fast, structured decisions usable inside ordinary software workflows.

Founder Diogo Almeida previously worked at OpenAI and Google Brain. In TypeSafe&#x27;s own account, his work on instruction-following and RLHF helped shape the research behind ChatGPT.

Readpodcast AI

### Diogo Almeida&#x27;s ideas over time
Readpodcast AI pairs recent talks on RLHF and reliable automation with an older interview and a 2017 deep-learning talk, giving his current argument more context.

Read the talks and interviews Meet the TypeSafe team Read the manifesto

Good questions

## Questions worth asking.

Is Jev a chatbot?+No. Jev is designed to return typed decisions and probabilities rather than free-form chat replies or generated code.

Can Jev power recommendations?+It can help score or rerank candidates by semantic relevance. A complete recommendation system still needs candidate retrieval, business rules, evaluation, and your own ranking logic.

Does a typed output mean the decision is correct?+No. Typed output constrains the format. The selected option can still be wrong, so test with representative data and handle uncertainty in code.

Where can I learn how to use Jev?+Start with the official TypeSafe docs and SDK. The OpenRouter model page also provides a route to access Jev through its platform.

Start with one question

## Try Jev on a concrete decision.
Define the question and possible answers. Let your application decide what to do with the result.

Try Jev For free Read the official quickstart

Jev AI Dev
## Follow what developers build with Jev.
Get occasional community picks: trending GitHub projects, useful code examples, and practical Jev use cases.

✉ SubscribeBy subscribing, you agree to receive occasional emails from Jev AI Dev.

Jev AI DevAn independent developer guide to the Jev AI model, its use cases, and API integration.

© 2026 Jev AI Dev
