# 02. Route / State Map

## Route
```text
/invite/[token]
   ↓
/                    landing + name entry
   ↓
/boarding            member confirm + boarding result
   ↓
/home
 ├─ /schedule
 ├─ /album
 └─ /cards             composer + editor + preview + saved cards + export/share
```

실제 구현에서 invite token을 pathname보다 cookie/session으로 normalize해도 된다.
UX상 URL 구조는 노출 대상이 아니다.

`/cards`가 카드 생성·편집·미리보기·저장 목록·export/share를 모두 담당하는 단일 route/state surface다.
별도 `/cards/editor`, `/cards/result` route는 존재하지 않으며, 아키텍처를 명시적으로 다시 열기 전에는 추가하지 않는다.

## Global Session State
```text
trip
member
authSession
isBoarded
onlineMembers(optional)
```

## Global UI State
- loading
- offline/network error
- toast
- modal
- bottom navigation active tab

## Route Guard
### Landing
invite validation 이전에 가족 roster 전체를 보내지 않는다.

### Internal routes
필수:
- valid Supabase auth session
- current trip membership

없으면 landing으로 이동.

## State Transition
```text
VISITOR
 → INVITE_VALIDATED
 → ANON_AUTH_READY
 → MEMBER_CLAIMED
 → BOARDED
 → TRIP_MEMBER
```

`ONLINE`은 별도의 ephemeral presence state다.
