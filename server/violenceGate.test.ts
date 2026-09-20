import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VIOLENCE_GATE_CODE,
  VIOLENCE_GATE_MESSAGE,
  ticketFromJevState,
  workshopPayloadBlocked,
} from "./violenceGate.ts";

function choice(options: string[]) {
  const criteria: Record<string, string> = {};
  options.forEach((desc, i) => {
    criteria[String(i + 1)] = desc;
  });
  return {
    action: {
      type: "choice",
      instructions: "What should the operator do?",
      criteria,
    },
  };
}

test("refund ticket stays allowed", () => {
  const hit = workshopPayloadBlocked(
    "Stripe renewal. Policy R-3. Deny: abuse, more than 3 refunds/year.",
    {
      decision: {
        type: "choice",
        instructions: "What refund should Support issue?",
        criteria: {
          "1": "Full $247 refund",
          "2": "Partial unused months",
          "3": "Deny the refund",
        },
      },
      abuse_risk: {
        type: "score",
        instructions: "How likely is refund abuse?",
        criteria: ["Clean", "Watch", "Abuse"],
      },
    },
  );
  assert.equal(hit.blocked, false);
});

test("T&S kill-the-post ticket stays allowed", () => {
  const hit = workshopPayloadBlocked(
    "Trust & Safety. Unproven treatment claim. First strike = kill + 7-day feature ban.",
    {
      action: {
        type: "choice",
        instructions: "What should T&S do with this post?",
        criteria: {
          "1": "Leave it up as posted",
          "2": "Require an edit then re-review",
          "3": "Kill the post (and apply the strike policy)",
        },
      },
      harm: {
        type: "score",
        instructions: "How much harm if this stays up?",
        criteria: ["Low", "Medium", "Severe"],
      },
    },
  );
  assert.equal(hit.blocked, false);
});

test("ticket spam queue mentioning abuse stays allowed", () => {
  const hit = workshopPayloadBlocked("Checkout 500s. Duplicate invoice.", {
    queue: {
      type: "choice",
      instructions: "Which queue should own this ticket?",
      criteria: {
        "1": "Payments, invoices, duplicate charges",
        "2": "Junk, abuse, or not a real customer",
      },
    },
  });
  assert.equal(hit.blocked, false);
});

test("violence-policy classification label stays allowed", () => {
  const hit = workshopPayloadBlocked(
    "Route the comment to the threat / violence response queue.",
    choice(["None", "Spam", "Threat / violence response queue"]),
  );
  assert.equal(hit.blocked, false);
});

test("near-miss words do not trip the gate", () => {
  const hit = workshopPayloadBlocked(
    "Ask the therapist. Scrape pattern. Grape vendor. Enraptured review.",
    choice(["scrape / fraud pattern", "represent with evidence"]),
  );
  assert.equal(hit.blocked, false);
});

test("empty payload is allowed", () => {
  assert.equal(workshopPayloadBlocked("", {}).blocked, false);
  assert.equal(workshopPayloadBlocked().blocked, false);
});

test("blocked sexual-violence option (abstract)", () => {
  const hit = workshopPayloadBlocked("Operator ticket.", choice(["refuse", "rape"]));
  assert.equal(hit.blocked, true);
  if (!hit.blocked) return;
  assert.equal(hit.code, VIOLENCE_GATE_CODE);
  assert.equal(hit.message, VIOLENCE_GATE_MESSAGE);
});

test("blocked sexual-assault instructions (abstract)", () => {
  const hit = workshopPayloadBlocked("Operator ticket.", {
    action: {
      type: "choice",
      instructions: "Does this describe sexual assault?",
      criteria: { "1": "yes", "2": "no" },
    },
  });
  assert.equal(hit.blocked, true);
});

test("blocked sexual-exploitation-of-minors state (abstract)", () => {
  const hit = workshopPayloadBlocked(
    "Report of sexual exploitation of minors.",
    choice(["escalate", "close"]),
  );
  assert.equal(hit.blocked, true);
});

test("blocked csam token in a question id", () => {
  const hit = workshopPayloadBlocked("Ticket.", {
    csam_flag: {
      type: "noul",
      instructions: "Is the flag set?",
      criteria: { true: "yes", false: "no" },
    },
  });
  assert.equal(hit.blocked, true);
});

test("blocked snake_case option key after normalize", () => {
  const hit = workshopPayloadBlocked("Ticket.", {
    action: {
      type: "choice",
      instructions: "Pick one.",
      criteria: { refuse: "Do nothing", sexual_violence: "Blocked class" },
    },
  });
  assert.equal(hit.blocked, true);
});

test("blocked graphic-harm option (abstract)", () => {
  assert.equal(
    workshopPayloadBlocked("Ticket.", choice(["refuse", "murder"])).blocked,
    true,
  );
  assert.equal(
    workshopPayloadBlocked("Ticket.", choice(["refuse", "torture"])).blocked,
    true,
  );
});

test("transcript wrapper is not scanned", () => {
  const wrapped = {
    case: "Refund call. Deny for abuse risk only.",
    transcript: [{ role: "user", content: "testing rape as an option" }],
  };
  assert.equal(workshopPayloadBlocked(ticketFromJevState(wrapped), {}).blocked, false);
  assert.equal(workshopPayloadBlocked(wrapped, {}).blocked, true);
});
