# RAG Context Catalog — Discovery Notes

## Current State
- Catalog items live in `shared/schema.ts` (`catalog_items` with name/description/category/manufacturer/price/status/tags). No file metadata table exists.
- Server only exposes `/api/chat` and log streaming. There is no file upload middleware or storage client.
- RAG context today comes solely from FAQs and catalog rows; no document attachments are ingested.

## Proposed Storage + Paths
- Storage target: Vercel Blob `agroremoto-blob`.
- Path convention: `catalog-files/{itemId}/{slug}-{uuid}{ext}` to avoid collisions and keep items isolated.
- Required env: `BLOB_READ_WRITE_TOKEN` (write), optional `BLOB_PUBLIC_BASE_URL` for read URLs; fail fast if missing.
- Dependencies to add: `@vercel/blob` for upload/list, `multer` (or `busboy`) for multipart parsing in Express. Keep uploads streaming to avoid buffering large files.

## Schema Additions
- New table `catalog_files`:
  - `id` (serial PK)
  - `catalogItemId` FK → `catalog_items.id` (index)
  - `originalName` (text), `blobPath` (text), `blobUrl` (text)
  - `mimeType` (text), `sizeBytes` (integer), `createdAt` (timestamp default now)
  - Optional `textPreview` (text, small excerpt) to support RAG context without full doc ingestion
- Migration via Drizzle; extend Zod schemas for inserts/selects.

## API/Route Sketch
- `POST /api/catalog/:itemId/files` (multipart):
  - Validate catalog item exists; enforce allowlist of MIME types (pdf, txt, doc, docx, md) and `MAX_FILE_SIZE` (e.g., 10MB).
  - Stream upload to Vercel Blob with path convention; persist metadata row.
  - Return metadata and signed/public URL.
- `GET /api/catalog/:itemId/files` → list metadata.
- `DELETE /api/catalog/files/:fileId` → delete blob + metadata (with auth guard when available).
- Consider `GET /api/catalog/files/:fileId` issuing a signed download URL if blobs are private.

## Client/UI Notes
- Add upload widget on catalog item detail page: accepts multiple files, shows progress/errors, renders list with download/remove actions.
- Surface text preview (if stored) for quick RAG inspection; otherwise show metadata.

## Security/Perf
- Enforce MIME + size limits server-side; sanitize filenames to slug + uuid.
- Avoid logging blob tokens; redact URLs containing signatures.
- Add rate limiting or auth once user model is wired (currently public endpoints).
- For large files, prefer streaming to Blob to avoid high memory usage.

## Open Questions
- Authentication/authorization: who can upload/delete files?
- Exact max file size and allowed MIME list?
- Should we extract text on upload (server-side) for RAG, or defer to a separate ingestion job?
- Blob access model: private with signed URLs vs public read?
- Retention/versioning needs for file replacements?
