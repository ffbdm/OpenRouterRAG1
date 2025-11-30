import type { Express, NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { catalogPayloadSchema, statusFilterSchema } from "./catalog-validation";
import { storage, type IStorage } from "./storage";
import {
  allowedCatalogFileMimeTypes,
  deleteCatalogBlob,
  getCatalogBlobMaxSize,
  getCatalogBlobToken,
  uploadCatalogFileToBlob,
  validateCatalogFile,
} from "./catalog-file-storage";
import { extractTextPreview } from "./catalog-file-preview";
import { catalogImportLimits, catalogXlsxMimeType, generateCatalogTemplate, parseCatalogImport } from "./catalog-import";

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

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: catalogImportLimits.maxBytes,
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

function runImportUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  importUpload.single("file")(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        const maxMb = (catalogImportLimits.maxBytes / (1024 * 1024)).toFixed(1);
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

export function registerCatalogRoutes(app: Express, options?: { storage?: IStorage }) {
  const router = Router();
  const catalogStorage = options?.storage ?? storage;

  router.get("/import/template", async (_req, res) => {
    try {
      const buffer = generateCatalogTemplate();
      res.setHeader("Content-Type", catalogXlsxMimeType);
      res.setHeader("Content-Disposition", "attachment; filename=\"catalogo-template.xlsx\"");
      return res.send(buffer);
    } catch (error) {
      console.error("[CATALOG_IMPORT] Erro ao gerar template:", error);
      return res.status(500).json({ error: "Não foi possível gerar o template" });
    }
  });

  router.post("/import", runImportUploadMiddleware, async (req, res) => {
    const startedAt = Date.now();
    console.log("[CATALOG_IMPORT] start", {
      filename: req.file?.originalname,
      size: req.file?.size,
      mimetype: req.file?.mimetype,
    });

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    if (req.file.size <= 0) {
      return res.status(400).json({ error: "Arquivo está vazio" });
    }

    if (req.file.mimetype !== catalogXlsxMimeType || !req.file.originalname.toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ error: "Formato inválido. Envie um arquivo .xlsx" });
    }

    let parsed: ReturnType<typeof parseCatalogImport>;
    try {
      parsed = parseCatalogImport(req.file.buffer);
    } catch (error) {
      console.error("[CATALOG_IMPORT] Falha ao ler .xlsx:", error);
      return res.status(400).json({ error: "Não foi possível ler o arquivo .xlsx enviado" });
    }

    console.log("[CATALOG_IMPORT] parsed", {
      rows: parsed.rowCount,
      errors: parsed.errors.length,
    });

    if (parsed.errors.length > 0) {
      console.warn("[CATALOG_IMPORT] rowErrors", parsed.errors.slice(0, 5));
      return res.status(400).json({
        error: "Dados inválidos",
        errors: parsed.errors,
      });
    }

    try {
      const created = await catalogStorage.bulkInsertCatalogItems(parsed.items);
      const durationMs = Date.now() - startedAt;
      console.log("[CATALOG_IMPORT] created", {
        created: created.length,
        durationMs,
      });

      return res.json({
        created: created.length,
        durationMs,
        sampleIds: created.slice(0, 5).map((item) => item.id),
      });
    } catch (error) {
      console.error("[CATALOG_IMPORT] Erro ao importar planilha:", error);
      return res.status(500).json({ error: "Erro ao importar catálogo" });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const parsed = catalogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return handleValidationError(res, parsed.error);
      }

      const { search, status } = parsed.data;
      const items = await catalogStorage.listCatalogItems({
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

      const item = await catalogStorage.getCatalogItemById(parsed.data.id);
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

      const created = await catalogStorage.createCatalogItem(parsed.data);
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

      const item = await catalogStorage.getCatalogItemById(idResult.data.id);
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

      const created = await catalogStorage.createCatalogFile({
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

      const item = await catalogStorage.getCatalogItemById(idResult.data.id);
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado" });
      }

      const files = await catalogStorage.listCatalogFiles(item.id);

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

      const file = await catalogStorage.getCatalogFileById(parsed.data.fileId);
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
      await catalogStorage.deleteCatalogFile(file.id);

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

      const updated = await catalogStorage.updateCatalogItem(idResult.data.id, payloadResult.data);
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

      const result = await catalogStorage.deleteCatalogItem(parsed.data.id, { hardDelete });
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
