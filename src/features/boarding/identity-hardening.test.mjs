import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MEMBERSHIP_CLAIM_CONFLICTS,
  classifyMembershipClaim,
} from "./boarding-logic.ts";

const authA = "auth-a";
const authB = "auth-b";
const memberA = "member-a";
const memberB = "member-b";
const claim = (auth_user_id, family_member_id) => ({
  auth_user_id,
  family_member_id,
});
const compact = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();
const section = (value, start, end) =>
  value.slice(value.indexOf(start), value.indexOf(end, value.indexOf(start)));

test("claim state enforces both identity dimensions with stable safe conflicts", () => {
  assert.deepEqual(
    classifyMembershipClaim({
      authUserId: authA,
      currentAuthMembership: null,
      targetMemberId: memberA,
      targetMemberMembership: null,
    }),
    { status: "fresh" },
  );
  assert.deepEqual(
    classifyMembershipClaim({
      authUserId: authA,
      currentAuthMembership: claim(authA, memberA),
      targetMemberId: memberA,
      targetMemberMembership: claim(authA, memberA),
    }),
    { status: "owned" },
  );
  assert.deepEqual(
    classifyMembershipClaim({
      authUserId: authA,
      currentAuthMembership: claim(authA, memberB),
      targetMemberId: memberA,
      targetMemberMembership: null,
    }),
    {
      status: "conflict",
      code: "AUTH_ALREADY_CLAIMED_OTHER_MEMBER",
      error: MEMBERSHIP_CLAIM_CONFLICTS.AUTH_ALREADY_CLAIMED_OTHER_MEMBER,
    },
  );
  assert.deepEqual(
    classifyMembershipClaim({
      authUserId: authB,
      currentAuthMembership: null,
      targetMemberId: memberA,
      targetMemberMembership: claim(authA, memberA),
    }),
    {
      status: "conflict",
      code: "MEMBER_ALREADY_CLAIMED",
      error: MEMBERSHIP_CLAIM_CONFLICTS.MEMBER_ALREADY_CLAIMED,
    },
  );
});

test("the losing request in a two-auth claim race is classified after 23505", () => {
  const beforeA = classifyMembershipClaim({
    authUserId: authA,
    currentAuthMembership: null,
    targetMemberId: memberA,
    targetMemberMembership: null,
  });
  const beforeB = classifyMembershipClaim({
    authUserId: authB,
    currentAuthMembership: null,
    targetMemberId: memberA,
    targetMemberMembership: null,
  });
  assert.equal(beforeA.status, "fresh");
  assert.equal(beforeB.status, "fresh");

  const winnerAfterInsert = classifyMembershipClaim({
    authUserId: authA,
    currentAuthMembership: claim(authA, memberA),
    targetMemberId: memberA,
    targetMemberMembership: claim(authA, memberA),
  });
  const loserAfterUniqueViolation = classifyMembershipClaim({
    authUserId: authB,
    currentAuthMembership: null,
    targetMemberId: memberA,
    targetMemberMembership: claim(authA, memberA),
  });
  assert.equal(winnerAfterInsert.status, "owned");
  assert.equal(loserAfterUniqueViolation.status, "conflict");
  assert.equal(loserAfterUniqueViolation.code, "MEMBER_ALREADY_CLAIMED");
  assert.equal("auth_user_id" in loserAfterUniqueViolation, false);
});

test("claim route validates auth, invite, trip member, both claims, and rereads 23505", async () => {
  const source = await readFile(
    new URL("../../app/api/claim-member/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /authenticateRequest\(request\)[\s\S]*jsonError\([^\n]+, 401\)/);
  assert.match(source, /resolveInviteTrip\(request\)[\s\S]*jsonError\([^\n]+, 403\)/);
  assert.match(source, /\.eq\("id", memberId\)[\s\S]*\.eq\("trip_id", trip\.id\)[\s\S]*, 404\)/);
  assert.match(source, /\.eq\("auth_user_id", user\.id\)/);
  assert.match(source, /\.eq\("family_member_id", member\.id\)/);
  assert.match(source, /insertError\.code !== "23505"/);
  assert.match(source, /claimState = await readClaimState\(\)/);
  assert.match(source, /jsonError\(claimState\.error, 409, claimState\.code\)/);
  assert.match(source, /NextResponse\.json\(code \? \{ error, code \} : \{ error \}/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*auth_user_id/s);
});

test("member preview rejects either conflict without returning auth identifiers", async () => {
  const source = await readFile(
    new URL("../../app/api/member-preview/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /resolveInviteTrip\(request\)[\s\S]*jsonError\([^\n]+, 403\)/);
  assert.match(source, /if \(!member\) return jsonError\([^\n]+, 404\)/);
  assert.match(source, /\.eq\("auth_user_id", user\.id\)/);
  assert.match(source, /\.eq\("family_member_id", member\.id\)/);
  assert.match(source, /classifyMembershipClaim/);
  assert.match(source, /jsonError\(claimState\.error, 409, claimState\.code\)/);
  assert.match(source, /memberId: member\.id[\s\S]*tripId: trip\.id/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*auth_user_id/s);
});

test("valid invite with retained membership redirects home", async () => {
  const source = await readFile(new URL("./landing-entry.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /if \(invalidInvite\) return;[\s\S]*getCurrentTripSession\(\)[\s\S]*if \(session\)[\s\S]*if \(!switching.active\)[\s\S]*router\.replace\("\/home"\)/,
  );
  assert.match(source, /\}, \[invalidInvite, router\]\);/);
});

test("invalid or missing invite never redirects a retained membership", async () => {
  const source = await readFile(new URL("./landing-entry.tsx", import.meta.url), "utf8");

  assert.ok(
    source.indexOf("if (invalidInvite) return;") <
      source.indexOf("getCurrentTripSession()"),
  );
  assert.match(source, /if \(checkingMembership && !invalidInvite\)/);
  assert.match(source, /if \(invalidInvite\)[\s\S]*초대 링크를 확인해주세요/);
});

test("passive landing initialization never creates anonymous auth", async () => {
  const source = await readFile(new URL("./landing-entry.tsx", import.meta.url), "utf8");
  const submitPosition = source.indexOf("async function handleSubmit");
  const anonymousSignInPosition = source.indexOf("ensureAnonymousAuthSession()");

  assert.ok(anonymousSignInPosition > submitPosition);
  assert.equal(source.match(/ensureAnonymousAuthSession\(\)/g)?.length, 1);
});

test("canonical schema and migration add the member uniqueness preflight safely", async () => {
  const schema = compact(
    await readFile(new URL("../../../docs/data/01_SCHEMA_FINAL.sql", import.meta.url), "utf8"),
  );
  const migration = compact(
    await readFile(
      new URL("../../../docs/data/09_IDENTITY_HARDENING_MIGRATION.sql", import.meta.url),
      "utf8",
    ),
  );

  assert.match(schema, /unique \(trip_id, auth_user_id\)/);
  assert.match(schema, /unique \(trip_id, family_member_id\)/);
  assert.doesNotMatch(schema, /idx_trip_memberships_member/);
  assert.match(migration, /^begin;/);
  assert.match(migration, /group by trip_id, family_member_id having count\(\*\) > 1/);
  assert.ok(migration.indexOf("raise exception") < migration.indexOf("add constraint"));
  assert.match(migration, /if not exists \( select 1 from pg_constraint/);
  assert.match(migration, /unique \(trip_id, family_member_id\)/);
  assert.match(migration, /drop index if exists public\.idx_trip_memberships_member/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.trip_memberships/);
  assert.match(migration, /commit;$/);
});

test("photo and card writes use actual auth plus the guarded trip member", async () => {
  const album = await readFile(new URL("../album/album-repository.ts", import.meta.url), "utf8");
  const cards = await readFile(new URL("../cards/memory-card-repository.ts", import.meta.url), "utf8");
  const albumWrite = section(album, "export async function uploadAlbumPhoto", "export async function updateAlbumPhotoCaption");
  const cardWrite = section(cards, "export async function createMemoryCard", "export async function deleteMemoryCard");

  for (const write of [albumWrite, cardWrite]) {
    assert.match(write, /const authUserId = await requireAuthUserId\(\)/);
    assert.match(write, /memberId: tripSession\.member\.id/);
    assert.match(write, /tripId: tripSession\.trip\.id/);
    assert.match(write, /authUserId/);
  }
});

test("RLS binds write identity and storage uploads bind trip plus auth path", async () => {
  const rls = compact(
    await readFile(new URL("../../../docs/data/02_RLS_FINAL.sql", import.meta.url), "utf8"),
  );
  const storage = compact(
    await readFile(new URL("../../../docs/data/03_STORAGE_FINAL.sql", import.meta.url), "utf8"),
  );
  const photoInsert = section(rls, 'create policy "members can insert own photos"', 'create policy "uploaders can update own photo metadata"');
  const cardInsert = section(rls, 'create policy "members can create own memory cards"', 'create policy "creators can update own memory cards"');
  const photoRead = section(storage, 'create policy "trip members can read trip photos"', 'create policy "trip members can upload trip photos"');
  const photoUpload = section(storage, 'create policy "trip members can upload trip photos"', 'create policy "owners can update own trip photo objects"');
  const cardRead = section(storage, 'create policy "trip members can read memory card results"', 'create policy "trip members can upload memory card results"');
  const cardUpload = section(storage, 'create policy "trip members can upload memory card results"', 'create policy "owners can delete own memory card results"');

  assert.match(photoInsert, /uploader_auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(photoInsert, /tm\.family_member_id = photos\.uploader_member_id/);
  assert.match(cardInsert, /creator_auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(cardInsert, /tm\.family_member_id = memory_cards\.creator_member_id/);
  assert.doesNotMatch(photoRead, /foldername\(name\)\)\[2\]/);
  assert.match(photoUpload, /foldername\(name\)\)\[2\] = \(select auth\.uid\(\)::text\)/);
  assert.doesNotMatch(cardRead, /foldername\(name\)\)\[2\]/);
  assert.match(cardUpload, /foldername\(name\)\)\[2\] = \(select auth\.uid\(\)::text\)/);
});
