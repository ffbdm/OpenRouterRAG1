import "dotenv/config";

import { storage } from "../server/storage";
import { extractSearchTokens, normalizeText } from "../server/text-utils";
import { scoreCatalogItemLexical } from "../server/catalog-lexical-ranker";
import { buildSnippet } from "../server/catalog-embedding-utils";
import type { CatalogItem } from "../shared/schema";

type FieldName = "name" | "description" | "category" | "manufacturer" | "tags";

type TokenFieldMatch = {
  token: string;
  fields: Array<{ field: FieldName; snippet: string }>;
};

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("⚠️  Forneça a consulta. Exemplo: npx tsx scripts/debugCatalogSearch.ts \"pesticida para uva\"");
    process.exit(1);
  }

  const limit = Number(process.env.DEBUG_SEARCH_LIMIT ?? 10);
  const tokens = extractSearchTokens(query, { maxTokens: 8 });

  console.log(`🔍 Consulta: "${query}"`);
  console.log(`🧩 Tokens normalizados (${tokens.length}): ${tokens.join(", ") || "(nenhum)"}`);
  console.log("------------------------------------------------------------");

  const results = await storage.searchCatalog(query, limit);
  console.log(`searchCatalog retornou ${results.length} itens (limite=${limit}).\n`);

  results.forEach((item, index) => {
    logItemDetails(item, index, query, tokens);
  });

  process.exit(0);
}

function logItemDetails(item: CatalogItem, position: number, query: string, tokens: string[]) {
  console.log(`#${position + 1} — ${item.name} (id=${item.id})`);
  console.log(`   Categoria: ${item.category} | Fabricante: ${item.manufacturer}`);
  console.log(`   Tags: ${item.tags.join(", ") || "(sem tags)"}`);

  const tokenMatches = detectFieldMatches(item, tokens);
  if (tokenMatches.length === 0) {
    console.log("   ⚠️ Nenhum dos tokens normalizados aparece diretamente nas colunas (nome/descrição/categoria/fabricante/tags).");
    console.log("     → Resultado entrou porque o SQL usa OR entre tokens; revise texto completo abaixo.");
  } else {
    tokenMatches.forEach((match) => {
      const fields = match.fields.map((f) => `${f.field}: ${f.snippet}`).join(" | ");
      console.log(`   Token "${match.token}" encontrado em → ${fields}`);
    });
  }

  const lexical = scoreCatalogItemLexical(query, item);
  if (lexical) {
    console.log(
      `   Lexical score: ${lexical.score.toFixed(2)} | tokens usados: ${lexical.signals.matchedTokens.join(", ") || "(nenhum)"}`,
    );
    if (lexical.signals.hasCultureTreatmentPair) {
      console.log("     • Contém combinação cultura + tratamento (pair bonus)." );
    }
  } else {
    console.log("   Lexical score: (nenhum) — tokens não encontraram sinônimos relevantes.");
  }

  console.log(`   Descrição: ${buildSnippet(item.description)}`);
  console.log("------------------------------------------------------------\n");
}

function detectFieldMatches(item: CatalogItem, tokens: string[]): TokenFieldMatch[] {
  const fields: Record<FieldName, string[]> = {
    name: [item.name],
    description: [item.description],
    category: [item.category],
    manufacturer: [item.manufacturer],
    tags: item.tags ?? [],
  };

  const matches: TokenFieldMatch[] = [];

  tokens.forEach((token) => {
    const normalizedToken = token.toLowerCase();
    const fieldHits: Array<{ field: FieldName; snippet: string }> = [];

    (Object.entries(fields) as Array<[FieldName, string[]]>).forEach(([field, values]) => {
      values.forEach((value) => {
        if (!value) return;
        if (includesToken(value, normalizedToken)) {
          fieldHits.push({ field, snippet: highlightSnippet(value, normalizedToken) });
        }
      });
    });

    if (fieldHits.length > 0) {
      matches.push({ token: normalizedToken, fields: fieldHits });
    }
  });

  return matches;
}

function includesToken(value: string, token: string): boolean {
  if (!value) return false;
  const normalized = normalizeText(value);
  const boundaryPattern = new RegExp(`(?:^|\s)${escapeRegex(token)}(?:$|\s)`);
  return boundaryPattern.test(normalized);
}

function highlightSnippet(value: string, token: string): string {
  const normalized = normalizeText(value);
  const words = normalized.split(" ");
  let offset = 0;

  for (const word of words) {
    if (!word) {
      offset += 1;
      continue;
    }

    if (word === token) {
      const start = Math.max(0, offset - 20);
      const end = Math.min(normalized.length, offset + token.length + 20);
      const snippet = normalized.slice(start, end);
      return `…${snippet}…`;
    }

    offset += word.length + 1;
  }

  return buildSnippet(value, 80);
}

function escapeRegex(input: string): string {
  return input.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

main().catch((error) => {
  console.error("❌ Falha ao executar debug da busca:", error);
  process.exit(1);
});
