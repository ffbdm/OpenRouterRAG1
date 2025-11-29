import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, doublePrecision, pgEnum, integer, index, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const catalogEmbeddingDimensions = 1536;

export const catalogItemStatusValues = ["ativo", "arquivado"] as const;
export type CatalogItemStatus = (typeof catalogItemStatusValues)[number];
export const catalogItemStatusEnum = pgEnum("catalog_item_status", catalogItemStatusValues);
export const catalogItemStatusSchema = z.enum(catalogItemStatusValues);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  questionNormalized: text("question_normalized").notNull().default(""),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
  questionNormalized: true,
});

export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;

export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  manufacturer: text("manufacturer").notNull(),
  price: doublePrecision("price").notNull(),
  status: catalogItemStatusEnum("status").notNull().default("ativo"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCatalogItemSchema = createInsertSchema(catalogItems, {
  price: z.coerce.number().nonnegative(),
  tags: z.array(z.string()).default([]),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;
export type CatalogItem = typeof catalogItems.$inferSelect;
export const catalogItemInputSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(5),
  category: z.string().trim().min(2),
  manufacturer: z.string().trim().min(2),
  price: z.coerce.number().nonnegative(),
  status: catalogItemStatusSchema.default("ativo"),
  tags: z.array(z.string()).default([]),
});
export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export const updateCatalogItemSchema = catalogItemInputSchema.extend({
  id: z.number().int().positive(),
});
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;

export const catalogFiles = pgTable("catalog_files", {
  id: serial("id").primaryKey(),
  catalogItemId: integer("catalog_item_id")
    .notNull()
    .references(() => catalogItems.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  blobPath: text("blob_path").notNull(),
  blobUrl: text("blob_url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  textPreview: text("text_preview"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  catalogItemIndex: index("catalog_files_item_id_idx").on(table.catalogItemId),
}));

export const insertCatalogFileSchema = createInsertSchema(catalogFiles, {
  sizeBytes: z.coerce.number().int().nonnegative(),
  blobUrl: z.string().trim().url(),
  blobPath: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  textPreview: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCatalogFile = z.infer<typeof insertCatalogFileSchema>;
export type CatalogFile = typeof catalogFiles.$inferSelect;

export const catalogItemEmbeddingSources = ["item", "file", "note"] as const;
export type CatalogItemEmbeddingSource = (typeof catalogItemEmbeddingSources)[number];
export const catalogItemEmbeddingSourceEnum = pgEnum("catalog_item_embedding_source", catalogItemEmbeddingSources);

export const catalogItemEmbeddings = pgTable("catalog_item_embeddings", {
  id: serial("id").primaryKey(),
  catalogItemId: integer("catalog_item_id")
    .notNull()
    .references(() => catalogItems.id, { onDelete: "cascade" }),
  source: catalogItemEmbeddingSourceEnum("source").notNull().default("file"),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: catalogEmbeddingDimensions }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  catalogItemIndex: index("catalog_item_embeddings_item_id_idx").on(table.catalogItemId),
}));

export type CatalogItemEmbedding = typeof catalogItemEmbeddings.$inferSelect;
export type InsertCatalogItemEmbedding = typeof catalogItemEmbeddings.$inferInsert;

export const catalogItemsSeed: InsertCatalogItem[] = [
  {
    name: "Semente Premium Soja 64",
    description: "Cultivar precoce com alto teto produtivo e excelente emergência.",
    category: "Sementes",
    manufacturer: "AgroVale",
    price: 610.75,
    status: "ativo",
    tags: ["sementes", "soja"],
  },
  {
    name: "Inoculante NitroFix",
    description: "Alta concentração de Bradyrhizobium para máximo desempenho em soja.",
    category: "Inoculante",
    manufacturer: "BioRoots",
    price: 45,
    status: "ativo",
    tags: ["biológico", "fixação"],
  },
  {
    name: "Fertilizante Foliar MaxK",
    description: "Potássio de rápida absorção para estágios críticos de enchimento.",
    category: "Fertilizante",
    manufacturer: "Nutrimax",
    price: 155.9,
    status: "ativo",
    tags: ["fertilizante", "k"],
  },
  {
    name: "Controle de Pragas Sentinel",
    description: "Inseticida de amplo espectro com ação de choque e residual.",
    category: "Inseticida",
    manufacturer: "Protecta",
    price: 329.9,
    status: "arquivado",
    tags: ["inseticida", "lagarta"],
  },
];
