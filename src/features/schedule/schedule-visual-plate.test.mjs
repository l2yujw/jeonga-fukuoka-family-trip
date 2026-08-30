import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveScheduleVisual,
  SCHEDULE_DAY_NOS,
  scheduleVisualAssets,
} from "./schedule-visual-assets.ts";

const splitAssets = [
  [
    "top/day-3.png",
    "3ebf4adf9dc7a6b414195971d1c6fdbb30193f0646c31abe862d41101b6f5cc1",
    695,
    565,
  ],
  [
    "body/day-1.png",
    "61d8594bd8db1b2cc304ed5caf4096c2e7a8f2c12e1e64145ed65e9849ceae92",
    695,
    2193,
  ],
  [
    "body/day-2.png",
    "92cb7d8886b6bdfe16e2b8eadefc6456a6c0757c994ba879c6c1a116cd13ac28",
    695,
    1909,
  ],
  [
    "body/day-3.png",
    "f823203381a93eb9a8fa5f394a3d4e2fa7c52d4e8c56aa207a1b5e6d6d0a5f7b",
    695,
    1483,
  ],
];

test("schedule asset config maps exactly DAY 1 through DAY 3", () => {
  assert.deepEqual(SCHEDULE_DAY_NOS, [1, 2, 3]);
  assert.deepEqual(Object.keys(scheduleVisualAssets), ["1", "2", "3"]);

  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[1]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-1.png",
  });
  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[2]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-2.png",
  });
  assert.deepEqual(resolveScheduleVisual(scheduleVisualAssets[3]), {
    mode: "split",
    topSrc: "/assets/schedule/plates/top/day-3.png",
    bodySrc: "/assets/schedule/plates/body/day-3.png",
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
    for (const bodyHeight of [2193, 1909, 1483]) {
      assert.ok(width * (bodyHeight / 695) > topHeight);
    }
  }
});

test("all split assets retain locked bytes and equal width", async () => {
  for (const [name, expectedHash, expectedWidth, expectedHeight] of splitAssets) {
    const image = await readFile(
      new URL(`../../../public/assets/schedule/plates/${name}`, import.meta.url),
    );

    assert.equal(createHash("sha256").update(image).digest("hex"), expectedHash);
    assert.equal(image.readUInt32BE(16), expectedWidth);
    assert.equal(image.readUInt32BE(20), expectedHeight);
  }

  assert.equal(new Set(splitAssets.map(([, , width]) => width)).size, 1);
  assert.equal(new Set(splitAssets.slice(1).map(([, , , height]) => height)).size, 3);
});
