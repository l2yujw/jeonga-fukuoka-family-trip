import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGoogleMapsSearchUrl,
  getScheduleGuideItem,
  hasVariableGuideInfo,
  resolveScheduleGuideDay,
  SCHEDULE_GUIDE_ITEMS,
} from "./schedule-guide-data.ts";
import {
  SCHEDULE_DETAIL_HOTSPOTS,
  SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS,
} from "./schedule-detail-hotspots.ts";

const dayCounts = (items) =>
  Object.fromEntries([1, 2, 3].map((day) => [day, items.filter((item) => item.day === day).length]));

const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

test("guide data contains the 27 stable IDs in 11/9/7 day order", () => {
  assert.equal(SCHEDULE_GUIDE_ITEMS.length, 27);
  assert.deepEqual(dayCounts(SCHEDULE_GUIDE_ITEMS), { 1: 11, 2: 9, 3: 7 });
  assert.equal(new Set(SCHEDULE_GUIDE_ITEMS.map((item) => item.id)).size, 27);
});

test("guide data explicitly separates itinerary facts from visit information", () => {
  for (const item of SCHEDULE_GUIDE_ITEMS) {
    assert.equal(Object.hasOwn(item, "facts"), false, `${item.id} keeps legacy facts`);
    assert.ok(
      Object.hasOwn(item, "itineraryFacts") || Object.hasOwn(item, "visitInfo"),
      `${item.id} needs an explicit semantic fact group`,
    );
    if (item.itineraryFacts) assert.ok(item.itineraryFacts.length > 0);
    if (item.visitInfo) assert.ok(item.visitInfo.length > 0);
  }

  const oura = getScheduleGuideItem("d2-oura-cathedral");
  assert.equal(oura?.itineraryFacts, undefined);
  assert.deepEqual(oura?.visitInfo, [
    "3~10월 08:30~18:00, 마지막 입장 17:30",
    "성인 일반요금 ¥1,000",
    "성당 내부 촬영 금지",
    "방문객 전용 주차장 없음",
  ]);
  assert.equal(hasVariableGuideInfo(oura), true);

  assert.deepEqual(getScheduleGuideItem("d1-incheon-departure")?.itineraryFacts, [
    "출발 09:30",
    "제주항공 7C1403",
  ]);
  assert.deepEqual(getScheduleGuideItem("d1-move-yanagawa")?.itineraryFacts, [
    "약 1시간 20분",
    "이동 중 간식 제공",
  ]);
});

test("hotspots cover every guide item once in its split body", () => {
  assert.equal(SCHEDULE_DETAIL_HOTSPOTS.length, 27);
  assert.deepEqual(dayCounts(SCHEDULE_DETAIL_HOTSPOTS), { 1: 11, 2: 9, 3: 7 });
  assert.equal(new Set(SCHEDULE_DETAIL_HOTSPOTS.map((hotspot) => hotspot.id)).size, 27);
  assert.deepEqual(new Set(SCHEDULE_DETAIL_HOTSPOTS.map(({ scope }) => scope)), new Set(["body"]));

  for (const hotspot of SCHEDULE_DETAIL_HOTSPOTS) {
    assert.ok(getScheduleGuideItem(hotspot.id), `${hotspot.id} must resolve`);
    for (const value of Object.values(hotspot.rect)) assert.ok(value >= 0 && value <= 100);
    assert.ok(hotspot.rect.x + hotspot.rect.width <= 100);
    assert.ok(hotspot.rect.y + hotspot.rect.height <= 100);
  }
});

test("same-day, same-scope hotspot rectangles never overlap", () => {
  for (let index = 0; index < SCHEDULE_DETAIL_HOTSPOTS.length; index += 1) {
    const current = SCHEDULE_DETAIL_HOTSPOTS[index];
    for (const candidate of SCHEDULE_DETAIL_HOTSPOTS.slice(index + 1)) {
      if (current.day === candidate.day && current.scope === candidate.scope) {
        assert.equal(overlaps(current.rect, candidate.rect), false, `${current.id} overlaps ${candidate.id}`);
      }
    }
  }
});

test("DAY 1 and DAY 2 full-plate fallbacks retain one hotspot per card", () => {
  assert.equal(SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS.length, 20);
  assert.deepEqual(dayCounts(SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS), { 1: 11, 2: 9, 3: 0 });
  assert.equal(new Set(SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS.map(({ id }) => id)).size, 20);

  for (let index = 0; index < SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS.length; index += 1) {
    const hotspot = SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS[index];
    assert.equal(hotspot.scope, "fullPlate");
    assert.ok(getScheduleGuideItem(hotspot.id), `${hotspot.id} must resolve`);
    for (const value of Object.values(hotspot.rect)) assert.ok(value >= 0 && value <= 100);
    assert.ok(hotspot.rect.x + hotspot.rect.width <= 100);
    assert.ok(hotspot.rect.y + hotspot.rect.height <= 100);
    for (const candidate of SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS.slice(index + 1)) {
      if (hotspot.day === candidate.day) {
        assert.equal(overlaps(hotspot.rect, candidate.rect), false, `${hotspot.id} overlaps ${candidate.id}`);
      }
    }
  }
});

test("Maps URLs encode search text and detail IDs resolve safely", () => {
  assert.equal(
    buildGoogleMapsSearchUrl("오우라 천주당 Nagasaki"),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("오우라 천주당 Nagasaki")}`,
  );
  assert.equal(resolveScheduleGuideDay("d2-oura-cathedral"), 2);
  assert.equal(resolveScheduleGuideDay("d3-dazaifu"), 3);
  assert.equal(resolveScheduleGuideDay("not-a-guide-id"), undefined);
  assert.equal(getScheduleGuideItem(null), undefined);
});

test("current raster geometry keeps every hotspot tappable at supported widths", () => {
  const assetSizes = {
    1: { width: 695, height: 2193 },
    2: { width: 695, height: 1909 },
    3: { width: 695, height: 1483 },
  };

  for (const viewportWidth of [360, 390, 430]) {
    for (const hotspot of SCHEDULE_DETAIL_HOTSPOTS) {
      const asset = assetSizes[hotspot.day];
      const renderedHeight = viewportWidth * (asset.height / asset.width);
      assert.ok((hotspot.rect.width / 100) * viewportWidth >= 44);
      assert.ok((hotspot.rect.height / 100) * renderedHeight >= 44);
    }
  }
});

test("detail UI keeps query history, scroll lock, and z-order contracts", async () => {
  const [view, sheet, css] = await Promise.all([
    readFile(new URL("./schedule-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("./schedule-detail-sheet.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(view, /detailHotspots\("body"\)/);
  assert.match(view, /detailHotspots\("fullPlate"\)/);
  assert.match(view, /searchParams\.set\("detail"[\s\S]*history\.pushState\(/);
  assert.match(view, /searchParams\.delete\("detail"\)[\s\S]*history\.replaceState/);
  assert.match(view, /addEventListener\("popstate"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /item\.itineraryFacts\?\.length \? \(/);
  assert.match(sheet, /item\.visitInfo\?\.length \? \(/);
  assert.match(sheet, />우리 일정</);
  assert.match(sheet, />방문 정보</);
  assert.doesNotMatch(sheet, /item\.facts/);
  assert.match(sheet, /event\.key === "Escape"/);
  assert.match(sheet, /document\.body\.style\.overflow = "hidden"/);
  assert.match(sheet, /event\.target === event\.currentTarget/);
  assert.match(css, /\.bottom-nav\s*\{[^}]*z-index:\s*70/s);
  assert.match(css, /\.schedule-detail-overlay\s*\{[^}]*z-index:\s*100/s);
  assert.match(css, /\.schedule-detail-content\s*\{[^}]*overflow-y:\s*auto/s);
});
