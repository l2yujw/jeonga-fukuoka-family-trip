import type { LocalPhotoDraft } from "./album-types";

export const ALBUM_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const ALBUM_FILE_MAX_BYTES = 15 * 1024 * 1024;
export const ALBUM_CAPTION_MAX_LENGTH = 300;

const acceptedTypes = new Set(ALBUM_FILE_ACCEPT.split(","));

export function validateAlbumFile(file: Pick<File, "size" | "type">) {
  if (file.size === 0) return "비어 있는 파일은 선택할 수 없어요.";
  if (file.size > ALBUM_FILE_MAX_BYTES)
    return "사진은 15MB 이하만 선택할 수 있어요.";
  if (!acceptedTypes.has(file.type.toLowerCase()))
    return "JPEG, PNG, WebP, HEIC, HEIF 사진만 선택할 수 있어요.";
  return null;
}

export function createLocalPhotoDraft(file: File) {
  const previewUrl = URL.createObjectURL(file);

  const ready = new Promise<LocalPhotoDraft>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        file,
        previewUrl,
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
      });
    image.onerror = () => {
      reject(new Error("preview-unsupported"));
    };
    image.src = previewUrl;
  });

  return { previewUrl, ready };
}
