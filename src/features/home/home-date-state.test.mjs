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
  assert.deepEqual(HOME_SCHEDULE_DAYS, [
    { dayNo: 1, date: "2026-09-11", label: "DAY 1" },
    { dayNo: 2, date: "2026-09-12", label: "DAY 2" },
    { dayNo: 3, date: "2026-09-13", label: "DAY 3" },
  ]);
});

test("home schedule copy remains itinerary-derived and non-mutating", () => {
  const rows = [
    itineraryRow({ location_name: "우레시노", title: "호텔 조식", item_type: "meal" }),
    itineraryRow({ sequence: 20, location_name: "나가사키", title: "나가사키 이동", item_type: "move" }),
    itineraryRow({ sequence: 30, location_name: "나가사키", title: "나가사키 차이나타운" }),
    itineraryRow({ sequence: 40, location_name: "나가사키", title: "오우라 천주당" }),
  ];
  const originalRows = structuredClone(rows);

  assert.deepEqual(createHomeSchedulePreviewCopy(rows, "2026-09-11", 2), {
    title: "우레시노 · 나가사키",
    supporting: "호텔 조식 · 나가사키 차이나타운 · 오우라 천주당",
  });
  assert.deepEqual(rows, originalRows);
  assert.equal(createHomeSchedulePreviewCopy([], "2026-09-11", 1), null);
});

test("home preview fit preserves unusual runtime media ratios", () => {
  assert.deepEqual(getHomeImageFit(null, null, 1, 1), {
    mode: "cover",
    scale: 1,
  });
  assert.deepEqual(getHomeImageFit(4, 3, 4, 3), {
    mode: "cover",
    scale: 1,
  });
  assert.deepEqual(getHomeImageFit(16, 9, 1, 1), {
    mode: "bounded",
    scale: 1.22,
  });
  assert.deepEqual(getHomeImageFit(21, 9, 1, 1), {
    mode: "contain",
    scale: 1,
  });
});

test("home restores the approved v5 composition with live previews", async () => {
  const [
    page,
    route,
    css,
    ui,
    schedulePage,
    albumPage,
    cardsPage,
    albumRepository,
    cardRepository,
    scenicAsset,
    nextConfig,
  ] = await Promise.all([
    readFile(new URL("../../app/home/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/home-visual/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../components/ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/schedule/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/album/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/cards/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../album/album-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../cards/memory-card-repository.ts", import.meta.url), "utf8"),
    readFile("private-assets/home/Jeonga_Fukuoka_Home_v5_Hero_Scenery_445x490.png"),
    readFile("next.config.ts", "utf8"),
  ]);
  const homeCssStart = css.indexOf("/* Home approved base restore + light development v5. */");
  const homeCssEnd = css.indexOf(".bottom-nav {", homeCssStart);
  const homeCss = css.slice(homeCssStart, homeCssEnd);

  assert.ok(scenicAsset.byteLength > 40_000);
  assert.ok(homeCssStart >= 0 && homeCssEnd > homeCssStart);
  assert.match(page, /<TripAccessGuard>/);
  assert.match(page, /const \{ trip \} = useCurrentTripSession\(\)/);
  assert.match(page, /FUKUOKA FAMILY TRIP/);
  assert.match(page, /<span>전가네<\/span>[\s\S]*<span>후쿠오카<\/span>[\s\S]*<span>가족여행<\/span>/);
  assert.match(page, /함께하는 2박 3일/);
  assert.match(page, /trip\.startDate\.replaceAll\("-", "\."\)/);
  assert.match(page, /trip\.endDate\.slice\(5\)\.replace\("-", "\."\)/);
  assert.match(page, /width=\{445\}[\s\S]*height=\{490\}[\s\S]*className="home-v5-hero-scene"/);

  for (const [label, value] of [
    ["여행지", "후쿠오카"],
    ["기간", "2박 3일"],
    ["인원", "가족 10명"],
    ["주요 경로", "야나가와 · 나가사키"],
  ]) {
    assert.match(page, new RegExp(`label: "${label}", value: "${value}"`));
  }

  assert.match(page, /eyebrow="OUR TRIP"[\s\S]*title="여행을 시작해요"/);
  for (const [href, label, description] of [
    ["/schedule", "여행 일정", "자세히 보기"],
    ["/album", "사진 공유", "추억 나누기"],
    ["/cards", "추억 카드 만들기", "나만의 카드"],
  ]) {
    assert.match(
      page,
      new RegExp(`href: "${href}"[\\s\\S]*?label: "${label}"[\\s\\S]*?description: "${description}"`),
    );
  }

  assert.match(page, /eyebrow="TRAVEL NOTES"[\s\S]*title="여행 미리보기"/);
  const wideScheduleIndex = page.indexOf("home-v5-schedule-preview");
  const lowerPreviewGridIndex = page.indexOf("home-v5-preview-grid");
  assert.ok(wideScheduleIndex > 0 && lowerPreviewGridIndex > wideScheduleIndex);
  assert.match(page, /HOME_SCHEDULE_PREVIEW_ASSETS\[schedule\.dayNo\]/);
  assert.match(page, /albumPreview\.photo\.signedUrl/);
  assert.match(page, /latestCard\?\.creatorName/);
  assert.match(page, /latestCardTemplate/);
  assert.match(page, /loadHomeAlbumPreview\(trip\.id\)/);
  assert.match(page, /loadLatestMemoryCard\(trip\.id\)/);
  assert.match(page, /loadHomeAlbumPhoto\(trip\.id, photoId\)/);
  assert.match(page, /createHomeSchedulePreviewCopy\([\s\S]*scheduleItems,[\s\S]*trip\.startDate,[\s\S]*schedule\.dayNo/);
  assert.match(
    page,
    /\.from\("itinerary_items"\)[\s\S]*?\.eq\("trip_id", trip\.id\)[\s\S]*?\.eq\("day_no", schedule\.dayNo\)[\s\S]*?\.order\("sequence", \{ ascending: true \}\)/,
  );

  assert.match(route, /Jeonga_Fukuoka_Home_v5_Hero_Scenery_445x490\.png/);
  assert.match(route, /"private-assets",\s*"home"/);
  assert.doesNotMatch(route, /local-references\/home-v5/);
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /serveLandingVisual/);
  assert.match(route, /'"home-visual-v5"'/);
  assert.match(route, /private, max-age=0, must-revalidate/);
  assert.match(nextConfig, /"\/api\/home-visual": \["\.\/private-assets\/home\/\*\*\/\*"\]/);
  assert.match(nextConfig, /"\/api\/schedule-asset\/\[\.\.\.path\]": \["\.\/private-assets\/schedule\/\*\*\/\*"\]/);

  assert.match(homeCss, /\.home-v5-hero\s*\{[^}]*height: clamp\(270px, 73vw, 314px\)/s);
  assert.match(homeCss, /\.home-v5-summary dl\s*\{[^}]*grid-template-columns: 0\.9fr 0\.9fr 0\.95fr 1\.35fr/s);
  assert.match(homeCss, /\.home-v5-quick-grid\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(homeCss, /\.home-v5-schedule-preview\s*\{[^}]*grid-template-columns: minmax\(0, 42%\) minmax\(0, 1fr\)/s);
  assert.match(homeCss, /\.home-v5-preview-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(homeCss, /word-break: keep-all/);
  assert.match(homeCss, /@media \(max-width: 374px\)/);
  assert.match(homeCss, /focus-visible/);
  assert.doesNotMatch(homeCss, /bottom-nav/);
  assert.doesNotMatch(css, /\.home-page-shell\s*>\s*\.bottom-nav/);

  assert.match(
    ui,
    /const bottomNavItems = \[\s*\{ href: "\/home", icon: "home", label: "홈" \},\s*\{ href: "\/schedule", icon: "schedule", label: "일정" \},\s*\{ href: "\/album", icon: "album", label: "앨범" \},\s*\{ href: "\/cards", icon: "card", label: "카드" \}/s,
  );
  assert.match(page, /<BottomNav activeHref="\/home" \/>/);
  assert.match(schedulePage, /<BottomNav activeHref="\/schedule" \/>/);
  assert.match(albumPage, /<BottomNav activeHref="\/album" \/>/);
  assert.match(cardsPage, /<BottomNav activeHref="\/cards" className="cards-bottom-nav" \/>/);
  assert.match(css, /\.bottom-nav-list\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.bottom-nav-link\s*\{[^}]*min-height: 44px/s);

  assert.doesNotMatch(
    `${page}\n${route}\n${homeCss}`,
    /home-v3|home-v4|home-artboard|home-runtime-base|안녕하세요|오늘 한눈에 보기|25°C|추천 먹거리|가족 메모|\/my|rating|reviewCount|weather/,
  );
  assert.match(albumRepository, /select\(PHOTO_COLUMNS, \{ count: "exact" \}\)[\s\S]*order\("created_at", \{ ascending: false \}\)[\s\S]*limit\(1\)/);
  assert.match(albumRepository, /loadHomeAlbumPhoto[\s\S]*\.eq\("id", photoId\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(cardRepository, /loadLatestMemoryCard[\s\S]*loadMemoryCardsWithLimit\(tripId, 1\)/);
});
