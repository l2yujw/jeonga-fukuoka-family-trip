import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALBUM_FILE_MAX_BYTES,
  buildPhotoInsertPayload,
  buildStoragePath,
  isPhotoOwner,
  mapPersistedPhotoRows,
  validateAlbumFile,
} from "./album-utils.ts";

const tripId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const authUserId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";

test("album accepts only supported non-empty images up to 15MB", () => {
  assert.equal(validateAlbumFile({ size: 1, type: "image/jpeg" }), null);
  assert.equal(
    validateAlbumFile({ size: ALBUM_FILE_MAX_BYTES, type: "image/heic" }),
    null,
  );
  assert.match(validateAlbumFile({ size: 0, type: "image/png" }), /비어 있는/);
  assert.match(
    validateAlbumFile({ size: ALBUM_FILE_MAX_BYTES + 1, type: "image/png" }),
    /15MB/,
  );
  assert.match(validateAlbumFile({ size: 1, type: "image/gif" }), /JPEG/);
});

test("storage paths start with trip/auth UUIDs and use MIME extensions", () => {
  const cases = [
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/heic", "heic"],
    ["image/heif", "heif"],
  ];

  for (const [mimeType, extension] of cases) {
    assert.equal(
      buildStoragePath(tripId, authUserId, mimeType, photoId),
      `${tripId}/${authUserId}/${photoId}.${extension}`,
    );
  }
  assert.doesNotMatch(
    buildStoragePath(tripId, authUserId, "image/jpeg", photoId),
    /family-vacation\.jpg/,
  );
  assert.throws(
    () => buildStoragePath(tripId, authUserId, "image/gif", photoId),
    /unsupported-photo-type/,
  );
});

test("metadata payload uses trusted identities and normalizes caption", () => {
  const payload = buildPhotoInsertPayload({
    authUserId,
    caption: "  함께한 아침  ",
    draft: {
      file: {
        name: "Family Original.JPG",
        type: "image/jpeg",
      },
      previewUrl: null,
      width: 3024,
      height: 4032,
    },
    memberId,
    storagePath: `${tripId}/${authUserId}/${photoId}.jpg`,
    tripId,
  });

  assert.deepEqual(payload, {
    trip_id: tripId,
    uploader_member_id: memberId,
    uploader_auth_user_id: authUserId,
    storage_path: `${tripId}/${authUserId}/${photoId}.jpg`,
    original_filename: "Family Original.JPG",
    mime_type: "image/jpeg",
    caption: "함께한 아침",
    taken_at: null,
    width: 3024,
    height: 4032,
  });
  assert.equal(
    buildPhotoInsertPayload({
      authUserId,
      caption: "   ",
      draft: { file: { name: "a.heic", type: "image/heic" }, previewUrl: null, width: null, height: null },
      memberId,
      storagePath: `${tripId}/${authUserId}/${photoId}.heic`,
      tripId,
    }).caption,
    null,
  );
});

test("persisted mapping preserves newest-first input and calculates owner", () => {
  const older = photoRow({
    id: "older",
    storage_path: `${tripId}/${authUserId}/older.jpg`,
    created_at: "2026-09-11T01:00:00Z",
  });
  const newer = photoRow({
    id: "newer",
    storage_path: `${tripId}/${authUserId}/newer.jpg`,
    created_at: "2026-09-11T02:00:00Z",
  });
  const mapped = mapPersistedPhotoRows(
    [newer, older],
    new Map([[memberId, "류정원"]]),
    authUserId,
    new Map([[newer.storage_path, "https://signed.example/newer"]]),
  );

  assert.deepEqual(mapped.map(({ id }) => id), ["newer", "older"]);
  assert.equal(mapped[0].uploaderName, "류정원");
  assert.equal(mapped[0].signedUrl, "https://signed.example/newer");
  assert.equal(mapped[1].signedUrl, null);
  assert.equal(isPhotoOwner(newer, authUserId), true);
  assert.equal(isPhotoOwner(newer, "different-auth-user"), false);
});

test("private album repository never requests public Storage URLs", async () => {
  const source = await readFile(
    new URL("./album-repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /createSignedUrl/);
  assert.doesNotMatch(source, /getPublicUrl/);
});

function photoRow(overrides = {}) {
  return {
    id: photoId,
    trip_id: tripId,
    uploader_member_id: memberId,
    uploader_auth_user_id: authUserId,
    storage_path: `${tripId}/${authUserId}/${photoId}.jpg`,
    original_filename: "original.jpg",
    mime_type: "image/jpeg",
    caption: null,
    taken_at: null,
    width: 100,
    height: 200,
    created_at: "2026-09-11T00:00:00Z",
    ...overrides,
  };
}
