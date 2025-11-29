import { test } from "node:test";
import assert from "node:assert/strict";

import type { CatalogItem } from "@shared/schema";
import { mergeCatalogResults, type CatalogHybridHit } from "../server/catalog-hybrid";

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

test("mergeCatalogResults prioriza vetorial e remove duplicados", () => {
  const vectorHits: CatalogHybridHit[] = [
    { item: buildItem(1, "Item Vetorial"), source: "item", score: 0.1 },
    { item: buildItem(2, "Outro Vetorial"), source: "item", score: 0.2 },
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
  assert.equal(merged[1].source, "item");
  assert.equal(merged[2].source, "lexical");
});

test("mergeCatalogResults respeita limite quando apenas vetorial existe", () => {
  const vectorHits: CatalogHybridHit[] = [
    { item: buildItem(1, "Item 1"), source: "item", score: 0.05 },
    { item: buildItem(2, "Item 2"), source: "item", score: 0.06 },
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
