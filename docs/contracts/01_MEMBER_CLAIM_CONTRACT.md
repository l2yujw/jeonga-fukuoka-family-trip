# Member Claim Contract

## Why
화면에서는 이름만 입력하지만 Storage/DB 접근은 `auth.uid()` 기반으로 통제한다.

브라우저에 Supabase anonymous session이 없다면 사용자 주도 탑승 흐름에서만
`signInAnonymously()`를 호출한다. 초대 raw token은 invite route가 HttpOnly cookie로
normalize하고, DB에는 SHA-256 lowercase hex hash만 저장한다.

## Member preview
`POST /api/member-preview`

- Authorization: `Bearer <anonymous access token>`
- HttpOnly cookie: `jeonga_trip_invite=<raw invite token>`
- Body: `{ "name": "류정원" }`
- 이름은 NFC normalize/trim 후 해당 여행 안에서 exact match한다.
- 성공 응답은 일치한 member의 `memberId`, `name`, `displayRole`, `tripId`만 반환한다.
- roster를 반환하거나 membership/`boarded_at`을 만들지 않는다.

## Claim member
`POST /api/claim-member`

- Authorization: `Bearer <anonymous access token>`
- HttpOnly cookie: `jeonga_trip_invite=<raw invite token>`
- Body: `{ "memberId": "uuid" }`

서버는 auth와 invite를 다시 검증하고 member가 해당 trip 소속인지 확인한다.
같은 `(trip_id, auth_user_id)` membership 재요청은 동일 member일 때 idempotent success,
다른 member일 때 `409`다. `(trip_id, family_member_id)`도 unique이므로 다른 auth user가
이미 claim한 member는 `409`이며, insert race는 DB unique constraint가 최종 판정한다.
`family_members.boarded_at`은 null일 때만 설정하므로 device 수가 boarded count를 늘리지 않는다.

성공 응답은 trip의 id/slug/title/destination/start/end와 claimed member의
id/name/displayRole/boardedAt만 반환한다.

## Anonymous session persistence

- 같은 브라우저에서 Supabase session을 유지하면 같은 family member로 복원되고 `/`에서 `/home`으로 이동한다.
- 브라우저 auth storage를 지우면 anonymous identity도 사라진다.
- 새 identity는 이미 claim된 member를 자동으로 인계받을 수 없다.
- 일반 최초 claim은 다른 auth user의 member를 인계받지 않는다. 아래 명시적 Home 변경만 예외다.

## Explicit Home profile switch v1 (migration 16, unapplied)

`POST /api/member-switch` authenticates the anonymous Bearer user, resolves the existing
invite cookie, and verifies a boarded membership in that trip. It preserves that membership
and sets `jeonga_member_switch`: HttpOnly, SameSite=Lax, Secure in production, path `/`,
300-second max age. No client flag authorizes transfer.

The HMAC-SHA256 value binds auth user, trip, current membership row ID and expiration.
It uses the existing server-only `SUPABASE_SECRET_KEY` with the domain prefix
`jeonga:member-switch:v1:`. No new secret is required. Never expose/log this key or token;
key rotation invalidates pending switch intents. Missing signing configuration fails closed.

`GET /api/member-switch` validates the intent and current membership (no-store). Landing
keeps ordinary auto-forward unless this check returns active. The expiry timer returns Home;
server validation also rejects expired/tampered cookies. `DELETE` cancels and clears the
cookie; explicit cancel and returning Home, including browser Back, use this endpoint.

In switch mode `/api/member-preview` permits any exact registered name in the invite trip,
returns `claimedElsewhere` for the Boarding warning, and performs no mutation. Boarding
revalidates preview on entry. Its final confirmation calls `/api/claim-member` once at a time.

Only a valid intent selects `transfer_trip_membership_for_switch` in migration 16. The RPC
accepts trip, authenticated user, target member and `p_expected_membership_id`; the fourth
argument rejects intents whose original membership was revoked, inside the transaction.
It serializes transfers per trip, locks both memberships/member rows, checks trip boundaries,
replaces the current/target memberships, resets the previous boarded state and preserves or
sets the target boarded timestamp. Same-target retries are idempotent. Both unique constraints
remain authoritative. Execution is revoked from PUBLIC/anon/authenticated and granted only
to service_role. Ordinary claim and its 409 conflict/race handling remain unchanged.

The successful RPC returns status and boarded_at together, avoiding a post-commit read failure.
The API then returns the normal CurrentTripSession and clears the intent. RPC errors retain
intent, pending preview and existing access; no app-side release/delete/insert transfer exists.
A lost successful response can retry the same target without another membership replacement.
An evicted browser loses its CurrentTripSession on the next protected membership check.

Historical photos/cards and auth accounts are never changed by the transfer. Their auth and
member attribution stays immutable; new writes derive actual auth and current membership
as before. Existing Album/Card RLS and private asset/invite boundaries are unchanged.
Migration 16 must be applied in a separately authorized release before this flow can work remotely.
