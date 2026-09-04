"use client";

import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Button, Card, EmptyState, LoadingState } from "@/components/ui";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import {
  deleteAlbumPhoto,
  downloadAlbumPhoto,
  loadAlbumPhotoMetadata,
  loadAlbumPhotoSignedUrls,
  updateAlbumPhotoCaption,
  uploadAlbumPhoto,
} from "./album-repository";
import {
  ALBUM_HIGH_PRIORITY_MEDIA_COUNT,
  ALBUM_INITIAL_MEDIA_PREWARM_COUNT,
  getInitialMediaPrewarmCandidates,
} from "./album-media-observer";
import {
  useNearViewportPhoto,
  type AlbumPhotoMediaChange,
} from "./album-media-visibility";
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
  applyAlbumPhotoSignedUrls,
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
  updateAlbumPhotoMedia,
  updateAlbumUploadDraftCaption,
} from "./album-utils";

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7.5 18.5H6a4.5 4.5 0 0 1-.6-8.96A6.5 6.5 0 0 1 18.1 8.1a5 5 0 0 1-.6 9.96h-1" />
      <path d="m8.5 11.5 3.5-3.5 3.5 3.5M12 8v11" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3.5 5h17l-6.4 7.1v5.8l-4.2 2v-7.8L3.5 5Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AlbumHeroBotanical() {
  return (
    // Protected decorative crop; all Album copy and controls remain live DOM.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/api/album-asset/Jeonga_Fukuoka_Album_TopFloral_v1.png"
      alt=""
      aria-hidden="true"
      className="album-hero-botanical"
      draggable={false}
      width={220}
      height={145}
    />
  );
}

function AlbumMomentsBotanical() {
  return (
    // Protected decorative crop; filter and gallery remain live DOM.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/api/album-asset/Jeonga_Fukuoka_Album_OurMomentsGarden_v1.png"
      alt=""
      aria-hidden="true"
      className="album-moments-botanical"
      draggable={false}
      width={281}
      height={168}
    />
  );
}

const AlbumPhotoMedia = memo(function AlbumPhotoMedia({
  alt,
  fetchPriority,
  onMediaChange,
  photo,
}: {
  alt: string;
  fetchPriority: "high" | "auto";
  onMediaChange: AlbumPhotoMediaChange;
  photo: AlbumPhoto;
}) {
  const { mediaState, observe, onError, signedUrl } = useNearViewportPhoto(
    photo,
    onMediaChange,
  );

  return (
    <div
      ref={observe}
      className="album-photo-media"
      style={{
        aspectRatio: photo.width && photo.height
          ? `${photo.width} / ${photo.height}`
          : "4 / 5",
      }}
    >
      {mediaState === "ready" && signedUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={signedUrl}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchPriority={fetchPriority}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          onError={onError}
          className="size-full object-cover"
        />
      ) : mediaState === "error" ? (
        "이 사진은 현재 브라우저에서 표시할 수 없어요."
      ) : (
        <span className="sr-only">사진 불러오는 중</span>
      )}
    </div>
  );
});

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
  const filterRef = useRef<HTMLDivElement>(null);
  const filterSummaryRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const selectionVersion = useRef(0);

  useEffect(() => {
    let active = true;

    loadAlbumPhotoMetadata(currentTripSession.trip.id)
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

  useEffect(() => {
    if (!isFilterPanelOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setIsFilterPanelOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsFilterPanelOpen(false);
      filterSummaryRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFilterPanelOpen]);

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
  const displayedPhotos = useMemo(
    () => groupMode === "flat"
      ? visiblePhotos
      : photoGroups.flatMap(({ photos: groupPhotos }) => groupPhotos),
    [groupMode, photoGroups, visiblePhotos],
  );
  const highPriorityPhotoIds = new Set(
    displayedPhotos
      .slice(0, ALBUM_HIGH_PRIORITY_MEDIA_COUNT)
      .map(({ id }) => id),
  );
  const selectedUploaderLabel = uploaderFilter
    ? (uploaderOptions.find(({ memberId }) => memberId === uploaderFilter)?.label ??
      UNKNOWN_UPLOADER_LABEL)
    : "전체";
  const isFilterActive =
    uploaderFilter !== null || sort !== "newest" || groupMode !== "flat";
  const filterSummary = `${selectedUploaderLabel} · ${sort === "newest" ? "최신순" : "오래된순"} · ${groupMode === "flat" ? "전체 보기" : "올린 사람별"}`;
  const tripDateLabel = `${currentTripSession.trip.startDate.replaceAll("-", ".")} - ${currentTripSession.trip.endDate.slice(5).replace("-", ".")}`;

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

  const handlePhotoMediaChange = useCallback<AlbumPhotoMediaChange>((
    photoId,
    mediaState,
    signedUrl,
  ) => {
    setPhotos((current) => updateAlbumPhotoMedia(
      current,
      photoId,
      mediaState,
      signedUrl,
    ));
  }, []);

  useEffect(() => {
    const candidates = getInitialMediaPrewarmCandidates(
      displayedPhotos,
      ALBUM_INITIAL_MEDIA_PREWARM_COUNT,
    );
    if (candidates.length === 0) return;

    void loadAlbumPhotoSignedUrls(
      candidates.map(({ storagePath }) => storagePath),
    ).then(
      (signedUrls) => setPhotos((current) =>
        applyAlbumPhotoSignedUrls(current, signedUrls)),
      () => setPhotos((current) => applyAlbumPhotoSignedUrls(
        current,
        new Map(candidates.map(({ storagePath }) => [storagePath, null])),
      )),
    );
  }, [displayedPhotos]);

  const renderAlbumPhoto = (photo: AlbumPhoto) => {
    const uploaderLabel = photo.uploaderName?.trim() || UNKNOWN_UPLOADER_LABEL;
    return (
      <article
        key={photo.id}
        className="album-photo-card"
      >
        <AlbumPhotoMedia
          photo={photo}
          onMediaChange={handlePhotoMediaChange}
          fetchPriority={highPriorityPhotoIds.has(photo.id) ? "high" : "auto"}
          alt={photo.caption
            ? `${uploaderLabel}님이 올린 사진: ${photo.caption}`
            : `${uploaderLabel}님이 올린 여행 사진`}
        />
        <div className="album-photo-copy">
          {photo.caption && (
            <p className="album-photo-caption">{photo.caption}</p>
          )}
          <p className="album-photo-meta">
            <time dateTime={photo.createdAt}>
              {photo.createdAt.slice(5, 10).replace("-", ".")}
            </time>
            <span aria-hidden="true" className="album-photo-meta-divider" />
            <span aria-hidden="true" className="album-photo-uploader-dot" />
            <span className="truncate">{uploaderLabel}</span>
          </p>

          <details className="album-photo-actions">
            <summary aria-label={`${uploaderLabel}님 사진 작업 열기`}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="19" cy="12" r="1.4" />
              </svg>
            </summary>
            <div className="album-photo-action-menu">
              <button
                type="button"
                disabled={Boolean(downloadingPhotoId)}
                onClick={() => savePhoto(photo)}
              >
                {downloadingPhotoId === photo.id ? "저장 중" : "사진 저장"}
              </button>
              {photo.isOwner && (
                <>
                  <button
                    type="button"
                    disabled={Boolean(busyPhotoId)}
                    onClick={() => {
                      setEditingId(photo.id);
                      setEditedCaption(photo.caption ?? "");
                    }}
                  >
                    설명 수정
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyPhotoId)}
                    onClick={() => deletePhoto(photo)}
                    className="album-photo-delete-action"
                  >
                    {busyPhotoId === photo.id ? "처리 중" : "삭제"}
                  </button>
                </>
              )}
            </div>
          </details>

          {editingId === photo.id && (
            <div className="album-caption-editor">
              <label htmlFor={`caption-${photo.id}`} className="sr-only">
                사진 설명 수정
              </label>
              <textarea
                id={`caption-${photo.id}`}
                value={editedCaption}
                maxLength={ALBUM_CAPTION_MAX_LENGTH}
                disabled={busyPhotoId === photo.id}
                onChange={(event) => setEditedCaption(event.target.value)}
                className="album-caption-input"
              />
              <p className="album-caption-count">
                {editedCaption.length}/{ALBUM_CAPTION_MAX_LENGTH}
              </p>
              <div className="album-caption-buttons">
                <button
                  type="button"
                  disabled={busyPhotoId === photo.id}
                  onClick={() => saveCaption(photo)}
                >
                  저장
                </button>
                <button
                  type="button"
                  disabled={busyPhotoId === photo.id}
                  onClick={() => setEditingId(null)}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderAlbumMasonry = (items: AlbumPhoto[]) => (
    <div className="album-masonry">
      {[0, 1].map((column) => (
        <div key={column} className="album-masonry-column">
          {items
            .filter((_, index) => index % 2 === column)
            .map(renderAlbumPhoto)}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <header className="album-hero">
        <AlbumHeroBotanical />
        <p className="album-hero-eyebrow">FUKUOKA · FAMILY ALBUM</p>
        <h1>함께한 사진</h1>
        <div className="album-hero-information">
          <p>가족의 추억 기록</p>
          <span
            aria-label={`${currentTripSession.trip.startDate}부터 ${currentTripSession.trip.endDate}까지`}
          >
            {tripDateLabel}
          </span>
        </div>
        <div className="album-hero-controls">
          <span className="album-photo-count">{photos.length}장</span>
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
            className="album-upload-button"
            onClick={() => inputRef.current?.click()}
            disabled={isDecoding || isUploading || isLoading}
          >
            <UploadIcon />
            {isDecoding
              ? "미리보기 준비 중"
              : drafts.length > 0
                ? "사진 추가"
                : "사진 올리기"}
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="album-inline-error"
        >
          {error}
        </p>
      )}

      {uploadProgress && (
        <p aria-live="polite" className="album-upload-progress">
          업로드 {uploadProgress.completed}/{uploadProgress.total} 완료 · 성공 {uploadProgress.succeeded}장
        </p>
      )}

      {drafts.length > 0 && (
        <Card
          className="album-composer"
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

      <section className="album-moments" aria-labelledby="album-photos-title">
        <div className="album-moments-heading">
          <div>
            <p className="album-moments-eyebrow">
              OUR MOMENTS
            </p>
            <h2
              id="album-photos-title"
            >
              여행의 장면들
            </h2>
          </div>
          <AlbumMomentsBotanical />
        </div>

        {!isLoading && !loadError && photos.length > 0 && (
          <div ref={filterRef} className="album-filter">
            <button
              ref={filterSummaryRef}
              type="button"
              aria-expanded={isFilterPanelOpen}
              aria-controls="album-filter-panel"
              onClick={() => setIsFilterPanelOpen((current) => !current)}
              className="album-filter-summary"
            >
              <FilterIcon />
              <span className="album-filter-label">
                분류
                {isFilterActive && (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-accent-primary"
                  />
                )}
              </span>
              <span className="album-filter-value">
                {filterSummary}
              </span>
              <span
                aria-hidden="true"
                className={`album-filter-chevron ${
                  isFilterPanelOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronIcon />
              </span>
            </button>

            <div
              id="album-filter-panel"
              hidden={!isFilterPanelOpen}
              className="album-filter-panel"
            >
              <div className="album-filter-panel-heading">
                <p>
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
                    className="album-filter-reset"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div
                role="group"
                aria-label="업로더"
                className="album-uploader-options"
              >
                <button
                  type="button"
                  aria-pressed={uploaderFilter === null}
                  onClick={() => setUploaderFilter(null)}
                  className="album-uploader-option"
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
                    className="album-uploader-option"
                  >
                    {option.label} {option.count}
                  </button>
                ))}
              </div>

              <div className="album-filter-groups">
                <div className="album-filter-group">
                  <p id="album-sort-label">정렬</p>
                  <div role="group" aria-labelledby="album-sort-label">
                    {([
                      ["newest", "최신순"],
                      ["oldest", "오래된순"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={sort === value}
                        onClick={() => setSort(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="album-filter-group">
                  <p id="album-group-label">보기</p>
                  <div role="group" aria-labelledby="album-group-label">
                    {([
                      ["flat", "전체"],
                      ["uploader", "사람별"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={groupMode === value}
                        onClick={() => setGroupMode(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingState className="album-gallery-state" label="가족 앨범을 불러오고 있어요" />
        ) : loadError ? (
          <EmptyState
            className="album-gallery-state"
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
            className="album-gallery-state"
            title="첫 번째 여행 사진을 올려보세요."
            description="함께 찍은 순간을 가족 앨범에 모아봐요."
          />
        ) : visiblePhotos.length === 0 ? (
          <EmptyState
            className="album-gallery-state"
            title="선택한 사람이 올린 사진이 없어요."
            description="전체 사진으로 돌아가 다른 여행 장면을 확인해보세요."
            action={
              <Button variant="secondary" onClick={() => setUploaderFilter(null)}>
                전체 보기
              </Button>
            }
          />
        ) : groupMode === "flat" ? (
          renderAlbumMasonry(visiblePhotos)
        ) : (
          <div className="album-photo-groups">
            {photoGroups.map((group) => (
              <section key={group.memberId} className="album-photo-group">
                <div className="album-photo-group-heading">
                  <h3>
                    {group.label}
                  </h3>
                  <span>
                    {group.count}장
                  </span>
                </div>
                {renderAlbumMasonry(group.photos)}
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
