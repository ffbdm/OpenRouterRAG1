import type { Express, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { catalogItemStatusValues } from "@shared/schema";
import { storage } from "./storage";

const statusFilterSchema = z.union([
  z.enum(catalogItemStatusValues),
  z.literal("all"),
]).optional();

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string()).default([]));

const catalogPayloadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item"),
  description: z.string().trim().min(5, "Descreva o item"),
  category: z.string().trim().min(2, "Informe a categoria"),
  manufacturer: z.string().trim().min(2, "Informe o fabricante"),
  price: z.coerce.number().nonnegative("Preço deve ser zero ou positivo"),
  status: z.enum(catalogItemStatusValues).default("ativo"),
  tags: tagsSchema,
});

const catalogQuerySchema = z.object({
  search: z.string().optional(),
  status: statusFilterSchema,
});

const catalogIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

function handleValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: "Dados inválidos",
    details: error.flatten(),
  });
}

export function registerCatalogRoutes(app: Express) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const parsed = catalogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const { search, status } = parsed.data;
      const items = await storage.listCatalogItems({
        search,
        status: status ?? "ativo",
      });

      return res.json({ items });
    } catch (error) {
      console.error("[CATALOG] Erro ao listar itens:", error);
      return res.status(500).json({ error: "Erro ao buscar catálogo" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const parsed = catalogIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const item = await storage.getCatalogItemById(parsed.data.id);
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado" });
      }

      return res.json({ item });
    } catch (error) {
      console.error("[CATALOG] Erro ao recuperar item:", error);
      return res.status(500).json({ error: "Erro ao buscar item" });
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    try {
      const parsed = catalogPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const created = await storage.createCatalogItem(parsed.data);
      return res.status(201).json({ item: created });
    } catch (error) {
      console.error("[CATALOG] Erro ao criar item:", error);
      return res.status(500).json({ error: "Erro ao criar item" });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const idResult = catalogIdSchema.safeParse(req.params);
      if (!idResult.success) {
        return handleValidationError(res, idResult.error);
      }

      const payloadResult = catalogPayloadSchema.safeParse(req.body);
      if (!payloadResult.success) {
        return handleValidationError(res, payloadResult.error);
      }

      const updated = await storage.updateCatalogItem(idResult.data.id, payloadResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Item não encontrado para atualizar" });
      }

      return res.json({ item: updated });
    } catch (error) {
      console.error("[CATALOG] Erro ao atualizar item:", error);
      return res.status(500).json({ error: "Erro ao atualizar item" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const parsed = catalogIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const hardDelete = typeof req.query.hard === "string"
        ? ["true", "1", "yes", "sim"].includes(req.query.hard.toLowerCase())
        : false;

      const result = await storage.deleteCatalogItem(parsed.data.id, { hardDelete });
      if (!result.item) {
        return res.status(404).json({ error: "Item não encontrado para exclusão" });
      }

      return res.json({
        archived: result.archived,
        deleted: result.deleted,
        item: result.item,
      });
    } catch (error) {
      console.error("[CATALOG] Erro ao remover item:", error);
      return res.status(500).json({ error: "Erro ao remover item" });
    }
  });

  app.use("/api/catalog", router);
}
