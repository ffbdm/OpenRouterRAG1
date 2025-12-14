import "dotenv/config";

import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { Express } from "express";
import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";

import { catalogFiles } from "@shared/schema";
import { db } from "../server/db";
import { extractTextPreview } from "../server/catalog-file-preview";

function getArgValue(prefix: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return undefined;
  const value = match.slice(prefix.length);
  return value.trim() ? value.trim() : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function buildMockFile(options: { buffer: Buffer; mimetype: string; originalname?: string }): Express.Multer.File {
  const { buffer, mimetype, originalname } = options;

  return {
    fieldname: "file",
    originalname: originalname ?? "file.pdf",
    encoding: "7bit",
    mimetype,
    size: buffer.length,
    buffer,
    destination: "",
    filename: originalname ?? "file.pdf",
    path: "",
    stream: Readable.from([]),
  };
}

async function fetchFileBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar blob (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");
  const limit = parseOptionalInt(getArgValue("--limit=")) ?? 50;
  const onlyId = parseOptionalInt(getArgValue("--id="));

  console.log(`[BACKFILL] Iniciando backfill de previews (dryRun=${dryRun}, force=${force}, limit=${limit}${onlyId ? `, id=${onlyId}` : ""})`);
  console.log(`[BACKFILL] Engine atual: PDF_PREVIEW_ENGINE=${process.env.PDF_PREVIEW_ENGINE ?? "(default)"}`);

  const conditions: SQL[] = [eq(catalogFiles.mimeType, "application/pdf")];
  if (onlyId) conditions.push(eq(catalogFiles.id, onlyId));
  if (!force) conditions.push(or(isNull(catalogFiles.textPreview), eq(catalogFiles.textPreview, ""))!);
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
    .select()
    .from(catalogFiles)
    .where(whereClause)
    .orderBy(desc(catalogFiles.createdAt))
    .limit(limit);

  console.log(`[BACKFILL] ${rows.length} arquivo(s) PDF selecionado(s).`);
  if (rows.length === 0) return;

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      assert.ok(row.blobUrl, "blobUrl ausente");
      const buffer = await fetchFileBuffer(row.blobUrl);
      const file = buildMockFile({
        buffer,
        mimetype: row.mimeType,
        originalname: row.originalName,
      });

      const preview = await extractTextPreview(file);
      const nextPreview = preview?.trim() ? preview : null;

      const oldLength = row.textPreview?.length ?? 0;
      const newLength = nextPreview?.length ?? 0;
      const containsPipes = Boolean(nextPreview && nextPreview.includes("|"));

      if (dryRun) {
        console.log(`[BACKFILL] fileId=${row.id} oldLen=${oldLength} newLen=${newLength} pipes=${containsPipes}`);
        skipped += 1;
        continue;
      }

      await db
        .update(catalogFiles)
        .set({ textPreview: nextPreview })
        .where(eq(catalogFiles.id, row.id));

      console.log(`[BACKFILL] atualizado fileId=${row.id} oldLen=${oldLength} newLen=${newLength} pipes=${containsPipes}`);
      updated += 1;
    } catch (error) {
      console.warn(`[BACKFILL] falha fileId=${row.id}:`, error);
      skipped += 1;
    }
  }

  console.log(`[BACKFILL] Concluído. updated=${updated} skipped=${skipped}`);
  if (!dryRun) {
    console.log("[BACKFILL] Para regenerar embeddings após atualizar previews, rode: npm run seed:embeddings");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[BACKFILL] Backfill falhou:", error);
    process.exit(1);
  });
