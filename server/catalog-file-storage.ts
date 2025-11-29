import { randomUUID } from "node:crypto";
import path from "node:path";
import { put, del } from "@vercel/blob";

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const allowedCatalogFileMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
]);

export function getCatalogBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN não configurado");
  }

  return token;
}

export function getCatalogBlobMaxSize(): number {
  const envValue = process.env.BLOB_MAX_FILE_SIZE_BYTES;

  if (!envValue) return DEFAULT_MAX_FILE_SIZE_BYTES;

  const parsed = Number(envValue);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  return parsed;
}

function slugifyFilename(filename: string): string {
  const baseName = filename.replace(path.extname(filename), "");

  return baseName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "arquivo";
}

function buildStoragePath(itemId: number, originalName: string): string {
  const extension = (path.extname(originalName) || ".bin").toLowerCase();
  const slug = slugifyFilename(originalName);
  const uniqueId = randomUUID();

  return `catalog-files/${itemId}/${slug}-${uniqueId}${extension}`;
}

export function validateCatalogFile(file?: Express.Multer.File): { ok: boolean; message?: string } {
  if (!file) {
    return { ok: false, message: "Arquivo não enviado." };
  }

  const maxSize = getCatalogBlobMaxSize();
  if (file.size > maxSize) {
    return { ok: false, message: `Arquivo excede o limite de ${(maxSize / (1024 * 1024)).toFixed(1)}MB.` };
  }

  const mimeType = file.mimetype || "application/octet-stream";
  if (!allowedCatalogFileMimeTypes.has(mimeType)) {
    return { ok: false, message: `Tipo de arquivo não permitido: ${mimeType}.` };
  }

  return { ok: true };
}

function buildPublicBlobUrl(storagePath: string, uploadedUrl: string): string {
  const baseUrl = process.env.BLOB_PUBLIC_BASE_URL;

  if (!baseUrl) return uploadedUrl;

  return `${baseUrl.replace(/\/$/, "")}/${storagePath}`;
}

export async function uploadCatalogFileToBlob(params: {
  itemId: number;
  file: Express.Multer.File;
  token: string;
}): Promise<{ blobUrl: string; blobPath: string; size: number }> {
  const storagePath = buildStoragePath(params.itemId, params.file.originalname);

  const blob = await put(storagePath, params.file.buffer, {
    access: "public",
    token: params.token,
    contentType: params.file.mimetype || "application/octet-stream",
  });

  return {
    blobUrl: buildPublicBlobUrl(storagePath, blob.url),
    blobPath: storagePath,
    size: params.file.size,
  };
}

export async function deleteCatalogBlob(urlOrPath: string, token: string): Promise<void> {
  await del(urlOrPath, { token });
}

export function extractTextPreview(file: Express.Multer.File, maxLength = 2000): string | undefined {
  const mimeType = file.mimetype || "";
  const isText = mimeType.startsWith("text/") || mimeType === "application/json";

  if (!isText) return undefined;

  return file.buffer?.toString("utf-8").slice(0, maxLength);
}
