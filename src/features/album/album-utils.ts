import type {
  AlbumPhoto,
  AlbumUploadDraft,
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

export function partitionAlbumFiles(files: readonly File[]) {
  const accepted: File[] = [];
  const rejected: { file: File; error: string }[] = [];

  for (const file of files) {
    const error = validateAlbumFile(file);
    if (error) rejected.push({ file, error });
    else accepted.push(file);
  }

  return { accepted, rejected };
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

export function createAlbumUploadDraft(
  draft: LocalPhotoDraft,
  clientId = crypto.randomUUID(),
): AlbumUploadDraft {
  return { clientId, draft, caption: "", status: "ready" };
}

export function appendAlbumUploadDrafts(
  current: readonly AlbumUploadDraft[],
  added: readonly AlbumUploadDraft[],
) {
  return [...current, ...added];
}

export function removeAlbumUploadDraft(
  drafts: readonly AlbumUploadDraft[],
  clientId: string,
) {
  return drafts.filter((draft) => draft.clientId !== clientId);
}

export function updateAlbumUploadDraftCaption(
  drafts: readonly AlbumUploadDraft[],
  clientId: string,
  caption: string,
) {
  return drafts.map((draft) =>
    draft.clientId === clientId ? { ...draft, caption } : draft,
  );
}

export function getUploadableAlbumDrafts(drafts: readonly AlbumUploadDraft[]) {
  return drafts.filter(({ status }) => status !== "uploading");
}

export function markAlbumDraftsUploading(
  drafts: readonly AlbumUploadDraft[],
  clientIds: ReadonlySet<string>,
): AlbumUploadDraft[] {
  return drafts.map((draft) =>
    clientIds.has(draft.clientId)
      ? { ...draft, status: "uploading", error: undefined }
      : draft,
  );
}

export function settleAlbumUploadDraft(
  drafts: readonly AlbumUploadDraft[],
  clientId: string,
  error?: string,
): AlbumUploadDraft[] {
  if (!error) return removeAlbumUploadDraft(drafts, clientId);
  return drafts.map((draft) =>
    draft.clientId === clientId
      ? { ...draft, status: "failed", error }
      : draft,
  );
}

export type BoundedUploadResult<Result> =
  | { clientId: string; status: "fulfilled"; value: Result }
  | { clientId: string; status: "rejected"; reason: unknown };

export async function runBoundedUploads<
  Item extends { clientId: string },
  Result,
>(
  items: readonly Item[],
  upload: (item: Item) => Promise<Result>,
  concurrency: number,
  onSettled?: (result: BoundedUploadResult<Result>) => void,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("invalid-upload-concurrency");
  }

  const results = new Array<BoundedUploadResult<Result>>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      try {
        results[index] = {
          clientId: item.clientId,
          status: "fulfilled",
          value: await upload(item),
        };
      } catch (reason) {
        results[index] = { clientId: item.clientId, status: "rejected", reason };
      }
      onSettled?.(results[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
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
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    signedUrl: signedUrls.get(row.storage_path) ?? null,
    uploaderName: uploaderNames.get(row.uploader_member_id) ?? null,
    caption: row.caption,
    width: row.width,
    height: row.height,
    isOwner: isPhotoOwner(row, authUserId),
  }));
}

export function getAlbumPhotoDownloadFilename(
  photo: Pick<AlbumPhoto, "id" | "mimeType" | "originalFilename" | "storagePath">,
) {
  const original = photo.originalFilename
    ?.split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  if (original) return original;

  const storageExtension = photo.storagePath.split(".").at(-1)?.toLowerCase();
  const extension = extensionByMimeType[
    photo.mimeType?.toLowerCase() as AcceptedMimeType
  ] ?? (/^[a-z0-9]{1,10}$/.test(storageExtension ?? "")
    ? storageExtension
    : "jpg");
  const safeId = photo.id.replace(/[^a-zA-Z0-9-]/g, "-") || "photo";
  return `fukuoka-photo-${safeId}.${extension}`;
}
