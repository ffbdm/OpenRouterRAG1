import "dotenv/config";

import { eq } from "drizzle-orm";

import {
  catalogFiles,
  catalogItemEmbeddings,
  catalogItems,
  type CatalogItem,
  type InsertCatalogItemEmbedding,
} from "@shared/schema";
import { db } from "../server/db";
import { buildCatalogFileEmbeddingContent, buildCatalogItemEmbeddingContent, chunkContent } from "../server/catalog-embedding-utils";
import { embeddingsEnabled, generateCatalogEmbedding, getEmbeddingSettings } from "../server/embeddings";

const FILE_CHUNK_SIZE = Number.isFinite(Number(process.env.EMBEDDING_FILE_CHUNK_SIZE))
  ? Number(process.env.EMBEDDING_FILE_CHUNK_SIZE)
  : 800;

async function seedEmbeddingsForItem(item: CatalogItem): Promise<number> {
  const values: InsertCatalogItemEmbedding[] = [];

  const itemContent = buildCatalogItemEmbeddingContent(item);
  const itemEmbedding = await generateCatalogEmbedding(itemContent);

  if (itemEmbedding) {
    values.push({
      catalogItemId: item.id,
      source: "item",
      content: itemContent,
      embedding: itemEmbedding,
    });
  } else {
    console.warn(`[SEED] Embedding não gerado para item ${item.id} (${item.name}).`);
  }

  const files = await db
    .select()
    .from(catalogFiles)
    .where(eq(catalogFiles.catalogItemId, item.id));

  for (const file of files) {
    if (!file.textPreview) continue;

    const content = buildCatalogFileEmbeddingContent(file, item);
    const chunks = chunkContent(content, FILE_CHUNK_SIZE);

    for (const chunk of chunks) {
      const embedding = await generateCatalogEmbedding(chunk);
      if (!embedding) {
        console.warn(`[SEED] Falha ao gerar embedding do arquivo ${file.id} (item ${item.id}).`);
        continue;
      }

      values.push({
        catalogItemId: item.id,
        source: "file",
        content: chunk,
        embedding,
      });
    }
  }

  if (values.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(catalogItemEmbeddings)
      .where(eq(catalogItemEmbeddings.catalogItemId, item.id));

    await tx.insert(catalogItemEmbeddings).values(values);
  });

  return values.length;
}

async function main() {
  if (!embeddingsEnabled()) {
    console.error("[SEED] OPENROUTER_API_KEY não configurada. Configure para gerar embeddings do catálogo.");
    process.exit(1);
  }

  const settings = getEmbeddingSettings();
  console.log(`[SEED] Iniciando seed de embeddings (modelo=${settings.model}, dims=${settings.dimensions})`);

  const items = await db.select().from(catalogItems);
  console.log(`[SEED] ${items.length} itens encontrados.`);

  let totalEmbeddings = 0;
  for (const item of items) {
    const count = await seedEmbeddingsForItem(item);
    totalEmbeddings += count;
    console.log(`[SEED] Item ${item.id} (${item.name}) → ${count} embeddings.`);
  }

  console.log(`[SEED] Concluído. Total de embeddings gravados: ${totalEmbeddings}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[SEED] Seed de embeddings falhou:", error);
    process.exit(1);
  });
