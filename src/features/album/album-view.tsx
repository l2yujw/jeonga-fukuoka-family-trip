"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import {
  deleteAlbumPhoto,
  downloadAlbumPhoto,
  loadAlbumPhotos,
  updateAlbumPhotoCaption,
  uploadAlbumPhoto,
} from "./album-repository";
import type { AlbumPhoto, AlbumUploadDraft } from "./album-types";
import {
  UNKNOWN_UPLOADER_LABEL,
  filterAlbumPhotos,
  getAlbumUploaderOptions,
  groupAlbumPhotosByUploader,
  resolveAlbumUploaderFilter,
  sortAlbumPhotos,
  type AlbumGroupMode,
  type AlbumSort,
} from "./album-view-state";
import {
  ALBUM_CAPTION_MAX_LENGTH,
  ALBUM_FILE_ACCEPT,
  appendAlbumUploadDrafts,
  createAlbumUploadDraft,
  createLocalPhotoDraft,
  getUploadableAlbumDrafts,
  getAlbumPhotoDownloadFilename,
  markAlbumDraftsUploading,
  partitionAlbumFiles,
  removeAlbumUploadDraft,
  runBoundedUploads,
  settleAlbumUploadDraft,
  updateAlbumUploadDraftCaption,
} from "./album-utils";

type AlbumViewProps = {
  onComposerOpenChange?: (isOpen: boolean) => void;
};

export function AlbumView({ onComposerOpenChange }: AlbumViewProps) {
  const currentTripSession = useCurrentTripSession();
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [uploaderFilter, setUploaderFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<AlbumSort>("newest");
  const [groupMode, setGroupMode] = useState<AlbumGroupMode>("flat");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [drafts, setDrafts] = useState<AlbumUploadDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    succeeded: number;
    total: number;
  } | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const selectionVersion = useRef(0);

  useEffect(() => {
    let active = true;

    loadAlbumPhotos(currentTripSession.trip.id)
      .then((loadedPhotos) => {
        if (active) {
          setPhotos(loadedPhotos);
          setUploaderFilter((current) =>
            resolveAlbumUploaderFilter(loadedPhotos, current),
          );
        }
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
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    onComposerOpenChange?.(drafts.length > 0 || isDecoding);
  }, [drafts.length, isDecoding, onComposerOpenChange]);

  const uploaderOptions = useMemo(
    () => getAlbumUploaderOptions(photos),
    [photos],
  );
  const filteredPhotos = useMemo(
    () => filterAlbumPhotos(photos, uploaderFilter),
    [photos, uploaderFilter],
  );
  const visiblePhotos = useMemo(
    () => sortAlbumPhotos(filteredPhotos, sort),
    [filteredPhotos, sort],
  );
  const photoGroups = useMemo(
    () => groupAlbumPhotosByUploader(filteredPhotos, sort),
    [filteredPhotos, sort],
  );
  const selectedUploaderLabel = uploaderFilter
    ? (uploaderOptions.find(({ memberId }) => memberId === uploaderFilter)?.label ??
      UNKNOWN_UPLOADER_LABEL)
    : "전체";
  const isFilterActive =
    uploaderFilter !== null || sort !== "newest" || groupMode !== "flat";
  const filterSummary = `${selectedUploaderLabel} · ${sort === "newest" ? "최신순" : "오래된순"} · ${groupMode === "flat" ? "전체 보기" : "올린 사람별"}`;

  const revokeUrl = (url: string) => {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  };

  const clearDrafts = () => {
    selectionVersion.current += 1;
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setDrafts([]);
    setError(null);
    setUploadProgress(null);
    setIsDecoding(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeDraft = (clientId: string) => {
    const selected = drafts.find((draft) => draft.clientId === clientId);
    if (!selected || selected.status === "uploading") return;
    if (selected.draft.previewUrl) revokeUrl(selected.draft.previewUrl);
    setDrafts((current) => removeAlbumUploadDraft(current, clientId));
    if (drafts.length === 1) {
      setError(null);
      setUploadProgress(null);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const { accepted, rejected } = partitionAlbumFiles(files);
    const selectionErrors = rejected.map(
      ({ file, error: reason }) => `${file.name || "이름 없는 파일"}: ${reason}`,
    );
    setUploadProgress(null);
    setError(selectionErrors.length ? selectionErrors.join("\n") : null);
    if (accepted.length === 0) return;

    setIsDecoding(true);
    const version = ++selectionVersion.current;
    const addedDrafts: AlbumUploadDraft[] = [];

    try {
      for (const file of accepted) {
        if (version !== selectionVersion.current) return;
        let objectUrl: string | null = null;

        try {
          const pendingDraft = createLocalPhotoDraft(file);
          objectUrl = pendingDraft.objectUrl;
          objectUrls.current.add(objectUrl);
          const nextDraft = await pendingDraft.ready;

          if (version !== selectionVersion.current) {
            revokeUrl(objectUrl);
            return;
          }
          if (!nextDraft.previewUrl) revokeUrl(objectUrl);
          addedDrafts.push(createAlbumUploadDraft(nextDraft));
        } catch {
          if (objectUrl) revokeUrl(objectUrl);
          selectionErrors.push(
            `${file.name || "이름 없는 파일"}: 사진을 준비하지 못했어요.`,
          );
        }
      }

      if (version === selectionVersion.current) {
        setDrafts((current) => appendAlbumUploadDrafts(current, addedDrafts));
        setError(selectionErrors.length ? selectionErrors.join("\n") : null);
      }
    } finally {
      if (version === selectionVersion.current) setIsDecoding(false);
    }
  };

  const addPhotos = async () => {
    if (isUploading) return;
    const uploadableDrafts = getUploadableAlbumDrafts(drafts);
    if (uploadableDrafts.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress({ completed: 0, succeeded: 0, total: uploadableDrafts.length });
    const uploadingIds = new Set(uploadableDrafts.map(({ clientId }) => clientId));
    setDrafts((current) => markAlbumDraftsUploading(current, uploadingIds));

    try {
      const results = await runBoundedUploads(
        uploadableDrafts,
        (item) =>
          uploadAlbumPhoto({
            caption: item.caption,
            draft: item.draft,
            tripSession: currentTripSession,
          }),
        3,
        (result) => {
          const succeeded = result.status === "fulfilled";
          const selected = uploadableDrafts.find(
            ({ clientId }) => clientId === result.clientId,
          );
          if (succeeded && selected?.draft.previewUrl) {
            revokeUrl(selected.draft.previewUrl);
          }
          setDrafts((current) =>
            settleAlbumUploadDraft(
              current,
              result.clientId,
              succeeded ? undefined : "업로드하지 못했어요. 다시 시도해주세요.",
            ),
          );
          setUploadProgress((current) =>
            current
              ? {
                  ...current,
                  completed: current.completed + 1,
                  succeeded: current.succeeded + Number(succeeded),
                }
              : current,
          );
        },
      );
      const uploadedPhotos = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const uploadedIds = new Set(uploadedPhotos.map(({ id }) => id));
      setPhotos((current) => [
        ...uploadedPhotos,
        ...current.filter(({ id }) => !uploadedIds.has(id)),
      ]);

      const failedCount = results.length - uploadedPhotos.length;
      if (failedCount > 0) {
        setError(
          `${results.length}장 중 ${uploadedPhotos.length}장을 업로드했어요. 실패한 ${failedCount}장은 다시 시도할 수 있어요.`,
        );
      }
    } catch {
      setDrafts((current) =>
        current.map((draft) =>
          uploadingIds.has(draft.clientId)
            ? {
                ...draft,
                status: "failed",
                error: "업로드하지 못했어요. 다시 시도해주세요.",
              }
            : draft,
        ),
      );
      setError("사진 업로드를 시작하지 못했어요. 다시 시도해주세요.");
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
      setUploaderFilter((current) =>
        resolveAlbumUploaderFilter(
          photos.filter(({ id }) => id !== photo.id),
          current,
        ),
      );
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

  const savePhoto = async (photo: AlbumPhoto) => {
    if (downloadingPhotoId) return;
    setDownloadingPhotoId(photo.id);
    setError(null);
    try {
      const blob = await downloadAlbumPhoto(photo);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getAlbumPhotoDownloadFilename(photo);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError("사진을 저장하지 못했어요. 네트워크 연결을 확인해주세요.");
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const markPhotoUnavailable = (photoId: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, signedUrl: null } : photo,
      ),
    );
  };

  const renderAlbumPhoto = (photo: AlbumPhoto) => {
    const uploaderLabel = photo.uploaderName?.trim() || UNKNOWN_UPLOADER_LABEL;
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
          <button
            type="button"
            disabled={Boolean(downloadingPhotoId)}
            onClick={() => savePhoto(photo)}
            className="tap-target mt-1 px-2 text-caption font-semibold text-accent-secondary disabled:opacity-50"
          >
            {downloadingPhotoId === photo.id ? "저장 중" : "저장"}
          </button>
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
            multiple
            className="sr-only"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={isDecoding || isUploading || isLoading}
          >
            {isDecoding
              ? "미리보기 준비 중"
              : drafts.length > 0
                ? "사진 추가"
                : "사진 올리기"}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 whitespace-pre-line rounded-md border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {uploadProgress && (
        <p aria-live="polite" className="mt-3 text-sm text-text-secondary">
          업로드 {uploadProgress.completed}/{uploadProgress.total} 완료 · 성공 {uploadProgress.succeeded}장
        </p>
      )}

      {drafts.length > 0 && (
        <Card
          className="mt-5 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-labelledby="album-composer-title"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <h2 id="album-composer-title" className="font-editorial text-lg font-semibold">
              선택한 사진 {drafts.length}장
            </h2>
            <Button
              variant="ghost"
              className="px-3"
              disabled={isDecoding || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              사진 추가
            </Button>
          </div>

          <div className="space-y-3">
            {drafts.map((item) => (
              <article
                key={item.clientId}
                className="overflow-hidden rounded-md border border-line bg-background p-3"
              >
                {item.draft.previewUrl ? (
                  <div className="overflow-hidden rounded-md bg-line/40">
                    {/* Object URLs are runtime-local and do not need Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.draft.previewUrl}
                      alt={`선택한 사진 미리보기: ${item.draft.file.name}`}
                      className="max-h-[44svh] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-line/40 px-5 text-center text-sm text-text-secondary">
                    이 브라우저에서는 미리보기를 지원하지 않지만 원본 사진은 업로드할 수 있어요.
                  </div>
                )}

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-caption text-text-secondary">
                      {item.draft.file.name}
                    </p>
                    {item.status !== "ready" && (
                      <p className={`mt-1 text-caption font-semibold ${item.status === "failed" ? "text-danger" : "text-accent-primary"}`}>
                        {item.status === "failed" ? "업로드 실패" : "업로드 중"}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-caption text-text-secondary">
                      {(item.draft.file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <button
                      type="button"
                      disabled={item.status === "uploading"}
                      onClick={() => removeDraft(item.clientId)}
                      className="tap-target mt-1 px-2 text-caption font-semibold text-danger disabled:opacity-50"
                    >
                      제거
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`album-caption-${item.clientId}`} className="text-sm font-semibold">
                      사진 설명 <span className="font-normal text-text-secondary">(선택)</span>
                    </label>
                    <span className="text-caption text-text-secondary">
                      {item.caption.length}/{ALBUM_CAPTION_MAX_LENGTH}
                    </span>
                  </div>
                  <input
                    id={`album-caption-${item.clientId}`}
                    value={item.caption}
                    maxLength={ALBUM_CAPTION_MAX_LENGTH}
                    disabled={item.status === "uploading"}
                    onChange={(event) =>
                      setDrafts((current) =>
                        updateAlbumUploadDraftCaption(
                          current,
                          item.clientId,
                          event.target.value,
                        ),
                      )
                    }
                    placeholder="이 순간을 한 줄로 남겨보세요."
                    className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4 py-3 text-sm placeholder:text-text-secondary/75"
                  />
                  {item.error && (
                    <p role="alert" className="mt-2 text-caption text-danger">
                      {item.error}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={isUploading} onClick={clearDrafts}>
              전체 취소
            </Button>
            <Button loading={isUploading} onClick={addPhotos}>
              {isUploading
                ? "업로드 중"
                : drafts.some(({ status }) => status === "failed")
                  ? "남은 사진 다시 시도"
                  : "앨범에 추가"}
            </Button>
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
            <span className="text-caption text-text-secondary">
              {uploaderFilter
                ? `${visiblePhotos.length}장 표시 중`
                : sort === "newest"
                  ? "최신순"
                  : "오래된순"}
            </span>
          )}
        </div>

        {!isLoading && !loadError && photos.length > 0 && (
          <div className="mt-4 min-w-0 overflow-hidden rounded-md border border-line/70 bg-surface/55">
            <button
              type="button"
              aria-expanded={isFilterPanelOpen}
              aria-controls="album-filter-panel"
              onClick={() => setIsFilterPanelOpen((current) => !current)}
              className="tap-target flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left"
            >
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
                분류
                {isFilterActive && (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-accent-primary"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-caption text-text-secondary">
                {filterSummary}
              </span>
              <span
                aria-hidden="true"
                className={`shrink-0 text-text-secondary transition-transform ${
                  isFilterPanelOpen ? "rotate-180" : ""
                }`}
              >
                ⌄
              </span>
            </button>

            <div
              id="album-filter-panel"
              hidden={!isFilterPanelOpen}
              className="space-y-4 border-t border-line/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-caption font-semibold text-text-secondary">
                  업로더
                </p>
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploaderFilter(null);
                      setSort("newest");
                      setGroupMode("flat");
                    }}
                    className="tap-target px-2 text-caption font-semibold text-accent-primary"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div
                role="group"
                aria-label="업로더"
                className="flex max-w-full gap-2 overflow-x-auto pb-1"
              >
                <button
                  type="button"
                  aria-pressed={uploaderFilter === null}
                  onClick={() => setUploaderFilter(null)}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                    uploaderFilter === null
                      ? "border-accent-primary bg-accent-primary text-white"
                      : "border-line bg-surface text-text-secondary"
                  }`}
                >
                  전체 {photos.length}
                </button>
                {uploaderOptions.map((option) => (
                  <button
                    key={option.memberId}
                    type="button"
                    aria-pressed={uploaderFilter === option.memberId}
                    aria-label={`${option.label} 사진 ${option.count}장 보기`}
                    onClick={() => setUploaderFilter(option.memberId)}
                    className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                      uploaderFilter === option.memberId
                        ? "border-accent-primary bg-accent-primary text-white"
                        : "border-line bg-surface text-text-secondary"
                    }`}
                  >
                    {option.label} {option.count}
                  </button>
                ))}
              </div>

              <div>
                <p
                  id="album-sort-label"
                  className="text-caption font-semibold text-text-secondary"
                >
                  정렬
                </p>
                <div
                  role="group"
                  aria-labelledby="album-sort-label"
                  className="mt-2 grid min-w-0 grid-cols-2 gap-1"
                >
                  {([
                    ["newest", "최신순"],
                    ["oldest", "오래된순"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sort === value}
                      onClick={() => setSort(value)}
                      className={`min-h-11 rounded-md border px-2 text-sm font-semibold ${
                        sort === value
                          ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                          : "border-line bg-surface text-text-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p
                  id="album-group-label"
                  className="text-caption font-semibold text-text-secondary"
                >
                  보기
                </p>
                <div
                  role="group"
                  aria-labelledby="album-group-label"
                  className="mt-2 grid min-w-0 grid-cols-2 gap-1"
                >
                  {([
                    ["flat", "전체 보기"],
                    ["uploader", "올린 사람별"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={groupMode === value}
                      onClick={() => setGroupMode(value)}
                      className={`min-h-11 rounded-md border px-2 text-sm font-semibold ${
                        groupMode === value
                          ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                          : "border-line bg-surface text-text-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
        ) : visiblePhotos.length === 0 ? (
          <EmptyState
            className="mt-4 bg-surface/55"
            title="선택한 사람이 올린 사진이 없어요."
            description="전체 사진으로 돌아가 다른 여행 장면을 확인해보세요."
            action={
              <Button variant="secondary" onClick={() => setUploaderFilter(null)}>
                전체 보기
              </Button>
            }
          />
        ) : groupMode === "flat" ? (
          <div className="mt-4 grid grid-cols-2 items-start gap-3">
            {visiblePhotos.map(renderAlbumPhoto)}
          </div>
        ) : (
          <div className="mt-5 space-y-7">
            {photoGroups.map((group) => (
              <section key={group.memberId}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 truncate text-base font-semibold">
                    {group.label}
                  </h3>
                  <span className="shrink-0 text-caption text-text-secondary">
                    {group.count}장
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 items-start gap-3">
                  {group.photos.map(renderAlbumPhoto)}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
