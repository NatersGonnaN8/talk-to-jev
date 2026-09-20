import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasDsml,
  mergeDsmlCalls,
  parseDsml,
  stripDsml,
} from "./dsml.ts";

const SCREENSHOT = `< | DSML | tool_calls>
< | DSML | invoke name="ask_jev">
</ | DSML | invoke>
</ | DSML | tool_calls>`;

const COMPACT = `<|DSML|tool_calls>
<|DSML|invoke name="ask_jev">
</|DSML|invoke>
</|DSML|tool_calls>`;

const FULLWIDTH = `<｜DSML｜tool_calls>
<｜DSML｜invoke name="ask_jev">
</｜DSML｜invoke>
</｜DSML｜tool_calls>`;

test("screenshot fence strips to empty and honors ask_jev", () => {
  const parsed = parseDsml(SCREENSHOT);
  assert.equal(stripDsml(SCREENSHOT), "");
  assert.equal(parsed.stripped, true);
  assert.deepEqual(parsed.invokes, ["ask_jev"]);
  assert.equal(parsed.calls.length, 1);
  assert.equal(parsed.calls[0]?.name, "ask_jev");
  assert.equal(parsed.calls[0]?.arguments, "{}");
});

test("prose plus screenshot fence stays prose-only", () => {
  const raw = `Alright, let me add a secret weapon — a **Noul**\n\n${SCREENSHOT}`;
  assert.equal(
    stripDsml(raw),
    "Alright, let me add a secret weapon — a **Noul**",
  );
  const parsed = parseDsml(raw);
  assert.equal(parsed.calls[0]?.name, "ask_jev");
});

test("compact <|DSML|> fence strips the same", () => {
  assert.equal(stripDsml(COMPACT), "");
  assert.equal(parseDsml(COMPACT).calls[0]?.name, "ask_jev");
});

test("fullwidth pipe DSML fence strips the same", () => {
  assert.equal(stripDsml(FULLWIDTH), "");
  assert.equal(parseDsml(FULLWIDTH).calls[0]?.name, "ask_jev");
});

test("does not swallow ordinary less-than prose", () => {
  const raw = "Keep going if temp < 10 and the <div> stays.";
  assert.equal(stripDsml(raw), raw);
  assert.equal(hasDsml(raw), false);
  assert.equal(parseDsml(raw).calls.length, 0);
});

test("incomplete fence at the end is hidden junk", () => {
  const raw = "Hello\n< | DSML | tool_calls>\n< | DSML | invoke name=\"ask_jev\">";
  assert.equal(stripDsml(raw), "Hello");
  assert.equal(parseDsml(raw).calls[0]?.name, "ask_jev");
});

test("set_jev_state parameter becomes mill args and leaves the pane", () => {
  const raw = `<|DSML|invoke name="set_jev_state">
<|DSML|parameter name="state">Ticket text</|DSML|parameter>
</|DSML|invoke>
Done.`;
  const parsed = parseDsml(raw);
  assert.equal(stripDsml(raw), "Done.");
  assert.equal(parsed.calls[0]?.name, "set_jev_state");
  assert.equal(JSON.parse(parsed.calls[0]?.arguments ?? "{}").state, "Ticket text");
});

test("read_jev_state invoke is honored as a mill tool", () => {
  const raw = `<|DSML|invoke name="read_jev_state"></|DSML|invoke>Hi`;
  const parsed = parseDsml(raw);
  assert.equal(stripDsml(raw), "Hi");
  assert.equal(parsed.calls[0]?.name, "read_jev_state");
  assert.equal(parsed.calls[0]?.arguments, "{}");
});

test("read_jev_questions invoke is honored as a mill tool", () => {
  const raw = `<|DSML|invoke name="read_jev_questions"></|DSML|invoke>Hi`;
  const parsed = parseDsml(raw);
  assert.equal(stripDsml(raw), "Hi");
  assert.equal(parsed.calls[0]?.name, "read_jev_questions");
  assert.equal(parsed.calls[0]?.arguments, "{}");
});

test("unknown invoke is stripped and not honored as a mill tool", () => {
  const raw = `<|DSML|invoke name="launch_missiles"></|DSML|invoke>Hi`;
  const parsed = parseDsml(raw);
  assert.equal(stripDsml(raw), "Hi");
  assert.deepEqual(parsed.invokes, ["launch_missiles"]);
  assert.equal(parsed.calls.length, 0);
});

test("merge skips DSML when OpenRouter already ran that tool", () => {
  const extra = mergeDsmlCalls(
    [{ function: { name: "ask_jev" } }],
    [{ name: "ask_jev", arguments: "{}" }],
  );
  assert.deepEqual(extra, []);
});

test("merge honors DSML ask_jev when tool_calls were empty", () => {
  const extra = mergeDsmlCalls([], [{ name: "ask_jev", arguments: "{}" }]);
  assert.equal(extra[0]?.name, "ask_jev");
});

test("tag flood does not infinite-loop", () => {
  const flood = Array.from({ length: 80 }, () => "<|DSML|invoke name=\"ask_jev\">").join("");
  const parsed = parseDsml(flood);
  assert.equal(typeof parsed.text, "string");
  assert.ok(parsed.stripped);
});
