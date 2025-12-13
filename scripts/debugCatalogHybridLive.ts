import "dotenv/config";

import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../server/db";
import { buildFocusedSnippet } from "../server/catalog-embedding-utils";
import { generateCatalogEmbedding, embeddingsEnabled, getEmbeddingSettings } from "../server/embeddings";
import { clampCatalogLimit, mapLexicalResults, mergeCatalogResults, type CatalogHybridHit, type CatalogSearchSource } from "../server/catalog-hybrid";
import { scoreCatalogItemLexical } from "../server/catalog-lexical-ranker";
import { extractSearchTokens } from "../server/text-utils";
import { storage } from "../server/storage";
import { catalogItemEmbeddings, catalogItems } from "../shared/schema";

process.env.HYBRID_SEARCH_ENHANCED ||= process.env.HYBRID_SEARCH_ENHNACED || "true";

function resolveWeight(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeVectorScore(distance?: number): number {
  if (typeof distance !== "number" || Number.isNaN(distance)) return 0;
  if (distance <= 0) return 10;
  if (distance < 1) return Math.max(0, 2 - distance);
  return 0;
}

function buildVectorParam(embedding: number[]) {
  const literal = `[${embedding.join(",")}]`;
  return sql`${literal}::vector`;
}

async function searchCatalogVector(queryEmbedding: number[], query: string, limit: number) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return { results: [], thresholdApplied: false, threshold: undefined };
  }

  const embeddingParam = buildVectorParam(queryEmbedding);
  const distance = sql<number>`catalog_item_embeddings.embedding <#> ${embeddingParam}`;

  const threshold = Number(process.env.CATALOG_VECTOR_THRESHOLD ?? -0.5);
  const whereClauses: SQL[] = [eq(catalogItems.status, "ativo")];
  const thresholdApplied = Number.isFinite(threshold);
  if (thresholdApplied) {
    whereClauses.push(sql`${distance} <= ${threshold}`);
  }

  const rows = await db
    .select({
      item: catalogItems,
      source: catalogItemEmbeddings.source,
      content: catalogItemEmbeddings.content,
      score: distance,
    })
    .from(catalogItemEmbeddings)
    .innerJoin(catalogItems, eq(catalogItemEmbeddings.catalogItemId, catalogItems.id))
    .where(and(...whereClauses))
    .orderBy(distance)
    .limit(limit);

  const results: CatalogHybridHit[] = rows.map((row) => ({
    item: row.item,
    source: row.source as CatalogSearchSource,
    score: row.score,
    snippet: buildFocusedSnippet(row.content, query),
  }));

  return { results, thresholdApplied, threshold };
}

type ScoreBreakdown = {
  total: number;
  vectorDistance?: number;
  vectorComponent: number;
  vectorWeight: number;
  lexicalScore: number;
  lexicalWeight: number;
  pairBonus: number;
  pairWeight: number;
  vectorRank?: number;
  lexicalRank?: number;
  vectorRankBonus: number;
  lexicalRankBonus: number;
};

function computeScore(hit: CatalogHybridHit, vectorRank?: number, lexicalRank?: number): ScoreBreakdown {
  const vectorWeight = resolveWeight(process.env.CATALOG_VECTOR_WEIGHT, 6);
  const lexicalWeight = resolveWeight(process.env.CATALOG_LEXICAL_WEIGHT, 4);
  const pairWeight = resolveWeight(process.env.CATALOG_PAIR_PRIORITY_BONUS, 4);

  const vectorComponent = normalizeVectorScore(hit.score);
  const lexicalScore = hit.lexicalScore ?? 0;
  const pairBonus = hit.lexicalSignals?.hasCultureTreatmentPair ? pairWeight : 0;
  const vectorRankBonus = typeof vectorRank === "number" ? 1 / (vectorRank + 1) : 0;
  const lexicalRankBonus = typeof lexicalRank === "number" ? 1 / (lexicalRank + 1) : 0;

  const total = (vectorComponent * vectorWeight)
    + (lexicalScore * lexicalWeight)
    + pairBonus
    + vectorRankBonus
    + lexicalRankBonus;

  return {
    total,
    vectorDistance: hit.score,
    vectorComponent,
    vectorWeight,
    lexicalScore,
    lexicalWeight,
    pairBonus,
    pairWeight,
    vectorRank,
    lexicalRank,
    vectorRankBonus,
    lexicalRankBonus,
  };
}

function parseArgs(argv: string[]): { query: string; limit: number } {
  const raw = argv.filter(Boolean);
  const last = raw[raw.length - 1];
  const candidateLimit = last ? Number(last) : Number.NaN;
  const hasPositionalLimit = raw.length > 1 && Number.isFinite(candidateLimit);

  const limit = clampCatalogLimit(
    hasPositionalLimit ? candidateLimit : Number(process.env.DEBUG_HYBRID_LIMIT ?? 5),
  );

  const queryParts = hasPositionalLimit ? raw.slice(0, -1) : raw;
  const query = queryParts.join(" ").trim();

  return { query, limit };
}

async function main() {
  const { query, limit } = parseArgs(process.argv.slice(2));
  if (!query) {
    console.error(
      "⚠️  Forneça a consulta. Exemplo: npx tsx scripts/debugCatalogHybridLive.ts \"pesticida para uva\" 10",
    );
    process.exit(1);
  }

  const tokens = extractSearchTokens(query, { maxTokens: 12 });
  const hybridEnhanced = process.env.HYBRID_SEARCH_ENHANCED === "true";

  console.log(`🔍 Consulta: "${query}"`);
  console.log(`📏 Limite: ${limit}`);
  console.log(`🧩 Tokens (${tokens.length}): ${tokens.join(", ") || "(nenhum)"}`);
  console.log(`⚙️  HYBRID_SEARCH_ENHANCED=${process.env.HYBRID_SEARCH_ENHANCED} (default do script: true)`);
  console.log(
    `⚙️  Pesos: vector=${resolveWeight(process.env.CATALOG_VECTOR_WEIGHT, 6)} | lexical=${resolveWeight(process.env.CATALOG_LEXICAL_WEIGHT, 4)} | pair=${resolveWeight(process.env.CATALOG_PAIR_PRIORITY_BONUS, 4)}`,
  );

  const threshold = Number(process.env.CATALOG_VECTOR_THRESHOLD ?? -0.5);
  console.log(`⚙️  CATALOG_VECTOR_THRESHOLD=${Number.isFinite(threshold) ? threshold : "disabled"} (menor = melhor)`);

  const embeddingSettings = getEmbeddingSettings();
  console.log(
    `⚙️  Embeddings: enabled=${embeddingsEnabled()} | model=${embeddingSettings.model} | dims=${embeddingSettings.dimensions} | timeoutMs=${embeddingSettings.timeoutMs}`,
  );

  console.log("============================================================");

  const startedAt = Date.now();

  const lexicalStartedAt = Date.now();
  const lexicalRows = await storage.searchCatalog(query, limit);
  const lexicalMs = Date.now() - lexicalStartedAt;
  const lexicalHits = mapLexicalResults(lexicalRows, query);
  const lexicalRowIds = new Set(lexicalRows.map((item) => item.id));

  let vectorHits: CatalogHybridHit[] = [];
  let vectorMs = 0;
  let embeddingUsed = false;
  let fallbackReason: string | undefined;
  let thresholdApplied = false;

  const embedding = await generateCatalogEmbedding(query);
  if (embedding && embedding.length > 0) {
    embeddingUsed = true;
    const vectorStartedAt = Date.now();
    try {
      const vectorQuery = await searchCatalogVector(embedding, query, limit);
      vectorHits = vectorQuery.results;
      thresholdApplied = vectorQuery.thresholdApplied;
    } catch (error) {
      fallbackReason = "vector-query-error";
      console.warn("[DEBUG] Falha ao consultar busca vetorial:", error);
    }
    vectorMs = Date.now() - vectorStartedAt;
  } else {
    fallbackReason = embeddingsEnabled() ? "embedding-generation-failed" : "embedding-disabled";
  }

  const mergeStartedAt = Date.now();
  const merged = mergeCatalogResults(vectorHits, lexicalHits, limit);
  const mergeMs = Date.now() - mergeStartedAt;

  console.log(
    `[CATALOG_HYBRID] total=${merged.length} vetorial=${vectorHits.length} lexical=${lexicalHits.length} embeddingUsed=${embeddingUsed} enhanced=${hybridEnhanced}`,
  );
  console.log(`[CATALOG_HYBRID] Tempos (ms) → vector=${vectorMs} lexical=${lexicalMs} merge=${mergeMs} total=${Date.now() - startedAt}`);
  if (thresholdApplied) {
    console.log(`[CATALOG_HYBRID] Threshold aplicado (CATALOG_VECTOR_THRESHOLD).`);
  }
  if (fallbackReason) {
    console.log(`[CATALOG_HYBRID] Fallback: ${fallbackReason}`);
  }

  console.log("============================================================");
  console.log("📌 Vetorial (ordem por distância, menor=melhor):");
  if (vectorHits.length === 0) {
    console.log("  (nenhum)");
  } else {
    vectorHits.forEach((hit, index) => {
      console.log(`  #${index + 1} id=${hit.item.id} | ${hit.item.name} | source=${hit.source} | vec=${hit.score?.toFixed(4) ?? "n/a"}`);
    });
  }

  console.log("------------------------------------------------------------");
  console.log(`📌 Lexical (${hybridEnhanced ? "ordem por lexicalScore" : "ordem do banco"}):`);
  if (lexicalHits.length === 0) {
    console.log("  (nenhum)");
  } else {
    lexicalHits.forEach((hit, index) => {
      const lexicalScore = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
      const pairFlag = hit.lexicalSignals?.hasCultureTreatmentPair ? " pair" : "";
      console.log(`  #${index + 1} id=${hit.item.id} | ${hit.item.name} | lex=${lexicalScore}${pairFlag}`);
    });
  }

  console.log("------------------------------------------------------------");
  console.log("🔎 Checagem: score lexical para os hits vetoriais (mesmo se não vieram no SQL lexical):");
  if (vectorHits.length === 0) {
    console.log("  (nenhum)");
  } else {
    vectorHits.forEach((hit, index) => {
      const lexical = scoreCatalogItemLexical(query, hit.item);
      const inLexicalSql = lexicalRowIds.has(hit.item.id);
      const matchedTokens = lexical?.signals.matchedTokens ?? [];
      console.log(
        `  #${index + 1} id=${hit.item.id} | inLexicalSQL=${inLexicalSql ? "yes" : "no"} | lex=${lexical ? lexical.score.toFixed(2) : "n/a"} | matched=${matchedTokens.join(", ") || "(nenhum)"}`,
      );
    });
  }

  console.log("============================================================");
  console.log(`🏁 Resultado final (${hybridEnhanced ? "ranking híbrido com breakdown" : "merge simples (sem score)"}):`);

  if (!hybridEnhanced) {
    merged.forEach((hit, index) => {
      const sourceLabel = hit.source === "lexical" ? "lexical" : `vector:${hit.source}`;
      const vec = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
      console.log(`#${index + 1} — ${hit.item.name} (id=${hit.item.id}) | Fonte=${sourceLabel} | vec=${vec}`);
      if (hit.snippet) {
        console.log(`   Snippet: ${hit.snippet}`);
      }
      console.log("------------------------------------------------------------");
    });
    return;
  }

  type CombinedCandidate = {
    hit: CatalogHybridHit;
    vectorRank?: number;
    lexicalRank?: number;
    breakdown: ScoreBreakdown;
  };

  const candidates = new Map<number, CombinedCandidate>();

  vectorHits.forEach((hit, index) => {
    candidates.set(hit.item.id, { hit: { ...hit }, vectorRank: index, breakdown: computeScore(hit, index, undefined) });
  });

  lexicalHits.forEach((hit, index) => {
    const existing = candidates.get(hit.item.id);
    if (existing) {
      const mergedHit: CatalogHybridHit = {
        ...existing.hit,
        lexicalScore: hit.lexicalScore ?? existing.hit.lexicalScore,
        lexicalSignals: hit.lexicalSignals ?? existing.hit.lexicalSignals,
        snippet: existing.hit.snippet ?? hit.snippet,
      };
      existing.hit = mergedHit;
      existing.lexicalRank = index;
      existing.breakdown = computeScore(mergedHit, existing.vectorRank, index);
    } else {
      const mergedHit: CatalogHybridHit = { ...hit };
      candidates.set(hit.item.id, {
        hit: mergedHit,
        lexicalRank: index,
        breakdown: computeScore(mergedHit, undefined, index),
      });
    }
  });

  const scored = Array.from(candidates.values())
    .map((candidate) => ({
      ...candidate,
      breakdown: computeScore(candidate.hit, candidate.vectorRank, candidate.lexicalRank),
    }))
    .sort((a, b) => b.breakdown.total - a.breakdown.total);

  const expected = scored.slice(0, limit).map((entry) => entry.hit.item.id);
  const actual = merged.map((hit) => hit.item.id);
  const mismatch = expected.length !== actual.length || expected.some((id, idx) => id !== actual[idx]);
  if (mismatch) {
    console.warn("[DEBUG] Atenção: ordem calculada no script divergiu de mergeCatalogResults.");
    console.warn(`        script=${expected.join(", ")} | mergeCatalogResults=${actual.join(", ")}`);
  }

  scored.slice(0, limit).forEach((entry, index) => {
    const { hit, breakdown } = entry;
    const sourceLabel = hit.source === "lexical" ? "lexical" : `vector:${hit.source}`;
    const vec = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
    const lex = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
    const pairFlag = hit.lexicalSignals?.hasCultureTreatmentPair ? " pair" : "";

    console.log(`#${index + 1} — ${hit.item.name} (id=${hit.item.id})`);
    console.log(`   Fonte=${sourceLabel} | vec=${vec} | lex=${lex}${pairFlag}`);
    console.log(
      `   total=${breakdown.total.toFixed(2)} = (vecNorm=${breakdown.vectorComponent.toFixed(2)}*${breakdown.vectorWeight}) + (lex=${breakdown.lexicalScore.toFixed(2)}*${breakdown.lexicalWeight}) + pair=${breakdown.pairBonus} + rankV=${breakdown.vectorRankBonus.toFixed(2)} + rankL=${breakdown.lexicalRankBonus.toFixed(2)}`,
    );
    console.log(
      `   ranks: vector=${typeof entry.vectorRank === "number" ? entry.vectorRank + 1 : "n/a"} | lexical=${typeof entry.lexicalRank === "number" ? entry.lexicalRank + 1 : "n/a"}`,
    );
    if (hit.snippet) {
      console.log(`   Snippet: ${hit.snippet}`);
    }
    if (hit.lexicalSignals) {
      const { matchedTokens, cultureMatches, treatmentMatches } = hit.lexicalSignals;
      console.log(
        `   Lexical matched: ${matchedTokens.join(", ") || "(nenhum)"} | culturas: ${cultureMatches.join(", ") || "(nenhuma)"} | tratamentos: ${treatmentMatches.join(", ") || "(nenhum)"}`,
      );
    }
    console.log("------------------------------------------------------------");
  });
}

main().catch((error) => {
  console.error("❌ Falha ao executar debug híbrido do catálogo:", error);
  process.exit(1);
});
