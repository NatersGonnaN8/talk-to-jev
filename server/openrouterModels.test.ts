import assert from "node:assert/strict";
import { test } from "node:test";
import { chatModelsFromOpenRouter } from "./openrouterModels.ts";

test("chat catalog keeps text models and drops Jev", () => {
  const models = chatModelsFromOpenRouter({
    data: [
      { id: "typesafe/jev-1.13", name: "Jev" },
      { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
      {
        id: "google/gemini-2.5-flash",
        name: "Gemini",
        architecture: { output_modalities: ["text"] },
      },
      {
        id: "black-forest-labs/flux",
        name: "Flux",
        architecture: { output_modalities: ["image"] },
      },
    ],
  });
  assert.deepEqual(
    models.map((m) => m.id),
    ["deepseek/deepseek-v4-flash", "google/gemini-2.5-flash"],
  );
});
