import assert from "node:assert/strict";
import test from "node:test";
import {
  createFamilySlots,
  isPendingMemberPreview,
  normalizeMemberName,
  readMemberIdPayload,
  readMemberNamePayload,
} from "./boarding-logic.ts";

const memberId = "8bb5aa1b-bb13-4a6c-9f0b-77baf4d8b634";
const tripId = "5e042d3c-b7f2-40f8-a737-b82ba754c274";

test("member names are trimmed and normalized without fuzzy matching", () => {
  assert.equal(normalizeMemberName("  류정원  "), "류정원");
  assert.equal(normalizeMemberName("e\u0301"), "é");
  assert.equal(readMemberNamePayload({ name: " 류정원 " }), "류정원");
  assert.equal(readMemberNamePayload({ name: "   " }), null);
  assert.equal(readMemberNamePayload({ name: "가".repeat(101) }), null);
});

test("member claim payload accepts only a UUID member identifier", () => {
  assert.equal(readMemberIdPayload({ memberId }), memberId);
  assert.equal(readMemberIdPayload({ memberId: "류정원" }), null);
});

test("pending preview requires the versioned safe shape", () => {
  const preview = {
    version: 1,
    memberId,
    tripId,
    name: "류정원",
    displayRole: "전가네 큰손자",
  };

  assert.equal(isPendingMemberPreview(preview), true);
  assert.equal(isPendingMemberPreview({ ...preview, version: 2 }), false);
  assert.equal(isPendingMemberPreview({ version: 1, name: "류정원" }), false);
});

test("real roster rows are padded to nine anonymous visual slots", () => {
  const slots = createFamilySlots(
    [{ id: memberId, name: "류정원", displayRole: "전가네 큰손자", boardedAt: "2026-08-26T00:00:00.000Z" }],
    memberId,
  );

  assert.equal(slots.length, 9);
  assert.equal(slots.filter(({ boarded }) => boarded).length, 1);
  assert.equal(slots.filter(({ member }) => member === null).length, 8);
  assert.equal(slots[0].online, true);
});
