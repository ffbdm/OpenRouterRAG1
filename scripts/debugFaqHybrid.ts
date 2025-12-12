import "dotenv/config";

import { storage } from "../server/storage";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("⚠️  Forneça a consulta. Exemplo: npx tsx scripts/debugFaqHybrid.ts \"como aplicar fungicida?\"");
    process.exit(1);
  }

  const limit = Number(process.env.DEBUG_SEARCH_LIMIT ?? 10);

  console.log(`🔍 Consulta: "${query}"\n`);

  const result = await storage.searchFaqsHybrid(query, limit);

  console.log(`[FAQ_HYBRID] total=${result.results.length} vetorial=${result.vectorCount} lexical=${result.lexicalCount} embeddingUsed=${result.embeddingUsed}`);
  console.log(`[FAQ_HYBRID] Tempos (ms) → vector=${result.timings.vectorMs} lexical=${result.timings.lexicalMs} merge=${result.timings.mergeMs} total=${result.timings.totalMs}`);
  if (result.fallbackReason) {
    console.log(`[FAQ_HYBRID] Fallback: ${result.fallbackReason}`);
  }

  console.log("------------------------------------------------------------");
  result.results.forEach((hit, index) => {
    const vectorScore = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
    const lexicalScore = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
    console.log(`#${index + 1} [${hit.source}] vec=${vectorScore} lex=${lexicalScore}`);
    console.log(`Q: ${hit.item.question}`);
    console.log(`A: ${hit.snippet ?? hit.item.answer}`);
    console.log("------------------------------------------------------------");
  });
}

main().catch((error) => {
  console.error("❌ Falha ao executar debug da busca híbrida de FAQ:", error);
  process.exit(1);
});

