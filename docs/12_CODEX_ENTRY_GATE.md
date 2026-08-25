# 12. Codex Entry Gate

## Codex를 부르기 전에 완료된 것
- [x] Product scope
- [x] Screen inventory
- [x] Screen states
- [x] Copy
- [x] Design tokens
- [x] Tech stack
- [x] Auth model
- [x] DB schema
- [x] RLS draft
- [x] Storage policy draft
- [x] Seed draft
- [x] Data contracts
- [x] Card templates
- [x] Card generation algorithm
- [x] QA matrix
- [x] Deployment sequence
- [x] Visual references

## Codex가 처음 필요한 작업
**실제 repository 구현.**

처음 작업은:
1. Next.js scaffold
2. dependencies
3. environment
4. Supabase clients
5. design tokens/component foundation

이 시점 전에는 Codex 결과가 필요 없다.

## Recommended implementation order after entry
1. Scaffold + Design Foundation
2. Boarding
3. Schedule
4. Album
5. Card MVP
6. Optional editor polish
7. Release QA

## Rule
앞 단계 구현 결과가 있어야 다음 구현 단계에서 실제 코드 수정 위치/컴포넌트 구조를 정확히 지정할 수 있으므로,
**Codex는 여기서부터 순차 사용**한다.
