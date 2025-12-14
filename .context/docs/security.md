
<!-- agent-update:start:security -->
# Security & Compliance Notes

Capture the policies and guardrails that keep this project secure and compliant.

## Authentication & Authorization
- The public chat UI currently runs without end-user auth; it assumes access is restricted via deployment controls. If exposed broadly, wrap Express routes with session middleware plus rate limits.
- OpenRouter calls authenticate with a Bearer token stored in `OPENROUTER_API_KEY`. Never log the raw key—`server/routes.ts` only prints length/prefix for debugging.
- Database connections rely on `DATABASE_URL` (Neon). Credentials are injected via environment variables and never checked into version control.
- Catalog file uploads use Vercel Blob signed writes via `BLOB_READ_WRITE_TOKEN`. Upload routes reject requests if the token is missing; URLs are optionally rewritten with `BLOB_PUBLIC_BASE_URL` when blobs are private.

## Secrets & Sensitive Data
- Store secrets in `.env` locally and cloud-specific secret managers (Vercel env variables, GitHub Actions secrets) in CI/CD.
- Rotate `OPENROUTER_API_KEY` and Neon credentials if logs or config files inadvertently leak metadata.
- Keep `BLOB_READ_WRITE_TOKEN` scoped to the `agroremoto-blob` bucket. Do not log blob URLs with embedded signatures; `server/catalog-routes.ts` only returns sanitized URLs to the client.
- FAQ and catalog tables only contain reference content (no PII). If you introduce customer data, document retention windows and sanitization steps here.
- O histórico do chat não é persistido: o cliente envia `history` e o backend usa apenas as últimas mensagens (limitadas por `CHAT_HISTORY_CONTEXT_LIMIT` e truncadas a ~1200 caracteres) antes de enviá-las ao modelo.
- Avoid dumping full OpenRouter responses into logs—only log counts and tool metadata to limit exposure of customer prompts.
- Quando precisar auditar as tool calls, use o `logToolPayload` (em `server/routes.ts`) que já normaliza espaços e limita o preview a 800 caracteres para evitar vazamento de prompts extensos ou dados sensíveis.

## File Upload Guardrails
- `server/catalog-file-storage.ts` enforces MIME allowlist (pdf, txt, doc, docx, md, json/csv/rtf/odt) and max size (`BLOB_MAX_FILE_SIZE_BYTES`, default 10MB) before uploads reach Vercel Blob.
- Uploads stream to memory via `multer` with size caps; over-limit requests return 400 without touching Blob.
- Deletions remove the blob first (`@vercel/blob` `del`) and then delete metadata rows to avoid dangling public links.
- Preview parsing (`server/catalog-file-preview.ts`) normalizes whitespace before saving `textPreview` and applies conservative PDF limits (pages/chars/timeout) to reduce DoS risk from malformed/huge PDFs. PDF extraction defaults to `pdfjs+fallback` and is configurable via `PDF_PREVIEW_ENGINE` + `PDF_PREVIEW_MAX_PAGES`/`PDF_PREVIEW_MAX_CHARS`/`PDF_PREVIEW_TIMEOUT_MS`; unsupported/failed parses log warnings without dumping file contents or blocking uploads.
- PDF preview generation is text-only (no OCR); scanned PDFs may produce empty/low-quality previews unless an OCR pipeline is introduced.

## Compliance & Policies
- No formal certifications are mandated today, but follow GDPR-friendly practices: do not store personally identifiable prompts beyond transient processing, and scrub debug messages before sharing outside the team.
- Track schema changes and AI prompt edits via PR descriptions so audit trails show who changed retrieval behavior.
- When integrating with production support tools, document data processors and update this section with SOC2/GDPR references.

## Incident Response
- Monitor `/api/logs/stream` plus deployment logs for spikes in 4xx/5xx or repeated OpenRouter failures. Capture timestamps + request IDs when escalating.
- First response: disable the offending API key or redeploy with safeguards (e.g., fallback messages) if OpenRouter is unstable.
- Escalate to the maintainer listed in `AGENTS.md` (or Slack channel) when: secrets leak, catalog data is corrupted, or chats crash repeatedly.
- After mitigation, update this document (and relevant plan files) with findings, including links to issues/commits for traceability.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Confirm security libraries and infrastructure match current deployments.
2. Update secrets management details when storage or naming changes.
3. Reflect new compliance obligations or audit findings.
4. Ensure incident response procedures include current contacts and tooling.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Security architecture docs, runbooks, policy handbooks.
- IAM/authorization configuration (code or infrastructure).
- Compliance updates from security or legal teams.

<!-- agent-update:end -->
