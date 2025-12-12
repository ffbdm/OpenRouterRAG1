import { test } from "node:test";
import assert from "node:assert/strict";

import type { Faq } from "@shared/schema";
import { mergeFaqResults, type FaqHybridHit } from "../server/faq-hybrid";

function buildFaq(id: number, question: string, answer = "Resposta"): Faq {
  return {
    id,
    question,
    questionNormalized: question,
    answer,
    createdAt: new Date(),
  };
}

test("mergeFaqResults prioriza vetorial e remove duplicados", () => {
  const vectorHits: FaqHybridHit[] = [
    { item: buildFaq(1, "Pergunta Vetorial"), source: "embedding", score: 0.2 },
    { item: buildFaq(2, "Outra Vetorial"), source: "embedding", score: 0.3 },
  ];

  const lexicalHits: FaqHybridHit[] = [
    { item: vectorHits[1].item, source: "lexical", lexicalScore: 5 },
    { item: buildFaq(3, "Lexical"), source: "lexical", lexicalScore: 4 },
  ];

  const merged = mergeFaqResults(vectorHits, lexicalHits, 3, { enhanced: false });

  assert.deepEqual(
    merged.map((hit) => hit.item.id),
    [1, 2, 3],
    "mantém ordem vetorial e inclui lexical apenas quando não duplicado",
  );
  assert.equal(merged[1].source, "embedding");
  assert.equal(merged[2].source, "lexical");
});

test("mergeFaqResults respeita limite quando apenas vetorial existe", () => {
  const vectorHits: FaqHybridHit[] = [
    { item: buildFaq(1, "Item 1"), source: "embedding", score: 0.05 },
    { item: buildFaq(2, "Item 2"), source: "embedding", score: 0.06 },
  ];

  const merged = mergeFaqResults(vectorHits, [], 1, { enhanced: false });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].item.id, 1);
});

test("mergeFaqResults usa lexical quando não há vetorial", () => {
  const lexicalHits: FaqHybridHit[] = [
    { item: buildFaq(10, "Lexical 1"), source: "lexical", lexicalScore: 2 },
    { item: buildFaq(11, "Lexical 2"), source: "lexical", lexicalScore: 1.5 },
  ];

  const merged = mergeFaqResults([], lexicalHits, 2, { enhanced: false });
  assert.deepEqual(merged.map((hit) => hit.item.id), [10, 11]);
});

test("mergeFaqResults reordena pelo score combinado quando enhanced", () => {
  const faqA = buildFaq(21, "Como aplicar fungicida?");
  const faqB = buildFaq(22, "Qual dose recomendada?");

  const vectorHits: FaqHybridHit[] = [
    { item: faqA, source: "embedding", score: 0.9 },
    { item: faqB, source: "embedding", score: 0.1 },
  ];

  const lexicalHits: FaqHybridHit[] = [
    { item: faqA, source: "lexical", lexicalScore: 10 },
    { item: faqB, source: "lexical", lexicalScore: 0.5 },
  ];

  const merged = mergeFaqResults(vectorHits, lexicalHits, 2, { enhanced: true });

  assert.equal(merged[0].item.id, faqA.id, "lexical alto deve priorizar FAQ A");
  assert.equal(merged[1].item.id, faqB.id);
});

