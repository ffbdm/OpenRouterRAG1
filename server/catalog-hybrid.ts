import type { CatalogItem, CatalogItemEmbeddingSource } from "@shared/schema";
import { buildSnippet } from "./catalog-embedding-utils";

export type CatalogSearchSource = CatalogItemEmbeddingSource | "lexical";

export type CatalogHybridHit = {
  item: CatalogItem;
  source: CatalogSearchSource;
  score?: number;
  snippet?: string;
};

export type CatalogHybridSearchResult = {
  results: CatalogHybridHit[];
  vectorCount: number;
  lexicalCount: number;
  embeddingUsed: boolean;
  fallbackReason?: string;
  timings: {
    vectorMs: number;
    lexicalMs: number;
    mergeMs: number;
    totalMs: number;
  };
};

export function clampCatalogLimit(limit: number, fallback = 5, max = 20): number {
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

export function mergeCatalogResults(vectorResults: CatalogHybridHit[], lexicalResults: CatalogHybridHit[], limit: number): CatalogHybridHit[] {
  const deduped = new Map<number, CatalogHybridHit>();

  for (const result of vectorResults) {
    if (!deduped.has(result.item.id)) {
      deduped.set(result.item.id, result);
    }
  }

  for (const lexical of lexicalResults) {
    if (deduped.size >= limit) break;
    if (!deduped.has(lexical.item.id)) {
      deduped.set(lexical.item.id, lexical);
    }
  }

  return Array.from(deduped.values()).slice(0, limit);
}

export function mapLexicalResults(items: CatalogItem[]): CatalogHybridHit[] {
  return items.map((item) => ({
    item,
    source: "lexical" as const,
    snippet: buildSnippet(item.description),
  }));
}
