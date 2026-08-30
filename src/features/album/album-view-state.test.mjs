import assert from "node:assert/strict";
import test from "node:test";
import {
  UNKNOWN_UPLOADER_LABEL,
  filterAlbumPhotos,
  getAlbumUploaderOptions,
  groupAlbumPhotosByUploader,
  resolveAlbumUploaderFilter,
  sortAlbumPhotos,
} from "./album-view-state.ts";

test("uploader options use member IDs, aggregate counts, and order deterministically", () => {
  const photos = [
    photo("a-old", "member-a", "같은 이름", "2026-09-11T01:00:00Z"),
    photo("b-new", "member-b", "같은 이름", "2026-09-11T03:00:00Z"),
    photo("a-new", "member-a", "같은 이름", "2026-09-11T02:00:00Z"),
    photo("c-new", "member-c", null, "2026-09-11T03:00:00Z"),
  ];

  assert.deepEqual(getAlbumUploaderOptions(photos), [
    { memberId: "member-b", label: "같은 이름", count: 1 },
    { memberId: "member-c", label: UNKNOWN_UPLOADER_LABEL, count: 1 },
    { memberId: "member-a", label: "같은 이름", count: 2 },
  ]);
});

test("filter uses uploader member ID rather than display name", () => {
  const photos = [
    photo("a", "member-a", "같은 이름", "2026-09-11T01:00:00Z"),
    photo("b", "member-b", "같은 이름", "2026-09-11T02:00:00Z"),
  ];

  assert.deepEqual(filterAlbumPhotos(photos, null), photos);
  assert.deepEqual(
    filterAlbumPhotos(photos, "member-b").map(({ id }) => id),
    ["b"],
  );
  assert.deepEqual(filterAlbumPhotos(photos, "같은 이름"), []);
});

test("sort handles both directions, equal and malformed timestamps without mutation", () => {
  const photos = [
    photo("z", "member-a", "A", "not-a-timestamp"),
    photo("b", "member-a", "A", "2026-09-11T02:00:00Z"),
    photo("a", "member-a", "A", "2026-09-11T02:00:00Z"),
    photo("old", "member-a", "A", "2026-09-11T01:00:00Z"),
  ];

  assert.deepEqual(
    sortAlbumPhotos(photos, "newest").map(({ id }) => id),
    ["a", "b", "old", "z"],
  );
  assert.deepEqual(
    sortAlbumPhotos(photos, "oldest").map(({ id }) => id),
    ["old", "a", "b", "z"],
  );
  assert.deepEqual(photos.map(({ id }) => id), ["z", "b", "a", "old"]);
});

test("groups remain member-ID distinct and follow active photo and group sort", () => {
  const photos = [
    photo("a-old", "member-a", "같은 이름", "2026-09-11T01:00:00Z"),
    photo("b-new", "member-b", "같은 이름", "2026-09-11T03:00:00Z"),
    photo("a-new", "member-a", "같은 이름", "2026-09-11T02:00:00Z"),
  ];

  const newestGroups = groupAlbumPhotosByUploader(photos, "newest");
  assert.deepEqual(
    newestGroups.map(({ memberId, count }) => [memberId, count]),
    [["member-b", 1], ["member-a", 2]],
  );
  assert.deepEqual(newestGroups[1].photos.map(({ id }) => id), ["a-new", "a-old"]);

  const oldestGroups = groupAlbumPhotosByUploader(photos, "oldest");
  assert.deepEqual(oldestGroups.map(({ memberId }) => memberId), [
    "member-a",
    "member-b",
  ]);

  const filteredGroups = groupAlbumPhotosByUploader(
    filterAlbumPhotos(photos, "member-a"),
    "oldest",
  );
  assert.equal(filteredGroups.length, 1);
  assert.deepEqual(filteredGroups[0].photos.map(({ id }) => id), ["a-old", "a-new"]);
});

test("uploads join the active derived view and a deleted last uploader is detectable", () => {
  const original = photo("a-old", "member-a", "A", "2026-09-11T01:00:00Z");
  const otherUpload = photo("b-new", "member-b", "B", "2026-09-11T03:00:00Z");
  const selectedUpload = photo("a-new", "member-a", "A", "2026-09-11T02:00:00Z");
  const afterUploads = [otherUpload, selectedUpload, original];

  const visible = filterAlbumPhotos(afterUploads, "member-a");
  assert.deepEqual(sortAlbumPhotos(visible, "newest").map(({ id }) => id), [
    "a-new",
    "a-old",
  ]);
  assert.deepEqual(
    groupAlbumPhotosByUploader(visible, "newest")[0].photos.map(({ id }) => id),
    ["a-new", "a-old"],
  );
  assert.equal(resolveAlbumUploaderFilter([otherUpload], "member-a"), null);
  assert.equal(
    resolveAlbumUploaderFilter(afterUploads, "member-a"),
    "member-a",
  );
});

function photo(id, uploaderMemberId, uploaderName, createdAt) {
  return { id, uploaderMemberId, uploaderName, createdAt };
}
