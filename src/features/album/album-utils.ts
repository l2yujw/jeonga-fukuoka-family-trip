import type {
  AlbumPhoto,
  LocalPhotoDraft,
  PersistedPhotoRow,
} from "./album-types";

export const ALBUM_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const ALBUM_FILE_MAX_BYTES = 15 * 1024 * 1024;
export const ALBUM_CAPTION_MAX_LENGTH = 300;

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;

type AcceptedMimeType = keyof typeof extensionByMimeType;
const acceptedTypes = new Set(Object.keys(extensionByMimeType));

export function validateAlbumFile(file: Pick<File, "size" | "type">) {
  if (file.size === 0) return "비어 있는 파일은 선택할 수 없어요.";
  if (file.size > ALBUM_FILE_MAX_BYTES)
    return "사진은 15MB 이하만 선택할 수 있어요.";
  if (!acceptedTypes.has(file.type.toLowerCase()))
    return "JPEG, PNG, WebP, HEIC, HEIF 사진만 선택할 수 있어요.";
  return null;
}

export function createLocalPhotoDraft(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const ready = new Promise<LocalPhotoDraft>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        file,
        previewUrl: objectUrl,
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
      });
    image.onerror = () =>
      resolve({ file, previewUrl: null, width: null, height: null });
    image.src = objectUrl;
  });

  return { objectUrl, ready };
}

export function normalizeCaption(caption: string) {
  const normalized = caption.trim();
  if (normalized.length > ALBUM_CAPTION_MAX_LENGTH) {
    throw new Error("caption-too-long");
  }
  return normalized || null;
}

export function buildStoragePath(
  tripId: string,
  authUserId: string,
  mimeType: string,
  objectId = crypto.randomUUID(),
) {
  const extension = extensionByMimeType[mimeType.toLowerCase() as AcceptedMimeType];
  if (!extension) throw new Error("unsupported-photo-type");
  return `${tripId}/${authUserId}/${objectId}.${extension}`;
}

export function buildPhotoInsertPayload({
  authUserId,
  caption,
  draft,
  memberId,
  storagePath,
  tripId,
}: {
  authUserId: string;
  caption: string;
  draft: LocalPhotoDraft;
  memberId: string;
  storagePath: string;
  tripId: string;
}) {
  return {
    trip_id: tripId,
    uploader_member_id: memberId,
    uploader_auth_user_id: authUserId,
    storage_path: storagePath,
    original_filename: draft.file.name,
    mime_type: draft.file.type.toLowerCase(),
    caption: normalizeCaption(caption),
    taken_at: null,
    width: draft.width,
    height: draft.height,
  };
}

export function isPhotoOwner(row: PersistedPhotoRow, authUserId: string) {
  return row.uploader_auth_user_id === authUserId;
}

export function mapPersistedPhotoRows(
  rows: PersistedPhotoRow[],
  uploaderNames: ReadonlyMap<string, string>,
  authUserId: string,
  signedUrls: ReadonlyMap<string, string | null>,
): AlbumPhoto[] {
  return rows.map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    signedUrl: signedUrls.get(row.storage_path) ?? null,
    uploaderName: uploaderNames.get(row.uploader_member_id) ?? null,
    caption: row.caption,
    width: row.width,
    height: row.height,
    isOwner: isPhotoOwner(row, authUserId),
  }));
}
