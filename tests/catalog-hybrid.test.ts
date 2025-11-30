import { test } from "node:test";
import assert from "node:assert/strict";

import type { CatalogItem } from "@shared/schema";
import { mergeCatalogResults, type CatalogHybridHit } from "../server/catalog-hybrid";
import type { CatalogLexicalSignals } from "../server/catalog-lexical-ranker";

function buildItem(id: number, name: string): CatalogItem {
  return {
    id,
    name,
    description: `${name} description`,
    category: "Categoria",
    manufacturer: "Fabricante",
    price: id * 10,
    status: "ativo",
    tags: [],
    createdAt: new Date(),
  };
}

function buildSignals(overrides?: Partial<CatalogLexicalSignals>): CatalogLexicalSignals {
  return {
    tokens: overrides?.tokens ?? [],
    matchedTokens: overrides?.matchedTokens ?? [],
    matchedFields: {
      name: overrides?.matchedFields?.name ?? [],
      description: overrides?.matchedFields?.description ?? [],
      category: overrides?.matchedFields?.category ?? [],
      manufacturer: overrides?.matchedFields?.manufacturer ?? [],
      tags: overrides?.matchedFields?.tags ?? [],
    },
    cultureMatches: overrides?.cultureMatches ?? [],
    treatmentMatches: overrides?.treatmentMatches ?? [],
    hasCultureTreatmentPair: overrides?.hasCultureTreatmentPair ?? false,
  };
}

test("mergeCatalogResults prioriza vetorial e remove duplicados", () => {
  const vectorHits: CatalogHybridHit[] = [
    { item: buildItem(1, "Item Vetorial"), source: "file", score: 0.1 },
    { item: buildItem(2, "Outro Vetorial"), source: "file", score: 0.2 },
  ];

  const lexicalHits: CatalogHybridHit[] = [
    { item: vectorHits[1].item, source: "lexical" },
    { item: buildItem(3, "Lexical"), source: "lexical" },
  ];

  const merged = mergeCatalogResults(vectorHits, lexicalHits, 3);

  assert.deepEqual(
    merged.map((hit) => hit.item.id),
    [1, 2, 3],
    "mantém ordem vetorial e inclui lexical apenas quando não duplicado",
  );
  assert.equal(merged[1].source, "file");
  assert.equal(merged[2].source, "lexical");
});

test("mergeCatalogResults respeita limite quando apenas vetorial existe", () => {
  const vectorHits: CatalogHybridHit[] = [
    { item: buildItem(1, "Item 1"), source: "file", score: 0.05 },
    { item: buildItem(2, "Item 2"), source: "file", score: 0.06 },
  ];

  const merged = mergeCatalogResults(vectorHits, [], 1);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].item.id, 1);
});

test("mergeCatalogResults usa lexical quando não há vetorial", () => {
  const lexicalHits: CatalogHybridHit[] = [
    { item: buildItem(10, "Lexical 1"), source: "lexical" },
    { item: buildItem(11, "Lexical 2"), source: "lexical" },
  ];

  const merged = mergeCatalogResults([], lexicalHits, 2);
  assert.deepEqual(merged.map((hit) => hit.item.id), [10, 11]);
});

test("mergeCatalogResults prioriza sinais cultura + tratamento quando enhanced", () => {
  const preferred = buildItem(21, "Pesticida Protege Uva");
  const vectorFirst = buildItem(22, "Fungicida Tino");
  const vectorHits: CatalogHybridHit[] = [
    { item: vectorFirst, source: "file", score: -0.25 },
    { item: buildItem(23, "Outro Vetorial"), source: "file", score: -0.2 },
  ];

  const lexicalHits: CatalogHybridHit[] = [
    {
      item: preferred,
      source: "lexical",
      lexicalScore: 8.5,
      lexicalSignals: buildSignals({
        tokens: ["pesticida", "uva"],
        matchedTokens: ["pesticida", "uva"],
        matchedFields: {
          name: ["pesticida"],
          description: ["uva"],
          category: [],
          manufacturer: [],
          tags: ["uva"],
        },
        cultureMatches: ["uva"],
        treatmentMatches: ["pesticida"],
        hasCultureTreatmentPair: true,
      }),
    },
    {
      item: vectorFirst,
      source: "lexical",
      lexicalScore: 2,
      lexicalSignals: buildSignals({
        tokens: ["pesticida"],
        matchedTokens: ["pesticida"],
        matchedFields: {
          name: ["pesticida"],
          description: [],
          category: [],
          manufacturer: [],
          tags: [],
        },
        treatmentMatches: ["pesticida"],
      }),
    },
  ];

  const merged = mergeCatalogResults(vectorHits, lexicalHits, 2, { enhanced: true });

  assert.equal(merged[0].item.id, preferred.id);
  assert.equal(merged[1].item.id, vectorFirst.id);
  assert.equal(merged[0].lexicalSignals?.hasCultureTreatmentPair, true);
});
