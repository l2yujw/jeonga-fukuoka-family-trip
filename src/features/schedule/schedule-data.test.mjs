import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleDays } from "./schedule-data.ts";

const row = (overrides) => ({
  day_no: 1,
  sequence: 10,
  time_label: null,
  location_name: "후쿠오카",
  title: "일정",
  description: null,
  item_type: "sightseeing",
  ...overrides,
});

test("itinerary rows become ordered Day 1/2/3 schedule data", () => {
  const days = createScheduleDays(
    [
      row({ day_no: 3, location_name: "아소", title: "아소 이동", item_type: "move" }),
      row({ day_no: 1, sequence: 20, location_name: "가라츠", title: "가라츠 이동", item_type: "move" }),
      row({ day_no: 2, location_name: "유후인", title: "유후인 이동", item_type: "move" }),
      row({ day_no: 1, sequence: 10, title: "후쿠오카 도착", item_type: "flight" }),
    ],
    "2026-09-11",
  );

  assert.deepEqual(days.map(({ dayNo }) => dayNo), [1, 2, 3]);
  assert.deepEqual(days.map(({ weekday }) => weekday), ["금", "토", "일"]);
  assert.equal(days[0].routeSummary, "후쿠오카 → 가라츠");
  assert.deepEqual(days[0].items.map(({ title }) => title), ["후쿠오카 도착", "가라츠 이동"]);
});

test("database descriptions retain the existing schedule status labels", () => {
  const [day] = createScheduleDays(
    [
      row({ description: "항공편 및 출발시간 재확인 필요.", item_type: "flight" }),
      row({ sequence: 20, description: "석식 및 온천욕. 예정 호텔은 최종 확정 전까지 후보 표기.", item_type: "hotel" }),
      row({ sequence: 30, description: "자유시간 추천 일정", item_type: "optional" }),
    ],
    "2026-09-11",
  );

  assert.deepEqual(day.items.map(({ description }) => description), [
    "항공편 및 출발시간 재확인 필요",
    "석식 및 온천욕",
    "자유시간 추천 일정",
  ]);
  assert.deepEqual(day.items.map(({ statusLabel }) => statusLabel), [
    "재확인 필요",
    "숙소 최종 확정 전",
    "선택 일정",
  ]);
});
