# Function / Architecture Lock Re-audit v1

## 1. Baseline and audit boundary

- Repository: `l2yujw/jeonga-fukuoka-family-trip`
- Audited working copy: `/Users/ryu/dev/jeonga-fukuoka-family-trip`
- Required and observed branch: `fix/function-architecture-lock`
- Required and observed HEAD: `4c33129bdc374b408142586d675f3a0dec17fbd8`
- Audit date: 2026-09-03 (Asia/Seoul)
- Scope: independent repository re-audit of `FA-001` through `FA-008`, the requested regression boundaries, the supplied live FA-005 verification, and all five required validation commands.

The correction set is present as uncommitted working-tree changes on the original base HEAD. This re-audit did not implement a fix or modify product code. It created only this report. It did not mutate or query remote Supabase, apply a migration, commit, push, open or merge a PR, deploy, or change external state.

The live Supabase facts for FA-005 are an explicit supplied input to this re-audit, not a result of remote access performed here. Browser/device E2E, live signed-URL expiry, and deployed-environment checks were outside the requested validation list.

## 2. Verdict

# LOCK READY

**READY FOR WHOLE-APP DESIGN GUIDE**

| BLOCKER | HIGH | MEDIUM | LOW |
| ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 |

Every original finding is corrected in the audited working tree, the supplied live FA-005 state agrees with the corrected canonical SQL/migration representation, and every required validation gate passes.

## 3. FA-001 through FA-008 re-audit

| ID | Status | Independent evidence |
| --- | --- | --- |
| FA-001 | PASS / CORRECTED | `AGENTS.md:19` narrowly authorizes the already-approved Schedule raster system and requires invite-authorized delivery. Runtime URLs use `/api/schedule-asset/**`; `src/app/api/schedule-asset/[...path]/route.ts:15-27` resolves the invite cookie through `resolveInviteTrip`, while `src/features/schedule/server/schedule-asset.ts:34-109` restricts extensions, rejects encoded/separator traversal, verifies real paths against the private root, authorizes before path/file disclosure, and returns `private, no-store`. `public/assets/schedule` is absent. All 43 files are under `private-assets/schedule`; 40 moved files are byte-identical to their original Git blobs and only the three corrected body plates differ. The production NFT trace contains all 43 private files. Tests cover missing/invalid invites, traversal, escaping symlinks, safe errors, private caching, runtime URL removal, and tracing. |
| FA-002 | PASS / CORRECTED | `src/features/schedule/schedule-view.tsx:43-103` now initializes and synchronizes through `resolveScheduleViewDayNo` using `trip.startDate`. `src/features/schedule/schedule-data.ts:69-108` applies the priority `detail link -> valid persisted day -> Asia/Seoul current trip day`, with before/after clamping retained. Tests prove fresh 2026-09-12 selects Day 2, fresh 2026-09-13 selects Day 3, persisted selection wins over date, and a detail link wins over persisted selection. |
| FA-003 | PASS / CORRECTED | `src/features/cards/memory-card-export.ts:249-274` loads every distinct assigned photo before Canvas rendering and rejects missing URLs, decode failures, and zero-dimension decodes with `memory-card-required-image-load-failed`; intentional unassigned slots remain outside that required set. The existing 1080-to-720 retry remains, and two failures propagate to the existing UI error path. `src/features/cards/memory-card.test.mjs:1173-1236` proves retry, double-failure propagation, decode rejection, and missing-photo rejection. |
| FA-004 | PASS / CORRECTED | `scripts/schedule-itinerary.mjs:95-149` parses the canonical rows from `docs/data/04_SEED_DRAFT.sql` and joins them only to visual metadata; `scripts/generate-schedule-bodies.mjs:26-78` consumes those derived rows for all three plates. The equality test compares all 27 rows across day, sequence, time, location, title, description, and item type. Direct visual inspection of the three regenerated body plates agrees with the seed, including the three previously divergent values. |
| FA-005 | PASS / CORRECTED | Fresh-schema representation sets `memory_cards.layout_version` default to 3 (`docs/data/01_SCHEMA_FINAL.sql:76-97`). Canonical RLS removes authenticated Memory Card UPDATE and constrains INSERT to owned trip membership, DB/JSON version 3 agreement, null `result_storage_path`, caption shape, 1-6 slots, and required placement fields (`docs/data/02_RLS_FINAL.sql:11-19,31-37,151-211`). The idempotent row-preserving migration represents the same boundary and removes both table/column UPDATE privileges plus the old UPDATE policy (`docs/data/10_FUNCTION_ARCHITECTURE_LOCK_CARD_WRITE_MIGRATION.sql:1-66`). The request additionally supplies live verification that default 3, no UPDATE policy, all authenticated column UPDATE privileges false, and the constrained INSERT policy are applied. No remote action was performed in this re-audit. |
| FA-006 | PASS / CORRECTED | `docs/03_ROUTE_AND_STATE_MAP.md:3-21` documents `/cards` as the single composer/editor/preview/saved/export/share state surface and explicitly excludes `/cards/editor` and `/cards/result` unless architecture is reopened. The production build contains `/cards` and neither separate route. |
| FA-007 | PASS / CORRECTED | `docs/00_README_FIRST.md:1-5` and `docs/01_PRECODEX_STATUS.md:1-3` are explicitly historical/non-authoritative. `AGENTS.md:27-28` identifies Function / Architecture Lock correction/re-audit as the current phase. No document declares the Design Guide already active. |
| FA-008 | PASS / CORRECTED | The tracked zero-byte `src/app/.env.local.tmp` is deleted, no replacement temp env artifact exists, `.env.local` remains ignored/unprinted, and the build consumed the existing local environment without modifying it. |

## 4. Requested regression checks

| Boundary | Result | Evidence |
| --- | --- | --- |
| Auth/member claim | PASS | No boarding, invite, claim, request-context, Supabase-client, member-contract, identity migration, or protected-route implementation changed in the correction diff. The current suite passes normalization, safe preview, UUID claim, both uniqueness dimensions, race/`23505`, invite validation, passive-auth, boarded restoration, and route-guard checks. `SUPABASE_SECRET_KEY` remains confined to `src/lib/supabase/admin.ts`. |
| Album ownership/RLS/signed URLs | PASS | Album source, Photo contract, Storage SQL, and identity migration are unchanged. Photo grants/policies remain ownership- and membership-bound; tests pass owner/path assertions, private signed-URL creation, scoped cache, partial failure, upload cleanup, and absence of public Storage URLs. |
| Card eight templates and legacy reads | PASS | The canonical schema still permits exactly eight template keys. The reader paths are unchanged, and tests pass all eight-template coordinate/catalog checks plus legacy simple v1, canonical experimental v1, v2, and v3 read/export compatibility without read-time rewrite. New writes remain v3 only. |
| Runtime Google APIs | PASS | Schedule runtime source has no Google SDK/API key, `maps.googleapis.com`, Google runtime `fetch`, cache, cron, refresh route, or background refresh. Static dated research data and ordinary outbound Maps search anchors remain. The source guard at `src/features/schedule/schedule-detail-guide.test.mjs:774-777` passes. |
| Deployment | PASS | No deployment, Vercel operation, hosting manifest, deployment workflow, or operations document changed. `next.config.ts` adds only the required server output-file trace for the private Schedule assets; the local production build proves the route and all 43 assets are packaged. |
| Protected files | PASS | `next-env.d.ts` SHA-256 is `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`; `public/assets/grandfather-cutout.png` is `f48d1c75c64be95fa073c2b92695af4b62602aa4814ae19cbc6f5d00b8264511`. Both match the recorded before/after hashes and have no diff. The original audit remained unedited during this re-audit at SHA-256 `f3513109858830b0e982216dd4683205653f6516765588112dfffd96df27ce1c`. |

## 5. Validation results

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | PASS | 174 tests passed; 0 failed, cancelled, skipped, or todo. Only Node experimental-loader/module-type warnings were emitted. |
| `npm run lint` | PASS | ESLint exited 0 with no findings. |
| `npx tsc --noEmit` | PASS | Exited 0 with no diagnostics. |
| `npm run build` | PASS | Next.js 16.3.2 compiled and type-checked successfully and generated 15 routes, including `/api/schedule-asset/[...path]`; its NFT manifest includes all 43 private Schedule assets. |
| `git diff --check` | PASS | Exited 0 with no whitespace errors after this report was created. |

## 6. Final requested output

1. Verdict: **LOCK READY — READY FOR WHOLE-APP DESIGN GUIDE**
2. Counts: **BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0**
3. FA-001..FA-008 status: **FA-001 PASS; FA-002 PASS; FA-003 PASS; FA-004 PASS; FA-005 PASS; FA-006 PASS; FA-007 PASS; FA-008 PASS**
4. Validation: **`npm test` PASS (174/174); `npm run lint` PASS; `npx tsc --noEmit` PASS; `npm run build` PASS; `git diff --check` PASS**
5. `git status --short`: recorded from the final audited working tree in the command output accompanying this report.
6. Report path: `docs/architecture/FUNCTION_ARCHITECTURE_LOCK_REAUDIT_V1.md`
