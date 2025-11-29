import {
  users,
  faqs,
  catalogItems,
  catalogFiles,
  catalogItemEmbeddings,
  type User,
  type InsertUser,
  type Faq,
  type InsertFaq,
  type CatalogItem,
  type CatalogItemInput,
  type CatalogFile,
  type InsertCatalogFile,
} from "@shared/schema";
import { db } from "./db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { extractSearchTokens, normalizeText } from "./text-utils";
import { generateCatalogEmbedding, embeddingsEnabled } from "./embeddings";
import { buildCatalogFileEmbeddingContent, buildCatalogItemEmbeddingContent, buildSnippet } from "./catalog-embedding-utils";
import { clampCatalogLimit, mapLexicalResults, mergeCatalogResults, type CatalogHybridHit, type CatalogHybridSearchResult, type CatalogSearchSource } from "./catalog-hybrid";

let faqNormalizationEnsured = false;

async function ensureFaqQuestionNormalization() {
  if (faqNormalizationEnsured) return;

  const rows = await db
    .select({ id: faqs.id, question: faqs.question, questionNormalized: faqs.questionNormalized })
    .from(faqs);

  let updates = 0;
  for (const row of rows) {
    const normalized = normalizeText(row.question);
    if (row.questionNormalized === normalized) continue;

    await db
      .update(faqs)
      .set({ questionNormalized: normalized })
      .where(eq(faqs.id, row.id));
    updates += 1;
  }

  if (updates > 0) {
    console.log(`[DB] question_normalized atualizado para ${updates} FAQ${updates === 1 ? "" : "s"}.`);
  }

  faqNormalizationEnsured = true;
}

function buildCatalogSearchCondition(query: string) {
  const tokens = extractSearchTokens(query);
  const trimmed = query.trim();

  const buildFieldMatch = (term: string) => {
    const pattern = `%${term}%`;
    const tagsText = sql<string>`array_to_string(${catalogItems.tags}, ' ')`;

    return or(
      ilike(catalogItems.name, pattern),
      ilike(catalogItems.description, pattern),
      ilike(catalogItems.category, pattern),
      ilike(catalogItems.manufacturer, pattern),
      ilike(tagsText, pattern)
    );
  };

  if (tokens.length === 0) {
    return buildFieldMatch(trimmed || query);
  }

  if (tokens.length === 1) {
    return buildFieldMatch(tokens[0]);
  }

  return or(...tokens.map(buildFieldMatch));
}

function buildVectorParam(embedding: number[]) {
  const literal = `[${embedding.join(",")}]`;
  return sql`${literal}::vector`;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  searchFaqs(query: string, limit: number): Promise<Faq[]>;
  searchCatalog(query: string, limit: number): Promise<CatalogItem[]>;
  searchCatalogHybrid(query: string, limit: number): Promise<CatalogHybridSearchResult>;
  listCatalogItems(params: {
    search?: string;
    status?: CatalogItem["status"] | "all";
    limit?: number;
    offset?: number;
  }): Promise<CatalogItem[]>;
  getCatalogItemById(id: number): Promise<CatalogItem | undefined>;
  createCatalogItem(item: CatalogItemInput): Promise<CatalogItem>;
  updateCatalogItem(id: number, item: CatalogItemInput): Promise<CatalogItem | undefined>;
  deleteCatalogItem(id: number, options?: { hardDelete?: boolean }): Promise<{ deleted: boolean; archived: boolean; item?: CatalogItem }>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  getAllFaqs(): Promise<Faq[]>;
  listCatalogFiles(itemId: number): Promise<CatalogFile[]>;
  createCatalogFile(file: InsertCatalogFile): Promise<CatalogFile>;
  getCatalogFileById(id: number): Promise<CatalogFile | undefined>;
  deleteCatalogFile(id: number): Promise<CatalogFile | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async searchFaqs(query: string, limit: number): Promise<Faq[]> {
    await ensureFaqQuestionNormalization();

    const normalizedQuery = normalizeText(query);
    const tokens = extractSearchTokens(query);

    console.log("[DB] searchFaqs :: tokens =>", tokens.length > 0 ? tokens : "nenhum (fallback)" );

    if (tokens.length === 0) {
      const fallbackPattern = normalizedQuery ? `%${normalizedQuery}%` : `%${query}%`;
      return db
        .select()
        .from(faqs)
        .where(
        or(
          ilike(faqs.questionNormalized, fallbackPattern),
          ilike(faqs.answer, fallbackPattern)
        )
        )
        .limit(limit);
    }

    const tokenConditions = tokens.map((token) =>
      or(
        ilike(faqs.questionNormalized, `%${token}%`),
        ilike(faqs.answer, `%${token}%`)
      )
    );

    return db
      .select()
      .from(faqs)
      .where(or(...tokenConditions))
      .limit(limit);
  }

  async searchCatalog(query: string, limit: number): Promise<CatalogItem[]> {
    const searchCondition = buildCatalogSearchCondition(query);

    return db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.status, "ativo"),
          searchCondition
        )
      )
      .limit(limit);
  }

  private async searchCatalogVector(queryEmbedding: number[], limit: number): Promise<{ results: CatalogHybridHit[]; error?: string }> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return { results: [] };
    }

    const embeddingParam = buildVectorParam(queryEmbedding);
    const distance = sql<number>`catalog_item_embeddings.embedding <#> ${embeddingParam}`;

    try {
      const rows = await db
        .select({
          item: catalogItems,
          source: catalogItemEmbeddings.source,
          content: catalogItemEmbeddings.content,
          score: distance,
        })
        .from(catalogItemEmbeddings)
        .innerJoin(catalogItems, eq(catalogItemEmbeddings.catalogItemId, catalogItems.id))
        .where(eq(catalogItems.status, "ativo"))
        .orderBy(distance)
        .limit(limit);

      const results = rows.map((row) => ({
        item: row.item,
        source: row.source as CatalogSearchSource,
        score: row.score,
        snippet: buildSnippet(row.content),
      }));

      return { results };
    } catch (error) {
      console.warn("[DB] Falha na busca vetorial do catálogo:", error);
      return { results: [], error: error instanceof Error ? error.message : "unknown" };
    }
  }

  async searchCatalogHybrid(query: string, limit: number): Promise<CatalogHybridSearchResult> {
    const finalLimit = clampCatalogLimit(limit);
    const startedAt = Date.now();

    const lexicalStartedAt = Date.now();
    const lexicalResults = await this.searchCatalog(query, finalLimit);
    const lexicalMs = Date.now() - lexicalStartedAt;

    const lexicalHits = mapLexicalResults(lexicalResults);

    let vectorResults: CatalogHybridHit[] = [];
    let vectorMs = 0;
    let embeddingUsed = false;
    let fallbackReason: string | undefined;

    const embedding = await generateCatalogEmbedding(query);
    if (embedding && embedding.length > 0) {
      embeddingUsed = true;
      const vectorStartedAt = Date.now();
      const vectorQuery = await this.searchCatalogVector(embedding, finalLimit);
      vectorMs = Date.now() - vectorStartedAt;
      vectorResults = vectorQuery.results;

      if (vectorQuery.error) {
        fallbackReason = "vector-query-error";
      }
    } else {
      fallbackReason = embeddingsEnabled() ? "embedding-generation-failed" : "embedding-disabled";
    }

    const mergeStartedAt = Date.now();
    const results = mergeCatalogResults(vectorResults, lexicalHits, finalLimit);
    const mergeMs = Date.now() - mergeStartedAt;

    return {
      results,
      vectorCount: vectorResults.length,
      lexicalCount: lexicalHits.length,
      embeddingUsed,
      fallbackReason,
      timings: {
        vectorMs,
        lexicalMs,
        mergeMs,
        totalMs: Date.now() - startedAt,
      },
    };
  }

  async listCatalogItems(params: {
    search?: string;
    status?: CatalogItem["status"] | "all";
    limit?: number;
    offset?: number;
  }): Promise<CatalogItem[]> {
    const { search, status = "ativo", limit = 100, offset = 0 } = params;
    const filters = [];

    if (status && status !== "all") {
      filters.push(eq(catalogItems.status, status));
    }

    if (search && search.trim().length > 0) {
      filters.push(buildCatalogSearchCondition(search));
    }

    const baseQuery = db
      .select()
      .from(catalogItems);

    const filteredQuery = filters.length > 0
      ? baseQuery.where(and(...filters))
      : baseQuery;

    return filteredQuery
      .orderBy(desc(catalogItems.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getCatalogItemById(id: number): Promise<CatalogItem | undefined> {
    const [item] = await db
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.id, id));

    return item;
  }

  async createCatalogItem(item: CatalogItemInput): Promise<CatalogItem> {
    const [created] = await db
      .insert(catalogItems)
      .values({
        ...item,
        tags: item.tags ?? [],
      })
      .returning();

    this.triggerItemEmbedding(created);
    return created;
  }

  async updateCatalogItem(id: number, item: CatalogItemInput): Promise<CatalogItem | undefined> {
    const [updated] = await db
      .update(catalogItems)
      .set({
        ...item,
        tags: item.tags ?? [],
      })
      .where(eq(catalogItems.id, id))
      .returning();

    if (updated) {
      this.triggerItemEmbedding(updated);
    }

    return updated;
  }

  async deleteCatalogItem(id: number, options?: { hardDelete?: boolean }): Promise<{ deleted: boolean; archived: boolean; item?: CatalogItem }> {
    const hardDelete = options?.hardDelete ?? false;

    if (hardDelete) {
      const [deleted] = await db
        .delete(catalogItems)
        .where(eq(catalogItems.id, id))
        .returning();

      return {
        deleted: Boolean(deleted),
        archived: false,
        item: deleted,
      };
    }

    const [archived] = await db
      .update(catalogItems)
      .set({ status: "arquivado" })
      .where(eq(catalogItems.id, id))
      .returning();

    if (!archived) {
      return { deleted: false, archived: false };
    }

    return {
      deleted: false,
      archived: true,
      item: archived,
    };
  }

  async createFaq(insertFaq: InsertFaq): Promise<Faq> {
    const normalizedQuestion = normalizeText(insertFaq.question);
    const [faq] = await db
      .insert(faqs)
      .values({
        ...insertFaq,
        questionNormalized: normalizedQuestion,
      })
      .returning();
    return faq;
  }

  async getAllFaqs(): Promise<Faq[]> {
    return await db.select().from(faqs);
  }

  async listCatalogFiles(itemId: number): Promise<CatalogFile[]> {
    return db
      .select()
      .from(catalogFiles)
      .where(eq(catalogFiles.catalogItemId, itemId))
      .orderBy(desc(catalogFiles.createdAt));
  }

  async createCatalogFile(file: InsertCatalogFile): Promise<CatalogFile> {
    const [created] = await db
      .insert(catalogFiles)
      .values(file)
      .returning();

    const parentItem = await this.getCatalogItemById(created.catalogItemId);
    this.triggerFileEmbedding(created, parentItem || undefined);

    return created;
  }

  async getCatalogFileById(id: number): Promise<CatalogFile | undefined> {
    const [file] = await db
      .select()
      .from(catalogFiles)
      .where(eq(catalogFiles.id, id));

    return file;
  }

  async deleteCatalogFile(id: number): Promise<CatalogFile | undefined> {
    const [deleted] = await db
      .delete(catalogFiles)
      .where(eq(catalogFiles.id, id))
      .returning();

    return deleted;
  }

  private triggerItemEmbedding(item: CatalogItem | undefined) {
    if (!item || !embeddingsEnabled()) return;

    this.refreshItemEmbedding(item).catch((error) => {
      console.warn(`[DB] Não foi possível atualizar embedding do item ${item.id}:`, error);
    });
  }

  private triggerFileEmbedding(file: CatalogFile, item?: CatalogItem) {
    if (!embeddingsEnabled()) return;
    if (!file.textPreview) return;

    this.refreshFileEmbedding(file, item).catch((error) => {
      console.warn(`[DB] Não foi possível gerar embedding do arquivo ${file.id}:`, error);
    });
  }

  private async refreshItemEmbedding(item: CatalogItem): Promise<void> {
    const content = buildCatalogItemEmbeddingContent(item);
    if (!content) return;

    const embedding = await generateCatalogEmbedding(content);
    if (!embedding || embedding.length === 0) return;

    await db.transaction(async (tx) => {
      await tx
        .delete(catalogItemEmbeddings)
        .where(
          and(
            eq(catalogItemEmbeddings.catalogItemId, item.id),
            eq(catalogItemEmbeddings.source, "item"),
          ),
        );

      await tx.insert(catalogItemEmbeddings).values({
        catalogItemId: item.id,
        source: "item",
        content,
        embedding,
      });
    });
  }

  private async refreshFileEmbedding(file: CatalogFile, item?: CatalogItem): Promise<void> {
    if (!file.textPreview) return;

    const content = buildCatalogFileEmbeddingContent(file, item);
    if (!content) return;

    const embedding = await generateCatalogEmbedding(content);
    if (!embedding || embedding.length === 0) return;

    await db.transaction(async (tx) => {
      await tx
        .delete(catalogItemEmbeddings)
        .where(
          and(
            eq(catalogItemEmbeddings.catalogItemId, file.catalogItemId),
            eq(catalogItemEmbeddings.content, content),
          ),
        );

      await tx.insert(catalogItemEmbeddings).values({
        catalogItemId: file.catalogItemId,
        source: "file",
        content,
        embedding,
      });
    });
  }
}

export const storage = new DatabaseStorage();
