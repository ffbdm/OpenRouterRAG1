import type { Express } from "express";
import { Router } from "express";
import { z } from "zod";
import { instructionScopeValues, updateSystemInstructionSchema } from "@shared/schema";
import { storage } from "./storage";
import { normalizeScopeFilter } from "./instruction-utils";

const scopeQuerySchema = z.object({
  scope: z
    .preprocess((value) => normalizeScopeFilter(value), z.array(z.enum(instructionScopeValues)).optional())
    .optional(),
});

const slugParamSchema = z.object({
  slug: z.string().trim().min(2, "Slug inválido"),
});

export function registerInstructionRoutes(app: Express) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = scopeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Filtro inválido", details: parsed.error.flatten() });
    }

    try {
      const scopes = parsed.data.scope ?? [];
      const instructions = await storage.listInstructions({ scopes });
      return res.json({ instructions });
    } catch (error) {
      console.error("[INSTRUCTIONS] Erro ao listar instruções:", error);
      return res.status(500).json({ error: "Erro ao listar instruções" });
    }
  });

  router.get("/:slug", async (req, res) => {
    const parsed = slugParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: "Slug inválido", details: parsed.error.flatten() });
    }

    try {
      const instruction = await storage.getInstructionBySlug(parsed.data.slug);
      if (!instruction) {
        return res.status(404).json({ error: "Instrução não encontrada" });
      }

      return res.json({ instruction });
    } catch (error) {
      console.error("[INSTRUCTIONS] Erro ao buscar instrução:", error);
      return res.status(500).json({ error: "Erro ao recuperar instrução" });
    }
  });

  router.put("/:slug", async (req, res) => {
    const slugResult = slugParamSchema.safeParse(req.params);
    if (!slugResult.success) {
      return res.status(400).json({ error: "Slug inválido", details: slugResult.error.flatten() });
    }

    const payloadResult = updateSystemInstructionSchema.safeParse(req.body);
    if (!payloadResult.success) {
      return res.status(400).json({ error: "Conteúdo inválido", details: payloadResult.error.flatten() });
    }

    try {
      const updated = await storage.updateInstructionContent(slugResult.data.slug, payloadResult.data.content);
      if (!updated) {
        return res.status(404).json({ error: "Instrução não encontrada" });
      }

      console.log(`[INSTRUCTIONS] ${updated.slug} atualizado (${updated.scope})`);
      return res.json({ instruction: updated });
    } catch (error) {
      console.error("[INSTRUCTIONS] Erro ao atualizar instrução:", error);
      return res.status(500).json({ error: "Erro ao atualizar instrução" });
    }
  });

  app.use("/api/instructions", router);
}
