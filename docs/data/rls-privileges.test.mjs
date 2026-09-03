import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("memory card writes are v3/null-only and authenticated UPDATE is removed", async () => {
  const [schema, rls, migration] = await Promise.all([
    readFile(new URL("./01_SCHEMA_FINAL.sql", import.meta.url), "utf8"),
    readFile(new URL("./02_RLS_FINAL.sql", import.meta.url), "utf8"),
    readFile(
      new URL("./10_FUNCTION_ARCHITECTURE_LOCK_CARD_WRITE_MIGRATION.sql", import.meta.url),
      "utf8",
    ),
  ]);
  const normalizedRls = rls.replace(/\s+/g, " ").toLowerCase();
  const normalizedMigration = migration.replace(/\s+/g, " ").trim().toLowerCase();
  const historicalUpdateRevoke =
    /revoke update \( ?template_key, layout_version, layout_json, result_storage_path, updated_at ?\) on table public\.memory_cards from authenticated/;
  const authenticatedUpdateGrant =
    /grant update(?: \([^)]*\))? on table public\.memory_cards to [^;]*\bauthenticated\b/;

  assert.match(schema, /layout_version integer not null default 3/i);
  for (const sql of [normalizedRls, normalizedMigration]) {
    assert.match(sql, historicalUpdateRevoke);
    assert.doesNotMatch(sql, authenticatedUpdateGrant);
    assert.match(sql, /layout_version = 3/);
    assert.match(sql, /layout_json -> 'version' = to_jsonb\(layout_version\)/);
    assert.match(sql, /result_storage_path is null/);
    assert.match(sql, /jsonb_typeof\(layout_json -> 'slots'\) = 'array'/);
    assert.match(sql, /jsonb_array_length\(layout_json -> 'slots'\) between 1 and 6/);
    assert.match(sql, /slot #> '\{placement,zoom\}'/);
  }
  assert.doesNotMatch(normalizedRls, /on public\.memory_cards for update to authenticated/);
  assert.doesNotMatch(normalizedRls, /creators can update own memory cards/);
  assert.match(normalizedMigration, /revoke update on table public\.memory_cards from authenticated/);
  assert.match(normalizedMigration, /drop policy if exists "creators can update own memory cards"/);
  assert.doesNotMatch(normalizedMigration, /update public\.memory_cards set|delete from public\.memory_cards/);
  assert.match(normalizedMigration, /^begin;[\s\S]*commit;$/);
});
