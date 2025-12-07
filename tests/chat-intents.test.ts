import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeIntent, planSearches } from "../server/chat-intents";

test("normalizeIntent aceita variações de caixa e acento", () => {
  assert.equal(normalizeIntent("faq"), "FAQ");
  assert.equal(normalizeIntent("CATÁLOGO"), "CATALOG");
  assert.equal(normalizeIntent("Mist "), "MIST");
});

test("normalizeIntent cai em OTHER para entradas inválidas", () => {
  assert.equal(normalizeIntent(""), "OTHER");
  assert.equal(normalizeIntent("oi tudo bem?"), "OTHER");
  // @ts-expect-error - entrada inválida deve retornar OTHER
  assert.equal(normalizeIntent(undefined), "OTHER");
});

test("planSearches define tools e llmCalls coerentes", () => {
  assert.deepEqual(planSearches("FAQ"), {
    runFaq: true,
    runCatalog: false,
    usedTools: ["searchFaqs"],
    llmCalls: 1,
  });

  assert.deepEqual(planSearches("CATALOG"), {
    runFaq: false,
    runCatalog: true,
    usedTools: ["searchCatalog"],
    llmCalls: 1,
  });

  assert.deepEqual(planSearches("MIST"), {
    runFaq: true,
    runCatalog: true,
    usedTools: ["searchFaqs", "searchCatalog"],
    llmCalls: 2,
  });

  assert.deepEqual(planSearches("OTHER"), {
    runFaq: false,
    runCatalog: false,
    usedTools: [],
    llmCalls: 0,
  });
});
