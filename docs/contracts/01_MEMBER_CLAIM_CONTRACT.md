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
- 다른 auth user가 claim한 member의 reassignment/takeover는 관리자 수동 절차이며 현재 범위 밖이다.

## Wrong-member recovery v1

`POST /api/member-switch`는 Bearer token의 현재 anonymous auth user와 HttpOnly invite
cookie의 trip을 서버에서 결정한다. client member ID는 받지 않는다.

service-role 전용 `release_trip_membership_for_switch` 함수가 현재 membership row와
family member row를 lock하고 한 transaction 안에서 membership 삭제와 기존 member의
`boarded_at = null`을 함께 처리한다. 같은 trip에서 현재 auth user가 올린 Photo 또는
Memory Card가 하나라도 있으면 `409 blocked_owned_content`로 중단하며 ownership은
이전하거나 다시 쓰지 않는다.
release는 owned-content 확인 동안 Photo/Memory Card write를 직렬화해 concurrent write가 membership release와 race하지 못하게 한다.

성공 후에도 anonymous auth session과 invite cookie는 유지된다. 기존 landing/claim
흐름으로 돌아가 새 member를 claim하며, 양쪽 unique conflict 보호는 그대로 적용된다.
