import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const normalizeSql = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();

function extractMemoryCardInsertPolicy(sql) {
  const match = sql.match(
    /create policy "members can create own memory cards"[\s\S]*?\n\);/i,
  );
  assert.ok(match, "memory-card INSERT policy must exist");
  return normalizeSql(match[0]);
}

function extractTemplateBranch(policy, templateKey) {
  const marker = `when '${templateKey}' then `;
  const start = policy.indexOf(marker);
  assert.notEqual(start, -1, `${templateKey} policy branch must exist`);
  const tail = policy.slice(start + marker.length);
  const ends = [tail.indexOf(" when '"), tail.indexOf(" else false end")]
    .filter((index) => index >= 0);
  assert.ok(ends.length, `${templateKey} policy branch must terminate`);
  return tail.slice(0, Math.min(...ends));
}

function policyAllowsSlotShape(policy, templateKey, slotIds) {
  const branch = extractTemplateBranch(policy, templateKey);
  const count = branch.match(
    /jsonb_array_length\(layout_json -> 'slots'\) (?:= (\d+)|in \(([\d, ]+)\))/,
  );
  assert.ok(count, `${templateKey} slot count must be constrained`);
  const acceptedCounts = count[1]
    ? [Number(count[1])]
    : count[2].split(",").map((value) => Number(value.trim()));
  const orderedSlotIds = [...branch.matchAll(
    /layout_json #>> '\{slots,(\d+),slotid\}' = '([^']+)'/g,
  )].map((match) => [Number(match[1]), match[2]]);
  const applicableSlotIds = orderedSlotIds.filter(([index]) => index < slotIds.length);

  return acceptedCounts.includes(slotIds.length)
    && applicableSlotIds.length === slotIds.length
    && applicableSlotIds.every(([index, slotId]) => slotIds[index] === slotId);
}

test("browser privileges reset before narrow grants", async () => {
  const sql = (await readFile(new URL("./02_RLS_FINAL.sql", import.meta.url), "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();

  assert.match(
    sql,
    /revoke all privileges on table public\.trips, public\.family_members, public\.trip_memberships, public\.itinerary_items, public\.photos, public\.memory_cards from authenticated, anon/,
  );
  assert.match(
    sql,
    /grant select on table public\.trips, public\.family_members, public\.trip_memberships, public\.itinerary_items, public\.photos, public\.memory_cards to authenticated, service_role/,
  );
  assert.match(
    sql,
    /grant insert, delete on table public\.photos, public\.memory_cards to authenticated/,
  );
  assert.match(
    sql,
    /grant update \(caption, taken_at\) on table public\.photos to authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /grant update on table public\.(photos|memory_cards) to authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /grant update \([^)]*\) on table public\.memory_cards to authenticated/,
  );
});

test("historical migration 10 remains row-preserving and removes authenticated UPDATE", async () => {
  const [schema, rls, migration10] = await Promise.all([
    readFile(new URL("./01_SCHEMA_FINAL.sql", import.meta.url), "utf8"),
    readFile(new URL("./02_RLS_FINAL.sql", import.meta.url), "utf8"),
    readFile(
      new URL("./10_FUNCTION_ARCHITECTURE_LOCK_CARD_WRITE_MIGRATION.sql", import.meta.url),
      "utf8",
    ),
  ]);
  const normalizedRls = normalizeSql(rls);
  const normalizedMigration10 = normalizeSql(migration10);
  const historicalUpdateRevoke =
    /revoke update \( ?template_key, layout_version, layout_json, result_storage_path, updated_at ?\) on table public\.memory_cards from authenticated/;
  const authenticatedUpdateGrant =
    /grant update(?: \([^)]*\))? on table public\.memory_cards to [^;]*\bauthenticated\b/;

  assert.match(schema, /layout_version integer not null default 3/i);
  assert.match(normalizedRls, historicalUpdateRevoke);
  assert.doesNotMatch(normalizedRls, authenticatedUpdateGrant);
  assert.doesNotMatch(normalizedRls, /on public\.memory_cards for update to authenticated/);
  assert.doesNotMatch(normalizedRls, /creators can update own memory cards/);
  assert.match(normalizedMigration10, historicalUpdateRevoke);
  assert.doesNotMatch(normalizedMigration10, authenticatedUpdateGrant);
  assert.match(normalizedMigration10, /revoke update on table public\.memory_cards from authenticated/);
  assert.match(normalizedMigration10, /drop policy if exists "creators can update own memory cards"/);
  assert.match(normalizedMigration10, /layout_version = 3/);
  assert.match(normalizedMigration10, /layout_json -> 'version' = to_jsonb\(layout_version\)/);
  assert.match(normalizedMigration10, /result_storage_path is null/);
  assert.match(normalizedMigration10, /jsonb_typeof\(layout_json -> 'slots'\) = 'array'/);
  assert.doesNotMatch(
    normalizedMigration10,
    /update public\.memory_cards set|delete from public\.memory_cards/,
  );
  assert.match(normalizedMigration10, /^begin;[\s\S]*commit;$/);
});

test("canonical RLS and migration 11 enforce canonical-v3 reader parity", async () => {
  const [rls, migration11] = await Promise.all([
    readFile(new URL("./02_RLS_FINAL.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "./11_FUNCTION_ARCHITECTURE_LOCK_CARD_LAYOUT_POLICY_TIGHTENING.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const canonicalPolicy = extractMemoryCardInsertPolicy(rls);
  const migrationPolicy = extractMemoryCardInsertPolicy(migration11);
  const normalizedMigration11 = normalizeSql(migration11);

  assert.equal(migrationPolicy, canonicalPolicy);
  assert.equal(
    normalizedMigration11,
    `begin; drop policy if exists "members can create own memory cards" on public.memory_cards; ${migrationPolicy} commit;`,
  );
  assert.doesNotMatch(
    normalizedMigration11,
    /grant update(?: \([^)]*\))? on table public\.memory_cards to [^;]*\bauthenticated\b/,
  );

  for (const policy of [canonicalPolicy, migrationPolicy]) {
    assert.match(policy, /creator_auth_user_id = \(select auth\.uid\(\)\)/);
    assert.match(policy, /tm\.trip_id = memory_cards\.trip_id/);
    assert.match(policy, /tm\.family_member_id = memory_cards\.creator_member_id/);
    assert.match(policy, /tm\.auth_user_id = \(select auth\.uid\(\)\)/);
    assert.match(policy, /layout_version = 3/);
    assert.match(policy, /layout_json -> 'version' = to_jsonb\(layout_version\)/);
    assert.match(policy, /result_storage_path is null/);
    assert.match(policy, /layout_json \? 'caption'/);
    assert.match(policy, /layout_json -> 'caption' = 'null'::jsonb/);
    assert.match(policy, /jsonb_typeof\(layout_json -> 'caption'\) = 'string'/);
    assert.match(policy, /jsonb_typeof\(layout_json -> 'slots'\) = 'array'/);
    assert.match(policy, /jsonb_typeof\(slot\) is distinct from 'object'/);
    assert.match(policy, /nullif\(btrim\(slot ->> 'slotid'\), ''\) is null/);
    assert.match(policy, /nullif\(btrim\(slot ->> 'photoid'\), ''\) is null/);
    assert.match(policy, /jsonb_typeof\(slot -> 'placement'\) is distinct from 'object'/);
    assert.match(
      policy,
      /jsonb_typeof\(slot #> '\{placement,zoom\}'\) = 'number' then \(slot #>> '\{placement,zoom\}'\)::numeric < 1 else true/,
    );
    assert.match(
      policy,
      /jsonb_typeof\(slot #> '\{placement,rotation\}'\) = 'number' then \(slot #>> '\{placement,rotation\}'\)::numeric < -180 or \(slot #>> '\{placement,rotation\}'\)::numeric >= 180 else true/,
    );
    assert.match(
      policy,
      /jsonb_typeof\(slot #> '\{placement,offsetx\}'\) is distinct from 'number'/,
    );
    assert.match(
      policy,
      /jsonb_typeof\(slot #> '\{placement,offsety\}'\) is distinct from 'number'/,
    );
    assert.match(
      policy,
      /group by slot ->> 'photoid' having count\(\*\) > 1/,
    );
  }
});

test("canonical policies reject malformed slot shapes and allow both editorial shapes", async () => {
  const [rls, migration11] = await Promise.all([
    readFile(new URL("./02_RLS_FINAL.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "./11_FUNCTION_ARCHITECTURE_LOCK_CARD_LAYOUT_POLICY_TIGHTENING.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const expectedShapes = {
    polaroid_moodboard: [["p1", "p2", "p3", "p4", "p5", "p6"]],
    four_cut: [["f1", "f2", "f3", "f4"]],
    editorial_collage: [
      ["e1", "e2", "e3", "e4"],
      ["e1", "e2", "e3", "e4", "e5"],
    ],
    postcard_duo: [["pd1", "pd2"]],
    scrapbook_trio: [["st1", "st2", "st3"]],
    film_contact_sheet: [["fc1", "fc2", "fc3", "fc4", "fc5", "fc6"]],
    one_moment: [["om1"]],
    instant_memory: [["im1"]],
  };

  for (const sql of [rls, migration11]) {
    const policy = extractMemoryCardInsertPolicy(sql);
    assert.match(
      extractTemplateBranch(policy, "editorial_collage"),
      /jsonb_array_length\(layout_json -> 'slots'\) = 4 or layout_json #>> '\{slots,4,slotid\}' = 'e5'/,
    );
    for (const [templateKey, shapes] of Object.entries(expectedShapes)) {
      for (const slotIds of shapes) {
        assert.equal(policyAllowsSlotShape(policy, templateKey, slotIds), true);
      }
      assert.equal(
        policyAllowsSlotShape(policy, templateKey, shapes[0].slice(0, -1)),
        false,
      );
      assert.equal(
        policyAllowsSlotShape(policy, templateKey, [...shapes.at(-1), "extra"]),
        false,
      );
    }

    assert.equal(policyAllowsSlotShape(policy, "four_cut", ["f1"]), false);
    assert.equal(
      policyAllowsSlotShape(policy, "four_cut", ["f2", "f1", "f3", "f4"]),
      false,
    );
    assert.equal(
      policyAllowsSlotShape(policy, "editorial_collage", ["e1", "e2", "e3"]),
      false,
    );
    assert.equal(
      policyAllowsSlotShape(
        policy,
        "editorial_collage",
        ["e1", "e2", "e3", "e4", "wrong"],
      ),
      false,
    );
  }
});
