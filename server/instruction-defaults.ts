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
    title: "Etapa 1 — Classificar intenção",
    description: "Decide se a pergunta deve consultar FAQs, catálogo, ambos ou nenhum antes da resposta final.",
    content:
      [
        "Classifique cada mensagem do usuário para decidir quais buscas executar antes da resposta final.",
        "Retorne APENAS um JSON válido no formato:",
        '{ "intent": "FAQ|CATALOG|MIST|OTHER", "useCatalogFiles": true|false }',
        "",
        "Definições:",
        "- intent=FAQ: políticas/processos, dúvidas de atendimento, logística, como usar o sistema.",
        "- intent=CATALOG: produtos, cultivo, fabricante, preço, características do item.",
        "- intent=MIST: quando mistura FAQ + catálogo ou há dúvida entre eles.",
        "- intent=OTHER: saudações ou assuntos fora do escopo.",
        "",
        "Regra para useCatalogFiles:",
        "- useCatalogFiles=true SOMENTE quando o usuário pedir informações tipicamente encontradas em documentos/anexos (ex.: bula, FISPQ/MSDS/SDS, ficha técnica, composição, dose/dosagem, ppm, tabela, PDF, arquivo, anexo, laudo, especificação).",
        "- Caso contrário, useCatalogFiles=false.",
        "",
        "Restrições:",
        "- Não explique a escolha.",
        "- Não chame ferramentas.",
        "- Não inclua campos extras.",
      ].join("\n"),
    orderIndex: 10,
  },
  {
    slug: defaultInstructionSlugs.chatRespond,
    scope: "chat",
    title: "Etapa 2 — Responder usuário",
    description: "Define como transformar o contexto coletado em uma resposta estruturada e auditável.",
    content:
      "Use somente o contexto fornecido (pergunta do usuário, FAQs e itens de catálogo selecionados pelo backend) para responder. Não mencione ferramentas, classificação ou passos internos. Estruture em português: (1) Resumo das fontes consultadas e quantidades (FAQs, catálogo, ambos ou nenhum); (2) Resposta principal com nomes de produtos ou trechos relevantes; (3) Próximos passos claros. Se nada foi encontrado, explique isso e peça detalhes adicionais em vez de inventar.",
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
