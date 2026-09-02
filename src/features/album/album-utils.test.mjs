import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALBUM_HIGH_PRIORITY_MEDIA_COUNT,
  ALBUM_INITIAL_MEDIA_PREWARM_COUNT,
  ALBUM_MEDIA_ROOT_MARGIN,
  CARDS_HIGH_PRIORITY_MEDIA_COUNT,
  CARDS_INITIAL_MEDIA_PREWARM_COUNT,
  getFirstViewFetchPriority,
  getInitialMediaPrewarmCandidates,
  observeNearViewport,
} from "./album-media-observer.ts";
import {
  ALBUM_SIGNED_URL_BATCH_SIZE,
  ALBUM_SIGNED_URL_REFRESH_SAFETY_MS,
  createAlbumSignedUrlBroker,
} from "./album-signed-url-cache.ts";
import {
  ALBUM_FILE_MAX_BYTES,
  applyAlbumPhotoSignedUrls,
  appendAlbumUploadDrafts,
  buildPhotoInsertPayload,
  buildStoragePath,
  createAlbumUploadDraft,
  getAlbumPhotoDownloadFilename,
  getUploadableAlbumDrafts,
  isPhotoOwner,
  markAlbumDraftsUploading,
  mapPersistedPhotoRows,
  mergeAlbumPhotos,
  partitionAlbumFiles,
  removeAlbumUploadDraft,
  runBoundedUploads,
  settleAlbumUploadDraft,
  updateAlbumPhotoMedia,
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
  assert.equal(mapped[0].mediaState, "ready");
  assert.equal(mapped[1].signedUrl, null);
  assert.equal(mapped[1].mediaState, "idle");
  assert.equal(isPhotoOwner(newer, authUserId), true);
  assert.equal(isPhotoOwner(newer, "different-auth-user"), false);
  assert.equal(mapped[0].isOwner, true);
});

test("metadata-only photos are idle rather than unavailable", () => {
  const mapped = mapPersistedPhotoRows(
    [photoRow({ id: "a" }), photoRow({ id: "b" })],
    new Map(),
    authUserId,
    new Map(),
  );
  assert.deepEqual(mapped.map(({ signedUrl }) => signedUrl), [null, null]);
  assert.deepEqual(mapped.map(({ mediaState }) => mediaState), ["idle", "idle"]);
});

test("Cards fast lane takes only the first 9 picker photos", () => {
  const photos = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    mediaState: "idle",
  }));

  assert.equal(CARDS_INITIAL_MEDIA_PREWARM_COUNT, 9);
  assert.deepEqual(
    getInitialMediaPrewarmCandidates(
      photos,
      CARDS_INITIAL_MEDIA_PREWARM_COUNT,
    ).map(({ id }) => id),
    ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
  );
});

test("Album fast lane takes only the first 6 visible photos", () => {
  const photos = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    mediaState: "idle",
  }));

  assert.equal(ALBUM_INITIAL_MEDIA_PREWARM_COUNT, 6);
  assert.deepEqual(
    getInitialMediaPrewarmCandidates(
      photos,
      ALBUM_INITIAL_MEDIA_PREWARM_COUNT,
    ).map(({ id }) => id),
    ["0", "1", "2", "3", "4", "5"],
  );
});

test("a changed view requests only idle media still inside its top N", () => {
  const visiblePhotos = [
    { id: "cached", mediaState: "ready" },
    { id: "new-1", mediaState: "idle" },
    { id: "pending", mediaState: "loading" },
    { id: "failed", mediaState: "error" },
    { id: "new-2", mediaState: "idle" },
    { id: "new-3", mediaState: "idle" },
    { id: "outside-top-six", mediaState: "idle" },
  ];

  assert.deepEqual(
    getInitialMediaPrewarmCandidates(
      visiblePhotos,
      ALBUM_INITIAL_MEDIA_PREWARM_COUNT,
    ).map(({ id }) => id),
    ["new-1", "new-2", "new-3"],
  );
});

test("high fetch priority is limited to each first thumbnail row", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, (_, index) =>
      getFirstViewFetchPriority(index, ALBUM_HIGH_PRIORITY_MEDIA_COUNT)),
    ["high", "high", "auto", "auto", "auto", "auto"],
  );
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) =>
      getFirstViewFetchPriority(index, CARDS_HIGH_PRIORITY_MEDIA_COUNT)),
    ["high", "high", "high", "auto", "auto", "auto", "auto", "auto", "auto"],
  );
});

test("photo merge dedupes IDs and preserves an already resolved URL", () => {
  const [resolved] = mapPersistedPhotoRows(
    [photoRow({ id: "same", caption: "old" })],
    new Map(),
    authUserId,
    new Map([[`${tripId}/${authUserId}/${photoId}.jpg`, "signed"]]),
  );
  const [fresh, added] = mapPersistedPhotoRows(
    [
      photoRow({ id: "same", caption: "fresh" }),
      photoRow({ id: "added", storage_path: "added.jpg" }),
    ],
    new Map(),
    authUserId,
    new Map(),
  );
  const merged = mergeAlbumPhotos([resolved, resolved], [fresh, added]);

  assert.deepEqual(merged.map(({ id }) => id), ["same", "added"]);
  assert.equal(merged[0].caption, "fresh");
  assert.equal(merged[0].signedUrl, "signed");
  assert.equal(merged[0].mediaState, "ready");
  assert.equal(
    applyAlbumPhotoSignedUrls(merged, new Map([["added.jpg", "added-url"]]))[1]
      .signedUrl,
    "added-url",
  );
  assert.equal(
    applyAlbumPhotoSignedUrls(merged, new Map([["added.jpg", "added-url"]]))[1]
      .mediaState,
    "ready",
  );
});

test("metadata merges cannot regress hydrated/loading/error runtime state", () => {
  const [metadata] = mapPersistedPhotoRows(
    [photoRow({ id: "same" })],
    new Map(),
    authUserId,
    new Map(),
  );
  const ready = { ...metadata, signedUrl: "signed", mediaState: "ready" };
  const loading = { ...metadata, mediaState: "loading" };
  const failed = { ...metadata, mediaState: "error" };

  assert.deepEqual(
    mergeAlbumPhotos([ready], [metadata]).map(({ signedUrl, mediaState }) => ({
      signedUrl,
      mediaState,
    })),
    [{ signedUrl: "signed", mediaState: "ready" }],
  );
  assert.equal(mergeAlbumPhotos([loading], [metadata])[0].mediaState, "loading");
  assert.equal(mergeAlbumPhotos([failed], [metadata])[0].mediaState, "error");
});

test("localized media updates preserve every unrelated photo reference", () => {
  const photos = mapPersistedPhotoRows(
    [photoRow({ id: "a" }), photoRow({ id: "b", storage_path: "b.jpg" })],
    new Map(),
    authUserId,
    new Map(),
  );
  const loading = updateAlbumPhotoMedia(photos, "a", "loading");
  const ready = updateAlbumPhotoMedia(loading, "a", "ready", "a-url");

  assert.equal(loading[0].mediaState, "loading");
  assert.equal(ready[0].mediaState, "ready");
  assert.equal(ready[0].signedUrl, "a-url");
  assert.equal(loading[1], photos[1]);
  assert.equal(ready[1], photos[1]);
  assert.equal(updateAlbumPhotoMedia(ready, "a", "loading"), ready);
  assert.equal(
    applyAlbumPhotoSignedUrls(ready, new Map([[ready[0].storagePath, null]])),
    ready,
  );
});

test("signed URL broker batches unique paths and keeps partial failures local", async () => {
  const broker = createAlbumSignedUrlBroker();
  const calls = [];
  const signer = async (paths) => {
    calls.push(paths);
    return new Map([["a.jpg", "a-url"], ["b.jpg", null]]);
  };
  const urls = await broker.resolve(
    "user-a",
    ["a.jpg", "a.jpg", "b.jpg"],
    signer,
  );

  assert.deepEqual(calls, [["a.jpg", "b.jpg"]]);
  assert.equal(urls.get("a.jpg"), "a-url");
  assert.equal(urls.get("b.jpg"), null);
});

test("separate same-turn activations coalesce through the broker", async () => {
  const broker = createAlbumSignedUrlBroker();
  const calls = [];
  const signer = async (paths) => {
    calls.push(paths);
    return new Map(paths.map((path) => [path, `${path}-url`]));
  };

  const first = broker.resolve("user-a", ["a.jpg"], signer);
  const second = broker.resolve("user-a", ["b.jpg", "a.jpg"], signer);
  assert.equal((await first).get("a.jpg"), "a.jpg-url");
  assert.equal((await second).get("b.jpg"), "b.jpg-url");
  assert.deepEqual(calls, [["a.jpg", "b.jpg"]]);
});

test("signed URL broker chunks oversized activation sets", async () => {
  const broker = createAlbumSignedUrlBroker();
  const paths = Array.from(
    { length: ALBUM_SIGNED_URL_BATCH_SIZE + 3 },
    (_, index) => `${index}.jpg`,
  );
  const calls = [];
  const urls = await broker.resolve("user-a", paths, async (chunk) => {
    calls.push(chunk);
    return new Map(chunk.map((path) => [path, `${path}-url`]));
  });

  assert.deepEqual(calls.map(({ length }) => length), [
    ALBUM_SIGNED_URL_BATCH_SIZE,
    3,
  ]);
  assert.equal(urls.size, paths.length);
});

test("one failed sign marks only that photo as error", () => {
  const photos = mapPersistedPhotoRows(
    [photoRow({ id: "a" }), photoRow({ id: "b", storage_path: "b.jpg" })],
    new Map(),
    authUserId,
    new Map(),
  );
  const updated = applyAlbumPhotoSignedUrls(
    photos,
    new Map([[photos[0].storagePath, null], ["b.jpg", "b-url"]]),
  );
  assert.deepEqual(updated.map(({ mediaState }) => mediaState), ["error", "ready"]);
  assert.deepEqual(updated.map(({ signedUrl }) => signedUrl), [null, "b-url"]);
});

test("near-viewport observer activates visible targets once with 1000px overscan", () => {
  const target = {};
  let callback;
  let options;
  let observed;
  let disconnects = 0;
  let activations = 0;
  const cleanup = observeNearViewport(
    target,
    () => {
      activations += 1;
    },
    (nextCallback, nextOptions) => {
      callback = nextCallback;
      options = nextOptions;
      return {
        disconnect: () => {
          disconnects += 1;
        },
        observe: (nextTarget) => {
          observed = nextTarget;
        },
      };
    },
  );

  assert.equal(ALBUM_MEDIA_ROOT_MARGIN, "1000px 0px");
  assert.deepEqual(options, {
    root: null,
    rootMargin: ALBUM_MEDIA_ROOT_MARGIN,
    threshold: 0,
  });
  assert.equal(observed, target);
  callback([{ isIntersecting: false }]);
  callback([{ isIntersecting: true }]);
  callback([{ isIntersecting: true }]);
  assert.equal(activations, 1);
  assert.equal(disconnects, 1);
  cleanup();
  assert.equal(disconnects, 2);
});

test("near-viewport observer activates immediately when unsupported", () => {
  let activations = 0;
  const cleanup = observeNearViewport({}, () => {
    activations += 1;
  }, null);
  assert.equal(activations, 1);
  cleanup();
});

test("fresh signed URL cache hit avoids the signer and auth scopes stay isolated", async () => {
  const broker = createAlbumSignedUrlBroker();
  let calls = 0;
  const signer = async () => new Map([["a.jpg", `url-${++calls}`]]);

  assert.equal((await broker.resolve("user-a", ["a.jpg"], signer)).get("a.jpg"), "url-1");
  assert.equal((await broker.resolve("user-a", ["a.jpg"], signer)).get("a.jpg"), "url-1");
  assert.equal((await broker.resolve("user-b", ["a.jpg"], signer)).get("a.jpg"), "url-2");
  assert.equal(calls, 2);
});

test("signed URL cache refreshes inside the expiry safety window", async () => {
  let now = 0;
  const broker = createAlbumSignedUrlBroker(() => now);
  let calls = 0;
  const signer = async () => new Map([["a.jpg", `url-${++calls}`]]);

  await broker.resolve("user-a", ["a.jpg"], signer);
  now = 3600 * 1000 - ALBUM_SIGNED_URL_REFRESH_SAFETY_MS;
  assert.equal((await broker.resolve("user-a", ["a.jpg"], signer)).get("a.jpg"), "url-2");
});

test("first-view and observer requests share one in-flight signing operation", async () => {
  const broker = createAlbumSignedUrlBroker();
  let release;
  let calls = 0;
  const signed = new Promise((resolve) => {
    release = resolve;
  });
  const signer = async () => {
    calls += 1;
    return signed;
  };
  const first = broker.resolve("user-a", ["a.jpg"], signer);
  const second = broker.resolve("user-a", ["a.jpg"], signer);
  await Promise.resolve();
  release(new Map([["a.jpg", "shared-url"]]));

  assert.equal((await first).get("a.jpg"), "shared-url");
  assert.equal((await second).get("a.jpg"), "shared-url");
  assert.equal(calls, 1);
});

test("signed URL invalidation forces a refresh", async () => {
  const broker = createAlbumSignedUrlBroker();
  let calls = 0;
  const signer = async () => new Map([["a.jpg", `url-${++calls}`]]);

  await broker.resolve("user-a", ["a.jpg"], signer);
  broker.invalidate("user-a", "a.jpg");
  assert.equal((await broker.resolve("user-a", ["a.jpg"], signer)).get("a.jpg"), "url-2");
});

test("near-viewport shells exist before URLs and hydration is retry-safe", async () => {
  const [visibility, albumView, cardPreview, cardsView] = await Promise.all([
    readFile(new URL("./album-media-visibility.tsx", import.meta.url), "utf8"),
    readFile(new URL("./album-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../cards/memory-card-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../cards/memory-cards-view.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(visibility, /observeNearViewport\(node/);
  assert.match(visibility, /setIsNearViewport\(true\)/);
  assert.match(visibility, /if \(!isNearViewport \|\| signedUrl\) return/);
  assert.match(visibility, /loadAlbumPhotoSignedUrls\(\[photo\.storagePath\]\)/);
  assert.doesNotMatch(visibility, /requestedPath/);
  assert.match(albumView, /<div\s+ref=\{observe\}[\s\S]*mediaState === "ready"/);
  assert.match(cardPreview, /<span\s+ref=\{observe\}[\s\S]*mediaState === "ready"/);
  assert.match(cardsView, /<span ref=\{observe\}[\s\S]*mediaState === "ready"/);
  assert.match(albumView, /loading="eager"[\s\S]*decoding="async"/);
  assert.match(cardPreview, /loading="eager"[\s\S]*decoding="async"/);
  assert.match(cardsView, /loading="eager"[\s\S]*decoding="async"/);
  assert.doesNotMatch([albumView, cardPreview, cardsView].join("\n"), /loading="lazy"/);
  assert.match(albumView, /slice\(0, ALBUM_HIGH_PRIORITY_MEDIA_COUNT\)/);
  assert.match(albumView, /fetchPriority=\{highPriorityPhotoIds\.has\(photo\.id\)/);
  assert.match(cardsView, /getFirstViewFetchPriority\([\s\S]*CARDS_HIGH_PRIORITY_MEDIA_COUNT/);
  assert.doesNotMatch(cardPreview, /fetchPriority="high"/);
  for (const source of [albumView, cardPreview, cardsView]) {
    assert.match(source, /width=\{photo\.width \?\? undefined\}/);
    assert.match(source, /height=\{photo\.height \?\? undefined\}/);
  }
});

test("Album and Cards prewarm only bounded first-view candidates through the broker", async () => {
  const [albumView, cardsView] = await Promise.all([
    readFile(new URL("./album-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../cards/memory-cards-view.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(albumView, /getInitialMediaPrewarmCandidates\([\s\S]*ALBUM_INITIAL_MEDIA_PREWARM_COUNT[\s\S]*loadAlbumPhotoSignedUrls\(/);
  assert.match(cardsView, /getInitialMediaPrewarmCandidates\([\s\S]*CARDS_INITIAL_MEDIA_PREWARM_COUNT[\s\S]*loadAlbumPhotoSignedUrls\(/);
  assert.doesNotMatch(albumView, /loadAlbumPhotoSignedUrls\(\s*displayedPhotos\.map/);
  assert.doesNotMatch(cardsView, /loadAlbumPhotoSignedUrls\(\s*albumPhotos\.map/);
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
  assert.match(source, /createSignedUrls/);
  assert.match(source, /for \(const \[index, item\] of data\.entries\(\)\)/);
  assert.match(source, /requireBatchedAuthUserId/);
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
