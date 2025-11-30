import * as XLSX from "xlsx";
import type { CatalogItemInput, CatalogItemStatus } from "@shared/schema";
import { catalogPayloadSchema } from "./catalog-validation";

export const catalogImportLimits = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 500,
};

export const catalogXlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const headerFieldMap: Record<string, keyof CatalogItemInput> = {
  nome: "name",
  name: "name",
  descricao: "description",
  descrição: "description",
  description: "description",
  categoria: "category",
  category: "category",
  fabricante: "manufacturer",
  preco: "price",
  preço: "price",
  price: "price",
  status: "status",
  tags: "tags",
};

const requiredFields: (keyof CatalogItemInput)[] = ["name"];

export type CatalogImportRowError = {
  row: number;
  fields: (keyof CatalogItemInput)[];
  message: string;
};

export type CatalogImportParseResult = {
  items: CatalogItemInput[];
  errors: CatalogImportRowError[];
  rowCount: number;
  headers: string[];
};

function slugifyHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeHeaderValue(value: string): string {
  const slug = slugifyHeader(value);
  return slug.replace(/-/g, "");
}

function stringifyCell(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
}

function normalizePriceInput(value: unknown): string | number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return "";

  const cleaned = value
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "");

  const hasComma = cleaned.includes(",");
  const withoutThousands = hasComma ? cleaned.replace(/\./g, "") : cleaned;
  const normalized = withoutThousands.replace(",", ".");

  return normalized;
}

function normalizeStatusInput(value: unknown): CatalogItemStatus | string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized as CatalogItemStatus | string;
}

export function generateCatalogTemplate(): Buffer {
  const header = ["Nome", "Descrição", "Categoria", "Fabricante", "Preço", "Status", "Tags"];
  const examples = [
    ["Semente Premium Soja 64", "Cultivar precoce com alto teto produtivo e excelente emergência.", "Sementes", "AgroVale", 610.75, "ativo", "sementes, soja"],
    ["Fertilizante Foliar MaxK", "Potássio de rápida absorção para estágios críticos de enchimento.", "Fertilizante", "Nutrimax", "155,90", "ativo", "fertilizante, k"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([header, ...examples]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Catalogo");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseCatalogImport(buffer: Buffer): CatalogImportParseResult {
  const errors: CatalogImportRowError[] = [];

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (!workbook.SheetNames.length) {
    return {
      items: [],
      errors: [{ row: 1, fields: [], message: "Planilha vazia" }],
      rowCount: 0,
      headers: [],
    };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((value) => stringifyCell(value));
  const normalizedHeaders = headers.map(normalizeHeaderValue);

  const columnIndex = new Map<keyof CatalogItemInput, number>();
  normalizedHeaders.forEach((header, index) => {
    const field = headerFieldMap[header];
    if (field) {
      columnIndex.set(field, index);
    }
  });

  const missing = requiredFields.filter((field) => !columnIndex.has(field));
  if (missing.length > 0) {
    return {
      items: [],
      errors: [
        {
          row: 1,
          fields: missing,
          message: `Colunas obrigatórias ausentes: ${missing.join(", ")}`,
        },
      ],
      rowCount: 0,
      headers,
    };
  }

  const dataRows = rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => stringifyCell(cell).length > 0));

  if (dataRows.length === 0) {
    return {
      items: [],
      errors: [{ row: 1, fields: [], message: "Planilha sem linhas de dados" }],
      rowCount: 0,
      headers,
    };
  }

  if (dataRows.length > catalogImportLimits.maxRows) {
    return {
      items: [],
      errors: [{
        row: 1,
        fields: [],
        message: `Limite de ${catalogImportLimits.maxRows} linhas excedido (${dataRows.length} linhas úteis)`,
      }],
      rowCount: dataRows.length,
      headers,
    };
  }

  const seenPairs = new Set<string>();
  const items: CatalogItemInput[] = [];

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2; // header é linha 1
    const name = stringifyCell(row[columnIndex.get("name") ?? -1]);
    const description = columnIndex.has("description") ? stringifyCell(row[columnIndex.get("description") ?? -1]) : "";
    const category = columnIndex.has("category") ? stringifyCell(row[columnIndex.get("category") ?? -1]) : "";
    const manufacturer = columnIndex.has("manufacturer") ? stringifyCell(row[columnIndex.get("manufacturer") ?? -1]) : "";
    const price = columnIndex.has("price") ? normalizePriceInput(row[columnIndex.get("price") ?? -1]) : "";
    const status = normalizeStatusInput(columnIndex.has("status") ? row[columnIndex.get("status") ?? -1] : undefined) ?? "ativo";
    const tags = columnIndex.has("tags") ? stringifyCell(row[columnIndex.get("tags") ?? -1]) : "";

    if (name && manufacturer) {
      const dedupeKey = `${name.toLowerCase()}|${manufacturer.toLowerCase()}`;
      if (seenPairs.has(dedupeKey)) {
        errors.push({
          row: rowNumber,
          fields: ["name", "manufacturer"],
          message: "Linha duplicada na planilha (nome + fabricante)",
        });
        return;
      }
      seenPairs.add(dedupeKey);
    }

    const parsed = catalogPayloadSchema.safeParse({
      name,
      description,
      category,
      manufacturer,
      price,
      status,
      tags,
    });

    if (!parsed.success) {
      const fieldErrors = Object.keys(parsed.error.flatten().fieldErrors ?? {}) as (keyof CatalogItemInput)[];
      const message = parsed.error.errors[0]?.message || "Dados inválidos";
      errors.push({
        row: rowNumber,
        fields: fieldErrors,
        message,
      });
      return;
    }

    items.push({
      ...parsed.data,
      tags: parsed.data.tags ?? [],
    });
  });

  return {
    items,
    errors,
    rowCount: dataRows.length,
    headers,
  };
}
