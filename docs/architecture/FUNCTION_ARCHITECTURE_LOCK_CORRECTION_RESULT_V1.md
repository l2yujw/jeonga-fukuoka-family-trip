# Function / Architecture Lock Correction Result v1

## Scope and outcome

This bounded pass corrected the repository findings `FA-001` through `FA-008` from `FUNCTION_ARCHITECTURE_LOCK_AUDIT_V1.md`. It did not redesign Schedule, add product scope, mutate remote Supabase, apply a migration, deploy, or perform Git publishing operations.

This document reports correction status only. A separate re-audit is still required before the Design Guide phase; this report does not declare the architecture lock ready.

## Finding results

| Finding | Status | Exact correction | Files changed | Proof | Remote DB action |
| --- | --- | --- | --- | --- | --- |
| FA-001 | FIXED | Added the narrow approved Schedule raster exception; moved all 43 Schedule images from public delivery to `private-assets/schedule`; added the invite-cookie/trip-authorized Node API with PNG/WebP allow-listing, lexical and real-path traversal protection, safe errors, and private no-store caching; changed all runtime list/body/fallback/detail/CSS image URLs to the private API; disabled Next image optimization for cookie-authorized detail images; added explicit production file tracing. | `AGENTS.md`; `next.config.ts`; `package.json`; `public/assets/schedule/**` → `private-assets/schedule/**`; `src/app/api/schedule-asset/[...path]/route.ts`; `src/app/globals.css`; `src/features/schedule/server/schedule-asset.ts`; `src/features/schedule/server/schedule-asset.test.mjs`; `src/features/schedule/schedule-detail-sheet.tsx`; `src/features/schedule/schedule-guide-data.ts`; `src/features/schedule/schedule-visual-assets.ts`; Schedule visual/detail tests | Schedule asset tests reject missing/invalid invites, encoded traversal, separator traversal, unsupported types, and escaping symlinks; they verify private caching, safe errors, no runtime `/assets/schedule/` URL, no public Schedule directory, route authorization wiring, and tracing config. `next build` generated `/api/schedule-asset/[...path]`, and its NFT manifest contains the private assets. | No |
| FA-002 | FIXED | Wired Schedule initialization to trip `startDate` and the existing Asia/Seoul resolver with priority `detail link → valid persisted day → Korea-local current day`; retained manual tab persistence and detail-day persistence. | `src/features/schedule/schedule-data.ts`; `src/features/schedule/schedule-data.test.mjs`; `src/features/schedule/schedule-view.tsx` | Screen-wiring regression covers fresh 2026-09-12 → Day 2, fresh 2026-09-13 → Day 3, persisted-day override, detail override, and source wiring to `trip.startDate`. Existing before/after clamping tests remain green. | No |
| FA-003 | FIXED | Required assigned photos are now loaded before Canvas rendering; missing URLs, rejected decodes, and zero-dimension decodes throw the stable `memory-card-required-image-load-failed` error. The existing lower-resolution retry remains active, and a second failure propagates to the existing UI error path. Unassigned template slots remain blank by render-model intent. | `src/features/cards/memory-card-export.ts`; `src/features/cards/memory-card.test.mjs` | Tests cover required decode rejection, missing hydrated photo rejection, first-render failure followed by successful retry, both attempts failing, and the existing intentional Editorial `e5` empty slot. | No |
| FA-004 | FIXED | Removed duplicated itinerary facts from the raster generator. The generator now parses `docs/data/04_SEED_DRAFT.sql` and joins the 27 canonical rows to visual-only row metadata. All day/sequence/time/location/title/description/item-type fields are equality-tested. Regenerated only the three Schedule body plates whose displayed facts changed; every other moved image is byte-identical to its original Git blob. | `scripts/schedule-itinerary.mjs`; `scripts/generate-schedule-bodies.mjs`; `src/features/schedule/schedule-visual-plate.test.mjs`; `private-assets/schedule/plates/body/day-1.png`; `day-2.png`; `day-3.png` | Complete 27-row equality test compares generator-visible values with the canonical seed. Existing dimension/layout tests and visual inspection confirm the approved composition remains intact. | No |
| FA-005 | FIXED | Changed the canonical default to layout v3; constrained authenticated inserts to owned trip membership, DB/JSON version 3 agreement, non-null canonical object/slot/placement structure, and null `result_storage_path`; removed the unused authenticated Memory Card UPDATE grant and policy; explicitly revoked the five historical column-level authenticated UPDATE ACLs in both canonical RLS and the migration. Added an idempotent, row-preserving local migration. Legacy v1/v2 readers and v3 readers remain unchanged. | `docs/data/01_SCHEMA_FINAL.sql`; `docs/data/02_RLS_FINAL.sql`; `docs/data/10_FUNCTION_ARCHITECTURE_LOCK_CARD_WRITE_MIGRATION.sql`; `docs/data/rls-privileges.test.mjs` | RLS/schema tests assert default 3, v3/null minimum shape, version agreement, explicit historical column-level UPDATE ACL cleanup in both SQL paths, no authenticated Memory Card UPDATE re-grant or policy, and no migration row rewrite/delete. Existing Memory Card tests prove v1/v2/v3 read compatibility. | **Yes — manually apply the migration after re-audit/approval. It was not applied in this pass.** |
| FA-006 | FIXED | Replaced active `/cards/editor` and `/cards/result` claims with `/cards` as the single composer/editor/preview/saved/export/share route and stated that separate routes require an explicit architecture reopening. | `docs/03_ROUTE_AND_STATE_MAP.md` | Route document matches the built route list; build contains `/cards` and no separate editor/result routes. | No |
| FA-007 | FIXED | Marked both pre-Codex entry/status documents as historical and non-authoritative; changed `AGENTS.md` current phase to `Function / Architecture Lock correction / re-audit pending`. | `AGENTS.md`; `docs/00_README_FIRST.md`; `docs/01_PRECODEX_STATUS.md` | Source review confirms no document declares the Design Guide active. | No |
| FA-008 | FIXED | Removed the tracked zero-byte env-shaped temporary file without touching `.env.local`. | deleted `src/app/.env.local.tmp` | Git status records only that exact temp-file deletion; no environment value was printed. | No |

## Validation

- `npm test`: PASS — 174 tests passed; 0 failed, skipped, or todo.
- `npm run lint`: PASS — no findings.
- `npx tsc --noEmit`: PASS — no diagnostics.
- `npm run build`: PASS — Next.js 16.3.2 production build generated 15 routes including `/api/schedule-asset/[...path]`.
- `git diff --check`: PASS — no whitespace errors.
- Focused source/filesystem checks: PASS — runtime source has no `/assets/schedule/` URL; `public/assets/schedule` is absent; all 43 Schedule files are under `private-assets/schedule`; non-body moved image bytes match the original Git blobs.

## Protected artifacts

- `next-env.d.ts`: SHA-256 before/after `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b` — unchanged.
- `public/assets/grandfather-cutout.png`: SHA-256 before/after `f48d1c75c64be95fa073c2b92695af4b62602aa4814ae19cbc6f5d00b8264511` — unchanged.
- `docs/architecture/FUNCTION_ARCHITECTURE_LOCK_AUDIT_V1.md`: preserved unchanged as the historical pre-correction audit.

## Unapplied migration

`docs/data/10_FUNCTION_ARCHITECTURE_LOCK_CARD_WRITE_MIGRATION.sql` is the only new migration from this correction pass. It requires a deliberate manual remote Supabase application after review. No remote database action occurred here.

## Required next gate

Re-audit remains mandatory before the Design Guide phase. The re-audit must independently verify these corrections and any required remote migration/application state; this correction report does not replace that gate.
