import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  exportMemoryCardPng,
  getMemoryCardExportDimensions,
  MEMORY_CARD_EXPORT_SIZES,
  shareOrDownloadMemoryCardPng,
  wrapMemoryCardText,
} from "./memory-card-export.ts";
import {
  buildMemoryCardInsertPayload,
  buildMemoryCardLayoutV2,
  createMemoryCardRenderModel,
  getRandomPhotoCount,
  mapPersistedMemoryCardRows,
  normalizeMemoryCardCaption,
  parseCanonicalExperimentalMemoryCardLayoutV1,
  parseLegacyMemoryCardLayoutV1,
  parseMemoryCardLayoutV2,
  parseMemoryCardRenderModel,
  randomFillPhotoIds,
  reshuffleMemoryCardLayout,
  resolveMemoryCardSlots,
} from "./memory-card.ts";
import {
  FOUR_CUT_EXPORT_BOUNDS,
  MEMORY_CARD_CANVAS,
  MEMORY_CARD_FONT_STACKS,
  MEMORY_CARD_TEMPLATE_SPECS,
  MEMORY_CARD_TEXT_STYLES,
} from "./memory-card-template-spec.ts";

const tripId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const authUserId = "33333333-3333-4333-8333-333333333333";

test("code template coordinates stay synchronized with the canonical document", async () => {
  const canonical = JSON.parse(
    await readFile(
      new URL("../../../docs/card_engine/01_TEMPLATE_COORDINATES.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(MEMORY_CARD_CANVAS, canonical.canvas);
  assert.deepEqual(
    MEMORY_CARD_TEMPLATE_SPECS.map(({ key, slots, textSlots }) => ({ key, slots, textSlots })),
    canonical.templates.map(({ key, slots, textSlots }) => ({ key, slots, textSlots })),
  );
});

test("new layouts are strict canonical v2 with template slot counts", () => {
  const polaroid = buildMemoryCardLayoutV2(
    "polaroid_moodboard",
    ["a", "b", "c", "d", "e", "f"],
    " family ",
  );
  const fourCut = buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]);
  const editorial = buildMemoryCardLayoutV2("editorial_collage", ["a", "b", "c", "d"]);

  assert.equal(polaroid.version, 2);
  assert.deepEqual(polaroid.slots.map(({ slotId }) => slotId), ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.equal(polaroid.caption, "family");
  assert.deepEqual(fourCut.slots.map(({ slotId }) => slotId), ["f1", "f2", "f3", "f4"]);
  assert.deepEqual(editorial.slots.map(({ slotId }) => slotId), ["e1", "e2", "e3", "e4"]);
  assert.throws(() => buildMemoryCardLayoutV2("polaroid_moodboard", ["a", "b"]), /invalid-memory-card-photo-count/);
  assert.throws(() => buildMemoryCardLayoutV2("four_cut", ["a", "a", "c", "d"]), /duplicate-memory-card-photo/);
});

test("canonical v2 parser rejects v1, missing caption, malformed order, counts, and duplicates", () => {
  const valid = buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]);
  const malformed = [
    { ...valid, version: 1 },
    { version: 2, slots: valid.slots },
    { ...valid, slots: [valid.slots[1], valid.slots[0], ...valid.slots.slice(2)] },
    { ...valid, slots: valid.slots.slice(0, 3) },
    { ...valid, slots: valid.slots.map((slot, index) => index === 1 ? { ...slot, photoId: "a" } : slot) },
    { ...valid, caption: 7 },
  ];
  assert.deepEqual(parseMemoryCardLayoutV2("four_cut", valid), valid);
  malformed.forEach((layout) => assert.equal(parseMemoryCardLayoutV2("four_cut", layout), null));
});

test("canonical experimental v1 is detected before legacy and accepts an optional caption", () => {
  const withoutCaption = {
    version: 1,
    slots: ["a", "b", "c", "d"].map((photoId, index) => ({ slotId: `f${index + 1}`, photoId })),
  };
  const parsed = parseCanonicalExperimentalMemoryCardLayoutV1("four_cut", withoutCaption);
  const model = parseMemoryCardRenderModel("four_cut", 1, { ...withoutCaption, caption: "  가족 여행  " });

  assert.equal(parsed?.caption, null);
  assert.equal(model?.kind, "canonical");
  assert.equal(model?.layoutVersion, 1);
  assert.equal(model?.layout.caption, "가족 여행");
});

test("legacy simple v1 parses into its own display model without faking canonical slots", () => {
  const cases = [
    ["polaroid_moodboard", ["hero", "left", "right"]],
    ["four_cut", ["cut-1", "cut-2", "cut-3", "cut-4"]],
    ["editorial_collage", ["feature", "top", "bottom"]],
  ];

  for (const [templateKey, slotIds] of cases) {
    const layout = {
      version: 1,
      slots: slotIds.map((slotId, index) => ({ slotId, photoId: `photo-${index}` })),
    };
    assert.deepEqual(parseLegacyMemoryCardLayoutV1(templateKey, layout), layout);
    const model = parseMemoryCardRenderModel(templateKey, 1, layout);
    assert.equal(model?.kind, "legacy-simple-v1");
    assert.deepEqual(model?.layout.slots.map(({ slotId }) => slotId), slotIds);
  }
});

test("legacy slots keep missing-photo fallbacks", () => {
  const model = parseMemoryCardRenderModel("polaroid_moodboard", 1, {
    version: 1,
    slots: [
      { slotId: "hero", photoId: "available" },
      { slotId: "left", photoId: "deleted" },
      { slotId: "right", photoId: "missing" },
    ],
  });
  assert.ok(model);
  const slots = resolveMemoryCardSlots(
    "polaroid_moodboard",
    model,
    new Map([["available", { signedUrl: "runtime" }]]),
  );
  assert.deepEqual(slots.map(({ photo }) => photo !== null), [true, false, false]);
  assert.deepEqual(slots.map(({ slotId }) => slotId), ["hero", "left", "right"]);
});

test("new insert payload always writes DB and JSON version 2", () => {
  const layout = buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"], " 카드 문구 ");
  const payload = buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(["a", "b", "c", "d"]),
    layout: {
      ...layout,
      signedUrl: "not persisted",
      slots: layout.slots.map((slot) => ({ ...slot, storagePath: "not persisted" })),
    },
    memberId,
    templateKey: "four_cut",
    tripId,
  });

  assert.equal(payload.layout_version, 2);
  assert.deepEqual(payload.layout_json, layout);
  assert.equal(payload.layout_json.version, 2);
  assert.equal(payload.result_storage_path, null);
  assert.doesNotMatch(JSON.stringify(payload.layout_json), /signedUrl|storagePath|https?:\/\//i);
  assert.throws(() => buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(["a", "b", "c"]),
    layout,
    memberId,
    templateKey: "four_cut",
    tripId,
  }), /invalid-memory-card-photos/);
});

test("random fill and reshuffle preserve the canonical v2 shape and caption", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  assert.equal(getRandomPhotoCount("polaroid_moodboard", pool.length), 6);
  assert.equal(getRandomPhotoCount("four_cut", pool.length), 4);
  assert.equal(getRandomPhotoCount("editorial_collage", pool.length), 5);
  assert.equal(new Set(randomFillPhotoIds(pool, 6, () => 0.25)).size, 6);

  const layout = buildMemoryCardLayoutV2("four_cut", pool.slice(0, 4), "same caption");
  const shuffled = reshuffleMemoryCardLayout("four_cut", layout, pool.slice(0, 4), () => 0.999);
  assert.equal(shuffled.version, 2);
  assert.equal(shuffled.caption, "same caption");
  assert.deepEqual(shuffled.slots.map(({ slotId }) => slotId), ["f1", "f2", "f3", "f4"]);
  assert.notDeepEqual(shuffled.slots.map(({ photoId }) => photoId), layout.slots.map(({ photoId }) => photoId));
  assert.equal(normalizeMemoryCardCaption(" \n "), null);
});

test("Editorial 4-photo draft stays 4 after reshuffle", () => {
  const pool = ["a", "b", "c", "d", "e", "f"];
  const layout = buildMemoryCardLayoutV2(
    "editorial_collage",
    pool.slice(0, 4),
    "same caption",
  );
  const shuffled = reshuffleMemoryCardLayout(
    "editorial_collage",
    layout,
    pool,
    () => 0.999,
  );
  const photoIds = shuffled.slots.map(({ photoId }) => photoId);

  assert.equal(shuffled.version, 2);
  assert.equal(shuffled.slots.length, 4);
  assert.deepEqual(shuffled.slots.map(({ slotId }) => slotId), ["e1", "e2", "e3", "e4"]);
  assert.equal(shuffled.caption, "same caption");
  assert.equal(new Set(photoIds).size, 4);
  assert.ok(photoIds.every((photoId) => pool.includes(photoId)));
  assert.notDeepEqual(photoIds, layout.slots.map(({ photoId }) => photoId));
});

test("Editorial 5-photo draft stays 5 after reshuffle", () => {
  const pool = ["a", "b", "c", "d", "e", "f"];
  const layout = buildMemoryCardLayoutV2(
    "editorial_collage",
    pool.slice(0, 5),
    "same caption",
  );
  const shuffled = reshuffleMemoryCardLayout(
    "editorial_collage",
    layout,
    pool,
    () => 0.999,
  );
  const photoIds = shuffled.slots.map(({ photoId }) => photoId);

  assert.equal(shuffled.slots.length, 5);
  assert.deepEqual(shuffled.slots.map(({ slotId }) => slotId), ["e1", "e2", "e3", "e4", "e5"]);
  assert.equal(shuffled.caption, "same caption");
  assert.equal(new Set(photoIds).size, 5);
  assert.ok(photoIds.every((photoId) => pool.includes(photoId)));
  assert.notDeepEqual(photoIds, layout.slots.map(({ photoId }) => photoId));
});

test("Editorial e5 stays intentionally empty without duplicating a photo", () => {
  const model = createMemoryCardRenderModel(
    buildMemoryCardLayoutV2("editorial_collage", ["a", "b", "c", "d"]),
  );
  const slots = resolveMemoryCardSlots("editorial_collage", model, new Map());
  assert.equal(slots.length, 5);
  assert.equal(slots[4].slotId, "e5");
  assert.equal(slots[4].photoId, null);
  assert.equal(slots[4].optionalEmpty, true);
});

test("persisted rows preserve ownership and all supported read versions", () => {
  const legacy = memoryCardRow({
    layout_version: 1,
    layout_json: {
      version: 1,
      slots: ["cut-1", "cut-2", "cut-3", "cut-4"].map((slotId, index) => ({ slotId, photoId: `p${index}` })),
    },
  });
  const experimental = memoryCardRow({
    id: "experimental",
    layout_version: 1,
    layout_json: {
      version: 1,
      slots: ["f1", "f2", "f3", "f4"].map((slotId, index) => ({ slotId, photoId: `p${index}` })),
      caption: null,
    },
  });
  const v2 = memoryCardRow({ id: "v2" });
  const cards = mapPersistedMemoryCardRows(
    [legacy, experimental, v2],
    new Map([[memberId, "류정원"]]),
    authUserId,
  );

  assert.deepEqual(cards.map(({ renderModel }) => renderModel?.kind), ["legacy-simple-v1", "canonical", "canonical"]);
  assert.deepEqual(cards.map(({ renderModel }) => renderModel?.layoutVersion), [1, 1, 2]);
  assert.equal(cards[0].creatorName, "류정원");
  assert.equal(cards[0].isOwner, true);
});

test("caption typography tokens are shared Korean-capable, template-specific styles", async () => {
  assert.match(MEMORY_CARD_FONT_STACKS.editorial, /Noto Serif KR/);
  assert.match(MEMORY_CARD_FONT_STACKS.sans, /Noto Sans KR/);
  assert.equal(MEMORY_CARD_TEXT_STYLES["memory-line"].textAlign, "center");
  assert.equal(MEMORY_CARD_TEXT_STYLES["four-cut-footer"].fontFamily, "sans");
  assert.equal(MEMORY_CARD_TEXT_STYLES["editorial-caption"].textAlign, "left");
  const [previewSource, exportSource] = await Promise.all([
    readFile(new URL("./memory-card-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-export.ts", import.meta.url), "utf8"),
  ]);
  assert.match(previewSource, /MEMORY_CARD_TEXT_STYLES/);
  assert.match(exportSource, /MEMORY_CARD_TEXT_STYLES/);
  assert.match(exportSource, /document\.fonts\?\.ready/);
  assert.doesNotMatch(exportSource, /Georgia/);
});

test("wrapped captions honor max lines and add an ellipsis when truncated", () => {
  const lines = wrapMemoryCardText("가나다라마바사아자차카타파하", 3, 2, (value) => value.length);
  assert.deepEqual(lines, ["가나다", "라마…"]);
});

test("Four Cut export crops to the black strip while full templates keep their canvas", () => {
  const fourCut = exportInput(createMemoryCardRenderModel(
    buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]),
  ));
  const editorial = {
    ...fourCut,
    templateKey: "editorial_collage",
    renderModel: createMemoryCardRenderModel(
      buildMemoryCardLayoutV2("editorial_collage", ["a", "b", "c", "d"]),
    ),
  };

  assert.deepEqual(FOUR_CUT_EXPORT_BOUNDS, {
    x: 270,
    y: 130,
    width: 540,
    height: 1630,
    background: "template",
  });
  assert.deepEqual(getMemoryCardExportDimensions(fourCut, MEMORY_CARD_EXPORT_SIZES[0]), { width: 540, height: 1630 });
  assert.deepEqual(getMemoryCardExportDimensions(fourCut, MEMORY_CARD_EXPORT_SIZES[1]), { width: 360, height: 1087 });
  assert.deepEqual(getMemoryCardExportDimensions(editorial, MEMORY_CARD_EXPORT_SIZES[0]), MEMORY_CARD_CANVAS);
  assert.equal(MEMORY_CARD_TEMPLATE_SPECS.find(({ key }) => key === "four_cut").backgroundColor, "#2f2925");
  assert.equal(MEMORY_CARD_TEMPLATE_SPECS.find(({ key }) => key === "editorial_collage").backgroundColor, "#f3eadb");
});

test("legacy, experimental v1, and v2 saved cards all reach PNG export", async () => {
  const models = [
    parseMemoryCardRenderModel("four_cut", 1, {
      version: 1,
      slots: ["cut-1", "cut-2", "cut-3", "cut-4"].map((slotId, index) => ({ slotId, photoId: `p${index}` })),
    }),
    parseMemoryCardRenderModel("four_cut", 1, {
      version: 1,
      slots: ["f1", "f2", "f3", "f4"].map((slotId, index) => ({ slotId, photoId: `p${index}` })),
    }),
    createMemoryCardRenderModel(buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"])),
  ];
  let rendered = 0;
  for (const renderModel of models) {
    assert.ok(renderModel);
    await exportMemoryCardPng(exportInput(renderModel), async () => {
      rendered += 1;
      return new Blob(["png"], { type: "image/png" });
    });
  }
  assert.equal(rendered, 3);
});

test("export retries at lower scale and unsupported Web Share downloads", async () => {
  const attempted = [];
  await exportMemoryCardPng(exportInput(), async (_input, size) => {
    attempted.push(size);
    if (size.width === 1080) throw new Error("mobile-memory-pressure");
    return new Blob(["fallback"], { type: "image/png" });
  });
  assert.deepEqual(attempted, MEMORY_CARD_EXPORT_SIZES);

  let downloads = 0;
  const result = await shareOrDownloadMemoryCardPng(new Blob(["png"]), "card.png", {
    navigator: null,
    download: () => { downloads += 1; },
  });
  assert.equal(result, "downloaded");
  assert.equal(downloads, 1);
});

test("export and repositories exclude app wrappers, public URLs, and result uploads", async () => {
  const sources = await Promise.all([
    readFile(new URL("../album/album-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-export.ts", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");
  assert.match(sources[0], /createSignedUrl/);
  assert.doesNotMatch(source, /getPublicUrl|memory-card-results|app page background|mobile navigation/);
  assert.doesNotMatch(sources[1], /storage\.from\([^)]*\)\.upload/);
});

function exportInput(renderModel = createMemoryCardRenderModel(
  buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]),
)) {
  return {
    templateKey: "four_cut",
    renderModel,
    photos: [],
    dateLabel: "2026.09.11 – 2026.09.13",
  };
}

function memoryCardRow(overrides = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: "four_cut",
    layout_version: 2,
    layout_json: buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]),
    result_storage_path: null,
    created_at: "2026-09-11T00:00:00Z",
    updated_at: "2026-09-11T00:00:00Z",
    ...overrides,
  };
}
