import type { CatalogItem, CatalogItemEmbeddingSource } from "@shared/schema";
import { buildSnippet } from "./catalog-embedding-utils";
import { scoreCatalogItemLexical, type CatalogLexicalSignals } from "./catalog-lexical-ranker";

export type CatalogSearchSource = CatalogItemEmbeddingSource | "lexical";

export type CatalogHybridHit = {
  item: CatalogItem;
  source: CatalogSearchSource;
  score?: number;
  lexicalScore?: number;
  lexicalSignals?: CatalogLexicalSignals;
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

type MergeOptions = {
  enhanced?: boolean;
};

const VECTOR_WEIGHT = resolveWeight(process.env.CATALOG_VECTOR_WEIGHT, 6);
const LEXICAL_WEIGHT = resolveWeight(process.env.CATALOG_LEXICAL_WEIGHT, 4);
const CULTURE_PAIR_BONUS = resolveWeight(process.env.CATALOG_PAIR_PRIORITY_BONUS, 4);

export function mergeCatalogResults(
  vectorResults: CatalogHybridHit[],
  lexicalResults: CatalogHybridHit[],
  limit: number,
  options?: MergeOptions,
): CatalogHybridHit[] {
  const enhanced = shouldEnhance(options);
  if (!enhanced) {
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

  type CombinedEntry = {
    hit: CatalogHybridHit;
    vectorRank?: number;
    lexicalRank?: number;
  };

  const merged = new Map<number, CombinedEntry>();

  vectorResults.forEach((hit, index) => {
    merged.set(hit.item.id, {
      hit: { ...hit },
      vectorRank: index,
    });
  });

  lexicalResults.forEach((hit, index) => {
    const existing = merged.get(hit.item.id);
    if (existing) {
      existing.hit = {
        ...existing.hit,
        lexicalScore: hit.lexicalScore ?? existing.hit.lexicalScore,
        lexicalSignals: hit.lexicalSignals ?? existing.hit.lexicalSignals,
        snippet: existing.hit.snippet ?? hit.snippet,
      };
      existing.lexicalRank = index;
    } else {
      merged.set(hit.item.id, {
        hit: { ...hit },
        lexicalRank: index,
      });
    }
  });

  const scored = Array.from(merged.values());
  scored.sort((a, b) => computeCombinedScore(b) - computeCombinedScore(a));

  return scored.slice(0, limit).map((entry) => entry.hit);
}

export function mapLexicalResults(items: CatalogItem[], query: string, options?: MergeOptions): CatalogHybridHit[] {
  const enhanced = shouldEnhance(options);
  const entries = items.map((item, index) => {
    const lexicalScore = enhanced ? scoreCatalogItemLexical(query, item) : undefined;
    return {
      hit: {
        item,
        source: "lexical" as const,
        snippet: buildSnippet(item.description),
        lexicalScore: lexicalScore?.score,
        lexicalSignals: lexicalScore?.signals,
      },
      index,
    };
  });

  if (!enhanced) {
    return entries.map((entry) => entry.hit);
  }

  entries.sort((a, b) => {
    const scoreDiff = (b.hit.lexicalScore ?? 0) - (a.hit.lexicalScore ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.index - b.index;
  });

  return entries.map((entry) => entry.hit);
}

function shouldEnhance(options?: MergeOptions): boolean {
  if (typeof options?.enhanced === "boolean") {
    return options.enhanced;
  }
  return process.env.HYBRID_SEARCH_ENHANCED === "true";
}

function resolveWeight(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function computeCombinedScore(entry: { hit: CatalogHybridHit; vectorRank?: number; lexicalRank?: number }): number {
  const vectorComponent = normalizeVectorScore(entry.hit.score);
  const lexicalComponent = entry.hit.lexicalScore ?? 0;
  const hasPair = entry.hit.lexicalSignals?.hasCultureTreatmentPair ? CULTURE_PAIR_BONUS : 0;
  const vectorRankBonus = typeof entry.vectorRank === "number" ? 1 / (entry.vectorRank + 1) : 0;
  const lexicalRankBonus = typeof entry.lexicalRank === "number" ? 1 / (entry.lexicalRank + 1) : 0;

  return (vectorComponent * VECTOR_WEIGHT) + (lexicalComponent * LEXICAL_WEIGHT) + hasPair + vectorRankBonus + lexicalRankBonus;
}

function normalizeVectorScore(distance?: number): number {
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    return 0;
  }

  if (distance <= 0) {
    return Math.min(10, -distance * 10);
  }

  if (distance < 1) {
    return Math.max(0, 2 - distance);
  }

  return 0;
}
