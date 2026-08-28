import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FAMILY_SLOT_COUNT,
  createFamilySlots,
  isCurrentTripSession,
  isPendingMemberPreview,
  normalizeMemberName,
  readMemberIdPayload,
  readMemberNamePayload,
  resolveBoardingInitialization,
} from "./boarding-logic.ts";

const memberId = "8bb5aa1b-bb13-4a6c-9f0b-77baf4d8b634";
const tripId = "5e042d3c-b7f2-40f8-a737-b82ba754c274";
const pendingMember = {
  version: 1,
  memberId,
  tripId,
  name: "류정원",
  displayRole: "전가네 큰손자",
};
const currentSession = {
  trip: {
    id: tripId,
    slug: "jeonga-fukuoka-2026",
    title: "전가네 가족여행",
    destination: "후쿠오카",
    startDate: "2026-09-11",
    endDate: "2026-09-13",
  },
  member: {
    id: memberId,
    name: "류정원",
    displayRole: "전가네 큰손자",
    boardedAt: "2026-08-26T00:00:00.000Z",
  },
};
const rosterMember = (
  id,
  { boardedAt = null, seatOrder = null } = {},
) => ({
  id,
  name: `가족 ${id}`,
  displayRole: "가족",
  boardedAt,
  seatOrder,
});

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
  assert.equal(isPendingMemberPreview(pendingMember), true);
  assert.equal(isPendingMemberPreview({ ...pendingMember, version: 2 }), false);
  assert.equal(isPendingMemberPreview({ version: 1, name: "류정원" }), false);
});

test("pending boarding confirmation wins without reading an existing session", async () => {
  let sessionReads = 0;
  const initialization = await resolveBoardingInitialization(
    pendingMember,
    async () => {
      sessionReads += 1;
      return currentSession;
    },
  );

  assert.equal(initialization.stage, "confirm");
  assert.equal(initialization.pending, pendingMember);
  assert.equal(sessionReads, 0);
});

test("pending boarding confirmation wins when no session exists", async () => {
  const initialization = await resolveBoardingInitialization(
    pendingMember,
    async () => null,
  );

  assert.equal(initialization.stage, "confirm");
  assert.equal(initialization.pending, pendingMember);
});

test("an existing session completes a direct boarding visit", async () => {
  const initialization = await resolveBoardingInitialization(
    null,
    async () => currentSession,
  );

  assert.equal(initialization.stage, "complete");
  assert.equal(initialization.session, currentSession);
});

test("a direct boarding visit without a session redirects", async () => {
  const initialization = await resolveBoardingInitialization(
    null,
    async () => null,
  );

  assert.deepEqual(initialization, { stage: "redirect" });
});

test("an already-boarded claim response remains a valid current session", () => {
  assert.equal(isCurrentTripSession(currentSession), true);
});

test("confirm plate keeps pending values and existing actions as live DOM", async () => {
  const component = await readFile(
    new URL("./boarding-flow.tsx", import.meta.url),
    "utf8",
  );
  const confirm = component.slice(
    component.indexOf('if (stage === "confirm")'),
    component.indexOf("if (!session) return null"),
  );

  assert.match(confirm, /boarding-confirm-value--passenger[\s\S]*\{pending\.name\}/);
  assert.match(confirm, /boarding-confirm-value--role[\s\S]*\{pending\.displayRole\}/);
  assert.doesNotMatch(confirm, /pending\.member\./);
  assert.match(confirm, /aria-label="네, 탑승할게요"/);
  assert.match(confirm, /onClick=\{claimMember\}/);
  assert.match(confirm, /aria-label="다시 입력"/);
  assert.match(confirm, /onClick=\{startAgain\}/);
  assert.match(confirm, /src="\/api\/boarding-confirm-visual"/);
  assert.match(confirm, /boarding-confirm-sample-mask--passenger/);
  assert.match(confirm, /boarding-confirm-sample-mask--role/);
});

test("confirm overlays keep approved source geometry and accessible action targets", async () => {
  const css = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.boarding-confirm-plate\s*\{[^}]*width:\s*max\(100%,\s*47\.3396svh\)[^}]*aspect-ratio:\s*863\s*\/\s*1823/s);
  assert.match(css, /\.boarding-confirm-sample-mask--passenger\s*\{[^}]*top:\s*51\.3439%[^}]*left:\s*20\.6257%[^}]*width:\s*18\.1924%[^}]*height:\s*3\.3461%/s);
  assert.match(css, /\.boarding-confirm-sample-mask--role\s*\{[^}]*top:\s*58\.2556%[^}]*left:\s*20\.6257%[^}]*width:\s*37\.6593%[^}]*height:\s*3\.2913%/s);
  assert.match(css, /\.boarding-confirm-value\s*\{[^}]*font-family:\s*var\(--font-editorial\)[^}]*font-size:\s*clamp\(1\.25rem,\s*5\.65vw,\s*1\.42rem\)/s);
  assert.match(css, /\.boarding-confirm-value--passenger\s*\{[^}]*top:\s*50\.7405%[^}]*left:\s*21\.2051%[^}]*width:\s*40%[^}]*height:\s*3\.8398%/s);
  assert.match(css, /\.boarding-confirm-value--role\s*\{[^}]*top:\s*58\.1459%[^}]*left:\s*21\.2051%[^}]*width:\s*50%[^}]*height:\s*3\.8398%/s);
  assert.match(css, /\.boarding-confirm-action\s*\{[^}]*min-height:\s*var\(--app-tap-target-min\)[^}]*background:\s*transparent/s);
  assert.match(css, /\.boarding-confirm-action--primary\s*\{[^}]*top:\s*82\.3368%[^}]*height:\s*6\.033%/s);
  assert.match(css, /\.boarding-confirm-action--secondary\s*\{[^}]*top:\s*89\.3033%[^}]*height:\s*5\.7597%/s);
});

test("confirm visual route reads only the fixed ignored reference path", async () => {
  const route = await readFile(
    new URL("../../app/api/boarding-confirm-visual/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /serveLandingVisual as serveBoardingConfirmVisual/);
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /Jeonga_Fukuoka_Feedback03_Confirm_StartStyle_Approved_Target_v1\.png/);
  assert.doesNotMatch(route, /request\.(?:nextUrl|url|json|formData)/);
});

test("family cabin always returns exactly ten visual seats", () => {
  const slots = createFamilySlots([], memberId);

  assert.equal(FAMILY_SLOT_COUNT, 10);
  assert.equal(slots.length, 10);
  assert.deepEqual(slots.map(({ seatNumber }) => seatNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("explicit seat orders map to the first and tenth visual seats", () => {
  const slots = createFamilySlots(
    [rosterMember("first", { seatOrder: 1 }), rosterMember("last", { seatOrder: 10 })],
    memberId,
  );

  assert.equal(slots[0].member?.id, "first");
  assert.equal(slots[9].member?.id, "last");
});

test("sparse assigned seats preserve unoccupied gaps", () => {
  const slots = createFamilySlots(
    [rosterMember("middle", { seatOrder: 6 })],
    memberId,
  );

  assert.equal(slots[5].member?.id, "middle");
  assert.equal(slots[0].member, null);
  assert.equal(slots[9].member, null);
});

test("null seat orders fill the first available empty seats", () => {
  const slots = createFamilySlots(
    [
      rosterMember("assigned-1", { seatOrder: 1 }),
      rosterMember("fallback", { seatOrder: null }),
      rosterMember("assigned-3", { seatOrder: 3 }),
    ],
    memberId,
  );

  assert.equal(slots[0].member?.id, "assigned-1");
  assert.equal(slots[1].member?.id, "fallback");
  assert.equal(slots[2].member?.id, "assigned-3");
});

test("unassigned fallback keeps stable roster order", () => {
  const slots = createFamilySlots(
    [rosterMember("fallback-a"), rosterMember("fallback-b"), rosterMember("assigned", { seatOrder: 4 })],
    memberId,
  );

  assert.equal(slots[0].member?.id, "fallback-a");
  assert.equal(slots[1].member?.id, "fallback-b");
  assert.equal(slots[3].member?.id, "assigned");
});

test("more roster members never create more than ten slots", () => {
  const roster = Array.from({ length: 12 }, (_, index) => rosterMember(`member-${index + 1}`));
  const slots = createFamilySlots(roster, memberId);

  assert.equal(slots.length, 10);
  assert.equal(slots.filter(({ member }) => member).length, 10);
  assert.equal(slots[9].member?.id, "member-10");
});

test("current member is marked independently of boarded status", () => {
  const [slot] = createFamilySlots(
    [rosterMember(memberId, { boardedAt: null, seatOrder: 1 })],
    memberId,
  );

  assert.equal(slot.current, true);
  assert.equal(slot.boarded, false);
});

test("duplicate and invalid seat orders cannot overwrite an assigned seat", () => {
  const slots = createFamilySlots(
    [
      rosterMember("assigned", { seatOrder: 5 }),
      rosterMember("duplicate", { seatOrder: 5 }),
      rosterMember("too-low", { seatOrder: 0 }),
      rosterMember("too-high", { seatOrder: 11 }),
      rosterMember("fraction", { seatOrder: 2.5 }),
    ],
    memberId,
  );

  assert.equal(slots[4].member?.id, "assigned");
  assert.deepEqual(
    slots.filter(({ member }) => member?.id !== "assigned").slice(0, 4).map(({ member }) => member?.id),
    ["duplicate", "too-low", "too-high", "fraction"],
  );
});
