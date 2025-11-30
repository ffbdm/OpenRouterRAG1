do $$
begin
  if not exists (select 1 from pg_type where typname = 'instruction_scope') then
    create type "instruction_scope" as enum ('global', 'chat', 'catalog');
  end if;
end$$;

create table if not exists "system_instructions" (
  "id" serial primary key,
  "slug" varchar(120) not null unique,
  "scope" "instruction_scope" not null default 'global',
  "title" text not null,
  "description" text,
  "content" text not null,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

insert into "system_instructions" ("slug", "scope", "title", "description", "content") values
  (
    'chat-system',
    'chat',
    'Prompt do Chat RAG',
    'Mensagem "system" aplicada antes de cada interação com o OpenRouter.',
    'Você é um assistente de FAQ e catálogo inteligente. Consulte searchFaqs para perguntas frequentes e searchCatalog para dúvidas sobre produtos, itens, fabricantes ou preços. A tool searchCatalog retorna uma busca híbrida (vetorial + lexical) com score. Baseie suas respostas nos resultados encontrados e informe se nada for localizado. Responda sempre em português de forma clara e objetiva.'
  ),
  (
    'catalog-guidelines',
    'catalog',
    'Diretrizes de edição do catálogo',
    'Checklist rápido para manter consistência ao criar, editar ou arquivar itens.',
    'Mantenha nome, categoria e fabricante em português e com capitalização consistente. Detalhe diferenciais na descrição e informe o preço em reais com duas casas decimais. Tags devem ser curtas, minúsculas e separadas por vírgula. Arquive itens obsoletos ao invés de removê-los sempre que precisar preservar histórico.'
  ),
  (
    'global-operating-principles',
    'global',
    'Princípios gerais do console RAG',
    'Aplicável a qualquer tela do console (chat, catálogo e painéis auxiliares).',
    'Todas as respostas e campos devem permanecer em português. Registre alterações relevantes no terminal de logs sempre que possível e mantenha o fluxo de RAG auditável: explique quando nenhum dado foi encontrado e evite compartilhar chaves ou segredos. Utilize o painel de instruções para documentar acordos temporários e revise o conteúdo após cada sprint.'
  )
on conflict ("slug") do nothing;
