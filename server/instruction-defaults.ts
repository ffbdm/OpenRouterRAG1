import type { InsertSystemInstruction } from "@shared/schema";
import { storage } from "./storage";

// Canonical slugs shared between backend, UI, and seed logic.
export const defaultInstructionSlugs = {
  global: "global-operating-principles",
  chatGather: "buscar-dados",
  chatRespond: "responder-usuario",
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
    orderIndex: 0,
  },
  {
    slug: defaultInstructionSlugs.chatGather,
    scope: "chat",
    title: "Etapa 1 — Buscar dados",
    description: "Define como a IA consulta searchFaqs/searchCatalog e consolida o contexto antes de responder.",
    content:
      "Você opera em duas etapas. Nesta etapa 1 é obrigatório coletar dados antes de responder: (1) analise a pergunta e chame pelo menos uma tool; use searchCatalog para qualquer pedido de produtos/cultivo/fabricante/preços e use searchFaqs para políticas, processos ou quando houver dúvida. (2) Se não tiver certeza, chame searchCatalog E searchFaqs; nunca avance sem pelo menos uma tool. (3) Cumprimentos ou mensagens sem intenção clara (ex.: 'oi', 'olá', 'bom dia', 'tudo bem?') não devem acionar tools; responda curto e peça o objetivo antes de buscar. (4) Envie a pergunta completa como query e resuma os resultados em português (nome, categoria, fabricante, preço, tags ou trechos úteis das FAQs). (5) Se uma busca retornar zero itens, escreva explicitamente que não encontrou nada e convide o usuário a fornecer mais detalhes. Nunca invente dados que não vieram das tools e registre apenas fatos observáveis.",
    orderIndex: 10,
  },
  {
    slug: defaultInstructionSlugs.chatRespond,
    scope: "chat",
    title: "Etapa 2 — Responder usuário",
    description: "Define como transformar o contexto coletado em uma resposta estruturada e auditável.",
    content:
      "Após concluir a etapa de coleta, use apenas os dados enviados como mensagens system para responder ao usuário. Não descreva tool_choice nem devolva 'call:' ou justificativas internas. Estruture o retorno em português seguindo esta ordem: (1) Resumo da busca — cite quais fontes foram consultadas (FAQs, catálogo ou ambos) e a quantidade de itens relevantes. (2) Resposta principal — entregue a orientação solicitada citando nomes de produtos, fabricantes, preços ou trechos da FAQ que suportem a conclusão. (3) Próximos passos — sugira ações quando não houver dados suficientes (ex.: pedir mais detalhes ou direcionar para o time certo). Se nada foi encontrado, comunique isso claramente e proponha um próximo passo em vez de inventar. Mantenha tom profissional, use frases curtas e evite repetir a pergunta.",
    orderIndex: 20,
  },
  {
    slug: defaultInstructionSlugs.catalog,
    scope: "catalog",
    title: "Diretrizes de edição do catálogo",
    description: "Checklist rápido para manter consistência ao criar, editar ou arquivar itens.",
    content:
      "Mantenha nome, categoria e fabricante em português e com capitalização consistente. Detalhe diferenciais na descrição e informe o preço em reais com duas casas decimais. Tags devem ser curtas, minúsculas e separadas por vírgula. Arquive itens obsoletos ao invés de removê-los sempre que precisar preservar histórico.",
    orderIndex: 30,
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

export function getDefaultInstructionContent(slug: string): string | undefined {
  return defaultInstructions.find((instruction) => instruction.slug === slug)?.content;
}
