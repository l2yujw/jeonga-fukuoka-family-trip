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
 └─ /cards
      ├─ /cards/editor
      └─ /cards/result
```

실제 구현에서 invite token을 pathname보다 cookie/session으로 normalize해도 된다.
UX상 URL 구조는 노출 대상이 아니다.

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
