"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import {
  useNearViewportPhoto,
  type AlbumPhotoMediaChange,
} from "@/features/album/album-media-visibility";
import {
  CARDS_HIGH_PRIORITY_MEDIA_COUNT,
  CARDS_INITIAL_MEDIA_PREWARM_COUNT,
  getFirstViewFetchPriority,
  getInitialMediaPrewarmCandidates,
} from "@/features/album/album-media-observer";
import {
  loadAlbumPhotoCount,
  loadAlbumPhotoMetadata,
  loadAlbumPhotoSignedUrls,
  loadAlbumPhotosByIds,
  refreshAlbumPhotoSignedUrl,
} from "@/features/album/album-repository";
import type { AlbumPhoto } from "@/features/album/album-types";
import {
  applyAlbumPhotoSignedUrls,
  mergeAlbumPhotos,
  updateAlbumPhotoMedia,
} from "@/features/album/album-utils";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import {
  DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  getMemoryCardCenteredCoverPlacement,
  getMemoryCardPhotoViewport,
  reconcileMemoryCardPhotoPlacements,
  type MemoryCardPhotoPlacement,
} from "./memory-card-photo-placement";
import { MemoryCardCropEditor } from "./memory-card-crop-editor";
import {
  downloadMemoryCardPng,
  exportMemoryCardPng,
  shareOrDownloadMemoryCardPng,
} from "./memory-card-export";
import {
  getMemoryCardTemplate,
  getMemoryCardReferencedPhotoIds,
  getMemoryCardRenderPhotoIds,
  getMinimumMemoryCardPhotoCount,
  getRandomPhotoCount,
  MEMORY_CARD_TEMPLATES,
  normalizeMemoryCardCaption,
  randomFillPhotoIds,
  reshuffleMemoryCardLayout,
  type MemoryCard,
  type MemoryCardLayoutV3,
  type MemoryCardRenderModel,
  type MemoryCardTemplateKey,
} from "./memory-card";
import {
  createMemoryCard,
  deleteMemoryCard,
  loadMemoryCards,
} from "./memory-card-repository";
import { MemoryCardPreview } from "./memory-card-preview";
import type { MemoryCardPhotoSlot } from "./memory-card-template-spec";

type ComposerStep = "template" | "photos" | "preview";
type ExportAction = "download" | "share";

const createdAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function templatePhotoCountLabel(min: number, max: number) {
  return min === max ? `사진 ${min}장` : `사진 ${min}–${max}장`;
}

const minimumPhotoCount = getMinimumMemoryCardPhotoCount();

type PhotoDraft = {
  photoIds: string[];
  placementBySlotId: Record<string, MemoryCardPhotoPlacement>;
};

function getDefaultMemoryCardPhotoPlacement(
  photo: AlbumPhoto | undefined,
  slot: MemoryCardPhotoSlot | undefined,
) {
  if (!photo?.width || !photo.height || !slot) {
    return { ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT };
  }
  const viewport = getMemoryCardPhotoViewport(slot);
  return getMemoryCardCenteredCoverPlacement(
    photo.width,
    photo.height,
    viewport.width,
    viewport.height,
  );
}

const ComposerPhotoThumbnail = memo(function ComposerPhotoThumbnail({
  fetchPriority,
  onMediaChange,
  photo,
}: {
  fetchPriority: "high" | "auto";
  onMediaChange: AlbumPhotoMediaChange;
  photo: AlbumPhoto;
}) {
  const { mediaState, observe, onError, signedUrl } = useNearViewportPhoto(
    photo,
    onMediaChange,
  );

  return (
    <span ref={observe} className="flex size-full items-center justify-center px-2 text-[10px] text-text-secondary">
      {mediaState === "ready" && signedUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={signedUrl}
          alt={photo.caption ?? "앨범 여행 사진"}
          loading="eager"
          decoding="async"
          fetchPriority={fetchPriority}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          onError={onError}
          className="size-full object-cover object-center"
        />
      ) : mediaState === "error" ? (
        "표시할 수 없는 사진"
      ) : (
        <span className="sr-only">사진 불러오는 중</span>
      )}
    </span>
  );
});

export function MemoryCardsView() {
  const tripSession = useCurrentTripSession();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [albumPhotoCount, setAlbumPhotoCount] = useState(0);
  const [composerPhotosLoaded, setComposerPhotosLoaded] = useState(false);
  const [isLoadingComposerPhotos, setIsLoadingComposerPhotos] = useState(false);
  const [composerStep, setComposerStep] = useState<ComposerStep | null>(null);
  const [templateKey, setTemplateKey] = useState<MemoryCardTemplateKey | null>(null);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft>({
    photoIds: [],
    placementBySlotId: {},
  });
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [cardCaption, setCardCaption] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [cropPhotoReadyKey, setCropPhotoReadyKey] = useState<string | null>(null);
  const [cropPhotoFailedKey, setCropPhotoFailedKey] = useState<string | null>(null);
  const [cropRefreshVersion, setCropRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [loadedCards, photoCount] = await Promise.all([
          loadMemoryCards(tripSession.trip.id),
          loadAlbumPhotoCount(tripSession.trip.id),
        ]);
        const referencedPhotoIds = getMemoryCardReferencedPhotoIds(loadedCards);
        const referencedPhotos = await loadAlbumPhotosByIds(
          tripSession.trip.id,
          referencedPhotoIds,
        );
        const signedUrls = await loadAlbumPhotoSignedUrls(
          referencedPhotos.map(({ storagePath }) => storagePath),
        );
        if (!active) return;
        setCards(loadedCards);
        setAlbumPhotoCount(photoCount);
        setPhotos(applyAlbumPhotoSignedUrls(referencedPhotos, signedUrls));
        setComposerPhotosLoaded(false);
        setLoadError(false);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadVersion, tripSession.trip.id]);

  const template = templateKey ? getMemoryCardTemplate(templateKey) : null;
  const selectedPhotoIds = photoDraft.photoIds;
  const draftLayout = useMemo<MemoryCardLayoutV3 | null>(() => {
    if (!template) return null;
    return {
      version: 3,
      slots: selectedPhotoIds.map((photoId, index) => ({
        slotId: template.slots[index].id,
        photoId,
        placement: {
          ...(photoDraft.placementBySlotId[template.slots[index].id] ??
            getDefaultMemoryCardPhotoPlacement(
              photos.find(({ id }) => id === photoId),
              template.slots[index],
            )),
        },
      })),
      caption: normalizeMemoryCardCaption(cardCaption),
    };
  }, [cardCaption, photoDraft.placementBySlotId, photos, selectedPhotoIds, template]);
  const draftRenderModel = useMemo<MemoryCardRenderModel | null>(() =>
    draftLayout
      ? { kind: "canonical", layoutVersion: 3, layout: draftLayout }
      : null,
  [draftLayout]);
  const selectedSlot = draftLayout?.slots.find(
    ({ slotId }) => slotId === selectedSlotId,
  ) ?? null;
  const selectedSlotIndex = selectedSlot
    ? draftLayout?.slots.findIndex(({ slotId }) => slotId === selectedSlot.slotId) ?? -1
    : -1;
  const selectedTemplateSlot = selectedSlotIndex >= 0
    ? template?.slots[selectedSlotIndex] ?? null
    : null;
  const selectedPhoto = selectedSlot
    ? photos.find(({ id }) => id === selectedSlot.photoId) ?? null
    : null;
  const selectedCropKey = selectedSlot
    ? `${selectedSlot.slotId}:${selectedSlot.photoId}`
    : null;
  const selectedPhotoId = selectedPhoto?.id ?? null;
  const selectedPhotoStoragePath = selectedPhoto?.storagePath ?? null;
  const canPreview = Boolean(
    template &&
    selectedPhotoIds.length >= template.acceptedMin &&
    selectedPhotoIds.length <= template.acceptedMax,
  );
  const remainingCount = Math.max(
    0,
    (template?.acceptedMin ?? 0) - selectedPhotoIds.length,
  );
  const dateLabel = `${tripSession.trip.startDate.replaceAll("-", ".")} – ${tripSession.trip.endDate.replaceAll("-", ".")}`;

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
    if (!selectedCropKey || !selectedPhotoId || !selectedPhotoStoragePath) return;
    let active = true;
    queueMicrotask(() => {
      if (active) handlePhotoMediaChange(selectedPhotoId, "loading");
    });
    const request = cropRefreshVersion > 0
      ? refreshAlbumPhotoSignedUrl(selectedPhotoStoragePath)
      : loadAlbumPhotoSignedUrls([selectedPhotoStoragePath]).then(
          (urls) => urls.get(selectedPhotoStoragePath) ?? null,
        );
    void request.then(
      (signedUrl) => {
        if (!active) return;
        if (signedUrl) {
          handlePhotoMediaChange(selectedPhotoId, "ready", signedUrl);
          setCropPhotoReadyKey(selectedCropKey);
          setCropPhotoFailedKey(null);
        } else {
          handlePhotoMediaChange(selectedPhotoId, "error");
          setCropPhotoReadyKey(null);
          setCropPhotoFailedKey(selectedCropKey);
        }
      },
      () => {
        if (!active) return;
        handlePhotoMediaChange(selectedPhotoId, "error");
        setCropPhotoReadyKey(null);
        setCropPhotoFailedKey(selectedCropKey);
      },
    );
    return () => {
      active = false;
    };
  }, [
    cropRefreshVersion,
    handlePhotoMediaChange,
    selectedCropKey,
    selectedPhotoId,
    selectedPhotoStoragePath,
  ]);

  const openComposer = async () => {
    if (isLoadingComposerPhotos) return;
    if (composerPhotosLoaded) {
      setComposerStep("template");
      return;
    }

    setIsLoadingComposerPhotos(true);
    setError(null);
    try {
      const albumPhotos = await loadAlbumPhotoMetadata(tripSession.trip.id);
      const firstViewPhotos = getInitialMediaPrewarmCandidates(
        albumPhotos,
        CARDS_INITIAL_MEDIA_PREWARM_COUNT,
      );
      setPhotos((current) => mergeAlbumPhotos(albumPhotos, current));
      setAlbumPhotoCount(albumPhotos.length);
      setComposerPhotosLoaded(true);
      setComposerStep("template");
      void loadAlbumPhotoSignedUrls(
        firstViewPhotos.map(({ storagePath }) => storagePath),
      ).then(
        (signedUrls) => setPhotos((current) =>
          applyAlbumPhotoSignedUrls(current, signedUrls)),
        () => setPhotos((current) => applyAlbumPhotoSignedUrls(
          current,
          new Map(firstViewPhotos.map(({ storagePath }) => [storagePath, null])),
        )),
      );
    } catch {
      setError("앨범 사진을 불러오지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsLoadingComposerPhotos(false);
    }
  };

  const closeComposer = () => {
    setComposerStep(null);
    setTemplateKey(null);
    setPhotoDraft({ photoIds: [], placementBySlotId: {} });
    setSelectedSlotId(null);
    setCropPhotoReadyKey(null);
    setCropPhotoFailedKey(null);
    setCropRefreshVersion(0);
    setCardCaption("");
    setError(null);
  };

  const selectSlotForCrop = (slotId: string | null) => {
    setCropPhotoReadyKey(null);
    setCropPhotoFailedKey(null);
    setCropRefreshVersion(0);
    setSelectedSlotId(slotId);
  };

  const selectTemplate = (nextTemplateKey: MemoryCardTemplateKey) => {
    const nextTemplate = getMemoryCardTemplate(nextTemplateKey);
    if (!nextTemplate || photos.length < nextTemplate.acceptedMin) return;
    setTemplateKey(nextTemplateKey);
    setPhotoDraft({ photoIds: [], placementBySlotId: {} });
    setSelectedSlotId(null);
    setComposerStep("photos");
    setError(null);
  };

  const togglePhoto = (photoId: string) => {
    if (!template) return;
    setPhotoDraft((current) => {
      const nextPhotoIds = current.photoIds.includes(photoId)
        ? current.photoIds.filter((id) => id !== photoId)
        : current.photoIds.length >= template.acceptedMax
          ? current.photoIds
          : [...current.photoIds, photoId];
      return {
        photoIds: nextPhotoIds,
        placementBySlotId: reconcileMemoryCardPhotoPlacements(
          template.slots.map(({ id }) => id),
          current.photoIds,
          nextPhotoIds,
          current.placementBySlotId,
          (nextPhotoId, index) => getDefaultMemoryCardPhotoPlacement(
            photos.find(({ id }) => id === nextPhotoId),
            template.slots[index],
          ),
        ),
      };
    });
  };

  const fillRandomly = () => {
    if (!templateKey || !template) return;
    setPhotoDraft((current) => {
      const nextPhotoIds = randomFillPhotoIds(
        photos.map(({ id }) => id),
        getRandomPhotoCount(templateKey, photos.length),
      );
      return {
        photoIds: nextPhotoIds,
        placementBySlotId: reconcileMemoryCardPhotoPlacements(
          template.slots.map(({ id }) => id),
          current.photoIds,
          nextPhotoIds,
          current.placementBySlotId,
          (nextPhotoId, index) => getDefaultMemoryCardPhotoPlacement(
            photos.find(({ id }) => id === nextPhotoId),
            template.slots[index],
          ),
        ),
      };
    });
  };

  const reshuffle = () => {
    if (!templateKey || !template || !draftLayout) return;
    const reshuffled = reshuffleMemoryCardLayout(
      templateKey,
      draftLayout,
      photos.map(({ id }) => id),
    );
    const nextPhotoIds = reshuffled.slots.map(({ photoId }) => photoId);
    setPhotoDraft({
      photoIds: nextPhotoIds,
      placementBySlotId: reconcileMemoryCardPhotoPlacements(
        template.slots.map(({ id }) => id),
        photoDraft.photoIds,
        nextPhotoIds,
        photoDraft.placementBySlotId,
        (nextPhotoId, index) => getDefaultMemoryCardPhotoPlacement(
          photos.find(({ id }) => id === nextPhotoId),
          template.slots[index],
        ),
      ),
    });
  };

  const updateSelectedPlacement = (
    placement: MemoryCardPhotoPlacement,
  ) => {
    if (!selectedSlot) return;
    setPhotoDraft((current) => {
      return {
        ...current,
        placementBySlotId: {
          ...current.placementBySlotId,
          [selectedSlot.slotId]: { ...placement },
        },
      };
    });
  };

  const saveCard = async () => {
    if (!templateKey || !canPreview || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const saved = await createMemoryCard({
        availablePhotoIds: photos.map(({ id }) => id),
        layout: draftLayout!,
        templateKey,
        tripSession,
      });
      setCards((current) => [saved, ...current]);
      closeComposer();
    } catch {
      setError("추억 카드를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportCard = async (
    key: string,
    action: ExportAction,
    exportTemplateKey: MemoryCardTemplateKey,
    renderModel: MemoryCardRenderModel,
  ) => {
    if (exportingKey) return;
    setExportingKey(`${key}-${action}`);
    setError(null);
    try {
      const requiredPhotoIds = getMemoryCardRenderPhotoIds(renderModel);
      const requiredPhotoIdSet = new Set(requiredPhotoIds);
      const requiredPhotos = photos.filter(({ id }) => requiredPhotoIdSet.has(id));
      const signedUrls = await loadAlbumPhotoSignedUrls(
        requiredPhotos.map(({ storagePath }) => storagePath),
      );
      const hydratedRequiredPhotos = applyAlbumPhotoSignedUrls(
        requiredPhotos,
        signedUrls,
      );
      const hydratedPhotos = applyAlbumPhotoSignedUrls(photos, signedUrls);
      setPhotos((current) => mergeAlbumPhotos(current, hydratedRequiredPhotos));
      if (
        requiredPhotoIds.some(
          (photoId) => !hydratedPhotos.find(({ id }) => id === photoId)?.signedUrl,
        )
      ) {
        throw new Error("memory-card-export-photo-unavailable");
      }
      const blob = await exportMemoryCardPng({
        templateKey: exportTemplateKey,
        renderModel,
        photos: hydratedPhotos,
        dateLabel,
      });
      const filename = `fukuoka-memory-card-${exportTemplateKey}.png`;
      if (action === "share") {
        await shareOrDownloadMemoryCardPng(blob, filename);
      } else {
        downloadMemoryCardPng(blob, filename);
      }
    } catch {
      setError("PNG를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setExportingKey(null);
    }
  };

  const removeCard = async (card: MemoryCard) => {
    if (
      !card.isOwner ||
      deletingCardId ||
      !window.confirm("이 추억 카드를 삭제할까요? 앨범 사진은 삭제되지 않아요.")
    ) {
      return;
    }

    setDeletingCardId(card.id);
    setError(null);
    try {
      await deleteMemoryCard(card);
      setCards((current) => current.filter(({ id }) => id !== card.id));
    } catch {
      setError("추억 카드를 삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setDeletingCardId(null);
    }
  };

  if (isLoading) {
    return <LoadingState className="min-h-[60svh]" label="추억 카드를 불러오고 있어요" />;
  }

  if (loadError) {
    return (
      <EmptyState
        className="bg-surface/60"
        title="추억 카드를 불러오지 못했어요."
        description="네트워크 연결을 확인하고 다시 시도해주세요."
        action={
          <Button onClick={() => {
            setIsLoading(true);
            setLoadError(false);
            setReloadVersion((value) => value + 1);
          }}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (composerStep === "template") {
    return (
      <section aria-labelledby="template-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-caption font-bold tracking-[0.16em] text-accent-primary">STEP 1</p>
            <h2 id="template-title" className="font-editorial mt-1 text-section font-semibold">템플릿을 골라주세요</h2>
          </div>
          <Button variant="ghost" onClick={closeComposer}>닫기</Button>
        </div>
        {albumPhotoCount < minimumPhotoCount && (
          <EmptyState
            className="mt-5 bg-surface/60"
            title="카드를 만들 사진이 부족해요."
            description={`템플릿에는 앨범 사진이 최소 ${minimumPhotoCount}장 필요해요.`}
            action={<a href="/album" className="tap-target inline-flex items-center font-semibold text-accent-primary">앨범으로 이동</a>}
          />
        )}
        <div className="mt-5 space-y-4">
          {MEMORY_CARD_TEMPLATES.map((item) => {
            const available = albumPhotoCount >= item.acceptedMin;
            return (
              <button
                key={item.key}
                type="button"
                disabled={!available}
                onClick={() => selectTemplate(item.key)}
                className="tap-target grid w-full grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left shadow-card disabled:opacity-45"
              >
                <MemoryCardPreview templateKey={item.key} photos={[]} dateLabel={dateLabel} />
                <span className="min-w-0">
                  <span className="font-editorial block text-lg font-semibold">{item.displayName}</span>
                  <span className="mt-1 block text-sm text-text-secondary">
                    {templatePhotoCountLabel(item.acceptedMin, item.acceptedMax)} · {available ? "고정 배치" : `앨범 ${item.acceptedMin}장부터`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (composerStep === "photos" && template && draftLayout) {
    return (
      <section aria-labelledby="photo-selection-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-caption font-bold tracking-[0.16em] text-accent-primary">STEP 2</p>
            <h2 id="photo-selection-title" className="font-editorial mt-1 text-section font-semibold">사진을 채워주세요</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {template.displayName} · {selectedPhotoIds.length}/{template.acceptedMax}장
            </p>
          </div>
          <Button variant="ghost" onClick={closeComposer}>닫기</Button>
        </div>

        <Card className="mt-5 p-3">
          <MemoryCardPreview
            templateKey={template.key}
            renderModel={draftRenderModel}
            photos={photos}
            dateLabel={dateLabel}
            onPhotoMediaChange={handlePhotoMediaChange}
          />
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setComposerStep("template")}>템플릿 변경</Button>
          <Button variant="secondary" onClick={fillRandomly}>랜덤 채우기</Button>
        </div>

        {remainingCount > 0 && (
          <p role="status" className="mt-3 rounded-md bg-accent-primary/8 px-4 py-3 text-sm text-accent-primary">
            {remainingCount}칸이 비어 있어요. 사진을 더 선택해주세요.
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="카드에 넣을 사진 선택">
          {photos.map((photo, index) => {
            const selectionIndex = selectedPhotoIds.indexOf(photo.id);
            const selected = selectionIndex >= 0;
            const selectionFull = !selected && selectedPhotoIds.length >= template.acceptedMax;
            return (
              <button
                key={photo.id}
                type="button"
                aria-pressed={selected}
                disabled={selectionFull}
                onClick={() => togglePhoto(photo.id)}
                className={`relative aspect-square overflow-hidden rounded-md border-2 bg-line/40 disabled:opacity-45 ${selected ? "border-accent-primary" : "border-transparent"}`}
              >
                <ComposerPhotoThumbnail
                  photo={photo}
                  onMediaChange={handlePhotoMediaChange}
                  fetchPriority={getFirstViewFetchPriority(
                    index,
                    CARDS_HIGH_PRIORITY_MEDIA_COUNT,
                  )}
                />
                {selected && <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-accent-primary text-caption font-bold text-white">{selectionIndex + 1}</span>}
              </button>
            );
          })}
        </div>

        <Button
          fullWidth
          className="mt-5"
          disabled={!canPreview}
          onClick={() => {
            selectSlotForCrop(draftLayout.slots[0]?.slotId ?? null);
            setComposerStep("preview");
          }}
        >
          카드 미리보기
        </Button>
      </section>
    );
  }

  if (composerStep === "preview" && template && draftLayout && canPreview) {
    const draftBusy = exportingKey?.startsWith("draft-");
    return (
      <section aria-labelledby="preview-title">
        <p className="text-caption font-bold tracking-[0.16em] text-accent-primary">STEP 3</p>
        <h2 id="preview-title" className="font-editorial mt-1 text-section font-semibold">카드 미리보기</h2>
        <p className="mt-1 text-sm text-text-secondary">{template.displayName}</p>
        <Card className="mt-5 p-3">
          <MemoryCardPreview
            templateKey={template.key}
            renderModel={draftRenderModel}
            photos={photos}
            dateLabel={dateLabel}
            selectedSlotId={selectedSlotId}
            onSelectSlot={selectSlotForCrop}
            onPhotoMediaChange={handlePhotoMediaChange}
          />
        </Card>

        <div className="mt-5 rounded-lg border border-line bg-surface p-4">
          <h3 className="font-semibold">조정할 사진</h3>
          <p className="mt-1 text-sm text-text-secondary">미리보기의 사진을 눌러도 열 수 있어요.</p>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label="조정할 사진 선택">
            {draftLayout.slots.map((slot, index) => (
              <button
                key={slot.slotId}
                type="button"
                aria-pressed={slot.slotId === selectedSlotId}
                onClick={() => selectSlotForCrop(slot.slotId)}
                className={`min-h-11 rounded-md border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary ${
                  slot.slotId === selectedSlotId
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-line bg-background"
                }`}
              >
                사진 {index + 1}
              </button>
            ))}
          </div>
        </div>

        {selectedSlot && selectedTemplateSlot && selectedPhoto &&
          cropPhotoReadyKey === selectedCropKey && selectedPhoto.signedUrl && (
          <MemoryCardCropEditor
            key={`${selectedSlot.slotId}:${selectedSlot.photoId}`}
            initialPlacement={selectedSlot.placement}
            photo={selectedPhoto}
            slot={selectedTemplateSlot}
            slotNumber={selectedSlotIndex + 1}
            onCancel={() => selectSlotForCrop(null)}
            onPhotoError={() => {
              setCropPhotoReadyKey(null);
              if (cropRefreshVersion === 0) {
                setCropPhotoFailedKey(null);
                setCropRefreshVersion(1);
              } else {
                handlePhotoMediaChange(selectedPhoto.id, "error");
                setCropPhotoFailedKey(selectedCropKey);
              }
            }}
            onApply={(placement) => {
              updateSelectedPlacement(placement);
              selectSlotForCrop(null);
            }}
          />
        )}

        {selectedSlot && selectedTemplateSlot && selectedPhoto &&
          cropPhotoReadyKey !== selectedCropKey &&
          cropPhotoFailedKey !== selectedCropKey && (
          <LoadingState className="mt-5" label="편집할 사진을 불러오고 있어요" />
        )}

        {selectedSlot && selectedTemplateSlot && selectedPhoto &&
          cropPhotoFailedKey === selectedCropKey && (
          <div className="mt-5 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm text-text-secondary">이 사진을 불러오지 못했어요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => selectSlotForCrop(null)} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold">
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setCropPhotoFailedKey(null);
                  setCropRefreshVersion((version) => version + 1);
                }}
                className="min-h-11 rounded-md bg-accent-primary px-4 text-sm font-semibold text-white"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {selectedSlot && (!selectedTemplateSlot || !selectedPhoto) && (
          <div className="mt-5 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm text-text-secondary">이 사진의 편집 정보를 불러올 수 없어요.</p>
            <button type="button" onClick={() => selectSlotForCrop(null)} className="mt-3 min-h-11 w-full rounded-md border border-line px-4 text-sm font-semibold">
              닫기
            </button>
          </div>
        )}

        <label className="mt-5 block text-sm font-semibold" htmlFor="memory-card-caption">카드 문구</label>
        <textarea
          id="memory-card-caption"
          value={cardCaption}
          onChange={(event) => setCardCaption(event.target.value)}
          placeholder="이 카드에만 남길 문구를 입력하세요"
          rows={3}
          className="mt-2 w-full resize-none rounded-md border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent-primary"
        />
        <p className="mt-1 text-caption text-text-secondary">앨범 사진의 문구와 별도로 저장돼요.</p>

        {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={isSaving || Boolean(draftBusy)} onClick={() => setComposerStep("photos")}>사진 다시 고르기</Button>
          <Button variant="secondary" disabled={isSaving || Boolean(draftBusy)} onClick={reshuffle}>다시 섞기</Button>
          <Button variant="secondary" loading={exportingKey === "draft-download"} disabled={isSaving || Boolean(draftBusy)} onClick={() => draftRenderModel && exportCard("draft", "download", template.key, draftRenderModel)}>PNG 저장</Button>
          <Button variant="secondary" loading={exportingKey === "draft-share"} disabled={isSaving || Boolean(draftBusy)} onClick={() => draftRenderModel && exportCard("draft", "share", template.key, draftRenderModel)}>공유</Button>
        </div>
        <Button fullWidth className="mt-2" loading={isSaving} disabled={Boolean(draftBusy)} onClick={saveCard}>
          {isSaving ? "저장 중" : "카드 저장"}
        </Button>
      </section>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Badge tone="neutral">{cards.length}장</Badge>
        <Button
          loading={isLoadingComposerPhotos}
          disabled={albumPhotoCount < minimumPhotoCount}
          onClick={openComposer}
        >
          추억 카드 만들기
        </Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}

      {albumPhotoCount < minimumPhotoCount && (
        <Card className="mt-5 p-4">
          <p className="font-semibold">카드를 만들려면 사진이 최소 {minimumPhotoCount}장 필요해요.</p>
          <p className="mt-1 text-sm text-text-secondary">현재 앨범 사진 {albumPhotoCount}장 · 사진을 더 추가해주세요.</p>
          <a href="/album" className="tap-target mt-2 inline-flex items-center text-sm font-semibold text-accent-primary">앨범으로 이동 →</a>
        </Card>
      )}

      <section className="mt-8" aria-labelledby="saved-cards-title">
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="text-caption font-bold tracking-[0.14em] text-accent-secondary">FAMILY KEEPSAKES</p>
            <h2 id="saved-cards-title" className="font-editorial mt-1 text-section font-semibold">가족의 추억 카드</h2>
          </div>
          {cards.length > 0 && <span className="text-caption text-text-secondary">최신순</span>}
        </div>

        {cards.length === 0 ? (
          <EmptyState
            className="mt-4 bg-surface/55"
            title="아직 저장된 추억 카드가 없어요."
            description="앨범 사진으로 첫 카드를 만들어보세요."
          />
        ) : (
          <div className="mt-5 space-y-6">
            {cards.map((card) => {
              const savedTemplate = getMemoryCardTemplate(card.templateKey)!;
              const cardBusy = exportingKey?.startsWith(`${card.id}-`);
              return (
                <article key={card.id} className="overflow-hidden rounded-lg border border-line/70 bg-surface p-3 shadow-card">
                  <MemoryCardPreview
                    templateKey={card.templateKey}
                    renderModel={card.renderModel}
                    photos={photos}
                    dateLabel={dateLabel}
                    onPhotoMediaChange={handlePhotoMediaChange}
                  />
                  <div className="flex items-start justify-between gap-3 px-1 pt-3">
                    <div>
                      <h3 className="font-editorial font-semibold">{savedTemplate.displayName}</h3>
                      <p className="mt-0.5 text-caption text-text-secondary">{card.creatorName ?? "가족 구성원"} · {createdAtFormatter.format(new Date(card.createdAt))}</p>
                    </div>
                    {card.isOwner && (
                      <button
                        type="button"
                        disabled={Boolean(deletingCardId)}
                        onClick={() => removeCard(card)}
                        className="tap-target px-2 text-caption font-semibold text-danger disabled:opacity-50"
                      >
                        {deletingCardId === card.id ? "삭제 중" : "삭제"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      disabled={!card.renderModel || Boolean(cardBusy)}
                      loading={exportingKey === `${card.id}-download`}
                      onClick={() => card.renderModel && exportCard(card.id, "download", card.templateKey, card.renderModel)}
                    >
                      PNG 저장
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!card.renderModel || Boolean(cardBusy)}
                      loading={exportingKey === `${card.id}-share`}
                      onClick={() => card.renderModel && exportCard(card.id, "share", card.templateKey, card.renderModel)}
                    >
                      공유
                    </Button>
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
