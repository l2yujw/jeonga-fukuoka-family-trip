"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import {
  deleteAlbumPhoto,
  loadAlbumPhotos,
  updateAlbumPhotoCaption,
  uploadAlbumPhoto,
} from "./album-repository";
import type { AlbumPhoto, LocalPhotoDraft } from "./album-types";
import {
  ALBUM_CAPTION_MAX_LENGTH,
  ALBUM_FILE_ACCEPT,
  createLocalPhotoDraft,
  validateAlbumFile,
} from "./album-utils";

type AlbumViewProps = {
  onComposerOpenChange?: (isOpen: boolean) => void;
};

export function AlbumView({ onComposerOpenChange }: AlbumViewProps) {
  const currentTripSession = useCurrentTripSession();
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [draft, setDraft] = useState<LocalPhotoDraft | null>(null);
  const [caption, setCaption] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const selectionVersion = useRef(0);

  useEffect(() => {
    let active = true;

    loadAlbumPhotos(currentTripSession.trip.id)
      .then((loadedPhotos) => {
        if (active) setPhotos(loadedPhotos);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentTripSession.trip.id, reloadVersion]);

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
    if (draft?.previewUrl) revokeUrl(draft.previewUrl);
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

    if (draft?.previewUrl) revokeUrl(draft.previewUrl);
    setDraft(null);
    setCaption("");
    setError(null);
    setIsDecoding(true);
    const version = ++selectionVersion.current;

    try {
      const pendingDraft = createLocalPhotoDraft(file);
      objectUrls.current.add(pendingDraft.objectUrl);
      const nextDraft = await pendingDraft.ready;

      if (version !== selectionVersion.current) {
        revokeUrl(pendingDraft.objectUrl);
        return;
      }
      if (!nextDraft.previewUrl) revokeUrl(pendingDraft.objectUrl);
      setDraft(nextDraft);
      onComposerOpenChange?.(true);
    } catch {
      if (version !== selectionVersion.current) return;
      onComposerOpenChange?.(false);
      setError("사진을 준비하지 못했어요. 다시 선택해주세요.");
    } finally {
      if (version === selectionVersion.current) setIsDecoding(false);
    }
  };

  const addPhoto = async () => {
    if (!draft || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      const photo = await uploadAlbumPhoto({
        caption,
        draft,
        tripSession: currentTripSession,
      });
      setPhotos((current) => [photo, ...current.filter(({ id }) => id !== photo.id)]);
      if (draft.previewUrl) revokeUrl(draft.previewUrl);
      setDraft(null);
      setCaption("");
      onComposerOpenChange?.(false);
    } catch {
      setError("사진을 업로드하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsUploading(false);
    }
  };

  const saveCaption = async (photo: AlbumPhoto) => {
    if (!photo.isOwner || busyPhotoId) return;
    setBusyPhotoId(photo.id);
    setError(null);

    try {
      const savedCaption = await updateAlbumPhotoCaption(photo, editedCaption);
      setPhotos((current) =>
        current.map((item) =>
          item.id === photo.id ? { ...item, caption: savedCaption } : item,
        ),
      );
      setEditingId(null);
      setEditedCaption("");
    } catch {
      setError("사진 설명을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const deletePhoto = async (photo: AlbumPhoto) => {
    if (
      !photo.isOwner ||
      busyPhotoId ||
      !window.confirm("이 사진을 앨범에서 삭제할까요?")
    )
      return;

    setBusyPhotoId(photo.id);
    setError(null);
    try {
      const { storageCleanupFailed } = await deleteAlbumPhoto(photo);
      setPhotos((current) => current.filter(({ id }) => id !== photo.id));
      if (editingId === photo.id) setEditingId(null);
      if (storageCleanupFailed) {
        setError("사진은 삭제됐지만 저장소 정리가 완료되지 않았어요.");
      }
    } catch {
      setError("사진을 삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const markPhotoUnavailable = (photoId: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, signedUrl: null } : photo,
      ),
    );
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
            disabled={isDecoding || isUploading || isLoading}
          >
            {isDecoding ? "미리보기 준비 중" : "사진 올리기"}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {draft && (
        <Card
          className="mt-5 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-labelledby="album-composer-title"
        >
          {draft.previewUrl ? (
            <div className="overflow-hidden rounded-md bg-line/40">
              {/* Object URLs are runtime-local and do not need Next image optimization. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.previewUrl}
                alt={`선택한 사진 미리보기: ${draft.file.name}`}
                className="max-h-[55svh] w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-line/40 px-5 text-center text-sm text-text-secondary">
              이 브라우저에서는 미리보기를 지원하지 않지만 원본 사진은 업로드할 수 있어요.
            </div>
          )}
          <div className="px-1 pt-4 pb-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="album-composer-title"
                  className="font-editorial text-lg font-semibold"
                >
                  이 사진을 앨범에 남길까요?
                </h2>
                <p className="mt-1 truncate text-caption text-text-secondary">
                  {draft.file.name}
                </p>
              </div>
              <span className="shrink-0 text-caption text-text-secondary">
                {(draft.file.size / 1024 / 1024).toFixed(1)}MB
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="album-caption" className="text-sm font-semibold">
                  사진 설명{" "}
                  <span className="font-normal text-text-secondary">(선택)</span>
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
                disabled={isUploading}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="이 순간을 한 줄로 남겨보세요."
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-background px-4 py-3 text-sm placeholder:text-text-secondary/75"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={isUploading} onClick={clearDraft}>
                취소
              </Button>
              <Button loading={isUploading} onClick={addPhoto}>
                {isUploading ? "업로드 중" : "앨범에 추가"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <section className="mt-8" aria-labelledby="album-photos-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-caption font-bold tracking-[0.14em] text-accent-secondary">
              OUR MOMENTS
            </p>
            <h2
              id="album-photos-title"
              className="font-editorial mt-1 text-section font-semibold"
            >
              여행의 장면들
            </h2>
          </div>
          {photos.length > 0 && (
            <span className="text-caption text-text-secondary">최신순</span>
          )}
        </div>

        {isLoading ? (
          <LoadingState className="mt-4" label="가족 앨범을 불러오고 있어요" />
        ) : loadError ? (
          <EmptyState
            className="mt-4 bg-surface/55"
            title="앨범을 불러오지 못했어요."
            description="네트워크 연결을 확인하고 다시 시도해주세요."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(false);
                  setReloadVersion((value) => value + 1);
                }}
              >
                다시 시도
              </Button>
            }
          />
        ) : photos.length === 0 ? (
          <EmptyState
            className="mt-4 bg-surface/55"
            title="첫 번째 여행 사진을 올려보세요."
            description="함께 찍은 순간을 가족 앨범에 모아봐요."
          />
        ) : (
          <div className="mt-4 grid grid-cols-2 items-start gap-3">
            {photos.map((photo) => {
              const uploaderLabel = photo.uploaderName ?? "업로더 정보 없음";
              return (
                <article
                  key={photo.id}
                  className="min-w-0 overflow-hidden rounded-lg border border-line/70 bg-surface p-1.5 shadow-card"
                >
                  {photo.signedUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photo.signedUrl}
                      alt={
                        photo.caption
                          ? `${uploaderLabel}님이 올린 사진: ${photo.caption}`
                          : `${uploaderLabel}님이 올린 여행 사진`
                      }
                      width={photo.width ?? undefined}
                      height={photo.height ?? undefined}
                      onError={() => markPhotoUnavailable(photo.id)}
                      className="h-auto w-full rounded-md bg-line/30 object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center rounded-md bg-line/40 px-3 text-center text-caption text-text-secondary">
                      이 사진은 현재 브라우저에서 표시할 수 없어요.
                    </div>
                  )}
                  <div className="px-2 pt-2 pb-1.5">
                    <p className="truncate text-caption font-semibold">{uploaderLabel}</p>
                    {editingId === photo.id ? (
                      <div className="mt-2">
                        <label htmlFor={`caption-${photo.id}`} className="sr-only">
                          사진 설명 수정
                        </label>
                        <textarea
                          id={`caption-${photo.id}`}
                          value={editedCaption}
                          maxLength={ALBUM_CAPTION_MAX_LENGTH}
                          disabled={busyPhotoId === photo.id}
                          onChange={(event) => setEditedCaption(event.target.value)}
                          className="min-h-20 w-full resize-none rounded-md border border-line bg-background p-2 text-sm"
                        />
                        <p className="mt-1 text-right text-[10px] text-text-secondary">
                          {editedCaption.length}/{ALBUM_CAPTION_MAX_LENGTH}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={busyPhotoId === photo.id}
                            onClick={() => saveCaption(photo)}
                            className="tap-target px-2 text-caption font-semibold text-accent-primary disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            disabled={busyPhotoId === photo.id}
                            onClick={() => setEditingId(null)}
                            className="tap-target px-2 text-caption font-semibold text-text-secondary disabled:opacity-50"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {photo.caption && (
                          <p className="mt-1 break-words text-sm leading-snug text-text-secondary">
                            {photo.caption}
                          </p>
                        )}
                        {photo.isOwner && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={Boolean(busyPhotoId)}
                              onClick={() => {
                                setEditingId(photo.id);
                                setEditedCaption(photo.caption ?? "");
                              }}
                              className="tap-target px-2 text-caption font-semibold text-accent-primary disabled:opacity-50"
                            >
                              설명 수정
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyPhotoId)}
                              onClick={() => deletePhoto(photo)}
                              className="tap-target px-2 text-caption font-semibold text-danger disabled:opacity-50"
                            >
                              {busyPhotoId === photo.id ? "처리 중" : "삭제"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
