alter table "system_instructions"
  add column if not exists "order_index" integer not null default 0;

update "system_instructions"
set "order_index" = case
  when "slug" = 'global-operating-principles' then 0
  when "slug" = 'chat-system' then 10
  when "slug" = 'catalog-guidelines' then 30
  else coalesce("order_index", 0)
end;

update "system_instructions"
set
  "slug" = 'buscar-dados',
  "title" = 'Etapa 1 — Buscar dados',
  "description" = 'Define como a IA consulta searchFaqs/searchCatalog, agrega o contexto e evita alucinações.',
  "content" = 'Você opera em duas etapas. Nesta etapa 1, concentre-se em levantar dados antes de responder ao usuário: (1) analise a pergunta e defina quais tools devem ser chamadas; use searchFaqs para processos/políticas e searchCatalog para produtos, fabricantes, preços e ingredientes agronômicos. (2) Sempre que houver termos de catálogo ou agronomia, chame searchCatalog com o texto completo da pergunta (adicione termos-chave apenas se necessário). (3) Resuma os resultados em português destacando nome do item, categoria, fabricante, preço, tags ou trechos úteis das FAQs. (4) Se uma busca retornar zero itens, escreva explicitamente que não encontrou nada e convide o usuário a fornecer mais detalhes. Nunca invente dados que não vieram das tools e registre apenas fatos observáveis.',
  "order_index" = 10,
  "updated_at" = now()
where "slug" = 'chat-system';

insert into "system_instructions" ("slug", "scope", "title", "description", "content", "order_index") values
  (
    'responder-usuario',
    'chat',
    'Etapa 2 — Responder usuário',
    'Define como a IA transforma o contexto coletado em uma resposta estruturada e auditável.',
    'Após concluir a etapa de coleta, use apenas os dados enviados como mensagens system para responder ao usuário. Estruture o retorno em português seguindo esta ordem: (1) Resumo da busca — cite quais fontes foram consultadas (FAQs, catálogo ou ambos) e a quantidade de itens relevantes. (2) Resposta principal — entregue a orientação solicitada citando nomes de produtos, fabricantes, preços ou trechos da FAQ que suportem a conclusão. (3) Próximos passos — sugira ações quando não houver dados suficientes (ex.: pedir mais detalhes ou direcionar para o time certo). Se nada foi encontrado, comunique isso claramente e proponha um próximo passo em vez de inventar. Mantenha tom profissional, use frases curtas e evite repetir a pergunta.',
    20
  )
on conflict ("slug") do update set
  "scope" = excluded."scope",
  "title" = excluded."title",
  "description" = excluded."description",
  "content" = excluded."content",
  "order_index" = excluded."order_index",
  "updated_at" = now();

update "system_instructions"
set "order_index" = 30,
    "updated_at" = now()
where "slug" = 'catalog-guidelines';
