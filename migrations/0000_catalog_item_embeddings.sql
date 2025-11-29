-- Enable pgvector
create extension if not exists "vector";

-- Enum for embedding source
do $$
begin
  if not exists (select 1 from pg_type where typname = 'catalog_item_embedding_source') then
    create type "catalog_item_embedding_source" as enum ('item', 'file', 'note');
  end if;
end$$;

create table if not exists "catalog_item_embeddings" (
  "id" serial primary key,
  "catalog_item_id" integer not null references "catalog_items"("id") on delete cascade,
  "source" "catalog_item_embedding_source" not null default 'item',
  "content" text not null,
  "embedding" vector(1536) not null,
  "created_at" timestamp not null default now()
);

create index if not exists "catalog_item_embeddings_item_id_idx" on "catalog_item_embeddings" ("catalog_item_id");
create index if not exists "catalog_item_embeddings_embedding_ivfflat_idx"
  on "catalog_item_embeddings" using ivfflat ("embedding" vector_cosine_ops) with (lists = 100);

analyze "catalog_item_embeddings";
