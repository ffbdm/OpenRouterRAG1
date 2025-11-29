-- Enforce file-only embeddings and remove legacy item/note rows
alter table "catalog_item_embeddings" alter column "source" set default 'file';

delete from "catalog_item_embeddings" where "source" <> 'file';

alter table "catalog_item_embeddings"
  drop constraint if exists "catalog_item_embeddings_source_file_only";

alter table "catalog_item_embeddings"
  add constraint "catalog_item_embeddings_source_file_only" check ("source" = 'file');
