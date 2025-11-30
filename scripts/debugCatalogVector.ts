import "dotenv/config";

import { storage } from "../server/storage";
import { extractSearchTokens } from "../server/text-utils";
import type { CatalogHybridHit } from "../server/catalog-hybrid";

function formatMs(label: string, value: number) {
  return `${label}=${value}ms`;
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("⚠️  Forneça a consulta. Exemplo: npx tsx scripts/debugCatalogVector.ts \"pesticida para uva\"");
    process.exit(1);
  }

  const limit = Number(process.env.DEBUG_VECTOR_LIMIT ?? 5);
  const tokens = extractSearchTokens(query, { maxTokens: 12 });

  console.log(`🔎 Consulta vetorial: "${query}"`);
  console.log(`🧩 Tokens (${tokens.length}): ${tokens.join(", ") || "(nenhum)"}`);
  console.log(`📏 Limite solicitado: ${limit}`);
  console.log("============================================================");

  const result = await storage.searchCatalogHybrid(query, limit);
  const timingLine = [
    formatMs("vector", result.timings.vectorMs),
    formatMs("lexical", result.timings.lexicalMs),
    formatMs("merge", result.timings.mergeMs),
    formatMs("total", result.timings.totalMs),
  ].join(" | ");

  console.log(
    `Resultado: total=${result.results.length} | vetorial=${result.vectorCount} | lexical=${result.lexicalCount} | embeddingUsed=${result.embeddingUsed} | fallback=${result.fallbackReason ?? "none"}`,
  );
  console.log(`⏱️  ${timingLine}`);
  console.log("============================================================\n");

  if (result.vectorCount === 0) {
    console.log("⚠️  Nenhum item vetorial retornado (considere revisar embeddings ou threshold).");
  }

  result.results.forEach((hit, index) => {
    logHybridHit(hit, index);
  });

  process.exit(0);
}

function logHybridHit(hit: CatalogHybridHit, index: number) {
  const sourceLabel = hit.source === "lexical" ? "lexical" : `vector:${hit.source}`;
  const vectorScore = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
  const lexicalScore = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
  const pairFlag = hit.lexicalSignals?.hasCultureTreatmentPair ? " pair" : "";

  console.log(`#${index + 1} — ${hit.item.name} (id=${hit.item.id})`);
  console.log(`   Fonte=${sourceLabel} | vec=${vectorScore} | lex=${lexicalScore}${pairFlag}`);
  console.log(`   Categoria: ${hit.item.category} | Fabricante: ${hit.item.manufacturer}`);
  if (hit.snippet) {
    console.log(`   Snippet: ${hit.snippet}`);
  }

  if (hit.lexicalSignals) {
    const { matchedTokens, cultureMatches, treatmentMatches } = hit.lexicalSignals;
    console.log(
      `   Lexical matched tokens: ${matchedTokens.join(", ") || "(nenhum)"} | culturas: ${cultureMatches.join(", ") || "(nenhuma)"} | tratamentos: ${treatmentMatches.join(", ") || "(nenhum)"}`,
    );
  }

  console.log("------------------------------------------------------------");
}

main().catch((error) => {
  console.error("❌ Falha ao executar debug vetorial:", error);
  process.exit(1);
});
