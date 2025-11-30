import {
  users,
  faqs,
  catalogItems,
  catalogFiles,
  catalogItemEmbeddings,
  systemInstructions,
  type User,
  type InsertUser,
  type Faq,
  type InsertFaq,
  type CatalogItem,
  type CatalogItemInput,
  type CatalogFile,
  type InsertCatalogFile,
  type SystemInstruction,
  type InstructionScope,
  type InsertSystemInstruction,
} from "@shared/schema";
import { db } from "./db";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { extractSearchTokens, normalizeText } from "./text-utils";
import { generateCatalogEmbedding, embeddingsEnabled } from "./embeddings";
import { buildCatalogFileEmbeddingContent, buildFocusedSnippet, buildSnippet } from "./catalog-embedding-utils";
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

  const buildFieldMatch = (term: string, options?: { partial?: boolean }) => {
    const tagsText = sql<string>`array_to_string(${catalogItems.tags}, ' ')`;

    if (options?.partial) {
      const likePattern = `%${term}%`;
      return or(
        ilike(catalogItems.name, likePattern),
        ilike(catalogItems.description, likePattern),
        ilike(catalogItems.category, likePattern),
        ilike(catalogItems.manufacturer, likePattern),
        ilike(tagsText, likePattern)
      );
    }

    const regex = buildWordBoundaryPattern(term);
    return or(
      sql`${catalogItems.name} ~* ${regex}`,
      sql`${catalogItems.description} ~* ${regex}`,
      sql`${catalogItems.category} ~* ${regex}`,
      sql`${catalogItems.manufacturer} ~* ${regex}`,
      sql`${tagsText} ~* ${regex}`,
    );
  };

  if (tokens.length === 0) {
    return buildFieldMatch(trimmed || query, { partial: true });
  }

  if (tokens.length === 1) {
    return buildFieldMatch(tokens[0]);
  }

  return or(...tokens.map((token) => buildFieldMatch(token)));
}

function buildWordBoundaryPattern(term: string): string {
  const normalized = term.trim();
  if (!normalized) return "";
  return `\\m${escapeRegex(normalized)}\\M`;
}

function escapeRegex(input: string): string {
  return input.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
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
  bulkInsertCatalogItems(items: CatalogItemInput[]): Promise<CatalogItem[]>;
  updateCatalogItem(id: number, item: CatalogItemInput): Promise<CatalogItem | undefined>;
  deleteCatalogItem(id: number, options?: { hardDelete?: boolean }): Promise<{ deleted: boolean; archived: boolean; item?: CatalogItem }>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  getAllFaqs(): Promise<Faq[]>;
  listCatalogFiles(itemId: number): Promise<CatalogFile[]>;
  createCatalogFile(file: InsertCatalogFile): Promise<CatalogFile>;
  getCatalogFileById(id: number): Promise<CatalogFile | undefined>;
  deleteCatalogFile(id: number): Promise<CatalogFile | undefined>;
  listInstructions(params?: { scopes?: InstructionScope[] }): Promise<SystemInstruction[]>;
  getInstructionBySlug(slug: string): Promise<SystemInstruction | undefined>;
  updateInstructionContent(slug: string, content: string): Promise<SystemInstruction | undefined>;
  createInstruction(instruction: InsertSystemInstruction): Promise<SystemInstruction>;
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

  private async searchCatalogVector(queryEmbedding: number[], query: string, limit: number): Promise<{ results: CatalogHybridHit[]; error?: string }> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return { results: [] };
    }

    const embeddingParam = buildVectorParam(queryEmbedding);
    const distance = sql<number>`catalog_item_embeddings.embedding <#> ${embeddingParam}`;

    // Novo: Threshold de similaridade (menor = melhor; ex: -0.3 = cos_sim ~0.3)
    const threshold = Number(process.env.CATALOG_VECTOR_THRESHOLD ?? -0.5);
    const whereClauses: SQL[] = [eq(catalogItems.status, "ativo")];
    if (Number.isFinite(threshold)) {
      whereClauses.push(sql`${distance} <= ${threshold}`);
      console.log(`[VECTOR] Threshold aplicado: score <= ${threshold}`);
    }

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
        .where(and(...whereClauses))
        .orderBy(distance)
        .limit(limit);

      const results = rows.map((row) => ({
        item: row.item,
        source: row.source as CatalogSearchSource,
        score: row.score,
        snippet: buildFocusedSnippet(row.content, query),
      }));

      if (results.length > 0) {
        const scores = results.map((r) => r.score?.toFixed(4) ?? 'N/A').join(', ');
        console.log(`[VECTOR] Scores filtrados (${results.length}): ${scores}`);
      }

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

    const lexicalHits = mapLexicalResults(lexicalResults, query);

    let vectorResults: CatalogHybridHit[] = [];
    let vectorMs = 0;
    let embeddingUsed = false;
    let fallbackReason: string | undefined;

    const embedding = await generateCatalogEmbedding(query);
    if (embedding && embedding.length > 0) {
      embeddingUsed = true;
      const vectorStartedAt = Date.now();
      const vectorQuery = await this.searchCatalogVector(embedding, query, finalLimit);
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

    return created;
  }

  async bulkInsertCatalogItems(items: CatalogItemInput[]): Promise<CatalogItem[]> {
    if (items.length === 0) return [];

    const chunkSize = 100;
    const created: CatalogItem[] = [];

    await db.transaction(async (tx) => {
      for (let index = 0; index < items.length; index += chunkSize) {
        const chunk = items
          .slice(index, index + chunkSize)
          .map((item) => ({
            ...item,
            tags: item.tags ?? [],
          }));

        const inserted = await tx
          .insert(catalogItems)
          .values(chunk)
          .returning();

        created.push(...inserted);
      }
    });

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
      this.removeItemEmbeddings(updated.id).catch((error) => {
        console.warn(`[DB] Não foi possível remover embeddings do item ${updated.id}:`, error);
      });
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

  async listInstructions(params?: { scopes?: InstructionScope[] }): Promise<SystemInstruction[]> {
    const scopes = params?.scopes?.filter(Boolean) ?? [];

    const baseQuery = db
      .select()
      .from(systemInstructions)
      .orderBy(asc(systemInstructions.scope), asc(systemInstructions.title));

    if (scopes.length === 0) {
      return baseQuery;
    }

    return baseQuery.where(inArray(systemInstructions.scope, scopes));
  }

  async getInstructionBySlug(slug: string): Promise<SystemInstruction | undefined> {
    const [instruction] = await db
      .select()
      .from(systemInstructions)
      .where(eq(systemInstructions.slug, slug))
      .limit(1);

    return instruction;
  }

  async updateInstructionContent(slug: string, content: string): Promise<SystemInstruction | undefined> {
    const [updated] = await db
      .update(systemInstructions)
      .set({ content, updatedAt: sql`now()` })
      .where(eq(systemInstructions.slug, slug))
      .returning();

    return updated;
  }

  async createInstruction(instruction: InsertSystemInstruction): Promise<SystemInstruction> {
    const [created] = await db
      .insert(systemInstructions)
      .values(instruction)
      .returning();

    return created;
  }

  private async removeItemEmbeddings(itemId: number): Promise<void> {
    await db
      .delete(catalogItemEmbeddings)
      .where(
        and(
          eq(catalogItemEmbeddings.catalogItemId, itemId),
          eq(catalogItemEmbeddings.source, "item"),
        ),
      );
  }

  private triggerFileEmbedding(file: CatalogFile, item?: CatalogItem) {
    if (!embeddingsEnabled()) return;
    if (!file.textPreview) return;

    this.refreshFileEmbedding(file, item).catch((error) => {
      console.warn(`[DB] Não foi possível gerar embedding do arquivo ${file.id}:`, error);
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
