-- PRE-PRODUCTION DRAFT
-- Replace invite token hash and TBD family members before production.

insert into public.trips (
  slug, title, destination, start_date, end_date, invite_token_hash
)
values (
  'jeonga-fukuoka-2026',
  '전가네 후쿠오카 가족여행',
  '후쿠오카 · 가라츠 · 유후인 · 벳부 · 아소',
  '2026-10-09',
  '2026-10-11',
  'REPLACE_WITH_REAL_HASH'
)
on conflict (slug) do nothing;

insert into public.family_members (trip_id, name, display_role)
select id, '류정원', '전가네 큰손자'
from public.trips where slug = 'jeonga-fukuoka-2026'
on conflict (trip_id, name) do nothing;

-- Remaining 8 family members are intentionally not invented.
-- Add them after names/roles are confirmed.

insert into public.itinerary_items
(trip_id, day_no, sequence, time_label, location_name, title, description, item_type)
select t.id, v.day_no, v.sequence, v.time_label, v.location_name, v.title, v.description, v.item_type
from public.trips t
cross join (
  values
  (1, 10, null, '인천', '인천 국제공항 출발', 'LJ261 출발시간은 견적서 내 06:05/06:50 충돌. 최종 항공권 확인 필요.', 'flight'),
  (1, 20, '08:10', '후쿠오카', '후쿠오카 국제공항 도착', '입국 수속 후 전용 차량 탑승', 'flight'),
  (1, 30, null, '가라츠', '가라츠 이동', null, 'move'),
  (1, 40, null, '가라츠', '니지노 마쓰바라', '일본 3대 송림 해안가의 소나무 숲', 'sightseeing'),
  (1, 50, null, '가라츠', '카가미야마 전망대', '가라츠시의 절경 감상', 'sightseeing'),
  (1, 60, null, '후쿠오카', '후쿠오카 이동', null, 'move'),
  (1, 70, null, '후쿠오카', '라라포트 후쿠오카', '초대형 건담 입상이 있는 종합 쇼핑몰', 'sightseeing'),
  (1, 80, null, '후쿠오카', '호텔 체크인 및 휴식', '저녁 자유시간. 예정 호텔은 별도 확정 필요.', 'hotel'),
  (1, 90, null, '후쿠오카', '모모치 해변공원 / 마크이즈', '자유시간 추천 일정', 'optional'),

  (2, 10, null, '후쿠오카', '호텔 조식', null, 'meal'),
  (2, 20, null, '다자이후', '다자이후 텐만구', '사계절이 아름다운 신사', 'sightseeing'),
  (2, 30, null, '유후인', '유후인 이동', null, 'move'),
  (2, 40, null, '유후인', '유노쓰보 가이도', '예쁜 상점이 이어지는 거리', 'sightseeing'),
  (2, 50, null, '유후인', '긴린코 호수', '유후인의 대표 호수', 'sightseeing'),
  (2, 60, null, '벳부', '벳부 이동', null, 'move'),
  (2, 70, null, '벳부', '가마도지옥', '족욕 체험, 온천계란 및 라무네사이다 특전', 'sightseeing'),
  (2, 80, null, '벳부', '유노하나 재배지', '천연입욕제를 만드는 재배지', 'sightseeing'),
  (2, 90, null, '큐슈', '온천호텔 체크인', '석식 및 온천욕. 예정 호텔은 최종 확정 전까지 후보 표기.', 'hotel'),

  (3, 10, null, '아소', '아소 이동', null, 'move'),
  (3, 20, null, '아소', '아소 대관봉', '아소 대자연의 절경', 'sightseeing'),
  (3, 30, null, '고코노에', '고코노에 이동', null, 'move'),
  (3, 40, null, '고코노에', '코코노에 유메오오츠리바시', '꿈의 대현수교 산책', 'sightseeing'),
  (3, 50, null, '후쿠오카', '후쿠오카 이동', null, 'move'),
  (3, 60, '20:05', '후쿠오카', '후쿠오카 공항 출발', 'LJ266', 'flight'),
  (3, 70, '21:35', '인천', '인천 국제공항 도착', '여행 종료', 'flight')
) as v(day_no, sequence, time_label, location_name, title, description, item_type)
where t.slug = 'jeonga-fukuoka-2026'
on conflict (trip_id, day_no, sequence) do nothing;
