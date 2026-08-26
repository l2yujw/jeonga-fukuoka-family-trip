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
  assert.match(
    sql,
    /grant update \( template_key, layout_version, layout_json, result_storage_path, updated_at \) on table public\.memory_cards to authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /grant update on table public\.(photos|memory_cards) to authenticated/,
  );
});
