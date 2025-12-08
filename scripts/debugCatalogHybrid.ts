import type { CatalogItem } from "../shared/schema";
import { mergeCatalogResults, type CatalogHybridHit } from "../server/catalog-hybrid";
import { scoreCatalogItemLexical } from "../server/catalog-lexical-ranker";

function normalizeVectorScore(distance?: number): number {
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    return 0;
  }

  if (distance <= 0) {
    return 10;
  }

  if (distance < 1) {
    return Math.max(0, 2 - distance);
  }

  return 0;
}

function buildItem(id: number, name: string, description: string, tags: string[] = []): CatalogItem {
  return {
    id,
    name,
    description,
    category: "Categoria",
    manufacturer: "Fabricante",
    price: id * 10,
    status: "ativo",
    tags,
    createdAt: new Date(),
  };
}

function logItemScore(hit: CatalogHybridHit, vectorRank?: number, lexicalRank?: number) {
  const vectorComp = hit.score ? normalizeVectorScore(hit.score) : 0;
  const lexicalComp = hit.lexicalScore ?? 0;
  const hasPair = hit.lexicalSignals?.hasCultureTreatmentPair ? 4 : 0;
  const vectorRankBonus = vectorRank !== undefined ? 1 / (vectorRank + 1) : 0;
  const lexicalRankBonus = lexicalRank !== undefined ? 1 / (lexicalRank + 1) : 0;

  const totalScore = (vectorComp * 6) + (lexicalComp * 4) + hasPair + vectorRankBonus + lexicalRankBonus;

  console.log(`\nItem ${hit.item.id}: ${hit.item.name}`);
  console.log(`  Descrição: ${hit.item.description}`);
  console.log(`  Tags: ${hit.item.tags.join(", ")}`);
  console.log(`  Fonte: ${hit.source}`);
  console.log(`  Distância Vetorial: ${hit.score ?? "N/A"}`);
  console.log(`  Pontuação Vetorial Normalizada: ${vectorComp.toFixed(2)}`);
  console.log(`  Pontuação Lexical: ${lexicalComp.toFixed(2)}`);
  console.log(`  Bônus Par Cultura/Tratamento: ${hasPair}`);
  console.log(`  Bônus Ranking Vetorial: ${vectorRankBonus.toFixed(2)} (posição ${vectorRank ?? "N/A"})`);
  console.log(`  Bônus Ranking Lexical: ${lexicalRankBonus.toFixed(2)} (posição ${lexicalRank ?? "N/A"})`);
  console.log(`  Pontuação Total: ${totalScore.toFixed(2)}`);
  if (hit.lexicalSignals) {
    console.log(`  Sinais Lexical: Tokens=${hit.lexicalSignals.tokens.join(", ")}, Culturas=${hit.lexicalSignals.cultureMatches.join(", ")}, Tratamentos=${hit.lexicalSignals.treatmentMatches.join(", ")}, Par=${hit.lexicalSignals.hasCultureTreatmentPair}`);
  }
}

async function main() {
  console.log("=== Demonstração do Sistema Híbrido de Busca no Catálogo ===\n");

  // Itens de exemplo
  const items = [
    buildItem(1, "Fungicida para Uva", "Protege videiras contra fungos", ["uva", "fungicida"]),
    buildItem(2, "Pesticida Genérico", "Controle de pragas gerais", ["pesticida"]),
    buildItem(3, "Herbicida para Soja", "Elimina ervas daninhas em plantações de soja", ["soja", "herbicida"]),
    buildItem(4, "Inseticida Orgânico", "Produto biológico para insetos", ["inseticida", "biologico"]),
    buildItem(5, "Fertilizante Foliar", "Nutrientes para plantas", ["fertilizante"]),
  ];

  const query = "fungicida para uva";

  console.log(`Consulta: "${query}"\n`);

  // Simular resultados vetoriais (distâncias hipotéticas)
  const vectorHits: CatalogHybridHit[] = [
    { item: items[0], source: "file", score: -0.1 }, // Muito próximo semanticamente
    { item: items[2], source: "file", score: 0.3 },  // Médio
    { item: items[4], source: "file", score: 0.8 },  // Distante
  ];

  // Calcular resultados lexicais
  const lexicalHits: CatalogHybridHit[] = items.map(item => {
    const lexicalScore = scoreCatalogItemLexical(query, item);
    return {
      item,
      source: "lexical" as const,
      lexicalScore: lexicalScore?.score,
      lexicalSignals: lexicalScore?.signals,
    };
  }).filter(hit => hit.lexicalScore !== undefined);

  console.log("Resultados Vetoriais:");
  vectorHits.forEach((hit, index) => logItemScore(hit, index));

  console.log("\nResultados Lexicais:");
  lexicalHits.forEach((hit, index) => logItemScore(hit, undefined, index));

  // Mesclar com enhanced=true
  const merged = mergeCatalogResults(vectorHits, lexicalHits, 5, { enhanced: true });

  console.log("\n=== Resultados Combinados (Híbridos) ===");
  merged.forEach(hit => {
    // Para logging, precisamos recalcular ranks
    const vectorRank = vectorHits.findIndex(v => v.item.id === hit.item.id);
    const lexicalRank = lexicalHits.findIndex(l => l.item.id === hit.item.id);
    logItemScore(hit, vectorRank >= 0 ? vectorRank : undefined, lexicalRank >= 0 ? lexicalRank : undefined);
  });

  console.log("\nOrdem Final:", merged.map(hit => hit.item.id));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}