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
import { buildCatalogFileEmbeddingChunkContent, buildCatalogItemEmbeddingContent } from "../server/catalog-embedding-utils";
import { embeddingsEnabled, generateCatalogEmbedding, getEmbeddingSettings } from "../server/embeddings";
import { chunkTextByChars } from "../server/text-chunking";

async function seedEmbeddingsForItem(item: CatalogItem): Promise<number> {
  const values: InsertCatalogItemEmbedding[] = [];

  // Always generate item embedding
  const itemContent = buildCatalogItemEmbeddingContent(item);
  const itemEmbedding = await generateCatalogEmbedding(itemContent);
  if (itemEmbedding) {
    values.push({
      catalogItemId: item.id,
      source: "item",
      chunkIndex: 0,
      content: itemContent,
      embedding: itemEmbedding,
    });
  } else {
    console.warn(`[SEED] Falha ao gerar embedding do item ${item.id} (${item.name}).`);
  }

  const chunkSizeChars = Number(process.env.CATALOG_FILE_EMBED_CHUNK_SIZE_CHARS ?? 1800);
  const overlapChars = Number(process.env.CATALOG_FILE_EMBED_CHUNK_OVERLAP_CHARS ?? 200);
  const maxChunks = Number(process.env.CATALOG_FILE_EMBED_MAX_CHUNKS);

  // Generate file embeddings if any
  const files = await db
    .select()
    .from(catalogFiles)
    .where(eq(catalogFiles.catalogItemId, item.id));

  for (const file of files) {
    if (!file.textPreview) continue;

    const chunks = chunkTextByChars(file.textPreview, {
      chunkSizeChars,
      overlapChars,
      maxChunks: Number.isFinite(maxChunks) ? maxChunks : undefined,
    });

    for (let index = 0; index < chunks.length; index += 1) {
      const content = buildCatalogFileEmbeddingChunkContent(file, chunks[index], item);
      const embedding = await generateCatalogEmbedding(content);
      if (!embedding) {
        console.warn(`[SEED] Falha ao gerar embedding do arquivo ${file.id} (item ${item.id}, chunk ${index}).`);
        continue;
      }

      values.push({
        catalogItemId: item.id,
        catalogFileId: file.id,
        source: "file",
        chunkIndex: index,
        content,
        embedding,
      });
    }
  }

  // Delete old and insert new
  await db.transaction(async (tx) => {
    await tx
      .delete(catalogItemEmbeddings)
      .where(eq(catalogItemEmbeddings.catalogItemId, item.id));

    if (values.length > 0) {
      await tx.insert(catalogItemEmbeddings).values(values);
    }
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
