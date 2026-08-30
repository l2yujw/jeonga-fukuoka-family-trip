-- CANONICAL TRIP DATA
-- Replace invite token hash and TBD family members before production.

begin;

insert into public.trips (
  slug, title, destination, start_date, end_date, invite_token_hash
)
values (
  'jeonga-fukuoka-2026',
  '전가네 후쿠오카 가족여행',
  '후쿠오카 · 야나가와 · 다케오 · 우레시노 · 나가사키',
  '2026-09-11',
  '2026-09-13',
  'REPLACE_WITH_SHA256_LOWERCASE_HEX_HASH'
)
on conflict (slug) do update set
  title = excluded.title,
  destination = excluded.destination,
  start_date = excluded.start_date,
  end_date = excluded.end_date;

insert into public.family_members (trip_id, name, display_role)
select id, '류정원', '전가네 큰손자'
from public.trips where slug = 'jeonga-fukuoka-2026'
on conflict (trip_id, name) do nothing;

-- Remaining 8 family members are intentionally not invented.
-- Add them after names/roles are confirmed.

delete from public.itinerary_items i
using public.trips t
where i.trip_id = t.id
  and t.slug = 'jeonga-fukuoka-2026';

insert into public.itinerary_items
(trip_id, day_no, sequence, time_label, location_name, title, description, item_type)
select t.id, v.day_no, v.sequence, v.time_label, v.location_name, v.title, v.description, v.item_type
from public.trips t
cross join (
  values
  (1, 10, '07:00', '인천', '인천국제공항 1터미널 집결', '탑승수속 및 출발 준비', 'flight'),
  (1, 20, '09:30', '인천', '인천국제공항 출발', '제주항공 7C1403', 'flight'),
  (1, 30, '11:00', '후쿠오카', '후쿠오카공항 도착', '1명 합류 후 일정 시작', 'flight'),
  (1, 40, null, '야나가와', '야나가와 이동', '약 1시간 20분 · 이동 중 간식 제공', 'move'),
  (1, 50, null, '야나가와', '중식 · 현지식', '야나가와 도착 후 점심 식사', 'meal'),
  (1, 60, null, '야나가와', '야나가와 뱃놀이', '운하를 따라 즐기는 여름 뱃놀이', 'sightseeing'),
  (1, 70, null, '다케오', '다케오 이동', '약 1시간 10분 소요', 'move'),
  (1, 80, null, '다케오', '다케오 신사', '3,000여 년의 녹나무가 있는 신사', 'sightseeing'),
  (1, 90, null, '다케오', '다케오 도서관', '감각적인 공간의 복합문화 요소', 'sightseeing'),
  (1, 100, null, '우레시노', '우레시노 이동', '약 30분 소요', 'move'),
  (1, 110, null, '우레시노', '오에도 온센 모노가타리 우레시노칸', E'체크인 · 석식(호텔 뷔페)\n온천욕으로 하루 마무리', 'hotel'),

  (2, 10, null, '우레시노', '호텔 조식', '호텔식으로 여유로운 아침', 'meal'),
  (2, 20, null, '나가사키', '나가사키 이동', '약 50분 소요', 'move'),
  (2, 30, null, '나가사키', '나가사키 차이나타운', '일본의 오래된 차이나타운 산책', 'sightseeing'),
  (2, 40, null, '나가사키', '오우라 천주당', '일본 국보 서양식 목조 성당', 'sightseeing'),
  (2, 50, null, '나가사키', '그라바엔', '이국적인 분위기의 역사 정원', 'sightseeing'),
  (2, 60, null, '나가사키', '중식 · 현지식', '현지식으로 점심 식사', 'meal'),
  (2, 70, null, '후쿠오카', '후쿠오카 이동', '약 2시간 소요', 'move'),
  (2, 80, null, '텐진', '텐진거리 자유시간', '쇼핑과 도심 산책 여유롭게', 'sightseeing'),
  (2, 90, null, '후쿠오카', '호텔 이동 및 휴식', E'베스트 웨스턴 플러스 후쿠오카 텐진 미나미\n석식은 불포함', 'hotel'),

  (3, 10, null, '후쿠오카', '호텔 조식', '호텔식 후 마지막 일정 준비', 'meal'),
  (3, 20, null, '다자이후', '다자이후 텐만구', '학문의 신을 모신 대표 신사', 'sightseeing'),
  (3, 30, null, '후쿠오카', '라라포트 후쿠오카', '복합 문화공간에서 마지막 자유시간', 'sightseeing'),
  (3, 40, null, null, '중식 · 현지식', '현지식으로 점심 식사', 'meal'),
  (3, 50, null, '공항', '후쿠오카공항 이동', '약 30분 소요', 'move'),
  (3, 60, '17:45', '후쿠오카', '후쿠오카공항 출발', '제주항공 7C1406', 'flight'),
  (3, 70, '19:15', '인천', '인천국제공항 도착', '가족여행의 마무리', 'flight')
) as v(day_no, sequence, time_label, location_name, title, description, item_type)
where t.slug = 'jeonga-fukuoka-2026'
on conflict (trip_id, day_no, sequence) do update set
  time_label = excluded.time_label,
  location_name = excluded.location_name,
  title = excluded.title,
  description = excluded.description,
  item_type = excluded.item_type;

commit;
