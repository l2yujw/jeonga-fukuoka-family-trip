# Supabase Setup — Codex 없이 가능한 작업

## 지금 미리 해도 되는 것
1. Supabase project 생성
2. Anonymous Sign-Ins 활성화
3. schema SQL 검토/실행
4. table privilege/RLS SQL (`docs/data/02_RLS_FINAL.sql`) 검토/실행
5. Storage bucket/policy SQL 검토/실행
6. seed draft 중 확정 데이터만 반영

## 아직 하지 않아도 되는 것
- Next.js client 연결
- claim-member route
- upload code
- Realtime channel code

## 주의
Anonymous user는 이메일/비밀번호 입력 없이 생성되지만 authenticated role을 사용하므로 RLS 적용이 가능하다.
브라우저 데이터 삭제/다른 기기에서는 새로운 anonymous user가 만들어질 수 있으므로 가족 identity와 auth identity를 분리한다.

## Bucket
- trip-photos: private
- memory-card-results: private

공개 가족사진 bucket 사용 금지.
