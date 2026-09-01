import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createScheduleDays,
  getInitialScheduleDayIndex,
  resolveScheduleDayNo,
} from "./schedule-data.ts";

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
      row({ day_no: 3, location_name: "다자이후", title: "다자이후 텐만구" }),
      row({ day_no: 1, sequence: 20, location_name: "야나가와", title: "야나가와 이동", item_type: "move" }),
      row({ day_no: 2, location_name: "나가사키", title: "나가사키 이동", item_type: "move" }),
      row({ day_no: 1, sequence: 10, title: "후쿠오카공항 도착", item_type: "flight" }),
    ],
    "2026-09-11",
  );

  assert.deepEqual(days.map(({ dayNo }) => dayNo), [1, 2, 3]);
  assert.deepEqual(days.map(({ weekday }) => weekday), ["금", "토", "일"]);
  assert.equal(days[0].routeSummary, "후쿠오카 → 야나가와");
  assert.deepEqual(days[0].items.map(({ title }) => title), ["후쿠오카공항 도착", "야나가와 이동"]);
});

test("confirmed descriptions remain intact without uncertainty statuses", () => {
  const [day] = createScheduleDays(
    [
      row({ description: "제주항공 7C1403.", item_type: "flight" }),
      row({ sequence: 20, description: "호텔 체크인 · 석식: 호텔식(뷔페) · 온천욕", item_type: "hotel" }),
      row({ sequence: 30, description: "석식: 불포함 / 개별", item_type: "other" }),
    ],
    "2026-09-11",
  );

  assert.deepEqual(day.items.map(({ description }) => description), [
    "제주항공 7C1403",
    "호텔 체크인 · 석식: 호텔식(뷔페) · 온천욕",
    "석식: 불포함 / 개별",
  ]);
});

test("canonical seed contains only the confirmed Day 1/2/3 itinerary", async () => {
  const sql = await readFile(
    new URL("../../../docs/data/04_SEED_DRAFT.sql", import.meta.url),
    "utf8",
  );
  const rows = sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\([123],\s/.test(line));
  const byDay = (dayNo) =>
    rows.filter((line) => line.startsWith(`(${dayNo},`)).join("\n");
  const assertInOrder = (source, titles) => {
    let offset = -1;
    for (const title of titles) {
      offset = source.indexOf(`'${title}'`, offset + 1);
      assert.ok(offset >= 0, `${title} must appear in order`);
    }
  };

  assert.deepEqual([1, 2, 3].map((dayNo) => byDay(dayNo).split("\n").length), [11, 9, 7]);

  assertInOrder(byDay(1), [
    "야나가와 이동",
    "야나가와 뱃놀이",
    "다케오 이동",
    "다케오 신사",
    "다케오 도서관",
    "우레시노 이동",
  ]);
  assertInOrder(byDay(2), [
    "나가사키 차이나타운",
    "오우라 천주당",
    "그라바엔",
    "텐진거리 자유시간",
  ]);
  assertInOrder(byDay(3), [
    "다자이후 텐만구",
    "라라포트 후쿠오카",
    "후쿠오카공항 이동",
    "후쿠오카공항 출발",
  ]);

  assert.deepEqual(
    rows.flatMap((line) => line.match(/^\(\d+,\s*\d+,\s*'(\d{2}:\d{2})'/)?.slice(1) ?? []),
    ["07:00", "09:30", "11:00", "17:45", "19:15"],
  );
  assert.doesNotMatch(byDay(2), /^\(2,\s*\d+,\s*'/m);

  const canonical = rows.join("\n");
  for (const confirmed of [
    "오에도 온센 모노가타리 우레시노칸",
    "베스트 웨스턴 플러스 후쿠오카 텐진 미나미",
    "7C1403",
    "7C1406",
    "인천국제공항 1터미널 집결",
    "탑승수속 및 출발 준비",
    "호텔 이동 및 휴식",
    "석식은 불포함",
    "가족여행의 마무리",
  ]) {
    assert.ok(canonical.includes(confirmed), confirmed);
  }
  for (const stale of [
    "재확인 필요",
    "미정",
    "예정",
    "후보",
    "야소",
    "아소",
    "고코노에",
    "유후인",
    "벳부",
    "니지노 마쓰바라",
    "카라미야마 전망대",
    "카가미야마 전망대",
    "모모치 해변공원",
    "힐튼 후쿠오카 씨호크",
  ]) {
    assert.ok(!canonical.includes(stale), stale);
  }
});

test("schedule opens on the Korea-local trip day and trims empty times", () => {
  const days = createScheduleDays(
    [
      row({ day_no: 1, time_label: "  " }),
      row({ day_no: 2, time_label: " 09:00 " }),
      row({ day_no: 3 }),
    ],
    "2026-09-11",
  );

  assert.equal(
    getInitialScheduleDayIndex(days, new Date("2026-09-11T14:59:59Z")),
    0,
  );
  assert.equal(
    getInitialScheduleDayIndex(days, new Date("2026-09-11T15:00:00Z")),
    1,
  );
  assert.equal(
    getInitialScheduleDayIndex(days, new Date("2026-09-14T00:00:00Z")),
    2,
  );
  assert.equal(days[0].items[0].timeLabel, undefined);
  assert.equal(days[1].items[0].timeLabel, "09:00");
  assert.equal(
    resolveScheduleDayNo(days, 3, new Date("2026-09-11T15:00:00Z")),
    3,
    "a valid manual selection wins over the date default",
  );
  assert.equal(
    resolveScheduleDayNo(days, 99, new Date("2026-09-11T15:00:00Z")),
    2,
    "an invalid persisted selection falls back to the Korea-local day",
  );
});
