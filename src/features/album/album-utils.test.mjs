import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALBUM_FILE_MAX_BYTES,
  appendAlbumUploadDrafts,
  buildPhotoInsertPayload,
  buildStoragePath,
  createAlbumUploadDraft,
  getAlbumPhotoDownloadFilename,
  getUploadableAlbumDrafts,
  isPhotoOwner,
  markAlbumDraftsUploading,
  mapPersistedPhotoRows,
  partitionAlbumFiles,
  removeAlbumUploadDraft,
  runBoundedUploads,
  settleAlbumUploadDraft,
  updateAlbumUploadDraftCaption,
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

test("multi-selection accepts valid files independently and preserves order", () => {
  const first = albumFile("same.jpg", "image/jpeg");
  const invalid = albumFile("too-large.png", "image/png", ALBUM_FILE_MAX_BYTES + 1);
  const second = albumFile("same.jpg", "image/jpeg");
  const { accepted, rejected } = partitionAlbumFiles([first, invalid, second]);

  assert.deepEqual(accepted, [first, second]);
  assert.deepEqual(rejected, [
    { file: invalid, error: "사진은 15MB 이하만 선택할 수 있어요." },
  ]);

  const existing = [createAlbumUploadDraft(localDraft(albumFile("old.jpg")), "old")];
  const added = [
    createAlbumUploadDraft(localDraft(first), "duplicate-1"),
    createAlbumUploadDraft(localDraft(second), "duplicate-2"),
  ];
  const appended = appendAlbumUploadDrafts(existing, added);
  assert.deepEqual(appended.map(({ clientId }) => clientId), [
    "old",
    "duplicate-1",
    "duplicate-2",
  ]);
  assert.notEqual(appended[1].clientId, appended[2].clientId);
});

test("draft state helpers target client ids and keep failed captions retriable", () => {
  const drafts = [
    createAlbumUploadDraft(localDraft(albumFile("same.jpg")), "first"),
    createAlbumUploadDraft(localDraft(albumFile("same.jpg")), "second"),
  ];
  const captioned = updateAlbumUploadDraftCaption(drafts, "second", "둘째 사진");
  assert.equal(captioned[0].caption, "");
  assert.equal(captioned[1].caption, "둘째 사진");
  assert.deepEqual(
    removeAlbumUploadDraft(captioned, "first").map(({ clientId }) => clientId),
    ["second"],
  );

  const uploading = markAlbumDraftsUploading(
    captioned,
    new Set(["first", "second"]),
  );
  const afterSuccess = settleAlbumUploadDraft(uploading, "first");
  const afterFailure = settleAlbumUploadDraft(
    afterSuccess,
    "second",
    "retry me",
  );
  assert.deepEqual(afterFailure, [
    {
      ...captioned[1],
      status: "failed",
      error: "retry me",
    },
  ]);
  assert.deepEqual(
    getUploadableAlbumDrafts(afterFailure).map(({ clientId }) => clientId),
    ["second"],
  );
});

test("bounded uploads limit concurrency and preserve partial-result identity", async () => {
  const items = ["first", "second", "third", "fourth"].map((clientId) => ({
    clientId,
  }));
  let active = 0;
  let maximumActive = 0;

  const results = await runBoundedUploads(
    items,
    async ({ clientId }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (clientId === "third") throw new Error("expected failure");
      return `${clientId}-photo`;
    },
    2,
  );

  assert.equal(maximumActive, 2);
  assert.deepEqual(results.map(({ clientId }) => clientId), [
    "first",
    "second",
    "third",
    "fourth",
  ]);
  assert.deepEqual(
    results.map(({ status }) => status),
    ["fulfilled", "fulfilled", "rejected", "fulfilled"],
  );
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
  assert.equal(mapped[0].uploaderMemberId, memberId);
  assert.equal(mapped[0].uploaderName, "류정원");
  assert.equal(mapped[0].createdAt, "2026-09-11T02:00:00Z");
  assert.equal(mapped[0].originalFilename, "original.jpg");
  assert.equal(mapped[0].mimeType, "image/jpeg");
  assert.equal(mapped[0].signedUrl, "https://signed.example/newer");
  assert.equal(mapped[1].signedUrl, null);
  assert.equal(isPhotoOwner(newer, authUserId), true);
  assert.equal(isPhotoOwner(newer, "different-auth-user"), false);
  assert.equal(mapped[0].isOwner, true);
});

test("download filenames prefer a sanitized original and safely preserve HEIC fallbacks", () => {
  assert.equal(
    getAlbumPhotoDownloadFilename({
      id: photoId,
      originalFilename: "../가족:사진?.HEIC",
      mimeType: "image/heic",
      storagePath: `${tripId}/${authUserId}/${photoId}.heic`,
    }),
    "가족-사진-.HEIC",
  );
  assert.equal(
    getAlbumPhotoDownloadFilename({
      id: photoId,
      originalFilename: null,
      mimeType: "image/heif",
      storagePath: `${tripId}/${authUserId}/${photoId}.heif`,
    }),
    `fukuoka-photo-${photoId}.heif`,
  );
  assert.equal(
    getAlbumPhotoDownloadFilename({
      id: "unsafe/id",
      originalFilename: null,
      mimeType: null,
      storagePath: "trip/user/original.webp",
    }),
    "fukuoka-photo-unsafe-id.webp",
  );
});

test("private album repository never requests public Storage URLs", async () => {
  const source = await readFile(
    new URL("./album-repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /createSignedUrl/);
  assert.match(source, /\.download\(photo\.storagePath\)/);
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

function albumFile(name, type = "image/jpeg", size = 1024) {
  return { name, type, size };
}

function localDraft(file) {
  return { file, previewUrl: null, width: null, height: null };
}
