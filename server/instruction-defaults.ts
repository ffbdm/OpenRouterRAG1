import type { InsertSystemInstruction } from "@shared/schema";
import { storage } from "./storage";

// Canonical slugs shared between backend, UI, and seed logic.
export const defaultInstructionSlugs = {
  global: "global-operating-principles",
  chat: "chat-system",
  catalog: "catalog-guidelines",
} as const;

const defaultInstructions: InsertSystemInstruction[] = [
  {
    slug: defaultInstructionSlugs.global,
    scope: "global",
    title: "Princípios gerais do console RAG",
    description: "Aplicável a qualquer tela do console (chat, catálogo e painéis auxiliares).",
    content:
      "Todas as respostas e campos devem permanecer em português. Registre alterações relevantes no terminal de logs sempre que possível e mantenha o fluxo de RAG auditável: explique quando nenhum dado foi encontrado e evite compartilhar chaves ou segredos. Utilize o painel de instruções para documentar acordos temporários e revise o conteúdo após cada sprint.",
  },
  {
    slug: defaultInstructionSlugs.chat,
    scope: "chat",
    title: "Prompt do Chat RAG",
    description: "Mensagem \"system\" aplicada antes de cada interação com o OpenRouter.",
    content:
      "Você é um assistente de FAQ e catálogo inteligente. Consulte searchFaqs para perguntas frequentes e searchCatalog para dúvidas sobre produtos, itens, fabricantes ou preços. A tool searchCatalog retorna uma busca híbrida (vetorial + lexical) com score. Baseie suas respostas nos resultados encontrados e informe se nada for localizado. Responda sempre em português de forma clara e objetiva.",
  },
  {
    slug: defaultInstructionSlugs.catalog,
    scope: "catalog",
    title: "Diretrizes de edição do catálogo",
    description: "Checklist rápido para manter consistência ao criar, editar ou arquivar itens.",
    content:
      "Mantenha nome, categoria e fabricante em português e com capitalização consistente. Detalhe diferenciais na descrição e informe o preço em reais com duas casas decimais. Tags devem ser curtas, minúsculas e separadas por vírgula. Arquive itens obsoletos ao invés de removê-los sempre que precisar preservar histórico.",
  },
];

export async function ensureDefaultInstructions(): Promise<void> {
  const existing = await storage.listInstructions();
  const seen = new Set(existing.map((instruction) => instruction.slug));

  for (const instruction of defaultInstructions) {
    if (seen.has(instruction.slug)) {
      continue;
    }

    await storage.createInstruction(instruction);
  }
}
