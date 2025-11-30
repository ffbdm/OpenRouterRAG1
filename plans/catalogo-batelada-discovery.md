# Catálogo Batelada — Discovery e Proposta de Contrato

Contexto: executar o plano `plan-catalogo-batelada` para habilitar importação em lote via planilha .xlsx. Base consultada: `shared/schema.ts`, `server/catalog-routes.ts`, `server/storage.ts`, `client/src/pages/catalog.tsx`, `.context/docs/architecture.md`, `.context/docs/glossary.md`.

## Linha de Base Atual (catálogo)
- Tabela `catalog_items` exige `name`, `description`, `category`, `manufacturer`, `price`, `status` (`ativo|arquivado`), `tags` (array).
- API expõe CRUD em `/api/catalog` e upload de arquivos por item em `/api/catalog/:id/files` (multer + Vercel Blob); não há importação em lote ou template disponível.
- UI (`/catalogo`) usa React Query + RHF, lista itens ativos por padrão e permite criar/editar um item por vez.

## Template .xlsx Proposto
| Coluna (header) | Obrigatório? | Regra/observação |
| --- | --- | --- |
| `Nome` | Sim | min 2 caracteres |
| `Descrição` | Sim | min 5 caracteres |
| `Categoria` | Sim | min 2 caracteres |
| `Fabricante` | Sim | min 2 caracteres |
| `Preço` | Sim | número >= 0 (aceitar vírgula ou ponto; normalizar para número) |
| `Status` | Não | padrão `ativo`; aceitar apenas `ativo` ou `arquivado` (case-insensitive) |
| `Tags` | Não | lista separada por vírgula; limpar espaços e ignorar vazios |

- Primeira linha é cabeçalho fixo; rejeitar planilhas sem todas as colunas obrigatórias.
- Limitar a 500 linhas úteis por upload (não contar header); rejeitar arquivos vazios ou >5MB.
- Anexar no template duas linhas de exemplo para orientar formatação.

## API/Backend
- **GET `/api/catalog/import/template`**: retorna `.xlsx` gerado em memória com header e linhas de exemplo. Conteúdo-Type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- **POST `/api/catalog/import`** (multipart/form-data): campo `file` deve ser `.xlsx`; rejeitar outros MIME/assinaturas. Passos:
  1) Validar tamanho (<5MB) e ler via `multer.memoryStorage`.
  2) Parsear com `xlsx` (SheetJS) lendo a primeira aba; normalizar headers via slugify (`nome`, `descricao`, etc).
  3) Mapear linhas para `{ name, description, category, manufacturer, price, status?, tags? }`, convertendo vírgula para ponto em preço e split de tags.
  4) Validar cada linha com Zod reusando `catalogPayloadSchema` (encapsular em helper compartilhado) e acumulando erros por índice da linha (1-based).
  5) Se houver erros, responder `400` com `{ error: "Dados inválidos", errors: [{ row, fields: [...], message }] }` sem inserir nada.
  6) Se ok, inserir em transação em lotes (ex.: chunk de 100) usando `storage.createCatalogItem` ou `db.insert(catalogItems).values([...])` para eficiência; retornar `{ created: n, durationMs, sampleIds: [...] }`.
- Limites adicionais: bloquear duplicados dentro da planilha por par `nome + fabricante` (case-insensitive) retornando erro de validação; não deduplicar contra o banco nesta versão (deixa aberto para v2).
- Observabilidade: log `[CATALOG_IMPORT] start`, `parsed`, `created`, `durationMs`, `rowErrors` (sem dados sensíveis).

## Fluxo de UI
- Nova seção em `/catalogo`: “Importar catálogo em lote”.
- Ações:
  - Botão “Baixar template (.xlsx)” → chama endpoint GET.
  - Input/drag-and-drop para `.xlsx` com checagem de tamanho/mime antes de enviar.
  - Botão “Enviar” usa React Query `useMutation` para POST; exibe progresso/spinner.
  - Exibir resumo de resultado: itens criados, tempo de processamento; lista de erros com `linha`, `campo`, `mensagem` quando 400.
  - Após sucesso, invalidar query `["catalog"]` para recarregar lista.
- Mensagens em português e consistentes com toasts existentes (`use-toast`).

## Validações e Segurança
- Restringir MIME a `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e checar assinatura mínima via `xlsx` para evitar uploads arbitrários.
- Limitar linhas (500) e tamanho (5MB) para não exaurir memória; responder com erro claro quando ultrapassar.
- Mantém comportamento idempotente por arquivo apenas se não houver erros; nenhuma inserção parcial.
- Reaproveitar autenticação/middlewares existentes da API (nenhum adicional requerido hoje).

## Testes e Evidências Esperadas
- Unit: parser normaliza headers/PT-BR, converte preço com vírgula, rejeita status inválido, deduplica linhas repetidas.
- Integration (rota Express): upload válido cria N itens; arquivo com erro retorna 400 com erros por linha e nenhum item inserido.
- Client e2e manual: baixar template, preencher ~100 linhas sintéticas, subir e ver itens novos na lista `/catalogo`.

## Perguntas em Aberto
1. Pode haver modo “atualizar existente” (match por nome/fabricante) ou só criar novos?
2. Precisamos guardar metadados do lote (ex.: `batch_id`, `uploaded_by`)? Hoje não há coluna para isso.
3. Limite de linhas ideal? 500 é suposição para evitar saturar a instância; confirmar expectativa real.
4. Tags precisam de normalização extra (ex.: minúsculas, remoção de acentos) antes de gravar?

## Próximos Passos (fase 2)
1) Adicionar dependência `xlsx` e helper compartilhado (`catalog-import.ts`) com parser + validação Zod.  
2) Implementar endpoints `GET/POST /api/catalog/import` com multer e transação em lote.  
3) Criar UI de importação em `client/src/pages/catalog.tsx` com download do template, upload, feedback e invalidation de cache.  
4) Cobrir rota com testes em `tests/catalog-import.test.ts` (casos feliz/erro/limite) e atualizar docs (README + `.context/docs/data-flow.md`).  

