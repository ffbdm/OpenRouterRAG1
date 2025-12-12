import "dotenv/config";

import { eq } from "drizzle-orm";

import {
  faqs,
  faqEmbeddings,
  type Faq,
  type InsertFaqEmbedding,
} from "@shared/schema";
import { db } from "../server/db";
import { buildFaqEmbeddingContent } from "../server/faq-embedding-utils";
import { embeddingsEnabled, generateCatalogEmbedding, getEmbeddingSettings } from "../server/embeddings";

async function seedEmbeddingForFaq(faq: Faq): Promise<number> {
  const content = buildFaqEmbeddingContent(faq);
  const embedding = await generateCatalogEmbedding(content);
  if (!embedding) {
    console.warn(`[SEED_FAQ] Falha ao gerar embedding da FAQ ${faq.id}.`);
    return 0;
  }

  const value: InsertFaqEmbedding = {
    faqId: faq.id,
    content,
    embedding,
  };

  await db.transaction(async (tx) => {
    await tx
      .delete(faqEmbeddings)
      .where(eq(faqEmbeddings.faqId, faq.id));

    await tx.insert(faqEmbeddings).values(value);
  });

  return 1;
}

async function main() {
  if (!embeddingsEnabled()) {
    console.error("[SEED_FAQ] OPENROUTER_API_KEY não configurada. Configure para gerar embeddings das FAQs.");
    process.exit(1);
  }

  const settings = getEmbeddingSettings();
  console.log(`[SEED_FAQ] Iniciando seed de embeddings (modelo=${settings.model}, dims=${settings.dimensions})`);

  const allFaqs = await db.select().from(faqs);
  console.log(`[SEED_FAQ] ${allFaqs.length} FAQs encontradas.`);

  let totalEmbeddings = 0;
  for (const faq of allFaqs) {
    const count = await seedEmbeddingForFaq(faq);
    totalEmbeddings += count;
    console.log(`[SEED_FAQ] FAQ ${faq.id} → ${count} embedding.`);
  }

  console.log(`[SEED_FAQ] Concluído. Total de embeddings gravados: ${totalEmbeddings}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[SEED_FAQ] Seed de embeddings falhou:", error);
    process.exit(1);
  });

