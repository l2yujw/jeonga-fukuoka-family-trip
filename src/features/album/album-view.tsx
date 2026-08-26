"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { demoBoardingAdapter } from "@/features/boarding/demo-adapter";
import {
  ALBUM_CAPTION_MAX_LENGTH,
  ALBUM_FILE_ACCEPT,
  createLocalPhotoDraft,
  validateAlbumFile,
} from "./demo-album-adapter";
import type { AlbumPhoto, LocalPhotoDraft } from "./album-types";

const subscribeToSession = () => () => undefined;
const readUploaderName = () => demoBoardingAdapter.readSession()?.member.name ?? null;

type AlbumViewProps = {
  onComposerOpenChange?: (isOpen: boolean) => void;
};

export function AlbumView({ onComposerOpenChange }: AlbumViewProps) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [draft, setDraft] = useState<LocalPhotoDraft | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const uploaderName = useSyncExternalStore(subscribeToSession, readUploaderName, () => null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const selectionVersion = useRef(0);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      selectionVersion.current += 1;
      urls.forEach(URL.revokeObjectURL);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (draft) captionRef.current?.focus();
  }, [draft]);

  const revokeUrl = (url: string) => {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  };

  const clearDraft = () => {
    selectionVersion.current += 1;
    if (draft) revokeUrl(draft.previewUrl);
    onComposerOpenChange?.(false);
    setDraft(null);
    setCaption("");
    setError(null);
    setIsDecoding(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateAlbumFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (draft) revokeUrl(draft.previewUrl);
    setDraft(null);
    setCaption("");
    setError(null);
    setIsDecoding(true);
    const version = ++selectionVersion.current;
    const pendingDraft = createLocalPhotoDraft(file);
    objectUrls.current.add(pendingDraft.previewUrl);

    try {
      const nextDraft = await pendingDraft.ready;
      if (version !== selectionVersion.current) {
        revokeUrl(nextDraft.previewUrl);
        return;
      }
      setDraft(nextDraft);
      onComposerOpenChange?.(true);
    } catch {
      revokeUrl(pendingDraft.previewUrl);
      if (version !== selectionVersion.current) return;
      onComposerOpenChange?.(false);
      const isHeic = file.type === "image/heic" || file.type === "image/heif";
      setError(
        isHeic
          ? "이 브라우저에서는 HEIC/HEIF 사진 미리보기를 지원하지 않아요. 현재 프로토타입에서는 JPEG, PNG 또는 WebP로 다시 선택해주세요."
          : "선택한 사진을 이 브라우저에서 미리 볼 수 없어요. 다른 사진을 선택해주세요.",
      );
    } finally {
      if (version === selectionVersion.current) setIsDecoding(false);
    }
  };

  const addPhoto = () => {
    if (!draft || !uploaderName) return;

    const photo: AlbumPhoto = {
      id: crypto.randomUUID(),
      uploaderName,
      uploaderMemberId: null,
      previewUrl: draft.previewUrl,
      originalFilename: draft.file.name,
      mimeType: draft.file.type,
      caption: caption.trim() || null,
      takenAt: null,
      width: draft.width,
      height: draft.height,
      createdAt: new Date().toISOString(),
      isOwner: true,
    };

    setPhotos((current) => [photo, ...current]);
    onComposerOpenChange?.(false);
    setDraft(null);
    setCaption("");
    setError(null);
  };

  const deletePhoto = (photo: AlbumPhoto) => {
    if (!photo.isOwner || !window.confirm("이 사진을 앨범에서 삭제할까요?")) return;
    revokeUrl(photo.previewUrl);
    setPhotos((current) => current.filter(({ id }) => id !== photo.id));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Badge tone="neutral">{photos.length}장</Badge>
        <div>
          <label htmlFor="album-photo-picker" className="sr-only">
            업로드할 사진 선택
          </label>
          <input
            ref={inputRef}
            id="album-photo-picker"
            type="file"
            accept={ALBUM_FILE_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={!uploaderName || isDecoding}
            aria-describedby={!uploaderName ? "album-session-help" : undefined}
          >
            {isDecoding ? "미리보기 준비 중" : "사진 올리기"}
          </Button>
        </div>
      </div>

      {!uploaderName && (
        <p id="album-session-help" role="status" className="mt-3 text-sm text-text-secondary">
          탑승 정보를 확인한 뒤 사진을 올릴 수 있어요.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {draft && (
        <Card className="mt-5 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-labelledby="album-composer-title">
          <div className="overflow-hidden rounded-md bg-line/40">
            {/* Object URLs are runtime-local and do not need Next image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.previewUrl}
              alt={`선택한 사진 미리보기: ${draft.file.name}`}
              className="max-h-[55svh] w-full object-contain"
            />
          </div>
          <div className="px-1 pt-4 pb-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="album-composer-title" className="font-editorial text-lg font-semibold">
                  이 사진을 앨범에 남길까요?
                </h2>
                <p className="mt-1 truncate text-caption text-text-secondary">{draft.file.name}</p>
              </div>
              <span className="shrink-0 text-caption text-text-secondary">
                {(draft.file.size / 1024 / 1024).toFixed(1)}MB
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="album-caption" className="text-sm font-semibold">
                  사진 설명 <span className="font-normal text-text-secondary">(선택)</span>
                </label>
                <span className="text-caption text-text-secondary">
                  {caption.length}/{ALBUM_CAPTION_MAX_LENGTH}
                </span>
              </div>
              <input
                ref={captionRef}
                id="album-caption"
                value={caption}
                maxLength={ALBUM_CAPTION_MAX_LENGTH}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="이 순간을 한 줄로 남겨보세요."
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-background px-4 py-3 text-sm placeholder:text-text-secondary/75"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={clearDraft}>취소</Button>
              <Button onClick={addPhoto}>앨범에 추가</Button>
            </div>
          </div>
        </Card>
      )}

      <section className="mt-8" aria-labelledby="album-photos-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-caption font-bold tracking-[0.14em] text-accent-secondary">OUR MOMENTS</p>
            <h2 id="album-photos-title" className="font-editorial mt-1 text-section font-semibold">
              여행의 장면들
            </h2>
          </div>
          {photos.length > 0 && <span className="text-caption text-text-secondary">최신순</span>}
        </div>

        {photos.length === 0 ? (
          <EmptyState
            className="mt-4 bg-surface/55"
            title="첫 번째 여행 사진을 올려보세요."
            description="함께 찍은 순간을 가족 앨범에 모아봐요."
          />
        ) : (
          <div className="mt-4 grid grid-cols-2 items-start gap-3">
            {photos.map((photo) => (
              <article key={photo.id} className="overflow-hidden rounded-lg border border-line/70 bg-surface p-1.5 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.caption ? `${photo.uploaderName}님이 올린 사진: ${photo.caption}` : `${photo.uploaderName}님이 올린 여행 사진`}
                  width={photo.width ?? undefined}
                  height={photo.height ?? undefined}
                  className="h-auto w-full rounded-md bg-line/30 object-cover"
                />
                <div className="px-2 pt-2 pb-1.5">
                  <p className="text-caption font-semibold">{photo.uploaderName}</p>
                  {photo.caption && <p className="mt-1 break-words text-sm leading-snug text-text-secondary">{photo.caption}</p>}
                  {photo.isOwner && (
                    <button
                      type="button"
                      onClick={() => deletePhoto(photo)}
                      className="tap-target -ml-2 mt-1 px-2 text-caption font-semibold text-danger"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
