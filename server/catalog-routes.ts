import type { Express, NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { catalogItemStatusValues } from "@shared/schema";
import { storage } from "./storage";
import {
  allowedCatalogFileMimeTypes,
  deleteCatalogBlob,
  getCatalogBlobMaxSize,
  getCatalogBlobToken,
  uploadCatalogFileToBlob,
  validateCatalogFile,
} from "./catalog-file-storage";
import { extractTextPreview } from "./catalog-file-preview";

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

const catalogFileIdSchema = z.object({
  fileId: z.coerce.number().int().positive(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getCatalogBlobMaxSize(),
  },
});

function runUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        const maxMb = (getCatalogBlobMaxSize() / (1024 * 1024)).toFixed(1);
        return res.status(400).json({ error: `Arquivo excede o limite de ${maxMb}MB.` });
      }

      return res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao processar upload",
      });
    }

    next();
  });
}

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

  router.post("/:id/files", runUploadMiddleware, async (req, res) => {
    try {
      const idResult = catalogIdSchema.safeParse(req.params);
      if (!idResult.success) {
        return handleValidationError(res, idResult.error);
      }

      const item = await storage.getCatalogItemById(idResult.data.id);
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado" });
      }

      const validation = validateCatalogFile(req.file);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.message });
      }

      let token: string;
      try {
        token = getCatalogBlobToken();
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }

      const uploadResult = await uploadCatalogFileToBlob({
        itemId: item.id,
        file: req.file!,
        token,
      });

      const created = await storage.createCatalogFile({
        catalogItemId: item.id,
        originalName: req.file!.originalname,
        blobPath: uploadResult.blobPath,
        blobUrl: uploadResult.blobUrl,
        mimeType: req.file!.mimetype || "application/octet-stream",
        sizeBytes: uploadResult.size,
        textPreview: await extractTextPreview(req.file!),
      });

      return res.status(201).json({ file: created });
    } catch (error) {
      console.error("[CATALOG] Erro ao fazer upload de arquivo:", error);
      return res.status(500).json({ error: "Erro ao enviar arquivo" });
    }
  });

  router.get("/:id/files", async (req, res) => {
    try {
      const idResult = catalogIdSchema.safeParse(req.params);
      if (!idResult.success) {
        return handleValidationError(res, idResult.error);
      }

      const item = await storage.getCatalogItemById(idResult.data.id);
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado" });
      }

      const files = await storage.listCatalogFiles(item.id);

      return res.json({
        files,
        limits: {
          maxSizeBytes: getCatalogBlobMaxSize(),
          allowedMimeTypes: Array.from(allowedCatalogFileMimeTypes),
        },
      });
    } catch (error) {
      console.error("[CATALOG] Erro ao listar arquivos:", error);
      return res.status(500).json({ error: "Erro ao listar arquivos" });
    }
  });

  router.delete("/files/:fileId", async (req, res) => {
    try {
      const parsed = catalogFileIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const file = await storage.getCatalogFileById(parsed.data.fileId);
      if (!file) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      let token: string;
      try {
        token = getCatalogBlobToken();
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }

      await deleteCatalogBlob(file.blobPath || file.blobUrl, token);
      await storage.deleteCatalogFile(file.id);

      return res.json({ deleted: true, file });
    } catch (error) {
      console.error("[CATALOG] Erro ao remover arquivo:", error);
      return res.status(500).json({ error: "Erro ao remover arquivo" });
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
