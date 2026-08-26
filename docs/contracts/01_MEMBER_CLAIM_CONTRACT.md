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
다른 member일 때 `409`다. 여러 auth user가 같은 `family_member_id`를 claim할 수 있다.
`family_members.boarded_at`은 null일 때만 설정하므로 device 수가 boarded count를 늘리지 않는다.

성공 응답은 trip의 id/slug/title/destination/start/end와 claimed member의
id/name/displayRole/boardedAt만 반환한다.
