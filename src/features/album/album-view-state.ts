import type { AlbumPhoto } from "./album-types";

export type AlbumSort = "newest" | "oldest";
export type AlbumGroupMode = "flat" | "uploader";

export type AlbumUploaderOption = {
  memberId: string;
  label: string;
  count: number;
};

export type AlbumPhotoGroup = AlbumUploaderOption & {
  photos: AlbumPhoto[];
};

export const UNKNOWN_UPLOADER_LABEL = "업로더 정보 없음";

function compareIds(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCreatedAt(left: string, right: string, sort: AlbumSort) {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);
  const leftIsValid = Number.isFinite(leftTimestamp);
  const rightIsValid = Number.isFinite(rightTimestamp);

  if (leftIsValid !== rightIsValid) return leftIsValid ? -1 : 1;
  if (!leftIsValid || leftTimestamp === rightTimestamp) return 0;
  return sort === "newest"
    ? rightTimestamp - leftTimestamp
    : leftTimestamp - rightTimestamp;
}

function getUploaderLabel(photos: readonly AlbumPhoto[]) {
  return (
    photos.find(({ uploaderName }) => uploaderName?.trim())?.uploaderName?.trim() ??
    UNKNOWN_UPLOADER_LABEL
  );
}

export function sortAlbumPhotos(
  photos: readonly AlbumPhoto[],
  sort: AlbumSort,
) {
  return [...photos].sort(
    (left, right) =>
      compareCreatedAt(left.createdAt, right.createdAt, sort) ||
      compareIds(left.id, right.id),
  );
}

export function filterAlbumPhotos(
  photos: readonly AlbumPhoto[],
  uploaderMemberId: string | null,
) {
  return uploaderMemberId
    ? photos.filter((photo) => photo.uploaderMemberId === uploaderMemberId)
    : [...photos];
}

export function groupAlbumPhotosByUploader(
  photos: readonly AlbumPhoto[],
  sort: AlbumSort,
): AlbumPhotoGroup[] {
  const byUploader = new Map<string, AlbumPhoto[]>();

  for (const photo of photos) {
    const group = byUploader.get(photo.uploaderMemberId) ?? [];
    group.push(photo);
    byUploader.set(photo.uploaderMemberId, group);
  }

  return [...byUploader.entries()]
    .map(([memberId, groupPhotos]) => {
      const sortedPhotos = sortAlbumPhotos(groupPhotos, sort);
      return {
        memberId,
        label: getUploaderLabel(sortedPhotos),
        count: sortedPhotos.length,
        photos: sortedPhotos,
      };
    })
    .sort(
      (left, right) =>
        compareCreatedAt(
          left.photos[0].createdAt,
          right.photos[0].createdAt,
          sort,
        ) || compareIds(left.memberId, right.memberId),
    );
}

export function getAlbumUploaderOptions(
  photos: readonly AlbumPhoto[],
): AlbumUploaderOption[] {
  return groupAlbumPhotosByUploader(photos, "newest").map(
    ({ memberId, label, count }) => ({ memberId, label, count }),
  );
}

export function resolveAlbumUploaderFilter(
  photos: readonly AlbumPhoto[],
  uploaderMemberId: string | null,
) {
  return uploaderMemberId &&
    photos.some((photo) => photo.uploaderMemberId === uploaderMemberId)
    ? uploaderMemberId
    : null;
}
