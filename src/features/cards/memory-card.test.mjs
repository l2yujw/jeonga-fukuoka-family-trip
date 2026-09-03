import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  exportMemoryCardPng,
  getMemoryCardExportDimensions,
  MEMORY_CARD_EXPORT_SIZES,
  MEMORY_CARD_REQUIRED_IMAGE_ERROR,
  renderMemoryCardPng,
  shareOrDownloadMemoryCardPng,
  wrapMemoryCardText,
} from "./memory-card-export.ts";
import {
  buildMemoryCardInsertPayload,
  buildMemoryCardLayoutV2,
  buildMemoryCardLayoutV3,
  createMemoryCardRenderModel,
  getMinimumMemoryCardPhotoCount,
  getRandomPhotoCount,
  getMemoryCardReferencedPhotoIds,
  getMemoryCardRenderPhotoIds,
  mapPersistedMemoryCardRows,
  normalizeMemoryCardCaption,
  parseCanonicalExperimentalMemoryCardLayoutV1,
  parseLegacyMemoryCardLayoutV1,
  parseMemoryCardLayoutV2,
  parseMemoryCardLayoutV3,
  parseMemoryCardRenderModel,
  randomFillPhotoIds,
  reshuffleMemoryCardLayout,
  resolveMemoryCardSlots,
} from "./memory-card.ts";
import {
  angleBetween,
  angleDeltaDegrees,
  applyMemoryCardGesture,
  clampMemoryCardPhotoPlacement,
  DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  distance,
  getMemoryCardCenteredContainPlacement,
  getMemoryCardCenteredCoverPlacement,
  getMemoryCardContainScale,
  getMemoryCardCoverScale,
  getMemoryCardCoverZoom,
  getMemoryCardMaxZoom,
  getMemoryCardPhotoOffsetBounds,
  getMemoryCardPhotoViewport,
  getPlacedImageRect,
  MEMORY_CARD_MIN_VISIBLE_RATIO,
  MEMORY_CARD_PHOTO_BACKGROUND_COLOR,
  midpoint,
  normalizeDegrees,
  rebaseMemoryCardGesture,
  reconcileMemoryCardPhotoPlacements,
  removeMemoryCardPointer,
} from "./memory-card-photo-placement.ts";
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
const newTemplateCases = [
  ["postcard_duo", 2, ["pd1", "pd2"]],
  ["scrapbook_trio", 3, ["st1", "st2", "st3"]],
  ["film_contact_sheet", 6, ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6"]],
  ["one_moment", 1, ["om1"]],
  ["instant_memory", 1, ["im1"]],
];
const feedback15TemplateCases = newTemplateCases.slice(-2);

function assertViewportCovered(imageWidth, imageHeight, viewportWidth, viewportHeight, placement) {
  const placed = getPlacedImageRect(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    placement,
  );
  assert.ok(placed);
  const centerX = placed.x + placed.width / 2;
  const centerY = placed.y + placed.height / 2;
  const radians = placed.rotation * Math.PI / 180;
  for (const point of [
    { x: 0, y: 0 },
    { x: viewportWidth, y: 0 },
    { x: 0, y: viewportHeight },
    { x: viewportWidth, y: viewportHeight },
  ]) {
    const deltaX = point.x - centerX;
    const deltaY = point.y - centerY;
    const localX = deltaX * Math.cos(radians) + deltaY * Math.sin(radians);
    const localY = -deltaX * Math.sin(radians) + deltaY * Math.cos(radians);
    assert.ok(Math.abs(localX) <= placed.width / 2 + 1e-7);
    assert.ok(Math.abs(localY) <= placed.height / 2 + 1e-7);
  }
}

function assertFullyVisible(imageWidth, imageHeight, viewportWidth, viewportHeight, placement) {
  const placed = getPlacedImageRect(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    placement,
  );
  assert.ok(placed);
  assert.ok(placed.x >= -1e-7);
  assert.ok(placed.y >= -1e-7);
  assert.ok(placed.x + placed.width <= viewportWidth + 1e-7);
  assert.ok(placed.y + placed.height <= viewportHeight + 1e-7);
}

function assertRecoverableOverlap(placed, viewportWidth, viewportHeight) {
  const overlap = Math.min(viewportWidth, viewportHeight) *
    MEMORY_CARD_MIN_VISIBLE_RATIO;
  const halfWidth = Math.max(0, placed.width / 2 - overlap);
  const halfHeight = Math.max(0, placed.height / 2 - overlap);
  const center = {
    x: placed.x + placed.width / 2,
    y: placed.y + placed.height / 2,
  };
  const radians = placed.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const imageCorners = [-1, 1].flatMap((horizontal) =>
    [-1, 1].map((vertical) => ({
      x: center.x + horizontal * halfWidth * cosine - vertical * halfHeight * sine,
      y: center.y + horizontal * halfWidth * sine + vertical * halfHeight * cosine,
    }))
  );
  const viewportCorners = [
    { x: 0, y: 0 },
    { x: viewportWidth, y: 0 },
    { x: viewportWidth, y: viewportHeight },
    { x: 0, y: viewportHeight },
  ];
  for (const axis of [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: cosine, y: sine },
    { x: -sine, y: cosine },
  ]) {
    const imageProjection = imageCorners.map((point) => point.x * axis.x + point.y * axis.y);
    const viewportProjection = viewportCorners.map((point) => point.x * axis.x + point.y * axis.y);
    assert.ok(
      Math.max(...imageProjection) >= Math.min(...viewportProjection) - 1e-7 &&
      Math.max(...viewportProjection) >= Math.min(...imageProjection) - 1e-7,
    );
  }
}

test("code template coordinates stay synchronized with the canonical document", async () => {
  const canonical = JSON.parse(
    await readFile(
      new URL("../../../docs/card_engine/01_TEMPLATE_COORDINATES.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(MEMORY_CARD_CANVAS, canonical.canvas);
  assert.deepEqual(
    MEMORY_CARD_TEMPLATE_SPECS.map(({ key, acceptedMin: requiredMin, acceptedMax: requiredMax, slots, textSlots, decorations = [] }) => (
      { key, requiredMin, requiredMax, slots, textSlots, decorations }
    )),
    canonical.templates.map(({ key, requiredMin, requiredMax, slots, textSlots, decorations = [] }) => (
      { key, requiredMin, requiredMax, slots, textSlots, decorations }
    )),
  );
});

test("template catalog has eight valid unique templates inside the canonical canvas", () => {
  assert.equal(MEMORY_CARD_TEMPLATE_SPECS.length, 8);
  assert.equal(new Set(MEMORY_CARD_TEMPLATE_SPECS.map(({ key }) => key)).size, 8);
  assert.deepEqual(
    MEMORY_CARD_TEMPLATE_SPECS.slice(-2).map(({ key }) => key),
    ["one_moment", "instant_memory"],
  );

  for (const template of MEMORY_CARD_TEMPLATE_SPECS) {
    assert.equal(new Set(template.slots.map(({ id }) => id)).size, template.slots.length);
    assert.ok(template.acceptedMin > 0);
    assert.ok(template.acceptedMin <= template.acceptedMax);
    assert.ok(template.acceptedMax <= template.slots.length);

    for (const slot of template.slots) {
      const radians = Math.abs(slot.r) * Math.PI / 180;
      const rotatedWidth = Math.abs(slot.w * Math.cos(radians)) + Math.abs(slot.h * Math.sin(radians));
      const rotatedHeight = Math.abs(slot.w * Math.sin(radians)) + Math.abs(slot.h * Math.cos(radians));
      const centerX = slot.x + slot.w / 2;
      const centerY = slot.y + slot.h / 2;
      assert.ok(centerX - rotatedWidth / 2 >= 0, `${template.key}/${slot.id} clips left`);
      assert.ok(centerX + rotatedWidth / 2 <= MEMORY_CARD_CANVAS.width, `${template.key}/${slot.id} clips right`);
      assert.ok(centerY - rotatedHeight / 2 >= 0, `${template.key}/${slot.id} clips top`);
      assert.ok(centerY + rotatedHeight / 2 <= MEMORY_CARD_CANVAS.height, `${template.key}/${slot.id} clips bottom`);
    }

    for (const slot of template.textSlots) {
      const style = MEMORY_CARD_TEXT_STYLES[slot.style];
      assert.ok(slot.x >= 0 && slot.x + slot.maxWidth <= MEMORY_CARD_CANVAS.width);
      assert.ok(slot.y >= 0 && slot.y + style.lineHeight * style.maxLines <= MEMORY_CARD_CANVAS.height);
    }
  }

  assert.equal(getMinimumMemoryCardPhotoCount(), 1);
  for (const [key, count] of newTemplateCases) {
    const template = MEMORY_CARD_TEMPLATE_SPECS.find((item) => item.key === key);
    assert.equal(template?.acceptedMin, count);
    assert.equal(template?.acceptedMax, count);
  }
});

test("Feedback #15 decorations are narrow, valid, and data-driven", () => {
  const oneMoment = MEMORY_CARD_TEMPLATE_SPECS.find(({ key }) => key === "one_moment");
  const instantMemory = MEMORY_CARD_TEMPLATE_SPECS.find(({ key }) => key === "instant_memory");
  assert.deepEqual(oneMoment?.slots, [
    { id: "om1", x: 0, y: 0, w: 1080, h: 1920, r: 0, z: 1, frame: "plain" },
  ]);
  assert.equal(oneMoment?.decorations?.length, 1);
  assert.equal(instantMemory?.decorations, undefined);

  const decoration = oneMoment.decorations[0];
  assert.equal(decoration.kind, "linear-gradient");
  assert.equal(decoration.direction, "vertical");
  assert.equal(decoration.id, "om-scrim");
  assert.ok(decoration.x >= 0 && decoration.x + decoration.w <= MEMORY_CARD_CANVAS.width);
  assert.ok(decoration.y >= 0 && decoration.y + decoration.h <= MEMORY_CARD_CANVAS.height);
  assert.ok(decoration.fromColor && decoration.toColor);
  assert.notEqual(decoration.fromColor, decoration.toColor);
});

test("template availability follows the derived one-photo minimum", () => {
  const eligibleKeys = (photoCount) => MEMORY_CARD_TEMPLATE_SPECS
    .filter(({ acceptedMin }) => photoCount >= acceptedMin)
    .map(({ key }) => key);
  assert.deepEqual(eligibleKeys(0), []);
  assert.deepEqual(eligibleKeys(1), ["one_moment", "instant_memory"]);
  assert.deepEqual(eligibleKeys(2), ["postcard_duo", "one_moment", "instant_memory"]);
  assert.deepEqual(eligibleKeys(3), ["postcard_duo", "scrapbook_trio", "one_moment", "instant_memory"]);
  assert.equal(eligibleKeys(6).length, 8);
});

test("canonical v2 layouts remain readable with every template slot count", () => {
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
  for (const [key, count, slotIds] of newTemplateCases) {
    const photoIds = Array.from({ length: count }, (_, index) => `${key}-${index}`);
    const layout = buildMemoryCardLayoutV2(key, photoIds, " 새 카드 ");
    assert.deepEqual(layout.slots.map(({ slotId }) => slotId), slotIds);
    assert.equal(parseMemoryCardLayoutV2(key, layout)?.caption, "새 카드");
    assert.throws(
      () => buildMemoryCardLayoutV2(key, photoIds.slice(0, -1)),
      /invalid-memory-card-photo-count/,
    );
    if (count > 1) {
      assert.throws(
        () => buildMemoryCardLayoutV2(key, photoIds.map((id, index) => index === 1 ? photoIds[0] : id)),
        /duplicate-memory-card-photo/,
      );
    }
  }
  for (const [key] of feedback15TemplateCases) {
    assert.throws(() => buildMemoryCardLayoutV2(key, []), /invalid-memory-card-photo-count/);
    assert.throws(() => buildMemoryCardLayoutV2(key, ["a", "b"]), /invalid-memory-card-photo-count/);
  }
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
    { ...valid, slots: [...valid.slots, { ...valid.slots[0], slotId: "f5", photoId: "e" }] },
    { ...valid, slots: valid.slots.map((slot, index) => index === 1 ? { ...slot, photoId: "a" } : slot) },
    { ...valid, caption: 7 },
  ];
  assert.deepEqual(parseMemoryCardLayoutV2("four_cut", valid), valid);
  malformed.forEach((layout) => assert.equal(parseMemoryCardLayoutV2("four_cut", layout), null));
});

test("new canonical v3 layouts persist contain-relative zoom and viewport offsets", () => {
  for (const template of MEMORY_CARD_TEMPLATE_SPECS) {
    const photoIds = Array.from(
      { length: template.acceptedMin },
      (_, index) => `${template.key}-${index}`,
    );
    const layout = buildMemoryCardLayoutV3(template.key, photoIds, " 새 카드 ");
    assert.equal(layout.version, 3);
    assert.equal(layout.caption, "새 카드");
    assert.deepEqual(
      layout.slots.map(({ slotId }) => slotId),
      template.slots.slice(0, template.acceptedMin).map(({ id }) => id),
    );
    assert.ok(layout.slots.every(({ placement }) =>
      assert.deepEqual(placement, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT) === undefined
    ));
    assert.deepEqual(parseMemoryCardLayoutV3(template.key, layout), layout);
  }

  const custom = buildMemoryCardLayoutV3(
    "one_moment",
    ["photo"],
    null,
    {
      om1: { zoom: 1.35, rotation: 27, offsetX: -0.2, offsetY: 0.8 },
    },
  );
  assert.deepEqual(custom.slots[0].placement, {
    zoom: 1.35,
    rotation: 27,
    offsetX: -0.2,
    offsetY: 0.8,
  });
  assert.deepEqual(parseMemoryCardLayoutV3("one_moment", custom), custom);
});

test("canonical v3 parser strictly rejects malformed placement, slots, counts, and duplicates", () => {
  const valid = buildMemoryCardLayoutV3("four_cut", ["a", "b", "c", "d"]);
  const withPlacement = (placement) => ({
    ...valid,
    slots: valid.slots.map((slot, index) =>
      index === 0 ? { ...slot, placement } : slot
    ),
  });
  const malformed = [
    { ...valid, version: 2 },
    { version: 3, slots: valid.slots },
    { ...valid, slots: [valid.slots[1], valid.slots[0], ...valid.slots.slice(2)] },
    { ...valid, slots: valid.slots.slice(0, 3) },
    {
      ...valid,
      slots: valid.slots.map((slot, index) =>
        index === 1 ? { ...slot, photoId: "a" } : slot
      ),
    },
    withPlacement(undefined),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, zoom: 0.99 }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, zoom: Number.NaN }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, zoom: Number.POSITIVE_INFINITY }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, rotation: -180.01 }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, rotation: 180 }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, rotation: Number.NaN }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, offsetX: Number.NaN }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, offsetX: Number.NEGATIVE_INFINITY }),
    withPlacement({ ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, offsetY: Number.POSITIVE_INFINITY }),
  ];
  malformed.forEach((layout) =>
    assert.equal(parseMemoryCardLayoutV3("four_cut", layout), null)
  );
});

test("zoom 1 uses contain scale and coverZoom is greater than 1 when aspects differ", () => {
  assert.equal(getMemoryCardContainScale(400, 200, 100, 200), 0.25);
  assert.equal(getMemoryCardCoverScale(400, 200, 100, 200), 1);
  assert.equal(getMemoryCardCoverZoom(400, 200, 100, 200), 4);
  assert.equal(getMemoryCardMaxZoom(400, 200, 100, 200), 16);
  const placed = getPlacedImageRect(400, 200, 100, 200, {
    ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  });
  assert.deepEqual(placed, {
    x: 0,
    y: 75,
    width: 100,
    height: 50,
    rotation: 0,
  });
});

test("landscape in portrait and portrait in landscape are fully visible at zoom 1", () => {
  assertFullyVisible(400, 200, 100, 200, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  assertFullyVisible(200, 400, 200, 100, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
});

test("photo-full decreases from centered cover to centered contain", () => {
  const cover = getMemoryCardCenteredCoverPlacement(400, 200, 100, 200);
  const entire = getMemoryCardCenteredContainPlacement();
  assert.equal(cover.zoom, 4);
  assert.equal(entire.zoom, 1);
  assert.deepEqual(entire, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  assertFullyVisible(400, 200, 100, 200, entire);
  assertViewportCovered(400, 200, 100, 200, cover);
});

test("visible warm-paper background is allowed at contain zoom", () => {
  const placed = getPlacedImageRect(
    400,
    200,
    100,
    200,
    DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  );
  assert.ok(placed.height < 200);
  assert.equal(MEMORY_CARD_PHOTO_BACKGROUND_COLOR, "#fffdf8");
});

test("rotation preserves contain-relative zoom instead of changing it", () => {
  const rotated = clampMemoryCardPhotoPlacement(400, 200, 100, 200, {
    ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
    rotation: 45,
  });
  assert.equal(rotated.zoom, 1);
  assert.equal(rotated.rotation, 45);
  const placed = getPlacedImageRect(400, 200, 100, 200, rotated);
  assert.equal(placed.width, 100);
  assert.equal(placed.height, 50);
});

test("placement clamps zoom and rotation without imposing fixed offset ranges", () => {
  const maximum = clampMemoryCardPhotoPlacement(
    400,
    200,
    100,
    200,
    { zoom: 99, rotation: 181, offsetX: 0, offsetY: 0 },
  );
  assert.equal(maximum.zoom, 16);
  assert.equal(maximum.rotation, -179);
  const bounds = getMemoryCardPhotoOffsetBounds(400, 200, 100, 200, maximum);
  assert.ok(bounds.minX < 0 && bounds.maxX > 0);
  assert.ok(bounds.minY < 0 && bounds.maxY > 0);
});

test("two-pointer primitives handle midpoint, distance, and the ±180 angle boundary", () => {
  assert.deepEqual(midpoint({ x: 2, y: 4 }, { x: 8, y: 10 }), { x: 5, y: 7 });
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.ok(Math.abs(angleDeltaDegrees(179 * Math.PI / 180, -179 * Math.PI / 180) - 2) < 1e-10);
  assert.equal(normalizeDegrees(180), -180);
  assert.equal(normalizeDegrees(540), -180);
  assert.equal(normalizeDegrees(-181), 179);
});

test("one pointer pans left, right, up, and down with resolution-independent offsets and visible background", () => {
  const drag = (x, y, scale = 1) => {
    const startPoints = new Map([[7, { x: 100 * scale, y: 100 * scale }]]);
    return applyMemoryCardGesture(
      rebaseMemoryCardGesture(
        startPoints,
        { ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT, zoom: 2 },
      ),
      new Map([[7, { x: (100 + x) * scale, y: (100 + y) * scale }]]),
      400 * scale,
      400 * scale,
      200 * scale,
      200 * scale,
    );
  };
  assert.ok(Math.abs(drag(-40, 0).offsetX + 0.2) < 1e-12);
  assert.ok(Math.abs(drag(40, 0).offsetX - 0.2) < 1e-12);
  assert.ok(Math.abs(drag(0, -40).offsetY + 0.2) < 1e-12);
  assert.ok(Math.abs(drag(0, 40).offsetY - 0.2) < 1e-12);
  assert.deepEqual(drag(40, 20, 2), drag(40, 20));
});

test("recoverability bound allows free background-revealing pan and only stops complete disappearance", () => {
  for (const rotation of [0, 45, 90]) {
    const free = clampMemoryCardPhotoPlacement(400, 200, 100, 200, {
      zoom: 1,
      rotation,
      offsetX: 0.25,
      offsetY: -0.25,
    });
    assert.equal(free.offsetX, 0.25);
    assert.equal(free.offsetY, -0.25);
    const valid = clampMemoryCardPhotoPlacement(200, 200, 200, 200, {
      zoom: 1,
      rotation,
      offsetX: -99,
      offsetY: 99,
    });
    const bounds = getMemoryCardPhotoOffsetBounds(200, 200, 200, 200, valid);
    assert.ok(valid.offsetX >= bounds.minX && valid.offsetX <= bounds.maxX);
    assert.ok(valid.offsetY >= bounds.minY && valid.offsetY <= bounds.maxY);
    assertRecoverableOverlap(
      getPlacedImageRect(200, 200, 200, 200, valid),
      200,
      200,
    );
  }
  assert.equal(MEMORY_CARD_MIN_VISIBLE_RATIO, 0.1);
});

test("two fingers zoom 1x to 2x and rotate freely by +30 degrees", () => {
  const startPoints = new Map([[1, { x: -50, y: 0 }], [2, { x: 50, y: 0 }]]);
  const baseline = rebaseMemoryCardGesture(startPoints, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  assert.equal(baseline?.kind, "multi");
  const angle = 30 * Math.PI / 180;
  const currentPoints = new Map([
    [1, { x: -100 * Math.cos(angle), y: -100 * Math.sin(angle) }],
    [2, { x: 100 * Math.cos(angle), y: 100 * Math.sin(angle) }],
  ]);
  const placement = applyMemoryCardGesture(baseline, currentPoints, 400, 400, 200, 200);
  assert.ok(Math.abs(placement.zoom - 2) < 1e-12);
  assert.ok(Math.abs(placement.rotation - 30) < 1e-12);
});

test("two fingers apply centroid pan, pinch zoom, and free rotation simultaneously from one baseline", () => {
  const startPoints = new Map([[1, { x: 0, y: 0 }], [2, { x: 100, y: 0 }]]);
  const baseline = rebaseMemoryCardGesture(startPoints, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  const angle = 30 * Math.PI / 180;
  const centroid = { x: 80, y: 40 };
  const currentPoints = new Map([
    [1, { x: centroid.x - 100 * Math.cos(angle), y: centroid.y - 100 * Math.sin(angle) }],
    [2, { x: centroid.x + 100 * Math.cos(angle), y: centroid.y + 100 * Math.sin(angle) }],
  ]);
  const placement = applyMemoryCardGesture(baseline, currentPoints, 400, 400, 200, 200);
  assert.ok(Math.abs(placement.zoom - 2) < 1e-12);
  assert.ok(Math.abs(placement.rotation - 30) < 1e-12);
  assert.ok(placement.offsetX > 0);
  assert.ok(placement.offsetY > 0);
  assert.deepEqual(
    applyMemoryCardGesture(baseline, currentPoints, 400, 400, 200, 200),
    placement,
    "the gesture-start baseline prevents incremental drift",
  );
});

test("pointer count 1→2→1 rebases without a jump and pointer cancel clears safely", () => {
  const one = new Map([[1, { x: 50, y: 50 }]]);
  const single = rebaseMemoryCardGesture(one, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  assert.deepEqual(
    applyMemoryCardGesture(single, one, 400, 400, 200, 200),
    DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  );

  const two = new Map([...one, [2, { x: 150, y: 50 }]]);
  const multi = rebaseMemoryCardGesture(two, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT);
  assert.deepEqual(
    applyMemoryCardGesture(multi, two, 400, 400, 200, 200),
    DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  );
  const moved = new Map([[1, { x: 30, y: 30 }], [2, { x: 170, y: 70 }]]);
  const transformed = applyMemoryCardGesture(multi, moved, 400, 400, 200, 200);
  const afterLift = removeMemoryCardPointer(moved, 2, transformed);
  assert.equal(afterLift.baseline?.kind, "single");
  assert.deepEqual(
    applyMemoryCardGesture(afterLift.baseline, afterLift.points, 400, 400, 200, 200),
    transformed,
  );
  const afterCancel = removeMemoryCardPointer(afterLift.points, 1, transformed);
  assert.equal(afterCancel.points.size, 0);
  assert.equal(afterCancel.baseline, null);
});

test("gesture zoom reaches contain and the aspect-aware maximum", () => {
  const startPoints = new Map([[1, { x: -50, y: 0 }], [2, { x: 50, y: 0 }]]);
  const baseline = rebaseMemoryCardGesture(
    startPoints,
    DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  );
  const zoomedOut = applyMemoryCardGesture(
    baseline,
    new Map([[1, { x: -12.5, y: 0 }], [2, { x: 12.5, y: 0 }]]),
    400,
    200,
    100,
    200,
  );
  const zoomedIn = applyMemoryCardGesture(
    baseline,
    new Map([[1, { x: -5000, y: 0 }], [2, { x: 5000, y: 0 }]]),
    400,
    200,
    100,
    200,
  );
  assert.equal(zoomedOut.zoom, 1);
  assert.equal(zoomedIn.zoom, 16);
});

test("Polaroid placement uses the inner image viewport and excludes its footer", () => {
  assert.deepEqual(
    getMemoryCardPhotoViewport({ frame: "polaroid", w: 840, h: 1120 }),
    { x: 18, y: 18, width: 804, height: 1032 },
  );
  assert.deepEqual(
    getMemoryCardPhotoViewport({ frame: "strip", w: 500, h: 330 }),
    { x: 8, y: 8, width: 484, height: 314 },
  );
});

test("all eight templates expose exact slot inner ratios with shared contain geometry", () => {
  assert.equal(MEMORY_CARD_TEMPLATE_SPECS.length, 8);
  for (const template of MEMORY_CARD_TEMPLATE_SPECS) {
    for (const slot of template.slots) {
      const viewport = getMemoryCardPhotoViewport(slot);
      assert.equal(viewport.width / viewport.height, (slot.w - viewport.x * 2) / viewport.height);
      const placed = getPlacedImageRect(
        4032,
        3024,
        viewport.width,
        viewport.height,
        DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
      );
      assert.ok(placed, `${template.key}/${slot.id} has placement geometry`);
      assert.equal(placed.rotation, 0);
      assertFullyVisible(
        4032,
        3024,
        viewport.width,
        viewport.height,
        DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
      );
    }
  }
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

test("Feedback #15 templates reject experimental canonical v1", () => {
  for (const [key, , [slotId]] of feedback15TemplateCases) {
    const layout = { version: 1, slots: [{ slotId, photoId: "a" }], caption: null };
    assert.equal(parseCanonicalExperimentalMemoryCardLayoutV1(key, layout), null);
    assert.equal(parseMemoryCardRenderModel(key, 1, layout), null);
  }
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

test("saved-card photo IDs support v1/v2/v3, dedupe, and ignore unreadable layouts", () => {
  const legacy = parseMemoryCardRenderModel("polaroid_moodboard", 1, {
    version: 1,
    slots: [
      { slotId: "hero", photoId: "a" },
      { slotId: "left", photoId: "b" },
      { slotId: "right", photoId: "c" },
    ],
  });
  const v2 = parseMemoryCardRenderModel(
    "postcard_duo",
    2,
    buildMemoryCardLayoutV2("postcard_duo", ["c", "d"]),
  );
  const v3 = parseMemoryCardRenderModel(
    "one_moment",
    3,
    buildMemoryCardLayoutV3("one_moment", ["a"]),
  );
  assert.ok(legacy && v2 && v3);
  assert.deepEqual(getMemoryCardRenderPhotoIds(v3), ["a"]);
  assert.deepEqual(
    getMemoryCardReferencedPhotoIds([
      { renderModel: legacy },
      { renderModel: v2 },
      { renderModel: v3 },
      { renderModel: null },
    ]),
    ["a", "b", "c", "d"],
  );
});

test("Cards startup is referenced-only and composer/export hydration is deferred", async () => {
  const [source, cropSource] = await Promise.all([
    readFile(new URL("./memory-cards-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-crop-editor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(source, /loadMemoryCards\(tripSession\.trip\.id\)[\s\S]*loadAlbumPhotoCount\(tripSession\.trip\.id\)/);
  assert.match(source, /getMemoryCardReferencedPhotoIds\(loadedCards\)/);
  assert.match(source, /loadAlbumPhotosByIds\([\s\S]*referencedPhotoIds/);
  assert.match(source, /const openComposer = async \(\) => \{[\s\S]*loadAlbumPhotoMetadata/);
  assert.match(source, /composerPhotosLoaded/);
  assert.match(source, /getMemoryCardRenderPhotoIds\(renderModel\)[\s\S]*loadAlbumPhotoSignedUrls/);
  assert.match(source, /requiredPhotoIds\.some\([\s\S]*memory-card-export-photo-unavailable/);
  assert.match(source, /cropPhotoReadyKey/);
  assert.match(source, /refreshAlbumPhotoSignedUrl\(selectedPhotoStoragePath\)/);
  assert.match(source, /setCropRefreshVersion\(\(version\) => version \+ 1\)/);
  assert.match(source, />\s*다시 시도\s*</);
  assert.match(cropSource, /onError=\{onPhotoError\}/);
  assert.match(source, /mergeAlbumPhotos/);
  assert.match(source, /updateAlbumPhotoMedia/);
  assert.match(source, /onPhotoMediaChange=\{handlePhotoMediaChange\}/);
  assert.doesNotMatch(source, /\bloadAlbumPhotos\b/);
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
  assert.ok(slots.every(({ placement }) => placement === null));
});

test("v1/v2 reads defer centered cover to render time without rewriting layouts", () => {
  const v2 = buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]);
  const model = parseMemoryCardRenderModel("four_cut", 2, v2);
  assert.ok(model);
  const slots = resolveMemoryCardSlots("four_cut", model, new Map());
  assert.ok(slots.every(({ placement }) => placement === null));
  assert.deepEqual(v2.slots[0], { slotId: "f1", photoId: "a" });
  assertViewportCovered(400, 200, 100, 200, slots[0].placement);
  assert.ok(
    getPlacedImageRect(400, 200, 100, 200, slots[0].placement).width >
      getPlacedImageRect(400, 200, 100, 200, DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT).width,
  );
});

test("new insert payload always writes validated DB and JSON version 3", () => {
  const layout = buildMemoryCardLayoutV3("four_cut", ["a", "b", "c", "d"], " 카드 문구 ", {
    f1: { zoom: 2, rotation: 45, offsetX: -0.2, offsetY: 0.7 },
  });
  const payload = buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(["a", "b", "c", "d"]),
    layout: {
      ...layout,
      signedUrl: "not persisted",
      decorations: [{ kind: "linear-gradient" }],
      gradient: "not persisted",
      slots: layout.slots.map((slot) => ({
        ...slot,
        storagePath: "not persisted",
        placement: { ...slot.placement, signedUrl: "not persisted" },
      })),
    },
    memberId,
    templateKey: "four_cut",
    tripId,
  });

  assert.equal(payload.layout_version, 3);
  assert.deepEqual(payload.layout_json, layout);
  assert.equal(payload.layout_json.version, 3);
  assert.equal(payload.result_storage_path, null);
  assert.doesNotMatch(JSON.stringify(payload.layout_json), /signedUrl|storagePath|decorations|gradient|https?:\/\//i);
  assert.throws(() => buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(["a", "b", "c"]),
    layout,
    memberId,
    templateKey: "four_cut",
    tripId,
  }), /invalid-memory-card-photos/);
});

test("photo-slot reconciliation keeps same-photo placement and resets changed slots to centered cover", () => {
  const custom = {
    zoom: 2,
    rotation: 45,
    offsetX: -0.4,
    offsetY: 0.7,
  };
  const centeredCover = getMemoryCardCenteredCoverPlacement(400, 200, 100, 200);
  const reconciled = reconcileMemoryCardPhotoPlacements(
    ["f1", "f2", "f3", "f4"],
    ["a", "b", "c", "d"],
    ["a", "c", "b", "e"],
    { f1: custom, f2: custom, f3: custom, f4: custom },
    () => centeredCover,
  );
  assert.deepEqual(reconciled.f1, custom);
  assert.deepEqual(reconciled.f2, centeredCover);
  assert.deepEqual(reconciled.f3, centeredCover);
  assert.deepEqual(reconciled.f4, centeredCover);
});

test("v3 reshuffle resets changed photos while preserving caption", () => {
  const layout = buildMemoryCardLayoutV3("four_cut", ["a", "b", "c", "d"], "same caption", {
    f1: { zoom: 2, rotation: 45, offsetX: -0.2, offsetY: 0.7 },
  });
  const shuffled = reshuffleMemoryCardLayout(
    "four_cut",
    layout,
    ["a", "b", "c", "d"],
    () => 0.999,
  );
  assert.equal(shuffled.version, 3);
  assert.equal(shuffled.caption, "same caption");
  assert.notDeepEqual(
    shuffled.slots.map(({ photoId }) => photoId),
    layout.slots.map(({ photoId }) => photoId),
  );
  assert.ok(shuffled.slots.every(({ placement }) =>
    assert.deepEqual(
      placement,
      DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
    ) === undefined
  ));
});

test("random fill and reshuffle preserve the canonical v2 shape and caption", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  assert.equal(getRandomPhotoCount("polaroid_moodboard", pool.length), 6);
  assert.equal(getRandomPhotoCount("four_cut", pool.length), 4);
  assert.equal(getRandomPhotoCount("editorial_collage", pool.length), 5);
  for (const [key, count] of newTemplateCases) {
    assert.equal(getRandomPhotoCount(key, pool.length), count);
  }
  assert.equal(new Set(randomFillPhotoIds(pool, 6, () => 0.25)).size, 6);

  const layout = buildMemoryCardLayoutV2("four_cut", pool.slice(0, 4), "same caption");
  const shuffled = reshuffleMemoryCardLayout("four_cut", layout, pool.slice(0, 4), () => 0.999);
  assert.equal(shuffled.version, 2);
  assert.equal(shuffled.caption, "same caption");
  assert.deepEqual(shuffled.slots.map(({ slotId }) => slotId), ["f1", "f2", "f3", "f4"]);
  assert.notDeepEqual(shuffled.slots.map(({ photoId }) => photoId), layout.slots.map(({ photoId }) => photoId));
  assert.equal(normalizeMemoryCardCaption(" \n "), null);
});

test("new fixed-count templates reshuffle exact slot counts without duplicates or caption loss", () => {
  const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (const [key, count, slotIds] of newTemplateCases) {
    const layout = buildMemoryCardLayoutV2(key, pool.slice(0, count), "same caption");
    const shuffled = reshuffleMemoryCardLayout(key, layout, pool, () => 0.999);
    const photoIds = shuffled.slots.map(({ photoId }) => photoId);
    assert.equal(shuffled.slots.length, count);
    assert.deepEqual(shuffled.slots.map(({ slotId }) => slotId), slotIds);
    assert.equal(shuffled.caption, "same caption");
    assert.equal(new Set(photoIds).size, count);
  }
});

test("one-photo reshuffle changes the photo when an alternative exists", () => {
  for (const [key] of feedback15TemplateCases) {
    const layout = buildMemoryCardLayoutV2(key, ["a"], "same caption");
    const changed = reshuffleMemoryCardLayout(key, layout, ["a", "b"], () => 0.999);
    const unchanged = reshuffleMemoryCardLayout(key, layout, ["a"], () => 0.999);
    assert.deepEqual(changed.slots.map(({ photoId }) => photoId), ["b"]);
    assert.deepEqual(unchanged.slots.map(({ photoId }) => photoId), ["a"]);
    assert.equal(changed.caption, "same caption");
    assert.equal(unchanged.caption, "same caption");
  }
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

test("persisted rows preserve ownership and all supported v1/v2/v3 read versions", () => {
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
  const v3 = memoryCardRow({
    id: "v3",
    layout_version: 3,
    layout_json: buildMemoryCardLayoutV3("four_cut", ["a", "b", "c", "d"]),
  });
  const cards = mapPersistedMemoryCardRows(
    [legacy, experimental, v2, v3],
    new Map([[memberId, "류정원"]]),
    authUserId,
  );

  assert.deepEqual(cards.map(({ renderModel }) => renderModel?.kind), ["legacy-simple-v1", "canonical", "canonical", "canonical"]);
  assert.deepEqual(cards.map(({ renderModel }) => renderModel?.layoutVersion), [1, 1, 2, 3]);
  assert.equal(cards[0].creatorName, "류정원");
  assert.equal(cards[0].isOwner, true);
});

test("persisted rows map every new template key", () => {
  const rows = newTemplateCases.map(([templateKey, count], index) => memoryCardRow({
    id: `new-${index}`,
    template_key: templateKey,
    layout_json: buildMemoryCardLayoutV2(
      templateKey,
      Array.from({ length: count }, (_, photoIndex) => `${templateKey}-${photoIndex}`),
    ),
  }));
  const cards = mapPersistedMemoryCardRows(rows, new Map(), authUserId);
  assert.deepEqual(cards.map(({ templateKey }) => templateKey), newTemplateCases.map(([key]) => key));
  assert.ok(cards.every(({ renderModel }) => renderModel?.layoutVersion === 2));
});

test("schema snapshot and Feedback #15 migration permit exactly the canonical template keys", async () => {
  const [schema, feedback14Migration, migration] = await Promise.all([
    readFile(new URL("../../../docs/data/01_SCHEMA_FINAL.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/data/07_FEEDBACK14_CARD_TEMPLATE_KEYS_MIGRATION.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/data/08_FEEDBACK15_SINGLE_PHOTO_TEMPLATE_KEYS_MIGRATION.sql", import.meta.url), "utf8"),
  ]);
  const keys = MEMORY_CARD_TEMPLATE_SPECS.map(({ key }) => key);
  const schemaCheck = schema.match(/template_key in \(([\s\S]*?)\)\n\s*\),/i)?.[1] ?? "";
  const migrationCheck = migration.match(/template_key in \(([\s\S]*?)\)\n\);/i)?.[1] ?? "";
  const quotedValues = (value) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(quotedValues(schemaCheck), keys);
  assert.deepEqual(quotedValues(migrationCheck), keys);
  assert.deepEqual(
    quotedValues(feedback14Migration),
    keys.slice(0, 6),
  );
  assert.match(migration, /begin;[\s\S]*commit;/i);
  assert.match(migration, /drop constraint if exists memory_cards_template_key_check/i);
  assert.match(migration, /add constraint memory_cards_template_key_check check/i);
  assert.deepEqual(
    [...migration.matchAll(/constraint(?: if exists)?\s+([a-z_]+)/gi)].map((match) => match[1]),
    ["memory_cards_template_key_check", "memory_cards_template_key_check"],
  );
  assert.doesNotMatch(migration, /row level security|\bpolicy\b|\bstorage\b|\bowner\b/i);
});

test("caption typography tokens are shared Korean-capable, template-specific styles", async () => {
  assert.match(MEMORY_CARD_FONT_STACKS.editorial, /Noto Serif KR/);
  assert.match(MEMORY_CARD_FONT_STACKS.sans, /Noto Sans KR/);
  assert.equal(MEMORY_CARD_TEXT_STYLES["memory-line"].textAlign, "center");
  assert.equal(MEMORY_CARD_TEXT_STYLES["four-cut-footer"].fontFamily, "sans");
  assert.equal(MEMORY_CARD_TEXT_STYLES["editorial-caption"].textAlign, "left");
  assert.equal(MEMORY_CARD_TEXT_STYLES["single-overlay-caption"].maxLines, 2);
  assert.equal(MEMORY_CARD_TEXT_STYLES["single-overlay-date"].maxLines, 1);
  assert.equal(MEMORY_CARD_TEXT_STYLES["date-dark"].textAlign, "center");
  const [previewSource, exportSource] = await Promise.all([
    readFile(new URL("./memory-card-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-export.ts", import.meta.url), "utf8"),
  ]);
  assert.match(previewSource, /MEMORY_CARD_TEXT_STYLES/);
  assert.match(exportSource, /MEMORY_CARD_TEXT_STYLES/);
  assert.match(exportSource, /document\.fonts\?\.ready/);
  assert.match(previewSource, /template\.decorations\?\.map/);
  assert.match(previewSource, /linear-gradient\(to bottom/);
  assert.match(exportSource, /template\.decorations \?\? \[\]/);
  assert.match(exportSource, /createLinearGradient/);
  assert.ok(exportSource.indexOf("for (const decoration") < exportSource.indexOf("for (const slot of template.textSlots)"));
  assert.doesNotMatch(previewSource, /templateKey === ["'](?:one_moment|instant_memory)/);
  assert.doesNotMatch(exportSource, /templateKey === ["'](?:one_moment|instant_memory)/);
  assert.doesNotMatch(exportSource, /Georgia/);
});

test("editor, draft/saved DOM preview, and Canvas export share geometry and background", async () => {
  const [editorSource, previewSource, exportSource, viewSource] = await Promise.all([
    readFile(new URL("./memory-card-crop-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-export.ts", import.meta.url), "utf8"),
    readFile(new URL("./memory-cards-view.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [editorSource, previewSource, exportSource]) {
    assert.match(source, /getMemoryCardPhotoViewport\(/);
    assert.match(source, /getPlacedImageRect\(/);
    assert.match(source, /MEMORY_CARD_PHOTO_BACKGROUND_COLOR/);
  }
  assert.equal(MEMORY_CARD_PHOTO_BACKGROUND_COLOR, "#fffdf8");
  assert.match(previewSource, /naturalWidth/);
  assert.match(previewSource, /onSelectSlot/);
  assert.ok((viewSource.match(/<MemoryCardPreview/g) ?? []).length >= 4);
  assert.match(viewSource, /getDefaultMemoryCardPhotoPlacement/);
  assert.match(viewSource, /getMemoryCardCenteredCoverPlacement/);
  assert.doesNotMatch(previewSource, /object-cover|object-position/);
  assert.doesNotMatch(editorSource, /objectFit:\s*["']cover/);
  assert.doesNotMatch(exportSource, /function drawCover/);
});

test("crop editor uses Pointer Events, active pointer rebasing, and honest trackpad fallbacks", async () => {
  const source = await readFile(
    new URL("./memory-card-crop-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /new Map<number, MemoryCardPoint>/);
  assert.match(source, /event\.pointerId/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /rebaseMemoryCardGesture/);
  assert.match(source, /removeMemoryCardPointer/);
  assert.match(source, /onPointerCancel=\{finishPointer\}/);
  assert.match(source, /touchAction: "none"/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /"GestureEvent" in window/);
  assert.match(source, /event\.ctrlKey/);
  assert.match(source, /event\.pointerType === "mouse"/);
  assert.match(source, /addEventListener\("wheel", wheel, \{ passive: false \}\)/);
  assert.match(source, /aspectRatio: `\$\{viewport\.width\} \/ \$\{viewport\.height\}`/);
  assert.match(source, /onApply\(placementRef\.current\)/);
  assert.match(source, /onClick=\{onCancel\}/);
  assert.match(source, /한 손가락으로 이동 · 두 손가락으로 확대\/회전/);
  assert.match(source, /memory-card-offset-x/);
  assert.match(source, /memory-card-offset-y/);
  assert.match(source, /getMemoryCardCenteredContainPlacement\(\)/);
  assert.match(source, />\s*사진 전체\s*</);
  assert.match(source, />\s*프레임 채우기\s*</);
  assert.match(source, />\s*초기화\s*</);
  assert.ok((source.match(/onClick=\{fillFrame\}/g) ?? []).length >= 2);
  assert.match(source, /aria-label="사진 축소"/);
  assert.match(source, /aria-label="사진 확대"/);
  assert.doesNotMatch(source, /touches|changedTouches|fake/i);
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

test("new templates use full-canvas PNG export through the existing path", async () => {
  let rendered = 0;
  for (const [templateKey, count] of newTemplateCases) {
    const input = {
      ...exportInput(),
      templateKey,
      renderModel: createMemoryCardRenderModel(buildMemoryCardLayoutV2(
        templateKey,
        Array.from({ length: count }, (_, index) => `${templateKey}-${index}`),
      )),
    };
    assert.deepEqual(getMemoryCardExportDimensions(input, MEMORY_CARD_EXPORT_SIZES[0]), MEMORY_CARD_CANVAS);
    await exportMemoryCardPng(input, async () => {
      rendered += 1;
      return new Blob(["png"], { type: "image/png" });
    });
  }
  assert.equal(rendered, 5);
});

test("legacy, experimental v1, v2, and v3 saved cards all reach PNG export", async () => {
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
    createMemoryCardRenderModel(buildMemoryCardLayoutV3("four_cut", ["a", "b", "c", "d"])),
  ];
  let rendered = 0;
  for (const renderModel of models) {
    assert.ok(renderModel);
    await exportMemoryCardPng(exportInput(renderModel), async () => {
      rendered += 1;
      return new Blob(["png"], { type: "image/png" });
    });
  }
  assert.equal(rendered, 4);
});

test("export retries at lower scale and unsupported Web Share downloads", async () => {
  const attempted = [];
  await exportMemoryCardPng(exportInput(), async (_input, size) => {
    attempted.push(size);
    if (size.width === 1080) throw new Error("mobile-memory-pressure");
    return new Blob(["fallback"], { type: "image/png" });
  });
  assert.deepEqual(attempted, MEMORY_CARD_EXPORT_SIZES);

  await assert.rejects(
    exportMemoryCardPng(exportInput(), async () => {
      throw new Error("decode-failed");
    }),
    /decode-failed/,
  );

  let downloads = 0;
  const result = await shareOrDownloadMemoryCardPng(new Blob(["png"]), "card.png", {
    navigator: null,
    download: () => { downloads += 1; },
  });
  assert.equal(result, "downloaded");
  assert.equal(downloads, 1);
});

test("required image decode failure rejects render instead of exporting a blank slot", async () => {
  const renderModel = createMemoryCardRenderModel(
    buildMemoryCardLayoutV2("four_cut", ["a", "b", "c", "d"]),
  );
  const photos = ["a", "b", "c", "d"].map((id) => ({
    id,
    storagePath: `${id}.jpg`,
    originalFilename: null,
    mimeType: "image/jpeg",
    signedUrl: `https://private.invalid/${id}`,
    mediaState: "ready",
    uploaderMemberId: memberId,
    uploaderName: null,
    caption: null,
    width: 100,
    height: 100,
    createdAt: "2026-09-11T00:00:00Z",
    isOwner: true,
  }));

  await assert.rejects(
    renderMemoryCardPng(
      { ...exportInput(renderModel), photos },
      MEMORY_CARD_EXPORT_SIZES[0],
      async () => {
        throw new Error("browser-decode-failed");
      },
    ),
    { message: MEMORY_CARD_REQUIRED_IMAGE_ERROR },
  );
  await assert.rejects(
    renderMemoryCardPng(
      { ...exportInput(renderModel), photos: photos.slice(1) },
      MEMORY_CARD_EXPORT_SIZES[0],
      async () => ({ naturalWidth: 100, naturalHeight: 100 }),
    ),
    { message: MEMORY_CARD_REQUIRED_IMAGE_ERROR },
  );
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
  assert.match(sources[1], /layout: MemoryCardLayoutV3/);
  assert.doesNotMatch(sources[1], /buildMemoryCardLayoutV2/);
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
