# Function / Architecture Lock Audit v1

## 1. Baseline / scope

- Repository: `l2yujw/jeonga-fukuoka-family-trip`
- Audited working copy: `/Users/ryu/dev/jeonga-fukuoka-family-trip`
- Required branch: `main`
- Observed branch: `audit/function-architecture-lock` (baseline deviation; see limitations)
- Required HEAD: `4c33129bdc374b408142586d675f3a0dec17fbd8`
- Observed HEAD: `4c33129bdc374b408142586d675f3a0dec17fbd8` (exact match)
- Initial working tree: clean
- Previous phase assumed by the request: Identity Hardening / PR #25
- Audit date: 2026-09-03 (Asia/Seoul)

This was a repository-only audit of the authorities named in the request: `AGENTS.md`, scope and route locks, all contracts/data/screen/card-engine documents, the Schedule design system where it defines runtime boundaries, `src/**`, `package.json`, scripts, migrations, and the current test suite. It judges functional, security, ownership, persistence, export, and data-contract stability. It does not judge visual taste or code style.

No source, schema, migration, runtime asset, or product behavior was changed. No remote Supabase operation, deployment, Vercel operation, commit, push, PR, process reset, or process termination was performed.

### Audit limitations

- The request required `main`, but the supplied working copy was on `audit/function-architecture-lock`. The HEAD matched exactly, so the audit continued without switching branches or mutating Git state.
- No remote Supabase access was made. Live policies, production rows, bucket settings, migration history, and the externally reported PR #25 reconciliation were not re-verified.
- No deploy/Vercel check was made. The approved private visual plates live in ignored local paths, so their production availability cannot be established by this repository/build audit.
- Validation was static/unit/build based. No signed-in browser E2E, real device/iOS share/download, network-expiry, offline, multi-tab race, or accessibility-tool session was run.
- The tracked `references/UIUX_final_mockups.pdf` and the broad `TEMP` expression made the required grep output noisy; findings were confirmed against textual source files rather than inferred from the encoded PDF stream.

## 2. Executive verdict: NOT LOCK READY

Severity count:

| BLOCKER | HIGH | MEDIUM | LOW |
| ---: | ---: | ---: | ---: |
| 0 | 3 | 3 | 2 |

The core invite, anonymous-auth, membership, boarding, Home, Album, RLS ownership, signed-URL, and card-layout flows are substantially implemented and locally green. The lock is not ready because three likely functional/security defects remain:

1. Schedule itinerary-bearing raster and detail assets are directly public and Schedule has no approved raster exception.
2. The implemented/tested Korea-local current-day resolver is not used by the actual Schedule screen; a fresh visit defaults to Day 1.
3. PNG export converts an image decode failure into a successful card with an empty photo slot.

Three medium contract/documentation drifts would also make the next visual phase liable to preserve or amplify the wrong behavior.

## 3. Route + feature matrix

| Route / boundary | Implemented behavior | Auth / state boundary | Audit state | Evidence |
| --- | --- | --- | --- | --- |
| `/invite/[token]` | Validates a SHA-256 token, writes an HttpOnly invite cookie, redirects to `/` | Server-side admin lookup; raw token is not returned | Implemented + stable | `src/app/invite/[token]/route.ts`; `src/features/boarding/server/invite.ts` |
| `/` | Safe invalid/missing-invite state, retained-session re-entry, name entry and preview | Passive initialization reads session only; anonymous auth begins after user submit | Implemented + stable | `src/app/page.tsx`; `src/features/boarding/landing-entry.tsx`; `identity-hardening.test.mjs` |
| `/api/member-preview` | Exact normalized-name preview with safe response shape | Requires authenticated anonymous user plus valid invite/trip context; rejects either identity conflict | Implemented + stable | `src/app/api/member-preview/route.ts` |
| `/api/claim-member` | Claims by member UUID; idempotent; classifies both conflict dimensions and `23505`; sets `boarded_at` once | Server-only admin mutation after bearer auth and invite/trip validation | Implemented + stable | `src/app/api/claim-member/route.ts`; `identity-hardening.test.mjs` |
| `/boarding` | Confirm, boarding transition, roster/current member/count, direct-visit recovery | Restores only a boarded membership; otherwise returns to landing | Implemented + stable | `src/features/boarding/boarding-flow.tsx`; `boarding-logic.test.mjs` |
| `/home` | Canonical title/date, three destinations, date-driven Schedule preview, Album/Card previews | `TripAccessGuard`; Supabase membership/RLS; approved private decorative plate | Implemented + stable | `src/app/home/page.tsx`; `home-date-state.test.mjs` |
| `/schedule` | Day tabs, split list artwork, 27 detail hotspots/sheet, static researched supplements | Page is guarded, but itinerary-bearing files are public; initial day resolver is disconnected | Implemented + risky (`FA-001`, `FA-002`, `FA-004`) | `src/app/schedule/page.tsx`; `src/features/schedule/schedule-view.tsx`; `schedule-visual-assets.ts` |
| `/album` | Metadata list, upload, caption, owner delete, uploader filter/group/sort, progressive media | `TripAccessGuard`; private bucket, RLS, short-lived signed URLs | Implemented + stable | `src/features/album/album-view.tsx`; `album-repository.ts`; Album tests |
| `/cards` | Direct/random selection, 8 templates, reshuffle, v3 placement, persistence, saved cards, delete, export/share | `TripAccessGuard`; owner-scoped metadata; referenced-photo hydration | Implemented + risky (`FA-003`, `FA-005`) | `src/features/cards/memory-cards-view.tsx`; `memory-card*.ts*` |
| `/cards/editor` | No route; editing is state inside `/cards` | N/A | Stale docs only (`FA-006`) | `docs/03_ROUTE_AND_STATE_MAP.md:15`; no matching `src/app` route |
| `/cards/result` | No route; preview/export/result actions are state inside `/cards` | N/A | Stale docs only (`FA-006`) | `docs/03_ROUTE_AND_STATE_MAP.md:16`; no matching `src/app` route |
| Private visual APIs | Landing, boarding confirm/status, and Home plates are loaded from ignored local files after invite authorization | HttpOnly invite cookie is resolved before file access; no-store/private cache behavior | Implemented + stable, production availability unverified | `src/app/api/*-visual/route.ts`; `src/features/boarding/server/landing-visual.ts` |
| `/assets/schedule/**` | Schedule list/detail artwork served as static public files | No invite or membership check | Implemented + risky (`FA-001`) | `public/assets/schedule/**`; `schedule-visual-assets.ts:19-38` |

The production build exposes no `/cards/editor` or `/cards/result` route; it exposes the documented core routes and five private visual/API routes.

## 4. P0/P1 scope matrix

| Scope item | Status | Implementation / test evidence | Lock judgment |
| --- | --- | --- | --- |
| P0 Entry / Boarding: invite URL, name, preview, role, claim, boarded count, session restore | Implemented | Invite/claim routes, `landing-entry.tsx`, `boarding-flow.tsx`, boarding and identity tests | Stable |
| P0 Home: trip facts, three CTAs, simple previews | Implemented | `src/app/home/page.tsx`; Home date/preview tests | Stable |
| P0 Schedule: Day 1/2/3, order, place/description, confirmed itinerary only | Implemented with defects | Three visual configs and 27 detail IDs; Schedule tests | Risky: public asset boundary, fresh-visit day behavior, and canonical copy drift |
| P0 Album: select/upload/view/uploader/caption/own delete | Implemented | `album-view.tsx`, `album-repository.ts`, Album tests | Stable |
| P0 Album/Card integration: multi-select | Implemented in Cards composer | `memory-cards-view.tsx:376-410` | Stable; the selection surface is integrated into `/cards`, not a separate Album route mode |
| P0 Cards: direct/random source, 8 templates, mapping, reshuffle, card caption | Implemented | `memory-card-template-spec.ts`, `memory-card.ts`, `memory-cards-view.tsx`, card tests | Stable |
| P0 Cards: PNG export and save/share fallback | Implemented with defect | `memory-card-export.ts`; export tests | Risky: decode failure can silently export an incomplete card (`FA-003`) |
| P1 Realtime Presence | Not implemented | No runtime presence code | Intentionally deferred; not part of the effective lock |
| P1 photo drag / scale / rotation | Implemented | Pointer-event crop editor and shared placement geometry; card tests | Effective behavior contract; stable in repository tests |
| P1 card layout DB save | Implemented | v3 insert payload and saved-card reader | Effective behavior contract; app path is stable, DB write boundary is permissive (`FA-005`) |
| P1 rendered PNG Storage save | Not implemented | Client export only; repository tests exclude result upload | Intentionally deferred; `result_storage_path` must remain null until this feature is deliberately reopened |
| P2 excluded features | Not implemented | No payment, general signup, OAuth, CMS, chat, settlement, video, print, or AI-image flow | Correctly excluded |

## 5. Auth/security findings

Stable boundaries:

- The invite token is hashed with SHA-256 for lookup. The raw value is confined to an HttpOnly, `SameSite=Lax`, path-wide cookie with `Secure` in production.
- Missing or invalid invite state does not expose roster data or redirect a retained membership into the private UI.
- Passive landing initialization calls `getCurrentTripSession()` only. `signInAnonymously()` is reached through the user-driven submission path.
- Member preview normalizes exact names, returns only the versioned safe member shape, and rejects conflicts on both `(trip, auth user)` and `(trip, member)` axes.
- Claim is by member UUID, validates invite/auth/trip membership, supports idempotency, rereads after `23505`, and writes `boarded_at` only when null.
- `/home`, `/schedule`, `/album`, and `/cards` all wrap their body in `TripAccessGuard`. Supabase RLS remains the data authorization boundary beneath the client-side route guard.
- `SUPABASE_SECRET_KEY` is referenced only from `server-only` code (`src/lib/supabase/admin.ts`). Browser code uses only the publishable URL/key. No secret value is tracked or printed by this audit.
- The four approved raster plates are served only after invite-cookie authorization; the live values and controls required by `AGENTS.md` remain DOM/state.

Open security issue:

- `FA-001`: Schedule is a fifth rasterized product screen without an approved exception, and its itinerary-bearing list/detail files are in `public/`. A direct asset request bypasses both `TripAccessGuard` and Supabase membership/RLS. This is a private-boundary violation even though navigation to `/schedule` is guarded.

## 6. Data/RLS/Storage findings

Stable boundaries:

- `trip_memberships` has both unique dimensions required by the member-claim contract. `09_IDENTITY_HARDENING_MIGRATION.sql` includes preflight/reconciliation checks, adds the member uniqueness constraint, drops the obsolete member index, and rewrites Storage upload policies.
- Browser table privileges are revoked first and re-granted narrowly. Membership/family-member writes remain service-role only.
- Photo/Card reads require trip membership. Photo insert/update/delete and Card insert/update/delete bind the current auth identity to the current trip member/creator.
- Both buckets are private. Storage upload paths bind folder 1 to `trip_id` and folder 2 to `auth.uid()`; delete/update require object ownership.
- Photo upload uses `{tripId}/{authUserId}/{uuid}.{mime-ext}`, uploads Storage before metadata, best-effort removes the object if metadata insert fails, and only prepends successfully persisted rows.
- Photo deletion follows the contract: metadata first, then best-effort object cleanup.
- Signed URLs and Storage paths are not persisted inside card `layout_json`; new application writes use validated layout v3 and `result_storage_path: null`.

Open data-contract issues:

- `FA-004`: `docs/screen_specs/04_SCHEDULE.md` names `docs/data/04_SEED_DRAFT.sql` as the single canonical row source, but `scripts/generate-schedule-bodies.mjs` duplicates the itinerary and differs on at least three values. The generated Day 1 plate visibly contains the noncanonical “3,000여 년의 역사가 있는 신사” copy.
- `FA-005`: the client correctly emits v3/null, but the database boundary still defaults `layout_version` to 1 and authenticated Card insert/update policies accept any layout JSON and a non-null `result_storage_path`. This does not create cross-user access, but it permits a regressed or modified client to persist rows outside the locked read/write contract.

No duplicate membership index remains in the canonical schema/migration representation. No legacy single-axis claim assumption was found in the current routes, RLS, or Storage policies.

## 7. Screen-by-screen functional findings

### Landing / Boarding

Implemented and stable. Exact normalization, safe preview shape, member-ID claim, both uniqueness dimensions, race classification, one-time boarding timestamp, current-member restoration, ten-seat display, and boarded-count semantics are represented in code and tests. Failure states preserve a safe route back to landing.

### Home

Implemented and stable. The approved decorative plate is private; `가족 10명` remains a fixed party-size fact. Schedule date state, Album/Card preview records, counts, and navigation remain live DOM/data. The Korea-local Home preview clamps before/during/after the trip as tested.

### Schedule

Implemented but not lock-stable.

- `FA-001`: `ScheduleView` renders itinerary-bearing images from `/assets/schedule/**`; those files are tracked below `public/` and bypass authorization.
- `FA-002`: `ScheduleView` initializes `selectedDayNo` to `1`, then uses a valid stored day or `1`. It imports neither `getInitialScheduleDayIndex` nor `resolveScheduleDayNo`. The tested Korea-local helper therefore does not control the screen. A fresh visit on 2026-09-12 or 2026-09-13 opens Day 1.
- `FA-004`: the visual generator is a second itinerary source and is not identical to the canonical seed.
- Day order, 27 detail IDs, hotspot mapping, detail navigation/close behavior, static snapshot dates, and exclusion of the four known unconfirmed claims are otherwise covered and internally consistent.

### Album

Implemented and stable in the audited repository. Metadata is newest-first; media hydration is progressive; uploader identity uses member IDs rather than display names; caption and owner-delete paths align with RLS; partial upload/signing failures remain local and retriable; Card selection uses the same photo metadata model. HEIC/HEIF decode-unavailable fallback is explicitly documented.

### Memory Cards

Implemented with one high and one medium risk.

- All eight templates match `docs/card_engine/01_TEMPLATE_COORDINATES.json` in tests.
- Direct and random selection, exact slot counts, de-duplication, reshuffle, one-photo alternatives, card-only caption, legacy simple v1, experimental canonical v1, v2, and v3 reads are covered.
- Editor, DOM preview, saved preview, and Canvas export share template/slot and placement geometry. Four Cut uses its cropped black-strip bounds; other templates retain full 1080×1920 geometry.
- New application writes are v3; drag, scale, rotation, and persisted placement are therefore effective P1 contracts.
- `FA-003`: signed-URL presence is checked, but `loadImage()` failure is swallowed into `null`; Canvas paints only the slot background and still returns a PNG. The lower-scale retry runs only when rendering throws, so it cannot correct or report this path.
- `FA-005`: DB policies do not enforce the v3/null write boundary that the application and contract declare.

## 8. Media/performance findings

No correctness blocker was found in the requested Album/Card media architecture:

- The shared cache is auth-user scoped, uses a 3600-second signed-URL lifetime, refreshes five minutes early, batches 40 paths, coalesces in-flight work, and isolates partial failures.
- Album prewarms six media items and uses near-viewport observation with 1000px overscan.
- Cards startup fetches only photos referenced by saved cards; composer and crop/export hydration are explicit and bounded, with nine-item prewarm.
- Neither Album nor Cards requests public Storage URLs.
- Schedule researched data is a static dated snapshot. No Google SDK, API key, runtime fetch, server refresh route, cache, cron, or background refresh is present; Maps actions are outbound anchors.
- Responsive transformed thumbnails remain the documented future optimization and are not a lock blocker.

Schedule's public body PNGs are large (`5,325,508`, `4,509,112`, and `3,338,002` bytes; shared top `537,122` bytes). This is a mobile transfer/performance concern, but it is not assigned a separate correctness severity. The authorization/raster-boundary problem is already captured by `FA-001`.

## 9. Test/validation evidence

| Check | Result | Evidence / note |
| --- | --- | --- |
| `git status --short` before audit | PASS | Empty output; clean working tree |
| `git grep -n -E 'TODO|FIXME|HACK|TEMP' -- ':!package-lock.json'` | PASS with noise | Exit 0. `TEMP` also matches `TEMPLATE`, and the tracked PDF emitted a very large encoded line. Actionable text was limited to the intentional `docs/data/05_PRODUCTION_DATA_TODO.md` and deployment checklist reference; no source TODO/FIXME/HACK was identified. |
| `npm test` | PASS | 165 tests, 165 passed, 0 failed/skipped/todo. Node printed experimental-loader and typeless-package warnings only. |
| `npm run lint` | PASS | ESLint exited 0 with no findings. |
| `npx tsc --noEmit` | PASS | Exited 0 with no diagnostics. |
| `npm run build` | PASS | Next.js 16.3.2 production build compiled, type-checked, generated 14 routes, and exited 0. No process was stopped. |
| `git diff --check` | PASS | No whitespace errors after creating this report. |

Important coverage gaps despite the green suite:

- The Schedule date test exercises `resolveScheduleDayNo()` in isolation, not its use by `ScheduleView`; the screen wiring defect remains green.
- Export tests cover render-scale retry/share fallback but do not force a real image decode rejection and assert that no incomplete PNG is returned.
- RLS tests are SQL/source assertions. No local Supabase integration test or adversarial direct-client write test validates the Card v3/null boundary.
- There is no browser/device E2E run for 360/375/390/430 widths, iOS share/download, pointer gestures, session restoration, or signed-URL expiry.

## 10. Findings table

| ID | Severity | Area | Evidence | Risk | Minimal correction |
| --- | --- | --- | --- | --- | --- |
| FA-001 | HIGH | Schedule / security / asset boundary | `AGENTS.md:19`; `docs/design/SCHEDULE_VISUAL_DESIGN_SYSTEM_V1.md:9`; `schedule-visual-assets.ts:19-38`; `schedule-view.tsx:227-264`; tracked `public/assets/schedule/**` | Itinerary-bearing assets can be fetched without invite or membership authorization, and an unapproved raster exception becomes part of the architecture lock. | Before design lock, either render Schedule content as authorized live DOM/data, or explicitly approve the narrow Schedule raster exception and move all itinerary-bearing assets behind a private authorized delivery boundary. Do not leave them under `public/`. |
| FA-002 | HIGH | Schedule / date state | `schedule-view.tsx:44,52-64`; unused `schedule-data.ts:69-89`; `schedule-data.test.mjs:139-171` | Fresh visits during Day 2/3 show Day 1, contradicting the implemented/tested Korea-local current-day behavior. | Use the canonical current-day resolver when no valid detail or persisted day exists; add a screen-level wiring test for Day 2/3 and preserve explicit user selection/detail deep links. |
| FA-003 | HIGH | Memory Card / PNG export | `memory-card-export.ts:38-46,280-296,336-344`; `memory-cards-view.tsx:489-521` | A signed but undecodable/expired/malformed image can produce a successful blank-slot PNG rather than a failure/retry message, violating P0 export quality/stability. | Treat every required image decode failure as a render failure (or render an explicit contract-approved unavailable marker); add a decode-rejection test that forbids a successful incomplete export. |
| FA-004 | MEDIUM | Schedule / canonical data | `docs/screen_specs/04_SCHEDULE.md:31-35`; `04_SEED_DRAFT.sql:49,61,67`; `generate-schedule-bodies.mjs:43,66,97` | Design regeneration can preserve incorrect facts or create further divergence from the single canonical itinerary. | Align the current generator/artifacts to the seed and make the generator consume one canonical structured source or add a complete equality test for all displayed itinerary fields. |
| FA-005 | MEDIUM | Card persistence / DB contract | `03_CARD_LAYOUT_CONTRACT.json:37-54,123-128`; `01_SCHEMA_FINAL.sql:93-95`; `02_RLS_FINAL.sql:21-36,164-202`; correct client payload at `memory-card.ts:582-584` | A modified or regressed authenticated client can persist non-v3/malformed layout rows or a non-null result path even though those writes are outside the locked contract. | Enforce v3/null on the DB insert boundary (policy/RPC/constraint as appropriate), validate DB/JSON version agreement, and withhold unused result-path mutation until rendered-result Storage is deliberately implemented. |
| FA-006 | MEDIUM | Route documentation | `docs/03_ROUTE_AND_STATE_MAP.md:14-16`; built route list; integrated state in `src/app/cards/page.tsx` | Polish work may create or navigate to routes that do not exist, reopening route/state semantics. | Update the route map to document `/cards` as the single composer/editor/result route, or deliberately implement/relock separate routes in a later architecture phase. |
| FA-007 | LOW | Phase documentation | `docs/00_README_FIRST.md:1,30-49`; `docs/01_PRECODEX_STATUS.md:1`; current `AGENTS.md:27-28` | Old entry instructions can send maintainers through obsolete phase gates; no runtime impact. | Mark the pre-Codex files historical and point active work to the current Phase 5 authorities. |
| FA-008 | LOW | Repository hygiene | tracked zero-byte `src/app/.env.local.tmp` | An env-shaped temp artifact creates needless secret-review ambiguity; it currently contains no data and has no runtime impact. | Remove the empty tracked temp file in the correction change; keep real local env files ignored. |

## 11. Documentation drift table

| Authority / claim | Implementation reality | Classification | Related finding |
| --- | --- | --- | --- |
| `docs/03_ROUTE_AND_STATE_MAP.md` lists `/cards/editor` and `/cards/result` | Build and `src/app` contain only `/cards`; editor/result are component state | Stale docs only | FA-006 |
| `docs/screen_specs/04_SCHEDULE.md` says the seed is the single exact source | The raster generator carries a duplicate, divergent row list | Data-contract drift | FA-004 |
| Card contract says the only new write is v3 and `resultStoragePath` is null/deferred | Client complies; schema/RLS still admit other versions/non-null result path | Boundary drift | FA-005 |
| Schedule test name says it opens on the Korea-local trip day | Only the helper is tested; `ScheduleView` does not call it | Test/implementation drift | FA-002 |
| `AGENTS.md` approves four specific private raster exceptions and says they are not a pattern | Schedule renders a fifth itinerary-bearing raster UI from public assets | Architecture drift | FA-001 |
| Pre-Codex readme/status are written as active entry instructions | `AGENTS.md` declares Phase 5 Memory Card MVP | Historical documentation drift | FA-007 |

The observed audit branch (`audit/function-architecture-lock`) versus required `main` is treated as a baseline limitation rather than a repository finding because the audited commit exactly matches the required SHA and the initial tree was clean.

## 12. Proposed locked behavior/architecture boundaries

These are the boundaries that can be locked after `FA-001` through `FA-005` are corrected:

1. **Invite/auth:** `/invite/[token]` validates the hashed invite and writes the HttpOnly cookie; passive landing reads but never creates auth; anonymous auth is user-initiated.
2. **Identity:** one auth identity per trip maps to at most one member and one member to at most one auth identity; preview is safe; claim is UUID-based, idempotent, race-classified, and sets `boarded_at` once.
3. **Route authorization:** `/home`, `/schedule`, `/album`, and `/cards` require a current boarded trip membership; RLS is authoritative for data, and every private visual/data asset has an authorization boundary.
4. **Routes/state:** card creation, editing, preview, saved results, export, and sharing remain states within `/cards`; no `/cards/editor` or `/cards/result` contract exists unless deliberately reopened.
5. **Trip truth:** itinerary order, times, titles, locations, descriptions, and meal/hotel facts derive from one canonical source. Schedule defaults to the Korea-local trip day unless a valid stored/manual selection or detail link takes precedence.
6. **Photos:** private `trip-photos`; `{trip}/{auth}/{uuid}.{ext}`; metadata-first reads; runtime-only signed URLs; owner caption/delete; DB insert failure cleans the uploaded object best-effort; delete remains metadata-first.
7. **Cards:** exactly eight templates; new writes are canonical v3; legacy simple v1, experimental canonical v1, v2, and v3 remain readable without read-time rewrite; photo IDs/placement/caption only are persisted; URLs, paths, decorations, and rendered result are not.
8. **Card ownership:** trip members can read trip cards; only the current member/auth creator can create, mutate, or delete their card.
9. **Geometry/export:** shared canonical slot/placement geometry governs editor, preview, saved render, and PNG; Four Cut keeps cropped bounds, others keep full portrait bounds; a required missing/undecodable photo cannot silently produce a complete-success result.
10. **Media fetching:** auth-scoped signed-URL cache, early refresh, batching/in-flight dedupe, progressive Album hydration, referenced-only Cards startup, and explicit crop/export hydration remain behavior contracts.
11. **Remote integrations:** Schedule snapshots remain static and dated; there is no runtime Google API/SDK/key/fetch/cache/background refresh. Outbound Maps links remain ordinary anchors.
12. **Deferred scope:** Realtime Presence and rendered-result Storage remain absent. `result_storage_path` remains null until a separately authorized phase reopens storage/write/cleanup semantics.

## 13. Allowed vs forbidden Design/Polish changes

Allowed without reopening the lock, after corrections:

- CSS, spacing, typography, color, responsive layout, and visual hierarchy within the behavior contracts.
- Factual wording polish that does not change canonical itinerary meaning, identity semantics, ownership, dates, counts, or route meaning.
- Approved decorative assets through their approved private runtime boundary.
- Non-semantic component extraction needed for polish, without changing data-fetch ownership or state transitions.
- Accessibility and 360/375/390/430-safe presentation corrections that preserve actions and state.

Forbidden without reopening the lock:

- Schema, migration, grants, RLS, or Storage policy changes beyond the agreed correction set.
- Invite, anonymous session, preview, member claim, conflict, `boarded_at`, or recovery changes.
- Route authorization changes or creation of new editor/result route semantics.
- Public exposure of private visual, photo, card, or itinerary-bearing assets.
- Storage path/owner identity changes; photo/card ownership changes.
- Persisted card layout/version/slot/placement/caption or export-geometry changes.
- Changes to fetch ownership/scope, cache identity, or hydration triggers.
- New product features, remote APIs, live Maps data, SDKs, keys, background jobs, or rendered-result Storage.

## 14. Final gate

CORRECTIONS REQUIRED BEFORE DESIGN GUIDE

## 15. Minimal correction sequence

1. Resolve the Schedule raster/private boundary, remove itinerary-bearing files from public delivery, and align the generator/current artifacts to the canonical seed without redesigning the approved visual.
2. Wire the existing Korea-local current-day resolver into `ScheduleView` for the no-detail/no-valid-persisted-selection case and add the missing screen-level test.
3. Make required image decode failure fail Card export (or use one explicitly approved unavailable rendering) and add the focused regression test.
4. Represent the Card v3/null new-write boundary at the database authorization/validation layer and add its migration/test representation; keep result PNG Storage deferred.
5. Correct the route/phase documents and remove the empty tracked env temp artifact in the same bounded correction phase.
