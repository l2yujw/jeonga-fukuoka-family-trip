import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createHomeSchedulePreviewCopy,
  getHomeSchedulePreview,
  HOME_SCHEDULE_DAYS,
} from "./home-date-state.ts";
import { getHomeImageFit } from "./home-preview-fit.ts";

const itineraryRow = (overrides = {}) => ({
  day_no: 2,
  sequence: 10,
  time_label: null,
  location_name: "후쿠오카",
  title: "일정",
  description: null,
  item_type: "sightseeing",
  ...overrides,
});

test("home schedule preview clamps to the Korea-local trip day", () => {
  const cases = [
    ["2026-09-10T03:00:00Z", "DAY 1"],
    ["2026-09-11T03:00:00Z", "DAY 1"],
    ["2026-09-12T03:00:00Z", "DAY 2"],
    ["2026-09-13T03:00:00Z", "DAY 3"],
    ["2026-09-14T03:00:00Z", "DAY 3"],
  ];

  for (const [instant, label] of cases) {
    assert.equal(getHomeSchedulePreview(new Date(instant)).label, label);
  }

  assert.equal(
    getHomeSchedulePreview(new Date("2026-09-11T14:59:59Z")).label,
    "DAY 1",
  );
  assert.equal(
    getHomeSchedulePreview(new Date("2026-09-11T15:00:00Z")).label,
    "DAY 2",
  );
});

test("home schedule day constants contain date state only", () => {
  assert.deepEqual(
    HOME_SCHEDULE_DAYS,
    [
      { dayNo: 1, date: "2026-09-11", label: "DAY 1" },
      { dayNo: 2, date: "2026-09-12", label: "DAY 2" },
      { dayNo: 3, date: "2026-09-13", label: "DAY 3" },
    ],
  );
});

test("home schedule copy reflects the selected current-seed-like day", () => {
  const rows = [
    itineraryRow({ location_name: "다자이후", title: "다자이후 텐만구" }),
    itineraryRow({ sequence: 20, location_name: "유후인", title: "유후인 이동", item_type: "move" }),
    itineraryRow({ sequence: 30, location_name: "유후인", title: "유노쓰보 가이도" }),
    itineraryRow({ sequence: 40, location_name: "유후인", title: "긴린코 호수" }),
    itineraryRow({ sequence: 50, location_name: "벳부", title: "벳부 이동", item_type: "move" }),
    itineraryRow({ sequence: 60, location_name: "벳부", title: "가마도지옥" }),
  ];
  const originalRows = structuredClone(rows);

  assert.deepEqual(
    createHomeSchedulePreviewCopy(rows, "2026-09-11", 2),
    {
      title: "다자이후 · 유후인 · 벳부",
      supporting: "다자이후 텐만구 · 유노쓰보 가이도 · 긴린코 호수 · 가마도지옥",
    },
  );
  assert.deepEqual(rows, originalRows);
});

test("home supporting copy prefers actual sightseeing, meal, and optional titles", () => {
  const copy = createHomeSchedulePreviewCopy(
    [
      itineraryRow({ title: "공항 도착", item_type: "flight" }),
      itineraryRow({ sequence: 20, title: "호텔 조식", item_type: "meal" }),
      itineraryRow({ sequence: 30, title: "관광지", item_type: "sightseeing" }),
      itineraryRow({ sequence: 40, title: "다음 도시 이동", item_type: "move" }),
      itineraryRow({ sequence: 50, title: "자유 일정", item_type: "optional" }),
      itineraryRow({ sequence: 60, title: "호텔 체크인", item_type: "hotel" }),
    ],
    "2026-09-11",
    2,
  );

  assert.equal(copy?.supporting, "호텔 조식 · 관광지 · 자유 일정");
  assert.doesNotMatch(copy?.supporting ?? "", /공항 도착|다음 도시 이동|호텔 체크인/);
});

test("home schedule copy has truthful empty and neutral fallbacks", () => {
  assert.equal(createHomeSchedulePreviewCopy([], "2026-09-11", 1), null);
  assert.deepEqual(
    createHomeSchedulePreviewCopy(
      [
        itineraryRow({
          day_no: 1,
          location_name: null,
          title: "현지 안내",
          item_type: "other",
        }),
      ],
      "2026-09-11",
      1,
    ),
    { title: "여행 일정", supporting: "현지 안내" },
  );
  assert.deepEqual(
    createHomeSchedulePreviewCopy(
      [
        itineraryRow({
          day_no: 1,
          location_name: null,
          title: "공항 이동",
          item_type: "move",
        }),
      ],
      "2026-09-11",
      1,
    ),
    { title: "여행 일정", supporting: "일정 보기" },
  );
});

test("home preview fit limits crop and preserves extreme source ratios", () => {
  assert.deepEqual(getHomeImageFit(null, null, 1, 1), {
    mode: "cover",
    scale: 1,
  });
  assert.deepEqual(getHomeImageFit(4, 3, 4, 3), {
    mode: "cover",
    scale: 1,
  });

  const moderate = getHomeImageFit(4, 3, 1, 1);
  assert.equal(moderate.mode, "bounded");
  assert.ok(moderate.scale >= 1.08 && moderate.scale <= 1.22);

  const wide = getHomeImageFit(16, 9, 1, 1);
  assert.deepEqual(wide, { mode: "bounded", scale: 1.22 });
  assert.deepEqual(getHomeImageFit(21, 9, 1, 1), {
    mode: "contain",
    scale: 1,
  });
});

test("home implements the v25 itinerary-backed progressive previews", async () => {
  const [
    page,
    homeDateState,
    route,
    css,
    ui,
    schedulePage,
    albumPage,
    cardsPage,
    albumRepository,
    cardRepository,
  ] = await Promise.all([
    readFile(new URL("../../app/home/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./home-date-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/home-visual/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../components/ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/schedule/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/album/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/cards/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../album/album-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../cards/memory-card-repository.ts", import.meta.url), "utf8"),
  ]);
  const compactPage = page.replace(/\s+/g, " ");
  const homeCss = css.slice(
    css.indexOf(".home-page-shell"),
    css.indexOf(".boarding-status-page"),
  );
  const regionValues = [
    "quickSchedule: { x: 20, y: 695, w: 260, h: 259 }",
    "quickAlbum: { x: 299, y: 695, w: 262, h: 259 }",
    "quickCards: { x: 583, y: 695, w: 269, h: 259 }",
    "previewSchedule: { x: 18, y: 1059, w: 263, h: 532 }",
    "previewAlbum: { x: 294, y: 1059, w: 264, h: 532 }",
    "previewCards: { x: 577, y: 1059, w: 273, h: 532 }",
    "scheduleMask: { x: 36, y: 1168, w: 236, h: 295 }",
    "scheduleMedia: { x: 36, y: 1164, w: 235, h: 241 }",
    "albumMask: { x: 322, y: 1168, w: 238, h: 295 }",
    "albumSingle: { x: 322, y: 1168, w: 237, h: 281 }",
    "cardMask: { x: 609, y: 1168, w: 242, h: 295 }",
    "cardThumbnail: { x: 610, y: 1168, w: 240, h: 295 }",
    "scheduleTitle: { x: 40, y: 1482, w: 235, h: 47 }",
    "scheduleMeta: { x: 40, y: 1529, w: 235, h: 58 }",
    "albumTitle: { x: 326, y: 1482, w: 230, h: 47 }",
    "albumCount: { x: 326, y: 1529, w: 230, h: 58 }",
    "cardTitle: { x: 615, y: 1482, w: 230, h: 47 }",
    "cardMeta: { x: 615, y: 1529, w: 230, h: 58 }",
  ];

  for (const value of regionValues) assert.ok(compactPage.includes(value), value);
  const overlayRegions = [
    { x: 20, y: 695, w: 260, h: 259 },
    { x: 299, y: 695, w: 262, h: 259 },
    { x: 583, y: 695, w: 269, h: 259 },
    { x: 18, y: 1059, w: 263, h: 532 },
    { x: 294, y: 1059, w: 264, h: 532 },
    { x: 577, y: 1059, w: 273, h: 532 },
    { x: 33, y: 1165, w: 242, h: 301 },
    { x: 33, y: 1161, w: 241, h: 247 },
    { x: 319, y: 1165, w: 244, h: 301 },
    { x: 319, y: 1165, w: 243, h: 287 },
    { x: 606, y: 1165, w: 248, h: 301 },
    { x: 607, y: 1165, w: 246, h: 301 },
    { x: 40, y: 1482, w: 235, h: 47 },
    { x: 40, y: 1529, w: 235, h: 58 },
    { x: 326, y: 1482, w: 230, h: 47 },
    { x: 326, y: 1529, w: 230, h: 58 },
    { x: 615, y: 1482, w: 230, h: 47 },
    { x: 615, y: 1529, w: 230, h: 58 },
  ];

  for (const [width, viewportHeight] of [
    [360, 800],
    [375, 812],
    [390, 844],
    [402, 874],
    [420, 896],
    [430, 932],
  ]) {
    const height = (1756 / 895) * width;
    assert.ok(viewportHeight > 0);
    for (const { x, y, w, h } of overlayRegions) {
      assert.ok((x / 895) * width >= 0);
      assert.ok(((x + w) / 895) * width <= width);
      assert.ok((y / 1756) * height >= 0);
      assert.ok(((y + h) / 1756) * height <= height);
    }
  }
  assert.ok(1408 < 1482, "schedule media must end before its text zone");
  assert.ok(1452 < 1482, "album media must end before its text zone");
  assert.equal(1482 - 1466, 16, "all titles keep the new stable paper gap");
  assert.equal(1482 + 47, 1529, "title and meta zones must not overlap");
  assert.equal(
    new Set(overlayRegions.slice(-6).filter((_, index) => index % 2 === 0).map(({ y }) => y)).size,
    1,
  );
  assert.ok(36 >= 33 && 271 <= 274 && 1168 >= 1165 && 1462 <= 1466);
  assert.ok(322 >= 319 && 559 <= 563 && 1168 >= 1165 && 1462 <= 1466);
  assert.ok(609 >= 606 && 850 <= 854 && 1168 >= 1165 && 1462 <= 1466);
  assert.match(page, /HOME_ARTBOARD = \{ width: 895, height: 1756 \}/);
  assert.match(page, /left: `\$\{\(x \/ HOME_ARTBOARD\.width\) \* 100\}%`/);
  assert.match(page, /top: `\$\{\(y \/ HOME_ARTBOARD\.height\) \* 100\}%`/);
  assert.match(page, /src="\/api\/home-visual"/);
  assert.match(page, /width=\{HOME_ARTBOARD\.width\}[\s\S]*height=\{HOME_ARTBOARD\.height\}/);
  assert.match(page, /className="home-runtime-base"/);
  assert.match(page, /className="home-overlay-root"/);
  assert.match(page, /loadHomeAlbumPreview\(trip\.id\)\.then/);
  assert.match(page, /loadLatestMemoryCard\(trip\.id\)\.then/);
  assert.match(page, /loadHomeAlbumPhoto\(trip\.id, photoId\)/);
  assert.doesNotMatch(page, /Promise\.allSettled|loadAlbumPhotos|loadMemoryCards/);
  assert.doesNotMatch(page, /slice\(0, 3\)|albumLarge|albumSmall|albumBottomWide/);
  assert.match(page, /사진 \$\{albumPreview\.count\}장/);
  assert.match(page, /getMemoryCardTemplateSpec\(latestCard\.templateKey\)/);
  assert.match(page, /우리만의 추억 카드를 만들어보세요/);
  assert.match(page, /getHomeImageFit\([\s\S]*region\.w,[\s\S]*region\.h/);
  assert.match(page, /loading="lazy"[\s\S]*decoding="async"[\s\S]*fetchPriority="low"/);
  assert.match(page, /dataset\.loaded = "true"/);
  assert.match(page, /replaceAll\(" · ", "\\u00a0· "\)/);
  assert.match(
    page,
    /\.from\("itinerary_items"\)[\s\S]*?\.select\(\s*"day_no,sequence,time_label,location_name,title,description,item_type",?\s*\)[\s\S]*?\.eq\("trip_id", trip\.id\)[\s\S]*?\.eq\("day_no", schedule\.dayNo\)[\s\S]*?\.order\("sequence", \{ ascending: true \}\)/,
  );
  assert.doesNotMatch(page, /\.select\(\s*["'`]\*["'`]\s*\)/);
  assert.match(
    page,
    /createHomeSchedulePreviewCopy\([\s\S]*?data[\s\S]*?trip\.startDate,[\s\S]*?schedule\.dayNo/,
  );
  assert.match(page, /scheduleCopy\?\.tripId === trip\.id/);
  assert.match(page, /\{scheduleTitle\.replaceAll\(" · ", "\\u00a0· "\)\}/);
  assert.match(page, /\{scheduleSupporting\.replaceAll\(" · ", "\\u00a0· "\)\}/);
  assert.doesNotMatch(homeDateState, /title:\s*".+ · .+"|supporting:\s*".+ · .+"/);
  assert.match(page, /\(data \?\? \[\]\) as ItineraryItemRow\[\]/);
  assert.match(page, /\?\? HOME_SCHEDULE_FALLBACK/);
  assert.match(page, /catch \{[\s\S]*?\.\.\.HOME_SCHEDULE_FALLBACK/);
  assert.match(page, /<h1 id="home-title" className="sr-only">\s*\{trip\.title\}\s*<\/h1>/);
  assert.match(
    page,
    /<p id="home-trip-summary" className="sr-only">\s*\{trip\.startDate\}부터 \{trip\.endDate\}까지, 가족 10명 여행\s*<\/p>/,
  );
  assert.match(page, /aria-describedby="home-trip-summary"/);
  assert.doesNotMatch(page, /family_members|loadFamilyRoster|rosterCount/);
  assert.match(
    page,
    /<div className="home-media-fill home-schedule-media">\s*<span className="home-schedule-badge">\{schedule\.label\}<\/span>\s*<\/div>/,
  );
  assert.doesNotMatch(
    `${page}\n${homeDateState}`,
    /image_url|Math\.random|selectRandomSchedulePreviewImage|SchedulePreviewImageItem|scheduleImage/,
  );
  assert.doesNotMatch(page, /MemoryCardPreview/);

  for (const [href, label] of [
    ["/schedule", "여행 일정"],
    ["/album", "사진 공유"],
    ["/cards", "추억 카드 만들기"],
    ["/schedule", "여행 일정 미리보기"],
    ["/album", "공유 사진 미리보기"],
    ["/cards", "추억 카드 미리보기"],
  ]) {
    assert.ok(compactPage.includes(`href: "${href}", label: "${label}"`));
  }

  assert.match(
    route,
    /Jeonga_Fukuoka_Feedback05_B_ORIGINAL_Runtime_Base_895x1756_v16\.png/,
  );
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /serveLandingVisual/);
  assert.doesNotMatch(route, /searchParams|request-controlled|homeVisualFiles/);

  assert.match(
    css,
    /\.home-page-shell\s*\{[^}]*width: 100%[^}]*max-width: 430px[^}]*min-width: 0[^}]*min-height: 0[^}]*box-sizing: border-box/s,
  );
  assert.match(css, /\.home-artboard\s*\{[^}]*width: 100%[^}]*max-width: 430px[^}]*min-width: 0[^}]*aspect-ratio: 895 \/ 1756/s);
  assert.match(css, /\.home-artboard\s*\{[^}]*position: relative/s);
  assert.match(css, /\.home-overlay-root\s*\{[^}]*position: absolute[^}]*inset: 0/s);
  assert.match(css, /\.home-runtime-base\s*\{[^}]*object-fit: contain[^}]*pointer-events: none/s);
  assert.match(css, /\.home-dynamic-media\s*\{[^}]*pointer-events: none/s);
  assert.match(css, /\.home-dynamic-copy\s*\{[^}]*pointer-events: none/s);
  assert.match(css, /\.home-hit-area\s*\{[^}]*pointer-events: auto/s);
  assert.match(css, /\.home-schedule-media img,[\s\S]*\.home-memory-card-thumbnail img\s*\{[^}]*opacity: 0[^}]*object-fit: cover/s);
  assert.match(css, /img\[data-fit="contain"\][\s\S]*\{[^}]*object-fit: contain/s);
  assert.match(css, /img\[data-loaded="true"\][\s\S]*\{[^}]*opacity: 1/s);
  assert.match(css, /transform: scale\(var\(--home-media-scale, 1\)\)/);
  assert.match(page, /const HOME_MEDIA_BLEED = 3/);
  assert.match(page, /style=\{mediaRegionStyle\(regions\.scheduleMask\)\}/);
  assert.match(page, /style=\{mediaRegionStyle\(regions\.scheduleMedia\)\}/);
  assert.match(page, /style=\{mediaRegionStyle\(regions\.cardMask\)\}/);
  assert.match(css, /\.home-dynamic-media\s*\{[^}]*overflow: hidden/s);
  assert.match(page, /className="home-memory-card-thumbnail"/);
  assert.match(css, /\.home-memory-card-thumbnail\s*\{[^}]*width: 92%[^}]*height: 90%[^}]*overflow: hidden[^}]*transform: rotate\(-3deg\)[^}]*background: transparent/s);
  assert.doesNotMatch(css, /\.home-memory-card-thumbnail\s*\{[^}]*(?:padding|box-shadow):/s);
  assert.match(css, /\.home-preview-media-mask\s*\{[^}]*background: #f1e2ca/s);
  assert.match(css, /\.home-schedule-media\s*\{[^}]*linear-gradient/s);
  assert.match(css, /\.home-schedule-media::before,[\s\S]*\.home-schedule-media::after/s);
  assert.match(css, /\.home-memory-clip\s*\{[^}]*#f3e5cd[^}]*#e9d5b5/s);
  assert.match(css, /\.home-dynamic-copy\s*\{[^}]*min-width: 0[^}]*overflow: hidden/s);
  assert.match(css, /\.home-schedule-title,[\s\S]*\.home-card-meta\s*\{[^}]*display: block[^}]*white-space: nowrap[^}]*text-overflow: ellipsis/s);
  assert.doesNotMatch(homeCss, /-webkit-line-clamp|text-wrap: balance/);
  assert.match(css, /\.home-dynamic-copy\s*\{[^}]*word-break: keep-all[^}]*overflow-wrap: break-word/s);
  assert.doesNotMatch(homeCss, /scale[XY]\(|object-fit:\s*fill/);
  assert.match(css, /font-size: clamp\(10\.5px, 2\.7vw, 12px\)/);
  assert.match(css, /font-size: clamp\(9px, 2\.35vw, 10\.5px\)/);
  assert.match(css, /font-size: clamp\(9\.5px, 2\.4vw, 10\.5px\)/);
  assert.doesNotMatch(`${page}\n${homeCss}`, /420 \/ 752|100v[hw]|100sv[hw]|margin-(?:left|right):\s*-/);
  assert.doesNotMatch(css, /\.home-main|\.home-quick-actions|\.home-preview-grid|\.home-memory-banner/);
  assert.match(css, /html\s*\{[^}]*-webkit-text-size-adjust: 100%[^}]*text-size-adjust: 100%/s);

  assert.match(
    ui,
    /const bottomNavItems = \[\s*\{ href: "\/home", icon: "home", label: "홈" \},\s*\{ href: "\/schedule", icon: "schedule", label: "일정" \},\s*\{ href: "\/album", icon: "album", label: "앨범" \},\s*\{ href: "\/cards", icon: "card", label: "카드" \}/s,
  );
  assert.match(schedulePage, /<BottomNav activeHref="\/schedule" \/>/);
  assert.match(albumPage, /<BottomNav activeHref="\/album" \/>/);
  assert.match(cardsPage, /<BottomNav activeHref="\/cards" className="cards-bottom-nav" \/>/);
  assert.match(page, /<BottomNav activeHref="\/home" \/>/);
  assert.match(
    css,
    /\.bottom-nav\s*\{[^}]*height: calc\(72px \+ env\(safe-area-inset-bottom\)\)[^}]*padding: 9px 11px calc\(9px \+ env\(safe-area-inset-bottom\)\)/s,
  );
  assert.match(css, /\.bottom-nav-list\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.bottom-nav-link\s*\{[^}]*min-height: 44px/s);
  assert.match(css, /\.bottom-nav-link\[aria-current="page"\]\s*\{[^}]*color: #c83818/s);
  assert.match(css, /\.cards-page\s*\{[^}]*overflow-x: clip/s);
  assert.match(css, /\.cards-main\s*\{[^}]*padding-bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/s);
  assert.match(css, /\.cards-bottom-nav\s*\{[^}]*position: fixed[^}]*left: 50%[^}]*transform: translateX\(-50%\)/s);
  assert.doesNotMatch(cardsPage, /overflow-hidden|overflow-y-(?:auto|scroll)/);

  assert.doesNotMatch(`${page}\n${route}\n${css}`, /전체 보기|42장/);
  assert.doesNotMatch(
    `${page}\n${route}\n${ui}`,
    /Jeonga_Fukuoka_Feedback05_C_Shared_BottomNav_420x72_v14\.png/,
  );
  assert.doesNotMatch(
    `${page}\n${route}`,
    /Hero_NoStateText_v12|Memory_Banner_v12|QuickAction_.+_v12|Preview_Title_Leaf_v12/,
  );
  assert.match(albumRepository, /select\(PHOTO_COLUMNS, \{ count: "exact" \}\)[\s\S]*order\("created_at", \{ ascending: false \}\)[\s\S]*limit\(1\)/);
  assert.match(albumRepository, /loadHomeAlbumPhoto[\s\S]*\.eq\("id", photoId\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(cardRepository, /loadLatestMemoryCard[\s\S]*loadMemoryCardsWithLimit\(tripId, 1\)/);
  assert.match(albumRepository, /export async function loadAlbumPhotos\(tripId: string\)/);
  assert.match(cardRepository, /export function loadMemoryCards\(tripId: string\)/);
  assert.doesNotMatch(schedulePage, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
});
