# 전가네 후쿠오카 가족여행 — Pre-Codex Complete v3 (Historical)

> Historical planning snapshot only. Do not use this document as the active execution gate. Current work is governed by `AGENTS.md`, with Function / Architecture Lock re-audit pending.

## 당시 상태
**Codex 호출 전 할 수 있는 설계 작업을 최대한 완료한 상태다.**

현재 Codex가 없어도 확정 가능한 항목:
- 제품 범위
- IA / route
- 모든 화면의 상태와 행동
- UI/Visual 방향
- 실제 여행 일정 데이터 초안
- 가족 identity 모델
- Supabase DB schema
- RLS
- Storage bucket / policy
- client/server 책임
- photo metadata contract
- memory-card layout contract
- 카드 template 좌표
- random generation 규칙
- 카피
- QA release gate
- 배포/운영 runbook

## 당시 Codex를 아직 실행하지 않은 이유
지금 Codex를 호출하면 설계 결정과 구현 결정을 동시에 하게 된다.
이 패키지는 그 판단을 선행해서 잠그고, 나중에 Codex가 **구현만 하도록** 만드는 것이 목적이다.

## 당시 Codex가 처음 필요하다고 정한 시점
`10_precodex_final/12_CODEX_ENTRY_GATE.md`의 조건을 모두 확인한 뒤:
- 실제 Next.js repository scaffold
- component/code 작성
- Supabase SDK 연결
부터 Codex를 시작한다.

## 남은 production data 항목
- 류정원 외 가족의 실제 이름/역할
- invite token hash

일정·항공·호텔 정보는 최종 여행 안내문 기준으로 `docs/data/04_SEED_DRAFT.sql`에 확정되었다.

## 먼저 볼 파일
1. `10_precodex_final/00_PRECODEX_STATUS.md`
2. `10_precodex_final/01_FINAL_SCOPE_LOCK.md`
3. `10_precodex_final/02_ROUTE_AND_STATE_MAP.md`
4. `10_precodex_final/screen_specs/`
5. `10_precodex_final/data/`
6. `10_precodex_final/card_engine/`
7. `10_precodex_final/12_CODEX_ENTRY_GATE.md`

`_archive_codex_requests_not_yet_needed/`는 지금 실행하지 않는다.
