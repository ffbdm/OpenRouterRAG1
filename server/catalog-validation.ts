import { z } from "zod";
import { catalogItemStatusValues } from "@shared/schema";

export const statusFilterSchema = z.union([
  z.enum(catalogItemStatusValues),
  z.literal("all"),
]).optional();

const optionalText = z.preprocess(
  (value) => (value == null ? "" : typeof value === "string" ? value.trim() : String(value).trim()),
  z.string().default(""),
);

const priceSchema = z.preprocess(
  (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "string") {
      const cleaned = value
        .replace(/R\$/gi, "")
        .replace(/\s+/g, "");

      const hasComma = cleaned.includes(",");
      const withoutThousands = hasComma ? cleaned.replace(/\./g, "") : cleaned;
      const normalized = withoutThousands.replace(",", ".");
      return normalized;
    }

    return value;
  },
  z.coerce.number().nonnegative("Preço deve ser zero ou positivo").default(0),
);

export const tagsSchema = z.preprocess((value) => {
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

export const catalogPayloadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item"),
  description: optionalText,
  category: optionalText,
  manufacturer: optionalText,
  price: priceSchema,
  status: z.enum(catalogItemStatusValues).default("ativo"),
  tags: tagsSchema,
});
