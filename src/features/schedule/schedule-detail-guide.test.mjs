import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  buildGoogleMapsSearchUrl,
  getScheduleDetailArtworkSrc,
  getScheduleGuideEnrichment,
  getScheduleGuideItem,
  getScheduleNearbyFood,
  getScheduleWalkablePlaces,
  hasVariableGuideInfo,
  resolveScheduleGuideDay,
  SCHEDULE_GUIDE_FOOD_ATTACHMENTS,
  SCHEDULE_GUIDE_ITEMS,
  SCHEDULE_GUIDE_SUPPLEMENT_ATTACHMENTS,
  SCHEDULE_MAPS_SNAPSHOT_DATE,
  SCHEDULE_MAPS_SNAPSHOT_LABEL,
  SCHEDULE_STATIC_SNAPSHOT_LABEL,
} from "./schedule-guide-data.ts";
import {
  buildScheduleDetailPresentation,
  formatSchedulePlaceRating,
} from "./schedule-detail-presentation.ts";
import {
  createScheduleDetailHistoryState,
  getScheduleDetailCloseMode,
  removeScheduleDetailFromUrl,
  SCHEDULE_DETAIL_HISTORY_KEY,
} from "./schedule-detail-history.ts";
import {
  SCHEDULE_DETAIL_HOTSPOTS,
  SCHEDULE_FULL_PLATE_FALLBACK_HOTSPOTS,
} from "./schedule-detail-hotspots.ts";
import {
  getScheduleBodyLogicalHeight,
  getScheduleRowLogicalY,
  SCHEDULE_BODY_DIMENSIONS,
  SCHEDULE_DAY_ROW_COUNTS,
  SCHEDULE_LAYOUT,
} from "./schedule-layout.ts";

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

test("detail artwork is generated only from Schedule-local source scenes", async () => {
  const detailDirectory = new URL(
    "../../../public/assets/schedule/detail/",
    import.meta.url,
  );
  const generatedFiles = (await readdir(detailDirectory)).filter((file) =>
    file.endsWith(".webp"),
  );

  assert.equal(generatedFiles.length, 29);
  for (const item of SCHEDULE_GUIDE_ITEMS) {
    const artworkSrc = getScheduleDetailArtworkSrc(item.id);
    assert.match(artworkSrc, /^\/assets\/schedule\/detail\/[a-z0-9-]+\.webp$/);
    assert.doesNotMatch(artworkSrc, /^https?:|APPROVED_DesignGuide|00_references/);
    const asset = await readFile(new URL(`../../../public${artworkSrc}`, import.meta.url));
    assert.ok(asset.byteLength > 0 && asset.byteLength < 100_000, item.id);
  }

  const generator = await readFile(
    new URL("../../../scripts/generate-schedule-bodies.mjs", import.meta.url),
    "utf8",
  );
  assert.match(generator, /plates\/source\/day-1-scenes-v2\.png/);
  assert.match(generator, /plates\/source\/day-2-scenes-v2\.png/);
  assert.match(generator, /plates\/source\/day-3-scenes-v25\.png/);
  assert.doesNotMatch(generator, /APPROVED_DesignGuide|00_references/);
});

test("the static Google Maps snapshot matches the v29-B manifest exactly", () => {
  const expected = {
    "d1-takeo-shrine": [4.4, 3688, "https://www.google.com/maps/search/?api=1&query=Takeo%20Shrine%20Saga%20Japan"],
    "d1-takeo-library": [4.5, 1390, "https://www.google.com/maps/search/?api=1&query=Takeo%20City%20Library%20Saga%20Japan"],
    "d1-ureshino-hotel": [3.7, 1770, "https://www.google.com/maps/search/?api=1&query=Ooedo%20Onsen%20Monogatari%20Ureshinokan"],
    "d2-nagasaki-chinatown": [3.7, 9223, "https://www.google.com/maps/search/?api=1&query=Nagasaki%20Shinchi%20Chinatown"],
    "d2-oura-cathedral": [4.0, 1664, "https://www.google.com/maps/search/?api=1&query=Oura%20Cathedral%20Nagasaki"],
    "d2-glover-garden": [4.1, 12135, "https://www.google.com/maps/search/?api=1&query=Glover%20Garden%20Nagasaki"],
    "d2-fukuoka-hotel": [4.1, 760, "https://www.google.com/maps/search/?api=1&query=Best%20Western%20Plus%20Fukuoka%20Tenjin-minami"],
    "d3-dazaifu": [4.5, 43923, "https://www.google.com/maps/search/?api=1&query=Dazaifu%20Tenmangu%20Shrine"],
    "d3-lalaport": [4.3, 9313, "https://www.google.com/maps/search/?api=1&query=LaLaport%20Fukuoka"],
  };
  const actual = Object.fromEntries(
    SCHEDULE_GUIDE_ITEMS.flatMap((item) =>
      item.ratingSnapshot
        ? [[item.id, [item.ratingSnapshot.rating, item.ratingSnapshot.reviewCount, item.ratingSnapshot.sourceUrl]]]
        : [],
    ),
  );

  assert.equal(SCHEDULE_MAPS_SNAPSHOT_DATE, "2026-09-02");
  assert.equal(SCHEDULE_MAPS_SNAPSHOT_LABEL, "Google Maps · 2026-09-02 조사 기준");
  assert.deepEqual(actual, expected);
  for (const item of SCHEDULE_GUIDE_ITEMS.filter(({ ratingSnapshot }) => ratingSnapshot)) {
    assert.equal(item.ratingSnapshot.sourceLabel, "Google Maps");
    assert.equal(item.ratingSnapshot.asOf, "2026-09-02");
  }
});

test("v29-E rating manifest is applied only to its intended guide IDs", () => {
  const expected = {
    "Kabashima Hyouka": [4.5, 168, "Google Maps", ["d1-lunch-yanagawa", "d1-yanagawa-boat"]],
    "83coffee": [4.1, 97, "Google Maps", ["d1-lunch-yanagawa", "d1-yanagawa-boat"]],
    "Starbucks Coffee - Tsutaya Books, Takeo City Library": [4.5, 456, "Google Maps", ["d1-takeo-library"]],
    "Glover Café": [3.6, 31, "Google Maps", ["d2-glover-garden"]],
    "Shooken Main Store": [4.5, 1011, "Google Maps", ["d2-nagasaki-chinatown", "d2-lunch-nagasaki"]],
    "Ito King - Tenjin": [4.2, 499, "Google Maps", ["d2-tenjin-free"]],
    "Blue Bottle Coffee Fukuoka Tenjin Cafe": [4.5, 1290, "Google Maps", ["d2-tenjin-free", "d2-fukuoka-hotel"]],
    "I’m donut? Tenjin": [3.62, 821, "食べログ", ["d2-tenjin-free"]],
    "Patisserie Sakura": [3.17, 29, "食べログ", ["d1-lunch-yanagawa", "d1-yanagawa-boat"]],
    "IYEMON CAFE LaLaport Fukuoka": [3.21, 75, "食べログ", ["d3-lalaport", "d3-lunch"]],
    "PUG LaLaport Fukuoka": [3.04, 24, "食べログ", ["d3-lalaport", "d3-lunch"]],
  };

  for (const [name, [rating, reviewCount, source, intendedIds]] of Object.entries(expected)) {
    const occurrences = SCHEDULE_GUIDE_ITEMS.flatMap((item) =>
      getScheduleGuideEnrichment(item).places
        .filter((place) => place.name === name)
        .map((place) => [item.id, place]),
    );
    assert.deepEqual(occurrences.map(([id]) => id), intendedIds, name);
    for (const [, place] of occurrences) {
      assert.equal(place.rating, rating, name);
      assert.equal(place.reviewCount, reviewCount, name);
      assert.equal(place.ratingSourceLabel, source, name);
      assert.equal(place.ratingAsOf, "2026-09-02", name);
    }
  }

  for (const name of ["Kyushu Pancake Cafe", "KAKA cheesecake store", "Megane Bridge"]) {
    const place = SCHEDULE_GUIDE_ITEMS.flatMap((item) =>
      getScheduleGuideEnrichment(item).places,
    ).find((candidate) => candidate.name === name);
    assert.ok(place, name);
    assert.equal(place.rating, undefined, name);
    assert.equal(place.reviewCount, undefined, name);
    assert.equal(place.ratingSourceLabel, undefined, name);
    assert.equal(place.ratingAsOf, undefined, name);
  }
});

test("recommendation rating lines preserve Google and 食べログ source semantics", () => {
  const allPlaces = SCHEDULE_GUIDE_ITEMS.flatMap((item) =>
    getScheduleGuideEnrichment(item).places,
  );
  const byName = (name) => allPlaces.find((place) => place.name === name);

  assert.equal(
    formatSchedulePlaceRating(byName("Kabashima Hyouka")),
    "★ 4.5 · 리뷰 168 · Google Maps",
  );
  assert.equal(
    formatSchedulePlaceRating(byName("I’m donut? Tenjin")),
    "食べログ 3.62 · 리뷰 821",
  );
  assert.equal(formatSchedulePlaceRating(byName("KAKA cheesecake store")), undefined);

  for (const place of allPlaces.filter(
    ({ rating, reviewCount }) => rating !== undefined || reviewCount !== undefined,
  )) {
    assert.equal(place.ratingAsOf, "2026-09-02", place.name);
    const line = formatSchedulePlaceRating(place);
    assert.ok(line, place.name);
    if (place.ratingSourceLabel === "食べログ") {
      assert.match(line, /^食べログ /, place.name);
      assert.doesNotMatch(line, /★|Google Maps/, place.name);
    } else {
      assert.match(line, /Google Maps$/, place.name);
      assert.doesNotMatch(line, /食べログ/, place.name);
    }
  }

  for (const name of [
    "Kabashima Hyouka",
    "83coffee",
    "Starbucks Coffee - Tsutaya Books, Takeo City Library",
    "Glover Café",
    "Shooken Main Store",
    "Ito King - Tenjin",
    "Blue Bottle Coffee Fukuoka Tenjin Cafe",
  ]) {
    assert.ok(formatSchedulePlaceRating(byName(name)), name);
  }
  assert.equal(SCHEDULE_MAPS_SNAPSHOT_DATE, "2026-09-02");
});

test("manifest nearby groups are static, complete, and capped at three", () => {
  const expectedFoodNames = [
    "Wakamatsuya",
    "Ganso Motoyoshiya",
    "Yoakejaya",
    "Starbucks Coffee - Tsutaya Books, Takeo City Library",
    "Shikairo",
    "Kozanro Chukagaishinkan",
    "Motsunabe Rakutenchi Tenjin BR",
    "Gyukatsu Motomura Fukuoka Parco Branch",
    "Kiwamiya Fukuoka Parco Store",
    "Kasanoya",
    "Starbucks Coffee - Dazaifu Tenmangu Shrine Omotesando",
    "Yasutake",
    "Kamimura Bokujyo LaLaport Fukuoka",
  ];
  const expectedWalkableNames = [
    "Takeo City Library",
    "Megane Bridge",
    "Glover Garden",
    "Nagasaki Confucius Shrine",
    "Canal City Hakata",
    "Kyushu National Museum",
    "Life-Size RX-93ff ν Gundam Statue",
  ];
  const foodNames = [];
  const walkableNames = [];

  for (const item of SCHEDULE_GUIDE_ITEMS) {
    const nearbyFood = getScheduleNearbyFood(item);
    const walkablePlaces = getScheduleWalkablePlaces(item);
    foodNames.push(...nearbyFood.map(({ name }) => name));
    walkableNames.push(...walkablePlaces.map(({ name }) => name));
    assert.ok(nearbyFood.length <= 3, `${item.id} nearby food cap`);
    assert.ok(walkablePlaces.length <= 3, `${item.id} walkable place cap`);
    for (const place of [...nearbyFood, ...walkablePlaces]) {
      assert.match(place.mapUrl, /^https:\/\/www\.google\.com\/maps\/search\//);
      if (place.artworkSrc) {
        assert.match(place.artworkSrc, /^\/assets\/schedule\/detail\/[a-z0-9-]+\.webp$/);
      }
    }
  }

  assert.deepEqual(foodNames, expectedFoodNames);
  assert.deepEqual(walkableNames, expectedWalkableNames);
  assert.equal(getScheduleWalkablePlaces(getScheduleGuideItem("d2-glover-garden")).length, 0);
});

test("walking metadata uses only the manifest values", () => {
  const findWalkable = (itemId, name) =>
    getScheduleWalkablePlaces(getScheduleGuideItem(itemId)).find((place) => place.name === name);

  assert.deepEqual(
    ["Takeo City Library", "Glover Garden", "Kyushu National Museum"].map((name) =>
      SCHEDULE_GUIDE_ITEMS.flatMap((item) => getScheduleWalkablePlaces(item)).find((place) => place.name === name)?.walkingMinutes,
    ),
    [5, 5, 5],
  );
  assert.deepEqual(
    [findWalkable("d2-nagasaki-chinatown", "Megane Bridge")?.walkingMinutes,
      findWalkable("d2-nagasaki-chinatown", "Megane Bridge")?.distanceMeters],
    [10, 890],
  );
  assert.equal(findWalkable("d2-fukuoka-hotel", "Canal City Hakata")?.walkingMinutes, 7);
  const gundam = findWalkable("d3-lalaport", "Life-Size RX-93ff ν Gundam Statue");
  assert.equal(gundam?.walkingMinutes, undefined);
  assert.equal(gundam?.distanceMeters, undefined);
  assert.equal(gundam?.sameComplex, true);
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
    "시간: 09:30",
    "항공편: 제주항공 7C1403",
    "공항: 인천국제공항 제1터미널",
  ]);
  assert.deepEqual(getScheduleGuideItem("d1-move-yanagawa")?.itineraryFacts, [
    "이동 구간: 후쿠오카공항 → 야나가와",
    "예상 이동시간: 약 1시간 20분",
    "도착 후: 중식 · 현지식",
  ]);
  assert.deepEqual(getScheduleGuideItem("d1-fukuoka-arrival")?.itineraryFacts, [
    "시간: 11:00",
    "항공편: 제주항공 7C1403",
    "공항: 후쿠오카공항",
  ]);
});

test("v29-D presentation keeps critical kind facts open and enrichment grouped", () => {
  for (const item of SCHEDULE_GUIDE_ITEMS) {
    const presentation = buildScheduleDetailPresentation(item);
    assert.ok(presentation.coreFacts.length > 0, `${item.id} core facts`);
    assert.ok(
      ["sparse", "rich"].includes(presentation.layout),
      `${item.id} layout policy`,
    );
    assert.ok(
      presentation.disclosures.filter(
        ({ key }) => key === presentation.defaultOpenDisclosure,
      ).length <= 1,
      `${item.id} default disclosure cap`,
    );
    assert.equal(
      new Set(presentation.disclosures.map(({ key }) => key)).size,
      presentation.disclosures.length,
      `${item.id} disclosure keys`,
    );
    for (const disclosure of presentation.disclosures) {
      if (disclosure.kind === "places") {
        assert.ok(
          disclosure.places.length > 0 || disclosure.localPicks.length > 0,
          `${item.id} empty group`,
        );
        assert.ok(
          disclosure.places.length + disclosure.localPicks.length <= 3,
          `${item.id} combined group cap`,
        );
      }
    }
  }

  const flight = buildScheduleDetailPresentation(
    getScheduleGuideItem("d1-incheon-departure"),
  );
  assert.equal(flight.layout, "sparse");
  assert.equal(flight.coreTitle, "항공 핵심");
  assert.deepEqual(flight.coreFacts, [
    "시간: 09:30",
    "항공편: 제주항공 7C1403",
    "공항: 인천국제공항 제1터미널",
  ]);

  const move = buildScheduleDetailPresentation(
    getScheduleGuideItem("d1-move-takeo"),
  );
  assert.equal(move.layout, "sparse");
  assert.deepEqual(move.coreFacts, [
    "이동 구간: 야나가와 → 다케오",
    "예상 이동시간: 약 1시간 10분",
    "도착 후: 다케오 신사",
  ]);

  for (const item of SCHEDULE_GUIDE_ITEMS.filter(
    ({ kind, title }) => kind === "meal" && title.includes("현지식"),
  )) {
    const meal = buildScheduleDetailPresentation(item);
    assert.equal(meal.layout, "sparse");
    assert.ok(meal.coreFacts.includes("확정 식당 없음"), item.id);
  }

  const attraction = buildScheduleDetailPresentation(
    getScheduleGuideItem("d3-dazaifu"),
  );
  assert.equal(attraction.layout, "rich");
  assert.deepEqual(
    attraction.disclosures.map(({ key }) => key),
    ["snack", "cafe", "walkable", "rating", "official"],
  );
  assert.deepEqual(
    attraction.disclosures
      .filter(({ kind }) => kind === "places")
      .map(({ label }) => label),
    ["간식·디저트", "카페·휴식", "같이 둘러보기"],
  );

  const genericMeal = buildScheduleDetailPresentation(
    getScheduleGuideItem("d1-lunch-yanagawa"),
  );
  assert.deepEqual(
    genericMeal.disclosures.map(({ key }) => key),
    ["food", "snack", "cafe"],
  );
  assert.equal(genericMeal.defaultOpenDisclosure, "food");

  const hotel = buildScheduleDetailPresentation(
    getScheduleGuideItem("d2-fukuoka-hotel"),
  );
  assert.equal(hotel.layout, "rich");
  assert.ok(hotel.coreFacts.includes("석식 불포함"));
  assert.ok(hotel.coreFacts.includes("다음 날 호텔 조식 후 다자이후 일정"));
});

test("all 27 guide IDs have an explicit, audited presentation attachment matrix", () => {
  const actual = Object.fromEntries(
    SCHEDULE_GUIDE_ITEMS.map((item) => [
      item.id,
      buildScheduleDetailPresentation(item).disclosures.map(({ key }) => key),
    ]),
  );

  assert.deepEqual(actual, {
    "d1-incheon-meeting": ["official"],
    "d1-incheon-departure": ["official"],
    "d1-fukuoka-arrival": ["official"],
    "d1-move-yanagawa": [],
    "d1-lunch-yanagawa": ["food", "snack", "cafe"],
    "d1-yanagawa-boat": ["snack", "cafe", "official"],
    "d1-move-takeo": [],
    "d1-takeo-shrine": ["walkable", "rating", "official"],
    "d1-takeo-library": ["snack", "cafe", "rating", "official"],
    "d1-move-ureshino": [],
    "d1-ureshino-hotel": ["rating"],
    "d2-hotel-breakfast": [],
    "d2-move-nagasaki": [],
    "d2-nagasaki-chinatown": ["food", "snack", "walkable", "rating", "official"],
    "d2-oura-cathedral": ["walkable", "rating", "official"],
    "d2-glover-garden": ["cafe", "rating", "official"],
    "d2-lunch-nagasaki": ["food", "snack"],
    "d2-move-fukuoka": [],
    "d2-tenjin-free": ["food", "snack", "cafe", "official"],
    "d2-fukuoka-hotel": ["cafe", "walkable", "rating"],
    "d3-hotel-breakfast": [],
    "d3-dazaifu": ["snack", "cafe", "walkable", "rating", "official"],
    "d3-lalaport": ["food", "snack", "cafe", "walkable", "rating", "official"],
    "d3-lunch": ["food", "snack", "cafe"],
    "d3-move-airport": ["official"],
    "d3-fukuoka-departure": ["official"],
    "d3-incheon-arrival": ["official"],
  });
});

test("explicit guide-ID attachments expose every intended static supplement", () => {
  assert.deepEqual(SCHEDULE_GUIDE_SUPPLEMENT_ATTACHMENTS, {
    "d1-lunch-yanagawa": "yanagawa",
    "d1-yanagawa-boat": "yanagawa",
    "d1-takeo-library": "takeo",
    "d2-nagasaki-chinatown": "nagasakiChinatown",
    "d2-glover-garden": "nagasakiGlover",
    "d2-lunch-nagasaki": "nagasakiChinatown",
    "d2-tenjin-free": "tenjin",
    "d2-fukuoka-hotel": "fukuokaHotel",
    "d3-dazaifu": "dazaifu",
    "d3-lalaport": "lalaport",
    "d3-lunch": "lalaport",
  });
  assert.deepEqual(SCHEDULE_GUIDE_FOOD_ATTACHMENTS, {
    "d2-lunch-nagasaki": "d2-nagasaki-chinatown",
    "d3-lunch": "d3-lalaport",
  });

  const group = (id, key) =>
    buildScheduleDetailPresentation(getScheduleGuideItem(id)).disclosures.find(
      (disclosure) => disclosure.key === key,
    );
  const names = (id, key) => group(id, key)?.places.map(({ name }) => name) ?? [];
  const picks = (id) =>
    group(id, "snack")?.localPicks.map(({ label }) => label) ?? [];

  for (const id of ["d1-lunch-yanagawa", "d1-yanagawa-boat"]) {
    assert.deepEqual(names(id, "snack"), ["Kabashima Hyouka", "Patisserie Sakura"]);
    assert.deepEqual(names(id, "cafe"), ["83coffee"]);
  }
  assert.deepEqual(names("d1-takeo-library", "snack"), ["Kyushu Pancake Cafe"]);
  assert.deepEqual(names("d1-takeo-library", "cafe"), [
    "Starbucks Coffee - Tsutaya Books, Takeo City Library",
  ]);
  assert.deepEqual(names("d2-lunch-nagasaki", "food"), [
    "Shikairo",
    "Kozanro Chukagaishinkan",
  ]);
  assert.deepEqual(names("d2-lunch-nagasaki", "snack"), ["Shooken Main Store"]);
  assert.equal(
    buildScheduleDetailPresentation(getScheduleGuideItem("d2-lunch-nagasaki"))
      .defaultOpenDisclosure,
    "food",
  );
  assert.deepEqual(picks("d2-nagasaki-chinatown"), [
    "角煮まんじゅう",
    "よりより",
  ]);
  assert.deepEqual(names("d2-nagasaki-chinatown", "snack"), ["Shooken Main Store"]);
  assert.deepEqual(names("d2-glover-garden", "cafe"), ["Glover Café"]);
  assert.deepEqual(names("d2-tenjin-free", "snack"), ["Ito King - Tenjin", "I’m donut? Tenjin"]);
  assert.deepEqual(names("d2-tenjin-free", "cafe"), [
    "Blue Bottle Coffee Fukuoka Tenjin Cafe",
  ]);
  assert.deepEqual(names("d2-fukuoka-hotel", "cafe"), [
    "Blue Bottle Coffee Fukuoka Tenjin Cafe",
  ]);
  assert.deepEqual(picks("d3-dazaifu"), ["梅ヶ枝餅"]);
  assert.deepEqual(names("d3-lalaport", "food"), ["Kamimura Bokujyo LaLaport Fukuoka"]);
  assert.deepEqual(names("d3-lalaport", "snack"), ["KAKA cheesecake store", "PUG LaLaport Fukuoka"]);
  assert.deepEqual(names("d3-lalaport", "cafe"), ["IYEMON CAFE LaLaport Fukuoka"]);
  assert.deepEqual(names("d3-lalaport", "walkable"), [
    "Life-Size RX-93ff ν Gundam Statue",
  ]);
  assert.deepEqual(names("d3-lunch", "food"), ["Kamimura Bokujyo LaLaport Fukuoka"]);
  assert.deepEqual(names("d3-lunch", "snack"), ["KAKA cheesecake store", "PUG LaLaport Fukuoka"]);
  assert.deepEqual(names("d3-lunch", "cafe"), ["IYEMON CAFE LaLaport Fukuoka"]);
});

test("v29-D static utility metadata stays truthful and compact", () => {
  const enriched = SCHEDULE_GUIDE_ITEMS.flatMap((item) => {
    const enrichment = getScheduleGuideEnrichment(item);
    return [...enrichment.places, ...enrichment.localPicks];
  });
  const places = enriched.filter(({ name }) => name);
  const localPicks = enriched.filter(({ label }) => label);

  for (const pick of localPicks) {
    assert.deepEqual(Object.keys(pick).sort(), ["kind", "label", "note"]);
  }
  for (const place of places.filter(({ sameComplex }) => sameComplex)) {
    assert.equal(place.walkingMinutes, undefined, place.name);
    assert.equal(place.distanceMeters, undefined, place.name);
    assert.equal(place.walkingLabel, undefined, place.name);
  }

  const yanagawaLunch = getScheduleGuideEnrichment(
    getScheduleGuideItem("d1-lunch-yanagawa"),
  ).places;
  assert.equal(
    yanagawaLunch.find(({ name }) => name === "Patisserie Sakura")?.walkingLabel,
    "오하나 하선장 기준 도보 약 1분",
  );
  assert.equal(
    yanagawaLunch.find(({ name }) => name === "83coffee")?.walkingLabel,
    "오하나 하선장 기준 도보 약 2분",
  );
  assert.equal(
    getScheduleGuideEnrichment(getScheduleGuideItem("d3-lalaport")).places.find(
      ({ name }) => name === "KAKA cheesecake store",
    )?.validThrough,
    "2026-10-04",
  );
  assert.equal(SCHEDULE_STATIC_SNAPSHOT_LABEL, "2026-09-02 정적 조사 기준");
});

test("all 27 summaries stay concise and omit implementation copy", () => {
  for (const item of SCHEDULE_GUIDE_ITEMS) {
    assert.ok(item.summary.length <= 44, `${item.id}: ${item.summary}`);
    assert.doesNotMatch(
      item.summary,
      /참고용|후보|일정표 기준|공식 관광 안내|Google|구현|데이터/,
      item.id,
    );
  }
});

test("canonical Schedule sources exclude the four unconfirmed claims", async () => {
  const sources = await Promise.all([
    readFile(new URL("../../../scripts/generate-schedule-bodies.mjs", import.meta.url), "utf8"),
    readFile(new URL("./schedule-guide-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/data/04_SEED_DRAFT.sql", import.meta.url), "utf8"),
  ]);

  for (const source of sources) {
    for (const claim of ["1명 합류", "김해 출발 가족", "간식 제공", "이동 중 간식"]) {
      assert.ok(!source.includes(claim), claim);
    }
  }
});

test("hotspots cover every guide item once in its split body", () => {
  assert.equal(SCHEDULE_DETAIL_HOTSPOTS.length, 27);
  assert.deepEqual(dayCounts(SCHEDULE_DETAIL_HOTSPOTS), { 1: 11, 2: 9, 3: 7 });
  assert.deepEqual(
    SCHEDULE_DETAIL_HOTSPOTS.map((hotspot) => hotspot.id),
    SCHEDULE_GUIDE_ITEMS.map((item) => item.id),
  );
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

test("body hotspots derive exactly from the shared row geometry", () => {
  for (const day of [1, 2, 3]) {
    const bodyHeight = getScheduleBodyLogicalHeight(SCHEDULE_DAY_ROW_COUNTS[day]);
    const hotspots = SCHEDULE_DETAIL_HOTSPOTS.filter((hotspot) => hotspot.day === day);

    hotspots.forEach((hotspot, index) => {
      const rowY = getScheduleRowLogicalY(index);
      const expectedY = (rowY / bodyHeight) * 100;
      const hotspotBottom = ((hotspot.rect.y + hotspot.rect.height) / 100) * bodyHeight;
      const memoY = bodyHeight - SCHEDULE_LAYOUT.memo.height - SCHEDULE_LAYOUT.memo.bottomMargin;
      assert.ok(Math.abs(hotspot.rect.x - (SCHEDULE_LAYOUT.row.cardX / SCHEDULE_LAYOUT.logicalWidth) * 100) < 1e-10);
      assert.ok(Math.abs(hotspot.rect.y - expectedY) < 1e-10, hotspot.id);
      assert.ok(Math.abs(hotspot.rect.width - (SCHEDULE_LAYOUT.row.cardWidth / SCHEDULE_LAYOUT.logicalWidth) * 100) < 1e-10);
      assert.ok(Math.abs(hotspot.rect.height - (SCHEDULE_LAYOUT.row.height / bodyHeight) * 100) < 1e-10);
      assert.ok(rowY >= SCHEDULE_LAYOUT.row.firstY);
      assert.ok(rowY > SCHEDULE_LAYOUT.route.y + SCHEDULE_LAYOUT.route.height);
      assert.ok(hotspotBottom <= memoY - SCHEDULE_LAYOUT.memo.gap + 1e-10);
      if (index > 0) {
        const previous = hotspots[index - 1];
        const logicalStep = ((hotspot.rect.y - previous.rect.y) / 100) * bodyHeight;
        assert.ok(Math.abs(logicalStep - (SCHEDULE_LAYOUT.row.height + SCHEDULE_LAYOUT.row.gap)) < 1e-10);
      }
    });
  }
});

test("detail history closes app entries with Back and deep links with replace", () => {
  const existingState = { nextInternal: "preserved" };
  const markedState = createScheduleDetailHistoryState(existingState);
  assert.deepEqual(markedState, {
    nextInternal: "preserved",
    [SCHEDULE_DETAIL_HISTORY_KEY]: true,
  });
  assert.equal(getScheduleDetailCloseMode(markedState), "back");
  assert.equal(getScheduleDetailCloseMode(existingState), "replace");
  assert.equal(getScheduleDetailCloseMode(null), "replace");

  const url = removeScheduleDetailFromUrl(
    "https://example.test/schedule?day=2&detail=d2-oura-cathedral&debugScheduleHotspots=1",
  );
  assert.equal(url.searchParams.has("detail"), false);
  assert.equal(url.searchParams.get("day"), "2");
  assert.equal(url.searchParams.get("debugScheduleHotspots"), "1");
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
  for (const viewportWidth of [360, 375, 390, 402, 430]) {
    for (const hotspot of SCHEDULE_DETAIL_HOTSPOTS) {
      const asset = SCHEDULE_BODY_DIMENSIONS[hotspot.day];
      const renderedHeight = viewportWidth * (asset.height / asset.width);
      assert.ok((hotspot.rect.width / 100) * viewportWidth >= 44);
      assert.ok((hotspot.rect.height / 100) * renderedHeight >= 44);
    }
  }
});

test("detail UI keeps interaction, accessibility, and visual contracts", async () => {
  const [view, sheet, guide, presentation, css] = await Promise.all([
    readFile(new URL("./schedule-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("./schedule-detail-sheet.tsx", import.meta.url), "utf8"),
    readFile(new URL("./schedule-guide-data.ts", import.meta.url), "utf8"),
    readFile(new URL("./schedule-detail-presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(view, /detailHotspots\("body"\)/);
  assert.match(view, /detailHotspots\("fullPlate"\)/);
  assert.match(view, /createScheduleDetailHistoryState\(window\.history\.state\)/);
  assert.match(view, /getScheduleDetailCloseMode\(window\.history\.state\) === "back"[\s\S]*window\.history\.back\(\)/);
  assert.match(view, /window\.history\.replaceState\(window\.history\.state/);
  assert.match(view, /addEventListener\("popstate"/);
  assert.match(view, /debugScheduleHotspots/);
  assert.match(view, /process\.env\.NODE_ENV !== "production"/);
  assert.match(view, /activation === "pointer"[\s\S]*currentTarget\.blur\(\)/);
  assert.match(view, /setRestoreDetailFocus\(activation === "keyboard"\)/);
  assert.match(view, /key=\{selectedDetail\?\.id \?\? "closed"\}/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /buildScheduleDetailPresentation\(item\)/);
  assert.match(sheet, /formatSchedulePlaceRating\(place\)/);
  assert.ok(
    sheet.indexOf("<h4>{place.name}</h4>") <
      sheet.indexOf("<span>{nearbyCategoryLabels[place.category]}</span>"),
  );
  assert.match(
    sheet,
    /disclosure\.places\.length[\s\S]*<PlaceRows[\s\S]*disclosure\.localPicks\.length[\s\S]*<LocalPickRows/,
  );
  assert.match(sheet, /presentation\.coreFacts\.map/);
  assert.ok(
    sheet.indexOf("schedule-detail-core") <
      sheet.indexOf("presentation.disclosures.map"),
  );
  assert.doesNotMatch(sheet, /item\.facts/);
  assert.doesNotMatch(sheet, /어르신 체크|seniorNotes/);
  assert.doesNotMatch(guide, /seniorNotes/);
  assert.match(guide, /ratingSnapshot\?: ScheduleRatingSnapshot/);
  assert.equal(SCHEDULE_GUIDE_ITEMS.filter((item) => item.ratingSnapshot).length, 9);
  assert.match(presentation, /label: "먹거리"/);
  assert.match(presentation, /label: "간식·디저트"/);
  assert.match(presentation, /label: "카페·휴식"/);
  assert.match(presentation, /label: "같이 둘러보기"/);
  assert.match(presentation, /place\.ratingSourceLabel === "食べログ"/);
  assert.match(presentation, /"Google Maps"/);
  assert.match(sheet, /aria-expanded=\{isOpen\}/);
  assert.match(sheet, /aria-controls=\{contentId\}/);
  assert.match(sheet, /role="region"/);
  assert.match(sheet, /hidden=\{!isOpen\}/);
  assert.match(sheet, /filter\(\(element\) => !element\.closest\("\[hidden\]"\)\)/);
  assert.match(sheet, /type="button"[\s\S]*schedule-detail-disclosure-trigger/);
  assert.equal(
    sheet.match(/확정 일정이 아닌, 여유가 있을 때 보는 참고 후보예요\./g)?.length,
    1,
  );
  assert.match(sheet, /SCHEDULE_MAPS_SNAPSHOT_LABEL/);
  assert.match(sheet, /getScheduleDetailArtworkSrc\(item\.id\)/);
  assert.match(sheet, /presentation\.layout/);
  assert.doesNotMatch(sheet, /fallbackArtwork/);
  assert.match(sheet, />\s*지도 보기\s*</);
  assert.match(sheet, />\s*공식 사이트\s*</);
  assert.doesNotMatch(sheet, /Google Maps에서 보기/);
  assert.match(sheet, /SWIPE_CLOSE_DISTANCE = 96/);
  assert.match(sheet, /onPointerDown=\{startDrag\}/);
  assert.match(sheet, /restoreFocusOnClose && previousFocus\?\.isConnected/);
  assert.match(sheet, /event\.key === "Escape"/);
  assert.match(sheet, /document\.body\.style\.overflow = "hidden"/);
  assert.match(sheet, /event\.target === event\.currentTarget/);
  assert.match(css, /\.bottom-nav\s*\{[^}]*z-index:\s*70/s);
  assert.match(css, /\.schedule-detail-overlay\s*\{[^}]*z-index:\s*100/s);
  assert.match(css, /\.schedule-detail-content\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.schedule-detail-hotspot:focus-visible\s*\{[^}]*outline:\s*0[^}]*box-shadow:/s);
  assert.match(css, /\.schedule-detail-actions\s*\{[^}]*position:\s*sticky[^}]*safe-area-inset-bottom/s);
  assert.match(css, /\.schedule-detail-sheet\s*\{[^}]*max-height:\s*min\(95dvh, 900px\)/s);
  assert.doesNotMatch(css, /\.schedule-detail-sheet\s*\{[^}]*\n\s*height:/s);
  assert.match(css, /\.schedule-detail-hero-art\s*\{/);
  assert.match(css, /\.schedule-detail-hero-art--sparse\s*\{[^}]*clamp\(116px, 34vw, 146px\)/s);
  assert.match(css, /\.schedule-detail-hero-art--rich\s*\{[^}]*min-height:\s*196px/s);
  assert.match(css, /\.schedule-detail-disclosure-trigger:focus-visible/);
  assert.match(css, /\.schedule-detail-disclosure-content\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.schedule-detail-place-list article\s*\{/);
  assert.doesNotMatch(
    `${sheet}\n${guide}\n${presentation}\n${css}`,
    /maps\.googleapis\.com|google\.maps\.|@googlemaps|GOOGLE_MAPS_API_KEY|NEXT_PUBLIC_GOOGLE|fetch\s*\(|APPROVED_DesignGuide|00_references/,
  );
});
