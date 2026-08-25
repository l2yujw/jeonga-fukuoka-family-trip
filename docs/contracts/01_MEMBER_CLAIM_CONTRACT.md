# Member Claim Contract

## Why
화면에서는 이름만 입력하지만 Storage/DB 접근은 `auth.uid()` 기반으로 통제한다.

## Precondition
브라우저에 Supabase anonymous session이 없다면 `signInAnonymously()`.

## Server endpoint
`POST /api/claim-member`

### Input
```json
{
  "name": "류정원",
  "inviteToken": "opaque-token"
}
```

### Server responsibility
1. input normalize
2. invite hash validate
3. trip resolve
4. exact family member lookup
5. auth user ↔ family member membership upsert
6. boarded_at set if null
7. minimal member response

### Response
```json
{
  "tripId": "uuid",
  "member": {
    "id": "uuid",
    "name": "류정원",
    "displayRole": "전가네 큰손자",
    "boardedAt": "ISO-8601"
  }
}
```

## Note
Anonymous auth session can disappear if browser data is cleared or another device is used.
같은 가족 이름을 새 anonymous user가 다시 claim하는 것은 가족행사용 v1에서는 허용 가능한 정책이다.
