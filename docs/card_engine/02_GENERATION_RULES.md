# Card Generation Rules

## Random ≠ Random Position
절대 자유 랜덤 좌표로 만들지 않는다.

## Generate
1. eligible photo pool 확보
2. template 선택
3. template min/max에 맞는 사진 수 결정
4. Fisher-Yates shuffle
5. slot에 순서대로 mapping
6. slot preset rotation 유지
7. caption 후보가 있으면 text slot 채움
8. preview

## Reshuffle
기본:
- template 고정
- photo-to-slot mapping만 변경

`다른 배치`:
- 같은 template variation 또는 다른 template 선택

## Photo count
- 0: 카드 생성 불가
- 1: one_moment, instant_memory
- 2: one_moment, instant_memory, postcard_duo
- 3: one_moment, instant_memory, postcard_duo, scrapbook_trio
- 4~5: one_moment, instant_memory, postcard_duo, scrapbook_trio, four_cut, editorial_collage
- 6+: 모든 8개 template

template별 최소 사진 수를 충족하는 항목만 활성화.

## Quality Rule
- rotation ±5° 이내
- 폴라로이드 사이 겹침은 의도된 preset만
- text는 이미지 핵심 얼굴을 덮지 않음
- photo crop은 center 기본
- 필요 시 편집에서 reposition

## Export
- 1080×1920 canonical portrait
- preview canvas와 export resolution 분리
- Blob export
- iOS memory 실패 시 lower scale fallback
