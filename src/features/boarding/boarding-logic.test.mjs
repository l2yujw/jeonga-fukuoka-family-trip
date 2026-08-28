import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
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
  assert.match(confirm, /네, 탑승할게요/);
  assert.match(confirm, /onClick=\{claimMember\}/);
  assert.match(confirm, /다시 입력/);
  assert.match(confirm, /onClick=\{startAgain\}/);
  assert.match(confirm, /src="\/api\/boarding-confirm-visual"/);
  assert.doesNotMatch(confirm, /boarding-confirm-mask/);
});

test("confirm overlays keep approved source geometry and accessible action targets", async () => {
  const css = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.boarding-confirm-plate\s*\{[^}]*aspect-ratio:\s*941\s*\/\s*2020/s);
  assert.doesNotMatch(css, /\.boarding-confirm-mask/);
  assert.match(css, /\.boarding-confirm-value\s*\{[^}]*font-family:\s*var\(--font-editorial\)[^}]*font-size:\s*clamp\(1\.3rem,\s*6\.15vw,\s*1\.5rem\)/s);
  assert.match(css, /\.boarding-confirm-value--passenger\s*\{[^}]*top:\s*45\.4455%[^}]*left:\s*20\.1913%[^}]*width:\s*33%[^}]*height:\s*3\.4653%/s);
  assert.match(css, /\.boarding-confirm-value--role\s*\{[^}]*top:\s*51\.8812%[^}]*left:\s*20\.1913%[^}]*width:\s*46%[^}]*height:\s*3\.4653%/s);
  assert.match(css, /\.boarding-confirm-action\s*\{[^}]*min-height:\s*var\(--app-tap-target-min\)[^}]*height:\s*52px/s);
  assert.match(css, /\.boarding-confirm-action--primary\s*\{[^}]*top:\s*78\.1%/s);
  assert.match(css, /\.boarding-confirm-action--secondary\s*\{[^}]*top:\s*86\.25%/s);
});

test("confirm visual route reads only the fixed ignored reference path", async () => {
  const route = await readFile(
    new URL("../../app/api/boarding-confirm-visual/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /serveLandingVisual as serveBoardingConfirmVisual/);
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /Jeonga_Fukuoka_Feedback03_Confirm_Final_Reference_v11\.png/);
  assert.doesNotMatch(route, /request\.(?:nextUrl|url|json|formData)/);
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
