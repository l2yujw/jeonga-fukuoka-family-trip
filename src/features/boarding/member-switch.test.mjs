import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const compact = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();

test("migration 13 always releases membership atomically and service-role only", async () => {
  const sql = compact(
    await readFile(
      new URL("../../../docs/data/13_MEMBER_SWITCH_ALWAYS_ALLOW_MIGRATION.sql", import.meta.url),
      "utf8",
    ),
  );
  const functionBody = sql.slice(
    sql.indexOf("create or replace function"),
    sql.indexOf("revoke all"),
  );

  assert.match(sql, /create or replace function public\.release_trip_membership_for_switch\( p_trip_id uuid, p_auth_user_id uuid \)/);
  assert.match(functionBody, /from public\.trip_memberships tm where tm\.trip_id = p_trip_id and tm\.auth_user_id = p_auth_user_id for update/);
  assert.match(functionBody, /from public\.family_members fm where fm\.id = current_member_id and fm\.trip_id = p_trip_id for update/);
  assert.ok(
    functionBody.indexOf("from public.trip_memberships") < functionBody.indexOf("from public.family_members") &&
      functionBody.indexOf("from public.family_members") < functionBody.indexOf("delete from public.trip_memberships") &&
      functionBody.indexOf("delete from public.trip_memberships") < functionBody.indexOf("update public.family_members"),
  );
  assert.match(functionBody, /return 'already_released'/);
  assert.match(functionBody, /delete from public\.trip_memberships tm[\s\S]*update public\.family_members fm set boarded_at = null/);
  assert.doesNotMatch(functionBody, /blocked_owned_content|public\.photos|public\.memory_cards|uploader_member_id|creator_member_id/);
  assert.doesNotMatch(functionBody, /lock table/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.release_trip_membership_for_switch\(uuid, uuid\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.release_trip_membership_for_switch\(uuid, uuid\) to service_role/);
  assert.match(sql, /^begin;[\s\S]*commit;$/);
});

test("member-switch API derives identity and trip and maps retry-safe statuses", async () => {
  const route = await readFile(
    new URL("../../app/api/member-switch/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /authenticateRequest\(request\)[\s\S]*401/);
  assert.match(route, /resolveInviteTrip\(request\)[\s\S]*403/);
  assert.match(route, /release_trip_membership_for_switch/);
  assert.match(route, /p_trip_id: trip\.id, p_auth_user_id: user\.id/);
  assert.match(route, /status === "released" \|\| status === "already_released"[\s\S]*NextResponse\.json\(\{ status \}\)/);
  assert.deepEqual(
    [...route.matchAll(/status === "([^"]+)"/g)].map((match) => match[1]),
    ["released", "already_released"],
  );
  assert.doesNotMatch(route, /blocked_owned_content|status:\s*409/);
  assert.doesNotMatch(route, /memberId|request\.json|request\.formData/);
  assert.doesNotMatch(route, /signOut|signInAnonymously/);
});

test("migration 13 keeps historical Photo metadata editable without changing attribution writes", async () => {
  const [migration, canonicalRls] = await Promise.all([
    readFile(
      new URL("../../../docs/data/13_MEMBER_SWITCH_ALWAYS_ALLOW_MIGRATION.sql", import.meta.url),
      "utf8",
    ).then(compact),
    readFile(
      new URL("../../../docs/data/02_RLS_FINAL.sql", import.meta.url),
      "utf8",
    ).then(compact),
  ]);
  const policy = migration.slice(
    migration.indexOf('drop policy if exists "uploaders can update own photo metadata"'),
  );

  assert.match(policy, /drop policy if exists "uploaders can update own photo metadata" on public\.photos/);
  assert.match(policy, /create policy "uploaders can update own photo metadata" on public\.photos for update to authenticated/);
  assert.equal((policy.match(/uploader_auth_user_id = \(select auth\.uid\(\)\)/g) ?? []).length, 2);
  assert.equal((policy.match(/tm\.trip_id = photos\.trip_id and tm\.auth_user_id = \(select auth\.uid\(\)\)/g) ?? []).length, 2);
  assert.doesNotMatch(policy, /tm\.family_member_id = photos\.uploader_member_id/);
  assert.match(canonicalRls, /grant update \(caption, taken_at\) on table public\.photos to authenticated/);
  assert.doesNotMatch(canonicalRls, /grant update on table public\.photos to authenticated/);
  assert.match(canonicalRls, /create policy "members can insert own photos"[\s\S]*tm\.family_member_id = photos\.uploader_member_id/);
  assert.doesNotMatch(migration, /members can insert own photos|memory_cards/);
  assert.match(canonicalRls, /revoke update \( template_key, layout_version, layout_json, result_storage_path, updated_at \) on table public\.memory_cards from authenticated/);
});

test("Home requires confirmation and preserves the current auth session", async () => {
  const [home, css, ui] = await Promise.all([
    readFile(new URL("../../app/home/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../components/ui.tsx", import.meta.url), "utf8"),
  ]);
  const confirmStart = home.indexOf("async function confirmMemberSwitch");
  const renderStart = home.indexOf("return (", confirmStart);
  const confirmation = home.slice(confirmStart, renderStart);

  assert.match(home, /\{member\.name\} · 변경/);
  assert.match(home, /aria-label=\{`현재 사용자 \$\{member\.name\}, 사용자 변경`\}/);
  assert.match(home, /className="home-v5-member-switch"[\s\S]*?setMemberSwitchOpen\(true\)/);
  assert.match(home, /className="home-v5-switch-confirm"[\s\S]*?onClick=\{confirmMemberSwitch\}/);
  assert.equal(home.match(/fetch\("/g)?.length, 1);
  assert.match(confirmation, /getCurrentAuthSession\(\)/);
  assert.doesNotMatch(confirmation, /ensureAnonymousAuthSession|signOut/);
  assert.match(confirmation, /fetch\("\/api\/member-switch"/);
  assert.match(confirmation, /Authorization: `Bearer \$\{authSession\.access_token\}`/);
  assert.match(confirmation, /clearPendingMember\(\)[\s\S]*router\.replace\("\/"\)/);
  assert.ok(confirmation.indexOf("if (!response.ok)") < confirmation.indexOf("router.replace"));
  assert.match(home, /사용자를 변경할까요\?/);
  assert.match(home, /사용자 변경을 하면 이\s+기기의 탑승 연결을 해제하고 이름 선택 화면으로 돌아갑니다\./);
  assert.match(home, /memberSwitchPending \? "변경하고 있어요" : "사용자 변경"/);
  assert.match(home, />\s*취소\s*</);
  assert.match(home, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(home, /event\.key === "Escape"/);
  assert.match(home, /previousFocus\?\.isConnected/);
  assert.match(css, /\.home-v5-member-switch\s*\{[^}]*position: absolute;[^}]*top: 17px;[^}]*right: 16px;[^}]*min-height: 44px/s);
  assert.match(css, /\.home-v5-switch-overlay\s*\{[^}]*position: fixed;[^}]*z-index: 100/s);
  assert.equal((ui.match(/href: "\/(?:home|schedule|album|cards)"/g) ?? []).length, 4);
});
