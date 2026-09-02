# Production Data TODO

개발 시작을 막지 않지만 production seed 전 확인:

1. 가족 명단
   - 현재 확정: 류정원 / 전가네 큰손자
   - 나머지 name/display_role 필요

2. Invite token
고엔트로피 랜덤값 생성 후 DB에는 SHA-256 lowercase hex hash만 저장.

일정·항공·호텔·식사 정보는 `docs/data/04_SEED_DRAFT.sql`의 확정 데이터를 사용한다.
