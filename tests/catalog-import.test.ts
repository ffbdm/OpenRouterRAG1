import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { test } from "node:test";
import * as XLSX from "xlsx";
import express from "express";

import type {
  CatalogFile,
  CatalogItem,
  CatalogItemInput,
  Faq,
  InsertCatalogFile,
  InsertFaq,
  InsertSystemInstruction,
  InsertUser,
  SystemInstruction,
  User,
} from "@shared/schema";
import type { CatalogHybridSearchResult } from "../server/catalog-hybrid";
import { catalogImportLimits, catalogXlsxMimeType, generateCatalogTemplate, parseCatalogImport } from "../server/catalog-import";
import type { IStorage } from "../server/storage";

function buildXlsxBuffer(rows: (string | number)[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Planilha1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

class InMemoryCatalogStorage implements IStorage {
  items: CatalogItem[] = [];
  private nextId = 1;

  private buildItem(item: CatalogItemInput): CatalogItem {
    return {
      ...item,
      id: this.nextId++,
      tags: item.tags ?? [],
      createdAt: new Date(),
    };
  }

  async getUser(): Promise<User | undefined> {
    return undefined;
  }

  async getUserByUsername(): Promise<User | undefined> {
    return undefined;
  }

  async createUser(_user: InsertUser): Promise<User> {
    throw new Error("not implemented");
  }

  async searchFaqs(): Promise<Faq[]> {
    return [];
  }

  async searchCatalog(): Promise<CatalogItem[]> {
    return this.items;
  }

  async searchCatalogHybrid(): Promise<CatalogHybridSearchResult> {
    return {
      results: [],
      vectorCount: 0,
      lexicalCount: 0,
      embeddingUsed: false,
      fallbackReason: undefined,
      timings: {
        vectorMs: 0,
        lexicalMs: 0,
        mergeMs: 0,
        totalMs: 0,
      },
    };
  }

  async listCatalogItems(): Promise<CatalogItem[]> {
    return this.items;
  }

  async getCatalogItemById(id: number): Promise<CatalogItem | undefined> {
    return this.items.find((item) => item.id === id);
  }

  async createCatalogItem(item: CatalogItemInput): Promise<CatalogItem> {
    const created = this.buildItem(item);
    this.items.push(created);
    return created;
  }

  async bulkInsertCatalogItems(items: CatalogItemInput[]): Promise<CatalogItem[]> {
    const created = items.map((item) => this.buildItem(item));
    this.items.push(...created);
    return created;
  }

  async updateCatalogItem(id: number, item: CatalogItemInput): Promise<CatalogItem | undefined> {
    const index = this.items.findIndex((candidate) => candidate.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...this.items[index],
      ...item,
    };
    this.items[index] = updated;
    return updated;
  }

  async deleteCatalogItem(id: number): Promise<{ deleted: boolean; archived: boolean; item?: CatalogItem }> {
    const index = this.items.findIndex((candidate) => candidate.id === id);
    if (index === -1) {
      return { deleted: false, archived: false };
    }

    const [removed] = this.items.splice(index, 1);
    return { deleted: true, archived: false, item: removed };
  }

  async createFaq(insertFaq: InsertFaq): Promise<Faq> {
    return {
      id: 0,
      question: insertFaq.question,
      questionNormalized: insertFaq.question,
      answer: insertFaq.answer,
      createdAt: new Date(),
    };
  }

  async getAllFaqs(): Promise<Faq[]> {
    return [];
  }

  async listCatalogFiles(): Promise<CatalogFile[]> {
    return [];
  }

  async createCatalogFile(file: InsertCatalogFile): Promise<CatalogFile> {
    return {
      ...file,
      id: 0,
      createdAt: new Date(),
    };
  }

  async getCatalogFileById(): Promise<CatalogFile | undefined> {
    return undefined;
  }

  async deleteCatalogFile(): Promise<CatalogFile | undefined> {
    return undefined;
  }

  async listInstructions(): Promise<SystemInstruction[]> {
    return [];
  }

  async getInstructionBySlug(): Promise<SystemInstruction | undefined> {
    return undefined;
  }

  async updateInstructionContent(): Promise<SystemInstruction | undefined> {
    return undefined;
  }

  async createInstruction(instruction: InsertSystemInstruction): Promise<SystemInstruction> {
    return {
      ...instruction,
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

async function startTestServer(storage: IStorage) {
  process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test";
  const { registerCatalogRoutes } = await import("../server/catalog-routes");

  const app = express();
  app.use(express.json());
  registerCatalogRoutes(app, { storage });

  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

test("parseCatalogImport converte headers PT-BR e normaliza preço/tags/status", () => {
  const buffer = buildXlsxBuffer([
    ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"],
    ["Herbicida Alpha", "Controle pós-emergência", "Defensivo", "AgroVale", "1.234,50", "ATIVO", "herbicida, pós, soja"],
  ]);

  const result = parseCatalogImport(buffer);

  assert.equal(result.errors.length, 0);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].price, 1234.5);
  assert.equal(result.items[0].status, "ativo");
  assert.deepEqual(result.items[0].tags, ["herbicida", "pós", "soja"]);
});

test("parseCatalogImport bloqueia status inválido e duplicados na planilha", () => {
  const buffer = buildXlsxBuffer([
    ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"],
    ["Bio Booster", "Inoculante premium", "Biológico", "RootLab", "55,90", "ativo", "bio"],
    ["Bio Booster", "Outro", "Biológico", "RootLab", "60", "ativo", "duplicado"],
    ["Bio Booster 2", "Teste", "Biológico", "RootLab", "10", "pausado", ""],
  ]);

  const result = parseCatalogImport(buffer);

  assert.equal(result.items.length, 1, "apenas primeira linha deve ser aceita");
  assert.equal(result.errors.length, 2);
  assert.equal(result.errors[0].row, 3, "detecta duplicidade na segunda linha repetida");
  assert.equal(result.errors[0].fields.includes("name"), true);
  assert.equal(result.errors[1].fields.includes("status"), true);
});

test("parseCatalogImport aceita campos opcionais vazios e só exige Nome no header", () => {
  const buffer = buildXlsxBuffer([
    ["Nome", "Categoria", "Preço"], // headers opcionais presentes mas sem descrição/fabricante
    ["Produto X", "", "",],
  ]);

  const result = parseCatalogImport(buffer);
  assert.equal(result.errors.length, 0);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].description, "");
  assert.equal(result.items[0].manufacturer, "");
  assert.equal(result.items[0].price, 0);
});

test("parseCatalogImport rejeita planilha sem header Nome e respeita limite de linhas", () => {
  const withoutHeader = buildXlsxBuffer([
    ["Categoria", "Fabricante", "Preço", "Tags"], // falta Nome
    ["Produto", "Categoria", "Fab", "10", "tag1"],
  ]);

  const missingResult = parseCatalogImport(withoutHeader);
  assert.equal(missingResult.items.length, 0);
  assert.equal(missingResult.errors.length, 1);
  assert.match(missingResult.errors[0].message, /Colunas obrigatórias/);

  const rows: (string | number)[][] = [
    ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"],
  ];

  for (let index = 0; index < catalogImportLimits.maxRows + 1; index++) {
    rows.push([`Item ${index}`, "Desc", "Cat", "Fab", 1, "ativo", "tag"]);
  }

  const limitResult = parseCatalogImport(buildXlsxBuffer(rows));
  assert.equal(limitResult.items.length, 0);
  assert.equal(limitResult.errors.length, 1);
  assert.match(limitResult.errors[0].message, /Limite/);
});

test("rota /api/catalog/import insere itens e devolve erros de validação", async () => {
  const storage = new InMemoryCatalogStorage();
  const { server, url } = await startTestServer(storage);

  try {
    const validBuffer = buildXlsxBuffer([
      ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"],
      ["Linha 1", "Desc 1", "Cat", "Fab", "10,00", "ativo", "tag"],
      ["Linha 2", "Desc 2", "Cat", "Fab 2", "20", "ativo", "tag2"],
    ]);

    const formData = new FormData();
    formData.append("file", new Blob([validBuffer], { type: catalogXlsxMimeType }), "catalogo.xlsx");

    const res = await fetch(`${url}/api/catalog/import`, {
      method: "POST",
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.created, 2);
    assert.equal(storage.items.length, 2);

    const invalidBuffer = buildXlsxBuffer([
      ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"],
      ["Linha 3", "Desc 3", "Cat", "Fab", "10", "invalido", ""],
    ]);

    const badForm = new FormData();
    badForm.append("file", new Blob([invalidBuffer], { type: catalogXlsxMimeType }), "catalogo.xlsx");

    const badRes = await fetch(`${url}/api/catalog/import`, {
      method: "POST",
      body: badForm,
    });
    const badBody = await badRes.json();

    assert.equal(badRes.status, 400);
    assert.ok(Array.isArray(badBody.errors));
    assert.equal(storage.items.length, 2, "nenhum item novo deve ser inserido após erro");
  } finally {
    server.close();
  }
});

test("generateCatalogTemplate cria workbook com header esperado", () => {
  const buffer = generateCatalogTemplate();
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const header = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0, blankrows: false })[0];

  assert.deepEqual(header, ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"]);
});
