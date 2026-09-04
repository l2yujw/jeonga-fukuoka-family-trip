import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  buildMemoryCardLayoutV3,
} from "./memory-card.ts";

const tripId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const authUserId = "33333333-3333-4333-8333-333333333333";
const cardId = "44444444-4444-4444-8444-444444444444";
const photoIds = ["a", "b", "c", "d"];
const layout = buildMemoryCardLayoutV3("four_cut", photoIds);
const events = [];
let insertError = null;

const storage = {
  async upload(path, blob, options) {
    events.push(["upload", path, blob.type, options]);
    return { error: null };
  },
  async remove(paths) {
    events.push(["remove", paths]);
    return { error: null };
  },
  async createSignedUrls(paths) {
    events.push(["sign", paths]);
    return {
      data: paths.map((path) => ({ path, signedUrl: `https://signed.invalid/${path}`, error: null })),
      error: null,
    };
  },
  async download(path) {
    events.push(["download", path]);
    return { data: new Blob(["stored-result"], { type: "image/png" }), error: null };
  },
};

const supabase = {
  storage: {
    from(bucket) {
      assert.equal(bucket, "memory-card-results");
      return storage;
    },
  },
  from(table) {
    assert.equal(table, "memory_cards");
    return {
      insert(payload) {
        events.push(["insert", payload]);
        return {
          select() {
            return {
              async single() {
                return insertError
                  ? { data: null, error: insertError }
                  : {
                      data: {
                        id: cardId,
                        ...payload,
                        created_at: "2026-09-11T00:00:00Z",
                        updated_at: "2026-09-11T00:00:00Z",
                      },
                      error: null,
                    };
              },
            };
          },
        };
      },
      delete() {
        events.push(["delete"]);
        return {
          eq(_column, id) {
            assert.equal(id, cardId);
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: { id: cardId }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

await mock.module(
  new URL("../boarding/current-trip-session.ts", import.meta.url).href,
  { exports: { getCurrentAuthSession: async () => ({ user: { id: authUserId } }) } },
);
await mock.module(
  new URL("../../lib/supabase/client.ts", import.meta.url).href,
  { exports: { getSupabaseBrowserClient: () => supabase } },
);

const {
  createMemoryCard,
  deleteMemoryCard,
  downloadMemoryCardResult,
} = await import("./memory-card-repository.ts");

const tripSession = {
  trip: { id: tripId },
  member: { id: memberId, name: "류정원" },
};

test("mocked finalization preserves upload/insert/sign/download/delete ordering and cleanup", async () => {
  const saved = await createMemoryCard({
    availablePhotoIds: photoIds,
    layout,
    resultPng: new Blob(["png"], { type: "image/png" }),
    templateKey: "four_cut",
    tripSession,
  });
  const uploadedPath = events[0][1];

  assert.deepEqual(events.map(([event]) => event), ["upload", "insert", "sign"]);
  assert.equal(events[1][1].result_storage_path, uploadedPath);
  assert.equal(events[1][1].layout_version, 3);
  assert.equal(saved.resultStoragePath, uploadedPath);
  assert.equal(saved.resultSignedUrl, `https://signed.invalid/${uploadedPath}`);

  events.length = 0;
  const downloaded = await downloadMemoryCardResult(saved);
  assert.equal(await downloaded.text(), "stored-result");
  assert.deepEqual(events, [["download", uploadedPath]]);

  events.length = 0;
  await deleteMemoryCard(saved);
  assert.deepEqual(events, [["delete"], ["remove", [uploadedPath]]]);

  events.length = 0;
  insertError = new Error("insert-failed");
  await assert.rejects(
    createMemoryCard({
      availablePhotoIds: photoIds,
      layout,
      resultPng: new Blob(["png"], { type: "image/png" }),
      templateKey: "four_cut",
      tripSession,
    }),
    /insert-failed/,
  );
  assert.deepEqual(events.map(([event]) => event), ["upload", "insert", "remove"]);
  assert.deepEqual(events[2][1], [events[0][1]]);
});
