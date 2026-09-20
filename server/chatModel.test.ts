import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LLM } from "./openrouter.ts";
import {
  isJevModelId,
  normalizeChatModel,
  resolveChatModel,
} from "./chatModel.ts";

test("default LLM is the cheap DeepSeek Flash pin", () => {
  assert.equal(DEFAULT_LLM, "deepseek/deepseek-v4-flash");
});

test("rejects Jev ids so chat completions never get the Decisions pin", () => {
  assert.equal(isJevModelId("typesafe/jev-1.13"), true);
  assert.equal(isJevModelId("typesafe/jev-latest"), true);
  assert.equal(normalizeChatModel("typesafe/jev-1.13"), "");
  assert.equal(normalizeChatModel("  TYPESAFE/jev-latest  "), "");
  assert.equal(
    resolveChatModel("typesafe/jev-1.13", "google/gemini-2.5-flash-lite"),
    "google/gemini-2.5-flash-lite",
  );
});

test("accepts OpenRouter chat slugs and falls back when junk", () => {
  assert.equal(
    normalizeChatModel("deepseek/deepseek-v4.1-flash"),
    "deepseek/deepseek-v4.1-flash",
  );
  assert.equal(normalizeChatModel("not a model"), "");
  assert.equal(normalizeChatModel("https://evil.example/x"), "");
  assert.equal(resolveChatModel("", "bogus"), DEFAULT_LLM);
  assert.equal(
    resolveChatModel(undefined, "qwen/qwen3-32b"),
    "qwen/qwen3-32b",
  );
});
