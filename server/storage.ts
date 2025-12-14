import {
  users,
  faqs,
  faqEmbeddings,
  catalogItems,
  catalogFiles,
  catalogItemEmbeddings,
  systemInstructions,
  type User,
  type InsertUser,
  type Faq,
  type InsertFaq,
  type InsertFaqEmbedding,
  type CatalogItem,
  type CatalogItemInput,
  type InsertCatalogItemEmbedding,
  type CatalogFile,
  type InsertCatalogFile,
  type SystemInstruction,
  type InstructionScope,
  type InsertSystemInstruction,
} from "@shared/schema";
import { db } from "./db";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { extractSearchTokens, normalizeText } from "./text-utils";
import { generateCatalogEmbedding, embeddingsEnabled } from "./embeddings";
import { buildCatalogFileEmbeddingChunkContent, buildCatalogItemEmbeddingContent, buildFocusedSnippet, buildSnippet } from "./catalog-embedding-utils";
import { clampCatalogLimit, mapLexicalResults, mergeCatalogResults, type CatalogHybridHit, type CatalogHybridSearchResult, type CatalogSearchSource } from "./catalog-hybrid";
import { clampFaqLimit, mapFaqLexicalResults, mergeFaqResults, type FaqHybridHit, type FaqHybridSearchResult } from "./faq-hybrid";
import { buildFaqEmbeddingContent, buildFaqSnippet } from "./faq-embedding-utils";
import { scoreCatalogItemLexical } from "./catalog-lexical-ranker";
import { chunkTextByChars, parseOptionalPositiveInt } from "./text-chunking";

let faqNormalizationEnsured = false;

const ACCENT_FROM = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç";
const ACCENT_TO = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc";

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

function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function buildCatalogSearchCondition(query: string) {
  const tokens = extractSearchTokens(query);
  const normalizedQuery = normalizeText(query);
  const terms = tokens.length > 0
    ? tokens
    : normalizedQuery
      ? [normalizedQuery]
      : [];

  const tagsText = sql<string>`array_to_string(${catalogItems.tags}, ' ')`;
  const searchableFields = [
    sql`lower(translate(${catalogItems.name}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.description}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.category}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.manufacturer}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${tagsText}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
  ];

  const clauses = terms
    .map((term) => {
      const likePattern = `%${term}%`;
      return or(...searchableFields.map((field) => ilike(field, likePattern)));
    })
    .filter(Boolean) as SQL[];

  if (clauses.length === 0) {
    return sql`true`;
  }

  return or(...clauses);
}

function buildCatalogSearchRank(query: string): SQL<number> {
  const tokens = extractSearchTokens(query);
  const normalizedQuery = normalizeText(query);
  const terms = tokens.length > 0
    ? tokens
    : normalizedQuery
      ? [normalizedQuery]
      : [];

  if (terms.length === 0) {
    return sql<number>`0`;
  }

  const tagsText = sql<string>`array_to_string(${catalogItems.tags}, ' ')`;
  const searchableFields = [
    sql`lower(translate(${catalogItems.name}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.description}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.category}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${catalogItems.manufacturer}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
    sql`lower(translate(${tagsText}, ${ACCENT_FROM}, ${ACCENT_TO}))`,
  ];

  const termScores = terms.map((term) => {
    const likePattern = `%${term}%`;
    const termMatch = or(...searchableFields.map((field) => ilike(field, likePattern)));
    return sql<number>`CASE WHEN ${termMatch} THEN 1 ELSE 0 END`;
  });

  return sql<number>`(${sql.join(termScores, sql` + `)})`;
}

function buildVectorParam(embedding: number[]) {
  const literal = `[${embedding.join(",")}]`;
  return sql`${literal}::vector`;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  searchFaqs(query: string, limit: number, options?: { queryContext?: string }): Promise<Faq[]>;
  searchCatalog(query: string, limit: number): Promise<CatalogItem[]>;
  searchCatalogHybrid(query: string, limit: number, options?: { queryContext?: string }): Promise<CatalogHybridSearchResult>;
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

function combineQueryWithContext(query: string, context?: string, maxLength = 1200): string {
  const combined = [query, context?.trim()].filter(Boolean).join(" ").trim();
  if (!combined) return query;
  return combined.length > maxLength ? combined.slice(0, maxLength) : combined;
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

  async searchFaqs(query: string, limit: number, options?: { queryContext?: string }): Promise<Faq[]> {
    const hybridEnabled = process.env.FAQ_HYBRID_ENABLED !== "false";
    if (!hybridEnabled) {
      const effectiveQuery = combineQueryWithContext(query, options?.queryContext);
      return this.searchFaqsLexical(effectiveQuery, limit, options?.queryContext);
    }

    const hybridSearch = await this.searchFaqsHybrid(query, limit, options);
    return hybridSearch.results.map((hit) => hit.item);
  }

  private async searchFaqsLexical(effectiveQuery: string, limit: number, queryContext?: string): Promise<Faq[]> {
    await ensureFaqQuestionNormalization();

    const normalizedQuery = normalizeText(effectiveQuery);
    const tokens = extractSearchTokens(effectiveQuery);

    const contextPreview = queryContext?.replace(/\s+/g, " ").trim();
    if (contextPreview) {
      console.log(`[DB] searchFaqs :: queryContext => ${contextPreview.slice(0, 240)}`);
    }

    console.log("[DB] searchFaqs :: tokens =>", tokens.length > 0 ? tokens : "nenhum (fallback)" );

    if (tokens.length === 0) {
      const fallbackPattern = normalizedQuery ? `%${normalizedQuery}%` : `%${effectiveQuery}%`;
      return db
        .select()
        .from(faqs)
        .where(
          or(
            ilike(faqs.questionNormalized, fallbackPattern),
            ilike(faqs.answer, fallbackPattern),
          ),
        )
        .limit(limit);
    }

    const tokenConditions = tokens.map((token) =>
      or(
        ilike(faqs.questionNormalized, `%${token}%`),
        ilike(faqs.answer, `%${token}%`),
      ),
    );

    return db
      .select()
      .from(faqs)
      .where(or(...tokenConditions))
      .limit(limit);
  }

  async searchFaqsHybrid(query: string, limit: number, options?: { queryContext?: string }): Promise<FaqHybridSearchResult> {
    const finalLimit = clampFaqLimit(limit);
    const startedAt = Date.now();

    const effectiveQuery = combineQueryWithContext(query, options?.queryContext);

    const contextPreview = options?.queryContext?.replace(/\s+/g, " ").trim();
    if (contextPreview) {
      console.log(`[RAG] searchFaqsHybrid :: queryContext => ${contextPreview.slice(0, 240)}`);
    }
    if (effectiveQuery !== query) {
      console.log(`[RAG] searchFaqsHybrid :: query+context aplicado => ${effectiveQuery.slice(0, 240)}`);
    }

    const lexicalStartedAt = Date.now();
    const lexicalResults = await this.searchFaqsLexical(effectiveQuery, finalLimit, options?.queryContext);
    const lexicalMs = Date.now() - lexicalStartedAt;

    const lexicalHits = mapFaqLexicalResults(lexicalResults, effectiveQuery);

    let vectorResults: FaqHybridHit[] = [];
    let vectorMs = 0;
    let embeddingUsed = false;
    let fallbackReason: string | undefined;

    const embedding = await generateCatalogEmbedding(effectiveQuery);
    if (embedding && embedding.length > 0) {
      embeddingUsed = true;
      const vectorStartedAt = Date.now();
      const vectorQuery = await this.searchFaqVector(embedding, effectiveQuery, finalLimit);
      vectorMs = Date.now() - vectorStartedAt;
      vectorResults = vectorQuery.results;

      if (vectorQuery.error) {
        fallbackReason = "vector-query-error";
      }
    } else {
      fallbackReason = embeddingsEnabled() ? "embedding-generation-failed" : "embedding-disabled";
    }

    const mergeStartedAt = Date.now();
    const results = mergeFaqResults(vectorResults, lexicalHits, finalLimit);
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

  async searchCatalog(query: string, limit: number): Promise<CatalogItem[]> {
    const searchCondition = buildCatalogSearchCondition(query);
    const searchRank = buildCatalogSearchRank(query);

    return db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.status, "ativo"),
          searchCondition
        )
      )
      .orderBy(desc(searchRank), desc(catalogItems.createdAt))
      .limit(limit);
  }

  private async searchFaqVector(queryEmbedding: number[], query: string, limit: number): Promise<{ results: FaqHybridHit[]; error?: string }> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return { results: [] };
    }

    const embeddingParam = buildVectorParam(queryEmbedding);
    const distance = sql<number>`faq_embeddings.embedding <#> ${embeddingParam}`;

    const threshold = Number(process.env.FAQ_VECTOR_THRESHOLD ?? -0.5);
    const whereClauses: SQL[] = [];
    if (Number.isFinite(threshold)) {
      whereClauses.push(sql`${distance} <= ${threshold}`);
      console.log(`[VECTOR] FAQ threshold aplicado: score <= ${threshold}`);
    }

    try {
      const rows = await db
        .select({
          faq: faqs,
          content: faqEmbeddings.content,
          score: distance,
        })
        .from(faqEmbeddings)
        .innerJoin(faqs, eq(faqEmbeddings.faqId, faqs.id))
        .where(whereClauses.length > 0 ? and(...whereClauses) : sql`true`)
        .orderBy(distance)
        .limit(limit);

      const results = rows.map((row) => ({
        item: row.faq,
        source: "embedding" as const,
        score: row.score,
        snippet: buildFaqSnippet(row.content),
      }));

      if (results.length > 0) {
        const scores = results.map((r) => r.score?.toFixed(4) ?? "N/A").join(", ");
        console.log(`[VECTOR] FAQ scores filtrados (${results.length}): ${scores}`);
      }

      return { results };
    } catch (error) {
      console.warn("[DB] Falha na busca vetorial de FAQs:", error);
      return { results: [], error: error instanceof Error ? error.message : "unknown" };
    }
  }

  private async searchCatalogVector(queryEmbedding: number[], query: string, limit: number): Promise<{ results: CatalogHybridHit[]; error?: string }> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return { results: [] };
    }

    const candidateMultiplier = Number(process.env.CATALOG_VECTOR_CANDIDATE_MULTIPLIER ?? 6);
    const candidateMax = Number(process.env.CATALOG_VECTOR_CANDIDATE_MAX ?? 200);
    const queryLimit = Math.min(
      Number.isFinite(candidateMax) ? candidateMax : 200,
      limit * (Number.isFinite(candidateMultiplier) && candidateMultiplier > 0 ? candidateMultiplier : 6),
    );

    const chunksPerItem = parseOptionalPositiveInt(process.env.CATALOG_VECTOR_CHUNKS_PER_ITEM) ?? 1;
    const combinedSnippetMaxChars = parseOptionalPositiveInt(process.env.CATALOG_VECTOR_SNIPPET_MAX_CHARS) ?? 800;

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
        .limit(queryLimit);

      type AggregatedHit = {
        hit: CatalogHybridHit;
        snippets: string[];
        completed: boolean;
      };

      const deduped = new Map<number, AggregatedHit>();
      let completedItems = 0;

      for (const row of rows) {
        const itemId = row.item.id;
        const existing = deduped.get(itemId);
        const candidateSnippet = buildFocusedSnippet(row.content, query);

        if (existing) {
          if (existing.snippets.length >= chunksPerItem) {
            continue;
          }
          if (candidateSnippet && !existing.snippets.includes(candidateSnippet)) {
            existing.snippets.push(candidateSnippet);
            existing.hit.snippet = existing.snippets.join(" … ");
            if (existing.hit.snippet.length > combinedSnippetMaxChars) {
              existing.hit.snippet = `${existing.hit.snippet.slice(0, Math.max(0, combinedSnippetMaxChars - 1))}…`;
            }
          }

          if (!existing.completed && existing.snippets.length >= chunksPerItem) {
            existing.completed = true;
            completedItems += 1;
          }
        } else {
          if (deduped.size >= limit) {
            continue;
          }

          const hit: CatalogHybridHit = {
            item: row.item,
            source: row.source as CatalogSearchSource,
            score: row.score,
            snippet: candidateSnippet,
          };

          deduped.set(itemId, {
            hit,
            snippets: candidateSnippet ? [candidateSnippet] : [],
            completed: false,
          });

          if (chunksPerItem <= 1) {
            const created = deduped.get(itemId);
            if (created) {
              created.completed = true;
            }
            completedItems += 1;
          }
        }

        if (deduped.size >= limit && completedItems >= limit) {
          break;
        }
      }

      const results = Array.from(deduped.values()).map((entry) => entry.hit);

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

  async searchCatalogHybrid(query: string, limit: number, options?: { queryContext?: string }): Promise<CatalogHybridSearchResult> {
    const finalLimit = clampCatalogLimit(limit);
    const startedAt = Date.now();

    const effectiveQuery = query;

    const enhanced = process.env.HYBRID_SEARCH_ENHANCED === "true";
    const lexicalCandidateMultiplier = Number(process.env.CATALOG_LEXICAL_CANDIDATE_MULTIPLIER ?? 6);
    const lexicalCandidateMax = Number(process.env.CATALOG_LEXICAL_CANDIDATE_MAX ?? 200);
    const lexicalCandidateLimit = enhanced
      ? Math.min(
        Number.isFinite(lexicalCandidateMax) ? lexicalCandidateMax : 200,
        finalLimit * (Number.isFinite(lexicalCandidateMultiplier) && lexicalCandidateMultiplier > 0 ? lexicalCandidateMultiplier : 6),
      )
      : finalLimit;

    const lexicalStartedAt = Date.now();
    const lexicalResults = await this.searchCatalog(effectiveQuery, Math.max(finalLimit, lexicalCandidateLimit));
    const lexicalMs = Date.now() - lexicalStartedAt;

    const lexicalHits = mapLexicalResults(lexicalResults, effectiveQuery);

    let vectorResults: CatalogHybridHit[] = [];
    let vectorMs = 0;
    let embeddingUsed = false;
    let fallbackReason: string | undefined;

    const embedding = await generateCatalogEmbedding(effectiveQuery);
    if (embedding && embedding.length > 0) {
      embeddingUsed = true;
      const vectorStartedAt = Date.now();
      const vectorQuery = await this.searchCatalogVector(embedding, effectiveQuery, finalLimit);
      vectorMs = Date.now() - vectorStartedAt;
      vectorResults = vectorQuery.results;

      if (enhanced) {
        vectorResults = vectorResults.map((hit) => {
          if (typeof hit.lexicalScore === "number") return hit;
          const lexical = scoreCatalogItemLexical(effectiveQuery, hit.item);
          return {
            ...hit,
            lexicalScore: lexical?.score,
            lexicalSignals: lexical?.signals,
          };
        });
      }

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

    // Auto-generate item embedding
    this.generateItemEmbedding(created).catch((error) => {
      console.warn(`[DB] Falha ao gerar embedding do novo item ${created.id}:`, error);
    });

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

    // Auto-generate embeddings for new items (async, non-blocking)
    for (const item of created) {
      this.generateItemEmbedding(item).catch((error) => {
        console.warn(`[DB] Falha ao gerar embedding bulk item ${item.id}:`, error);
      });
    }

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
      // Delete old embeddings (files + item)
      await this.removeItemEmbeddings(updated.id);

      // Auto-regenerate item embedding
      this.generateItemEmbedding(updated).catch((error) => {
        console.warn(`[DB] Falha ao regenerar embedding item ${updated.id}:`, error);
      });

      if (embeddingsEnabled()) {
        const [file] = await db
          .select()
          .from(catalogFiles)
          .where(eq(catalogFiles.catalogItemId, updated.id))
          .orderBy(desc(catalogFiles.createdAt))
          .limit(1);

        if (file && file.textPreview) {
          this.refreshFileEmbedding(file, updated).catch((error) => {
            console.warn(`[DB] Falha ao regenerar embeddings de arquivos do item ${updated.id}:`, error);
          });
        }
      }
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

    this.generateFaqEmbedding(faq).catch((error) => {
      console.warn(`[DB] Falha ao gerar embedding da nova FAQ ${faq.id}:`, error);
    });

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
    const file = await this.getCatalogFileById(id);
    if (!file) return undefined;

    const baseMatch = and(
      eq(catalogItemEmbeddings.catalogItemId, file.catalogItemId),
      eq(catalogItemEmbeddings.source, "file"),
      ilike(
        catalogItemEmbeddings.content,
        `%anexo ${escapeLikePattern(file.originalName)}.%`,
      ),
    );

    return await db.transaction(async (tx) => {
      await tx
        .delete(catalogItemEmbeddings)
        .where(
          and(
            eq(catalogItemEmbeddings.catalogItemId, file.catalogItemId),
            eq(catalogItemEmbeddings.source, "file"),
            or(
              eq(catalogItemEmbeddings.catalogFileId, file.id),
              and(isNull(catalogItemEmbeddings.catalogFileId), baseMatch),
            ),
          ),
        );

      const [deleted] = await tx
        .delete(catalogFiles)
        .where(eq(catalogFiles.id, id))
        .returning();

      return deleted;
    });
  }

  async listInstructions(params?: { scopes?: InstructionScope[] }): Promise<SystemInstruction[]> {
    const scopes = params?.scopes?.filter(Boolean) ?? [];

    const baseQuery = db
      .select()
      .from(systemInstructions)
      .orderBy(
        asc(systemInstructions.scope),
        asc(systemInstructions.orderIndex),
        asc(systemInstructions.title)
      );

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

  private async generateFaqEmbedding(faq: Faq): Promise<void> {
    if (!embeddingsEnabled()) return;

    const content = buildFaqEmbeddingContent(faq);
    if (!content) return;

    const embedding = await generateCatalogEmbedding(content);
    if (!embedding || embedding.length === 0) return;

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

    const chunkSizeChars = Number(process.env.CATALOG_FILE_EMBED_CHUNK_SIZE_CHARS ?? 1800);
    const overlapChars = Number(process.env.CATALOG_FILE_EMBED_CHUNK_OVERLAP_CHARS ?? 200);
    const maxChunks = Number(process.env.CATALOG_FILE_EMBED_MAX_CHUNKS);

    const files = await db
      .select()
      .from(catalogFiles)
      .where(eq(catalogFiles.catalogItemId, file.catalogItemId))
      .orderBy(desc(catalogFiles.createdAt));

    const parentItem = item ?? await this.getCatalogItemById(file.catalogItemId);

    const values: InsertCatalogItemEmbedding[] = [];

    for (const candidate of files) {
      if (!candidate.textPreview) continue;
      const chunks = chunkTextByChars(candidate.textPreview, {
        chunkSizeChars,
        overlapChars,
        maxChunks: Number.isFinite(maxChunks) ? maxChunks : undefined,
      });

      for (let index = 0; index < chunks.length; index += 1) {
        const content = buildCatalogFileEmbeddingChunkContent(candidate, chunks[index], parentItem ?? undefined);
        if (!content) continue;

        const embedding = await generateCatalogEmbedding(content);
        if (!embedding || embedding.length === 0) continue;

        values.push({
          catalogItemId: candidate.catalogItemId,
          catalogFileId: candidate.id,
          source: "file",
          chunkIndex: index,
          content,
          embedding,
        });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(catalogItemEmbeddings)
        .where(
          and(
            eq(catalogItemEmbeddings.catalogItemId, file.catalogItemId),
            eq(catalogItemEmbeddings.source, "file"),
          ),
        );

      if (values.length > 0) {
        await tx.insert(catalogItemEmbeddings).values(values);
      }
    });
  }

  private async generateItemEmbedding(item: CatalogItem): Promise<void> {
    if (!embeddingsEnabled()) return;

    const content = buildCatalogItemEmbeddingContent(item);
    const embedding = await generateCatalogEmbedding(content);
    if (!embedding || embedding.length === 0) return;

    await db.transaction(async (tx) => {
      // Delete old item embeddings
      await tx
        .delete(catalogItemEmbeddings)
        .where(
          and(
            eq(catalogItemEmbeddings.catalogItemId, item.id),
            eq(catalogItemEmbeddings.source, "item"),
          ),
        );

      // Insert new
      await tx.insert(catalogItemEmbeddings).values({
        catalogItemId: item.id,
        source: "item",
        chunkIndex: 0,
        content,
        embedding,
      });
    });
  }
}

export const storage = new DatabaseStorage();
