import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseJevQuestions,
} from "./questions.ts";

test("parses the array shape advertised to chat models", () => {
  const parsed = parseJevQuestions([
    {
      id: "next_action",
      type: "choice",
      instructions: "What should happen next?",
      criteria: ["Hold", "Proceed"],
    },
    {
      id: "risk",
      type: "score",
      instructions: "How risky is this?",
      criteria: ["Low", "High"],
    },
  ]);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(Object.keys(parsed.questions), ["next_action", "risk"]);
  assert.deepEqual(parsed.questions.next_action, {
    type: "choice",
    instructions: "What should happen next?",
    criteria: { "1": "Hold", "2": "Proceed" },
  });
});

test("rejects aliases instead of silently repairing a bad tool call", () => {
  const parsed = parseJevQuestions([
    {
      name: "route",
      prompt: "Where should this go?",
      options: [{ label: "Support" }, { label: "Engineering" }],
    },
  ]);
  assert.equal(parsed.ok, false);
});
