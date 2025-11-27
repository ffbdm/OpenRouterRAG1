## Plan: Add searchCatalog Tool Dynamically

Extend static `tools` in `server/routes.ts` with `searchCatalog` for `catalog_items` table (name, description, category, manufacturer, price, tags='ativo'); LLM auto-calls on catalog queries via updated prompt. Add storage method mirroring `searchFaqs`; supports static addition, extensible to dynamic registry.

### Steps
1. Export `CatalogItem` type; add `searchCatalog` to `IStorage`/`DatabaseStorage` with Drizzle `ilike`/`or` on fields, filter `status='ativo'` [server/storage.ts](server/storage.ts), [shared/schema.ts](shared/schema.ts).
2. Add `searchCatalog` tool schema (query:string, limit:number) to `tools` array [server/routes.ts](server/routes.ts).
3. Add `if (name === "searchCatalog")` handler: parse args, call storage, push system msg with results [server/routes.ts](server/routes.ts).
4. Update system prompt: "Use searchFaqs for FAQs; searchCatalog for products/catalog (preços, itens)" [server/routes.ts](server/routes.ts).
5. Seed data if needed `npm run scripts/seedCatalog.ts`; test `/api/chat` "preço soja".
6. Optional: Tool registry map for future dynamic loading from DB/config.

### Further Considerations
1. Search enhancements: tags array overlap (`tags @> ARRAY['soja']`), field filters (category)?
2. Run `npm run db:push` post-schema if adding indexes.
3. Option A: Static tools (immediate). Option B: Dynamic (load tools from new DB table).
