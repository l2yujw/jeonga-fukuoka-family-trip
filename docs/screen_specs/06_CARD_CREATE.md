# Screen 06 — Memory Card Create

## Header
`추억 카드 만들기`

## Step
1 사진 선택
2 배치 선택
3 카드 미리보기 + 사진 위치 조정 + 카드 문구 + 저장

## Photo Selection
- 직접 선택
- `랜덤 사진 선택`

## Templates
1. 폴라로이드 무드보드
2. 4컷 스트립
3. 에디토리얼 콜라주
4. Travel Postcard
5. Scrapbook Trio
6. Film Contact Sheet
7. One Moment
8. Instant Memory

## CTA
Primary: `랜덤 선택으로 생성`
Secondary: `직접 선택해서 만들기`

## UX
사용자가 편집기를 배우기 전에 결과를 먼저 볼 수 있어야 한다.

## STEP 3 Photo placement
- 점유된 slot별 선택
- 한 손가락: pan
- 두 손가락: 같은 gesture-start baseline에서 동시 pan + pinch zoom + free rotation
- pointer 수가 `1 → 2 → 1`로 바뀌면 현재 placement에서 seamless rebase
- 확대: contain scale 대비 `1.0..max(6, coverZoom*4)`; `1.0`에서 회전 전 원본 전체 표시
- 회전: `[-180, 180)`, 위치: viewport-relative `offsetX/offsetY`
- 상하좌우 pan과 surface 배경 노출을 허용하고, 사진이 완전히 frame 밖으로 사라지는 것만 10% overlap으로 방지
- 회전은 사용자 zoom을 변경하지 않음
- trackpad raw two-point coordinates는 가정하지 않으며 감지 가능한 pinch/Safari gesture와 fallback controls만 제공
- crop editor는 slot inner image area의 실제 ratio 사용
- `사진 전체`는 centered contain, `프레임 채우기`와 초기화는 centered cover, 취소는 editor-local, 적용만 STEP 3 draft에 반영
- editor/preview/saved preview/PNG는 frame padding/footer를 제외한 같은 inner photo viewport geometry와 surface 배경을 사용

신규 저장은 layout v3이며, 기존 v1/v2는 저장값 변경 없이 centered cover로 읽는다.
