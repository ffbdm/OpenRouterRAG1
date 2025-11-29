import type { CatalogItem, CatalogItemStatus } from "@shared/schema";

export type CatalogStatusFilter = CatalogItemStatus | "all";

export function parseTagsInput(value: string | string[] | null | undefined): string[] {
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
}

export function formatPriceBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function statusLabel(status: CatalogItemStatus): string {
  return status === "ativo" ? "Ativo" : "Arquivado";
}

export type CatalogListResponse = {
  items: CatalogItem[];
};

export type CatalogSingleResponse = {
  item: CatalogItem;
};
