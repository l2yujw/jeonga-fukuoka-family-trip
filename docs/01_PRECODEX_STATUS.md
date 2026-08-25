# 00. Pre-Codex Status

## Gate Summary

| 영역 | 상태 | Codex 필요 |
|---|---|---|
| Product / PM | LOCKED | No |
| Service Planning | LOCKED | No |
| UX | LOCKED | No |
| UI / Visual direction | LOCKED | No |
| Screen interaction spec | LOCKED | No |
| Content copy | LOCKED (가족 실명 일부 TBD) | No |
| Technical architecture | LOCKED | No |
| Supabase data model | LOCKED | No |
| RLS / Storage policy draft | LOCKED, 실행 전 검증 필요 | No |
| Card engine algorithm | LOCKED | No |
| Card template v1 coordinates | LOCKED | No |
| QA plan | LOCKED | No |
| Deployment plan | LOCKED | No |
| Actual repository code | NOT STARTED | **Yes** |
| Device implementation QA | NOT STARTED | **Yes, code 이후** |

## 최종 제품 한 문장
**가족이 이름으로 여행에 탑승하고, 일정과 사진을 함께 공유한 뒤, 여행 사진을 폴라로이드 감성의 한 장으로 남기는 비공개 모바일 웹.**

## Release Core
`탑승 → 일정 → 사진 공유 → 추억 카드 생성/저장`

이 흐름에 기여하지 않는 기능은 v1에서 추가하지 않는다.
