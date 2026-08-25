# QA Matrix

## P0 Environment
- iPhone Safari
- Android Chrome
- Desktop Chrome responsive

## Viewports
- 360×800
- 375×812
- 390×844
- 430×932

## Entry
- valid name
- invalid name
- whitespace
- duplicate submit
- session restore
- another device

## Boarding
- first boarded member
- 7/9
- all boarded
- presence disconnect does not unboard

## Schedule
- all 3 days
- long title
- null time
- unresolved flight time
- hotel TBD

## Photo
- JPEG
- PNG
- iPhone-origin image
- large image
- multiple sequential uploads
- caption null / 300 chars
- network failure
- delete own
- cannot delete other member photo

## Card
- 0 photos
- 4 photos
- 6 photos
- 8+ photos
- reshuffle
- caption edit
- export
- share unsupported fallback
- reload after save if persistence enabled

## Release Gate
반드시 실제 iPhone에서:
`입장 → 일정 → 사진 3장 업로드 → 앨범 확인 → 카드 생성 → 이미지 저장`
한 번에 통과.
