import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  getScheduleBodyLogicalHeight,
  SCHEDULE_BODY_DIMENSIONS,
  SCHEDULE_DAY_ROW_COUNTS,
  SCHEDULE_LAYOUT,
} from "./schedule-layout.ts";
import {
  resolveScheduleVisual,
  SCHEDULE_DAY_NOS,
  scheduleVisualAssets,
} from "./schedule-visual-assets.ts";

const splitAssets = [
  ["top/day-3.png", 695, 565],
  ...SCHEDULE_DAY_NOS.map((day) => [
    `body/day-${day}.png`,
    SCHEDULE_BODY_DIMENSIONS[day].width,
    SCHEDULE_BODY_DIMENSIONS[day].height,
  ]),
];

test("schedule asset config maps exactly DAY 1 through DAY 3", () => {
  assert.deepEqual(SCHEDULE_DAY_NOS, [1, 2, 3]);
  assert.deepEqual(Object.keys(scheduleVisualAssets), ["1", "2", "3"]);

  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[1]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-1.png",
    bodyWidth: 1390,
    bodyHeight: 4250,
  });
  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[2]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-2.png",
    bodyWidth: 1390,
    bodyHeight: 3594,
  });
  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[3]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-3.png",
    bodyWidth: 1390,
    bodyHeight: 2938,
  });
  assert.equal(scheduleVisualAssets[1].fullPlateFallbackSrc, "/assets/schedule/approved/day-1.png");
  assert.equal(scheduleVisualAssets[2].fullPlateFallbackSrc, "/assets/schedule/approved/day-2.png");
});

test("split assets take priority while full-plate fallback remains supported", () => {
  assert.deepEqual(
    resolveScheduleVisual({
      ...scheduleVisualAssets[1],
      fullPlateFallbackSrc: "/assets/schedule/approved/day-1.png",
    }),
    {
      mode: "split",
      topSrc: "/assets/schedule/plates/top/day-3.png",
      bodySrc: "/assets/schedule/plates/body/day-1.png",
      bodyWidth: 1390,
      bodyHeight: 4250,
    },
  );
  assert.deepEqual(
    resolveScheduleVisual({
      fullPlateFallbackSrc: "/assets/schedule/approved/day-1.png",
    }),
    {
      mode: "fallback",
      src: "/assets/schedule/approved/day-1.png",
    },
  );
  assert.equal(resolveScheduleVisual({}), null);
});

test("ScheduleView uses split segments without the legacy visual data path", async () => {
  const [view, css, page] = await Promise.all([
    readFile(new URL("./schedule-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../app/schedule/page.tsx", import.meta.url), "utf8"),
  ]);
  const scheduleCss = css.slice(
    css.indexOf("/* Feedback 06 v22"),
    css.indexOf(".boarding-transition-page"),
  );

  assert.match(
    view,
    /resolveScheduleVisual\(scheduleVisualAssets\[selectedDayNo\]\)/,
  );
  assert.match(view, /SCHEDULE_DAY_NOS\.map\(\(dayNo\) =>/);
  assert.match(view, /href="\/home"[\s\S]*aria-label="홈으로 돌아가기"/);
  assert.match(view, /aria-pressed=\{selectedDayNo === dayNo\}/);
  assert.match(view, /<strong>DAY \{dayNo\}<\/strong>/);
  assert.match(view, /<span>\{dayDates\[dayNo\]\}<\/span>/);
  assert.match(view, /localStorage\.getItem\(selectionKey\(trip\.id\)\)/);
  assert.match(view, /localStorage\.setItem\(selectionKey\(trip\.id\), String\(dayNo\)\)/);
  assert.match(
    view,
    /schedule-plate-segment schedule-plate-top[\s\S]*\{hotspots\}[\s\S]*schedule-plate-segment schedule-plate-body/,
  );
  assert.doesNotMatch(
    view,
    /itinerary_items|createScheduleDays|daySceneOrder|ScheduleScene|PageHeader|TravelSummaryCard|RouteNote|DaySchedule|ClosingNote|supabase/i,
  );
  assert.match(page, /<BottomNav activeHref="\/schedule" \/>/);
  assert.match(page, /overflow-x-clip/);
  assert.match(
    scheduleCss,
    /\.schedule-plate-image\s*\{[^}]*display: block[^}]*width: 100%[^}]*height: auto/s,
  );
  assert.match(
    view,
    /src=\{selectedVisual\.bodySrc\}[\s\S]*width=\{selectedVisual\.bodyWidth\}[\s\S]*height=\{selectedVisual\.bodyHeight\}/,
  );
  assert.match(
    scheduleCss,
    /\.schedule-plate-hotspot\s*\{[^}]*background: transparent/s,
  );
  assert.match(
    scheduleCss,
    /\.schedule-plate-hotspot--day-1\[aria-pressed="true"\][\s\S]*background: linear-gradient/s,
  );
  assert.doesNotMatch(scheduleCss, /aspect-ratio|object-fit:\s*cover/);

  for (const width of [360, 390, 430]) {
    const topHeight = width * (565 / 695);
    assert.ok(topHeight * 0.158 >= 44);
    assert.ok(width * (0.671 + 0.297) <= width);
    for (const { width: bodyWidth, height: bodyHeight } of Object.values(SCHEDULE_BODY_DIMENSIONS)) {
      assert.ok(width * (bodyHeight / bodyWidth) > topHeight);
    }
  }
});

test("split asset metadata matches runtime intrinsic dimensions", async () => {
  for (const [name, expectedWidth, expectedHeight] of splitAssets) {
    const image = await readFile(
      new URL(`../../../public/assets/schedule/plates/${name}`, import.meta.url),
    );

    assert.equal(image.readUInt32BE(16), expectedWidth);
    assert.equal(image.readUInt32BE(20), expectedHeight);
  }

  assert.deepEqual(
    splitAssets.slice(1).map(([, width, height]) => [width, height]),
    [[1390, 4250], [1390, 3594], [1390, 2938]],
  );
  assert.equal(new Set(splitAssets.slice(1).map(([, , height]) => height)).size, 3);
  assert.ok(SCHEDULE_BODY_DIMENSIONS[1].height > SCHEDULE_BODY_DIMENSIONS[2].height);
  assert.ok(SCHEDULE_BODY_DIMENSIONS[2].height > SCHEDULE_BODY_DIMENSIONS[3].height);

  const scheduleAssetNames = await readdir(
    new URL("../../../public/assets/schedule/", import.meta.url),
    { recursive: true },
  );
  assert.equal(scheduleAssetNames.some((name) => /bottom.?nav/i.test(name)), false);
});

test("generator uses one logical contract for native 2x composition", async () => {
  const generator = await readFile(
    new URL("../../../scripts/generate-schedule-bodies.mjs", import.meta.url),
    "utf8",
  );

  assert.equal(SCHEDULE_LAYOUT.logicalWidth, 695);
  assert.equal(SCHEDULE_LAYOUT.pixelRatio, 2);
  assert.equal(SCHEDULE_LAYOUT.row.height, 148);
  assert.equal(SCHEDULE_LAYOUT.row.gap, 16);
  assert.deepEqual(SCHEDULE_DAY_ROW_COUNTS, { 1: 11, 2: 9, 3: 7 });
  for (const day of SCHEDULE_DAY_NOS) {
    assert.equal(
      SCHEDULE_BODY_DIMENSIONS[day].height,
      getScheduleBodyLogicalHeight(SCHEDULE_DAY_ROW_COUNTS[day]) * 2,
    );
  }
  assert.match(generator, /schedule-layout\.json/);
  assert.match(generator, /width: physicalWidth/);
  assert.match(generator, /day-3-scenes-v25\.png/);
  assert.doesNotMatch(generator, /sharp\([^\n]*plates\/body\/day-3\.png/);
});

test("v29-E memo uses itinerary-card geometry while timed rows stay unchanged", async () => {
  const generator = await readFile(
    new URL("../../../scripts/generate-schedule-bodies.mjs", import.meta.url),
    "utf8",
  );
  const token = generator.match(/const TIMED_ROW_TIME_FONT_SIZE = (\d+);/);
  assert.ok(token);
  assert.equal(Number(token[1]), 21);
  assert.match(generator, /font-size:\$\{TIMED_ROW_TIME_FONT_SIZE\}px/);
  assert.match(
    generator,
    /font-size:\$\{TIMED_ROW_TIME_FONT_SIZE\}px;font-weight:600/,
  );
  assert.doesNotMatch(generator, /\.time\{[^}]*font-size:29px/);
  assert.deepEqual(
    {
      x: SCHEDULE_LAYOUT.row.cardX,
      width: SCHEDULE_LAYOUT.row.cardWidth,
      height: SCHEDULE_LAYOUT.memo.height,
      radius: SCHEDULE_LAYOUT.row.cardRadius,
    },
    { x: 91, width: 580, height: 148, radius: 20 },
  );
  assert.equal(SCHEDULE_LAYOUT.memo.height, SCHEDULE_LAYOUT.row.height);
  assert.match(
    generator,
    /<rect x="\$\{rowLayout\.cardX\}" y="\$\{memoY\}" width="\$\{rowLayout\.cardWidth\}" height="\$\{rowLayout\.height\}" rx="\$\{rowLayout\.cardRadius\}"/,
  );
  assert.doesNotMatch(generator, /<rect x="\$\{route\.x\}" y="\$\{memoY\}"/);
  assert.match(generator, /memoLines: \["설레는 시작,", "함께하는 여정의 첫걸음\."\]/);
  assert.match(generator, /memoLines: \["푸른 하늘 아래,", "나가사키에서의 추억을 마음에 담아요\."\]/);
  assert.match(generator, /rowLayout\.cardX \+ rowLayout\.cardWidth - 156/);

  const day1 = generator.slice(
    generator.indexOf("day: 1,"),
    generator.indexOf("day: 2,"),
  );
  const day2 = generator.slice(
    generator.indexOf("day: 2,"),
    generator.indexOf("day: 3,"),
  );
  const day3 = generator.slice(generator.indexOf("day: 3,"));
  const times = (source) =>
    [...source.matchAll(/time: "(\d{2}:\d{2})"/g)].map((match) => match[1]);

  assert.deepEqual(times(day1), ["07:00", "09:30", "11:00"]);
  assert.deepEqual(times(day2), []);
  assert.deepEqual(times(day3), ["17:45", "19:15"]);
  assert.doesNotMatch(generator, /Math\.random|Date\.now|new Date/);
  assert.deepEqual(
    SCHEDULE_DAY_NOS.map((day) => [
      SCHEDULE_BODY_DIMENSIONS[day].width,
      SCHEDULE_BODY_DIMENSIONS[day].height,
    ]),
    [[1390, 4250], [1390, 3594], [1390, 2938]],
  );
});

test("generator keeps the approved v27 content corrections declarative", async () => {
  const generator = await readFile(
    new URL("../../../scripts/generate-schedule-bodies.mjs", import.meta.url),
    "utf8",
  );

  assert.match(generator, /routeArtIndex: 8/);
  assert.match(generator, /titleLines: \["오에도 온센 모노가타리", "우레시노칸"\], titleSize: 21/);
  assert.match(generator, /설레는 시작,[\s\S]*함께하는 여정의 첫걸음\./);
  assert.match(generator, /day-2-hotel-composite-v27\.png/);
  assert.match(generator, /푸른 하늘 아래,[\s\S]*나가사키에서의 추억을 마음에 담아요\./);
  assert.doesNotMatch(generator, /원본 일정에 구체 시간이 없어/);
});
