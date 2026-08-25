# Current Platform Validation Notes

2026-08-25 기준 공식 문서 확인 결과:

## Supabase Anonymous Auth
- anonymous sign-in은 email/password 없이 authenticated user session을 만든다.
- anonymous user도 DB access 시 `authenticated` Postgres role을 사용한다.
- RLS에서 필요하면 JWT `is_anonymous` claim으로 구분 가능하다.
- Next.js에서 anonymous user metadata가 사용자 간 캐시되지 않도록 dynamic rendering 주의가 필요하다.

## Supabase Private Storage
- private asset은 authenticated request 또는 time-limited signed URL로 제공 가능.
- Storage access는 `storage.objects` RLS로 제어한다.
- `storage.foldername(name)` helper로 path folder를 정책에서 검사 가능하다.
- service role key는 RLS를 bypass하므로 client에 절대 노출하지 않는다.

## Project Decision
따라서:
`사용자 UX = 이름만 입력`
`내부 security identity = Supabase anonymous auth`
`family identity = family_members`
`authorization = trip_memberships + RLS`
구조로 고정한다.
