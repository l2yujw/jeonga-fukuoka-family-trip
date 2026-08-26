import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMemoryCardInsertPayload,
  buildMemoryCardLayout,
  mapPersistedMemoryCardRows,
  MEMORY_CARD_TEMPLATES,
  parseMemoryCardLayoutV1,
  randomFillPhotoIds,
  resolveMemoryCardSlots,
} from "./memory-card.ts";

const tripId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const authUserId = "33333333-3333-4333-8333-333333333333";

test("defines exactly the three locked templates with stable slot counts", () => {
  assert.deepEqual(
    MEMORY_CARD_TEMPLATES.map(({ key, slotIds }) => [key, slotIds.length]),
    [
      ["polaroid_moodboard", 3],
      ["four_cut", 4],
      ["editorial_collage", 3],
    ],
  );
  assert.deepEqual(MEMORY_CARD_TEMPLATES[0].slotIds, ["hero", "left", "right"]);
  assert.deepEqual(MEMORY_CARD_TEMPLATES[1].slotIds, ["cut-1", "cut-2", "cut-3", "cut-4"]);
  assert.deepEqual(MEMORY_CARD_TEMPLATES[2].slotIds, ["feature", "top", "bottom"]);
});

test("layout builder persists version, predefined slot IDs, and photo IDs only", () => {
  const layout = buildMemoryCardLayout("four_cut", ["photo-1", "photo-2", "photo-3", "photo-4"]);

  assert.deepEqual(layout, {
    version: 1,
    slots: [
      { slotId: "cut-1", photoId: "photo-1" },
      { slotId: "cut-2", photoId: "photo-2" },
      { slotId: "cut-3", photoId: "photo-3" },
      { slotId: "cut-4", photoId: "photo-4" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(layout), /signed|storage|url/i);
  assert.throws(
    () => buildMemoryCardLayout("four_cut", ["photo-1", "photo-1"]),
    /duplicate-memory-card-photo/,
  );
});

test("random fill stays unique, bounded, and inside the supplied trip-photo set", () => {
  const available = ["photo-1", "photo-2", "photo-2", "photo-3", "photo-4", "photo-5"];
  const selected = randomFillPhotoIds(available, 4, () => 0.25);

  assert.equal(selected.length, 4);
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(selected.every((photoId) => available.includes(photoId)));
  assert.equal(randomFillPhotoIds(["photo-1", "photo-2"], 4, () => 0).length, 2);
});

test("insert payload accepts only a complete selection from the loaded photo set", () => {
  const layout = buildMemoryCardLayout("four_cut", ["p1", "p2", "p3", "p4"]);
  const uncheckedLayout = {
    ...layout,
    ignored: "not persisted",
    slots: layout.slots.map((slot) => ({ ...slot, signedUrl: "not persisted" })),
  };
  const payload = buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(["p1", "p2", "p3", "p4"]),
    layout: uncheckedLayout,
    memberId,
    templateKey: "four_cut",
    tripId,
  });

  assert.deepEqual(payload, {
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: "four_cut",
    layout_version: 1,
    layout_json: layout,
    result_storage_path: null,
  });
  assert.notEqual(payload.layout_json, uncheckedLayout);
  assert.throws(
    () => buildMemoryCardInsertPayload({
      authUserId,
      availablePhotoIds: new Set(["p1", "p2", "p3"]),
      layout,
      memberId,
      templateKey: "four_cut",
      tripId,
    }),
    /invalid-memory-card-photos/,
  );
});

test("insert payload rejects malformed layouts at the persistence boundary", () => {
  const validSlots = buildMemoryCardLayout("four_cut", ["p1", "p2", "p3", "p4"]).slots;
  const malformedLayouts = [
    { version: 2, slots: validSlots },
    { version: 1, slots: [{ ...validSlots[0], slotId: "unknown" }, ...validSlots.slice(1)] },
    { version: 1, slots: [validSlots[1], validSlots[0], ...validSlots.slice(2)] },
    { version: 1, slots: validSlots.map((slot, index) => index === 1 ? { ...slot, photoId: "p1" } : slot) },
    { version: 1, slots: validSlots.slice(0, 3) },
    { version: 1, slots: [...validSlots, { slotId: "extra", photoId: "p5" }] },
  ];

  for (const layout of malformedLayouts) {
    assert.throws(
      () => buildMemoryCardInsertPayload({
        authUserId,
        availablePhotoIds: new Set(["p1", "p2", "p3", "p4", "p5"]),
        layout,
        memberId,
        templateKey: "four_cut",
        tripId,
      }),
      /invalid-memory-card-layout/,
    );
  }
});

test("persisted rows calculate owner from creator auth user ID", () => {
  const row = memoryCardRow();
  const ownerCard = mapPersistedMemoryCardRows(
    [row],
    new Map([[memberId, "류정원"]]),
    authUserId,
  )[0];
  const familyCard = mapPersistedMemoryCardRows(
    [row],
    new Map([[memberId, "류정원"]]),
    "another-auth-user",
  )[0];

  assert.equal(ownerCard.creatorName, "류정원");
  assert.equal(ownerCard.isOwner, true);
  assert.equal(familyCard.isOwner, false);
});

test("malformed layouts fail safely and deleted source photos resolve per slot", () => {
  assert.equal(parseMemoryCardLayoutV1("four_cut", { version: 2, slots: [] }), null);
  assert.equal(
    parseMemoryCardLayoutV1("four_cut", {
      version: 1,
      slots: [
        { slotId: "unknown", photoId: "p1" },
        { slotId: "cut-2", photoId: "p2" },
        { slotId: "cut-3", photoId: "p3" },
        { slotId: "cut-4", photoId: "p4" },
      ],
    }),
    null,
  );

  const layout = buildMemoryCardLayout("four_cut", ["p1", "deleted", "p3", "p4"]);
  const slots = resolveMemoryCardSlots(
    "four_cut",
    layout,
    new Map([["p1", { signedUrl: "runtime-only" }]]),
  );
  assert.deepEqual(slots.map(({ photo }) => photo !== null), [true, false, false, false]);
});

test("cards use private signed album URLs without persisting runtime URLs", async () => {
  const [albumRepository, cardRepository, cardContract] = await Promise.all([
    readFile(new URL("../album/album-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("./memory-card-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("./memory-card.ts", import.meta.url), "utf8"),
  ]);

  assert.match(albumRepository, /createSignedUrl/);
  assert.doesNotMatch(`${albumRepository}\n${cardRepository}`, /getPublicUrl/);
  assert.doesNotMatch(cardContract, /signedUrl|storagePath/);
});

function memoryCardRow(overrides = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: "four_cut",
    layout_version: 1,
    layout_json: buildMemoryCardLayout("four_cut", ["p1", "p2", "p3", "p4"]),
    result_storage_path: null,
    created_at: "2026-09-11T00:00:00Z",
    updated_at: "2026-09-11T00:00:00Z",
    ...overrides,
  };
}
