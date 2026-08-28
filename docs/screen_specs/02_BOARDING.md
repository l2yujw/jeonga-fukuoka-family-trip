# Screen 02 — Boarding

## Goal
입장 행위 자체를 기억에 남게 만든다.

## Sequence
1. Name / role
2. `BOARDING...`
3. plane route motion
4. `탑승 완료`
5. 가족 탑승 현황

## Copy
`류정원`
`전가네 큰손자`

`후쿠오카행 전가네 가족여행에 합류했습니다.`

## Status
`{boardedCount} / {rosterCount} 탑승 완료`

Boarded:
- occupied seat
- sage completion cue / check

Not boarded:
- occupied but muted seat
- `탑승 대기`

Empty visual seat:
- empty seat illustration only
- no invented member or status

Current member:
- terracotta accent
- `나` or `방금 탑승`

## Family cabin
- complete screen uses exactly 10 visual seats in a 2-column × 5-row cabin
- `family_members.seat_order` (1–10) drives assigned positions
- null, invalid, or conflicting positions fall back to the next empty seat in stable roster order
- seats are status displays only; there is no interactive seat selection, swapping, or reordering
- no face/avatar image is required or rendered

## CTA
`여행 시작하기`

## Motion
- 상태 순서는 `confirm -> transition -> complete`를 유지한다.
- transition/loading 화면의 dwell target은 약 1800ms이며, 승인된 boarding transition의 허용 가능한 visual dwell 범위는 1600~2200ms이다.
- route/plane motion target은 약 1550ms이며, 보이는 transition 시간의 대부분을 차지해야 한다.
- complete 직전의 짧은 final settle은 의도된 동작이다.
- reduced motion에서는 움직이는 route animation 대신 static/fade-equivalent route presentation을 제공한다.
- reduced-motion 상태의 timing도 의도된 여유를 유지할 수 있으며 abrupt하게 전환하지 않는다.
