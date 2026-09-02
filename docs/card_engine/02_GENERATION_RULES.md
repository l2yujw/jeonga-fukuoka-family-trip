# Card Generation Rules

## Random ≠ Random Position
절대 자유 랜덤 좌표로 만들지 않는다.

## Generate
1. eligible photo pool 확보
2. template 선택
3. template min/max에 맞는 사진 수 결정
4. Fisher-Yates shuffle
5. slot에 순서대로 mapping하고 사진/slot 비율로 계산한 centered-cover placement 적용
6. slot preset rotation 유지
7. caption 후보가 있으면 text slot 채움
8. preview

## Reshuffle
기본:
- template 고정
- photo-to-slot mapping만 변경

`다른 배치`:
- 같은 template variation 또는 다른 template 선택

사진이 같은 slot에 유지되면 placement도 유지한다.
사진 교체·순서 변경·다시 섞기로 slot의 사진이 달라지면 해당 slot만 기본 placement로 초기화한다.

## Photo count
- 0: 카드 생성 불가
- 1: one_moment, instant_memory
- 2: one_moment, instant_memory, postcard_duo
- 3: one_moment, instant_memory, postcard_duo, scrapbook_trio
- 4~5: one_moment, instant_memory, postcard_duo, scrapbook_trio, four_cut, editorial_collage
- 6+: 모든 8개 template

template별 최소 사진 수를 충족하는 항목만 활성화.

## Quality Rule
- 자동 template preset rotation은 ±5° 이내(사용자 편집 rotation은 `[-180, 180)`)
- 폴라로이드 사이 겹침은 의도된 preset만
- text는 이미지 핵심 얼굴을 덮지 않음
- photo placement 기본값은 사진/slot inner viewport의 `coverZoom`을 계산한 centered cover(`rotation 0`, `offsetX/Y 0`)
- 편집에서는 한 손가락 pan, 두 손가락 동시 pan/pinch/free rotation을 기본 UX로 사용
- zoom은 contain scale 대비 값이며 `1`에서 회전 전 원본 전체가 보이고 최대값은 `max(6, coverZoom*4)`
- `offsetX/Y`는 viewport 크기 대비 image center 이동량이며 상하좌우 pan을 허용함
- 회전은 zoom을 변경하지 않으며 사진 밖의 surface 배경 노출을 허용함
- pan은 사진이 완전히 frame 밖으로 사라지지 않도록 짧은 변 기준 10% overlap만 유지함
- `사진 전체`는 centered contain, `프레임 채우기`와 `초기화`는 centered cover로 editor-local placement를 설정함
- editor/DOM preview/saved preview/Canvas export는 frame padding/footer를 제외한 inner photo viewport, placement geometry, surface 배경을 공유

## Export
- 1080×1920 canonical portrait
- preview canvas와 export resolution 분리
- Blob export
- iOS memory 실패 시 lower scale fallback

## Layout persistence
- 신규 저장은 canonical layout v3만 사용
- legacy simple v1, canonical experimental v1, canonical v2, canonical v3 읽기 지원
- v1/v2는 저장값을 변경하지 않고 centered cover로 렌더링
