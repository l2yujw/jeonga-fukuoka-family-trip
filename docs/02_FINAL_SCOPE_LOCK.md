# 01. Final Scope Lock

## P0 — 반드시 구현
### Entry / Boarding
- 초대 URL
- 이름 입력
- 등록 가족 확인
- 가족 내 역할 표시
- 탑승 처리
- 탑승 완료 인원 표시
- 재접속 session 복원

### Home
- 여행 title/date
- 일정 CTA
- 사진 공유 CTA
- 추억 카드 CTA
- 간단 preview

### Schedule
- DAY 1 / DAY 2 / DAY 3
- 순서형 일정
- 장소/설명
- 확정되지 않은 내용은 예정/TBD 표시

### Album
- 사진 선택/업로드
- 사진 조회
- 업로더 표시
- 사진 caption
- 내 사진 삭제
- 카드 생성용 다중 선택

### Memory Card
- 사진 직접 선택
- 사진 랜덤 선택
- 8개 template
- template slot에 사진 random mapping
- 다시 섞기
- 카드용 caption 변경
- PNG export
- 기기 저장/공유 fallback

## P1 — 시간 허용 시
- Realtime Presence
- 사진 drag
- 사진 scale
- 사진 rotation
- 카드 layout DB 저장
- 결과 PNG Storage 저장

## P2 — 이번 가족행사에는 제외
- SaaS event builder
- 결제
- 일반 회원가입
- 이메일/OAuth
- 관리자 CMS
- 채팅/댓글
- 정산
- 영상 업로드
- 인쇄 주문
- AI 이미지 생성

## Cut Rule
하루 구현이 위험해지면 P1부터 제거한다.
P0 중에서도 카드 editor의 자유배치보다 **자동 결과 품질과 export 안정성**이 우선이다.
