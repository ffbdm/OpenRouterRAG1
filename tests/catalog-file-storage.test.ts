import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test, beforeEach, afterEach } from "node:test";
import type { Express } from "express";
import {
  allowedCatalogFileMimeTypes,
  getCatalogBlobMaxSize,
  validateCatalogFile,
} from "../server/catalog-file-storage";

function buildMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "documento.txt",
    encoding: "7bit",
    mimetype: "text/plain",
    size: 100,
    buffer: Buffer.from("conteúdo de teste"),
    destination: "",
    filename: "documento.txt",
    path: "",
    stream: Readable.from([]),
    ...overrides,
  };
}

beforeEach(() => {
  delete process.env.BLOB_MAX_FILE_SIZE_BYTES;
});

afterEach(() => {
  delete process.env.BLOB_MAX_FILE_SIZE_BYTES;
});

test("validateCatalogFile falha sem arquivo", () => {
  const result = validateCatalogFile(undefined);
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /Arquivo não enviado/);
});

test("validateCatalogFile bloqueia MIME não permitido", () => {
  const result = validateCatalogFile(buildMockFile({ mimetype: "image/png" }));
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /não permitido/i);
});

test("validateCatalogFile respeita limite configurado por env", () => {
  process.env.BLOB_MAX_FILE_SIZE_BYTES = "50";
  const result = validateCatalogFile(buildMockFile({ size: 60 }));
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /limite/i);
});

test("validateCatalogFile aceita arquivo válido", () => {
  const result = validateCatalogFile(buildMockFile());
  assert.equal(result.ok, true);
});

test("getCatalogBlobMaxSize usa padrão quando env inválida", () => {
  process.env.BLOB_MAX_FILE_SIZE_BYTES = "-10";
  const max = getCatalogBlobMaxSize();
  assert.equal(max, 10 * 1024 * 1024);
});

test("allowedCatalogFileMimeTypes inclui pdf e texto", () => {
  assert.equal(allowedCatalogFileMimeTypes.has("application/pdf"), true);
  assert.equal(allowedCatalogFileMimeTypes.has("text/plain"), true);
});
