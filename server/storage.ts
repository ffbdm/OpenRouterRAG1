import {
  users,
  faqs,
  catalogItems,
  type User,
  type InsertUser,
  type Faq,
  type InsertFaq,
  type CatalogItem,
  type CatalogItemInput,
} from "@shared/schema";
import { db } from "./db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { extractSearchTokens, normalizeText } from "./text-utils";

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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  searchFaqs(query: string, limit: number): Promise<Faq[]>;
  searchCatalog(query: string, limit: number): Promise<CatalogItem[]>;
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

  async updateCatalogItem(id: number, item: CatalogItemInput): Promise<CatalogItem | undefined> {
    const [updated] = await db
      .update(catalogItems)
      .set({
        ...item,
        tags: item.tags ?? [],
      })
      .where(eq(catalogItems.id, id))
      .returning();

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
}

export const storage = new DatabaseStorage();
