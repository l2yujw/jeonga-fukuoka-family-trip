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
  downloadMemoryCardResult,
  loadMemoryCards,
  refreshMemoryCardResultSignedUrl,
} from "./memory-card-repository";
import { MemoryCardPreview } from "./memory-card-preview";
import type { MemoryCardPhotoSlot } from "./memory-card-template-spec";

type ComposerStep = "template" | "photos" | "preview";
type ExportAction = "download" | "share";

const FEATURED_TEMPLATE_KEYS = [
  "one_moment",
  "instant_memory",
  "postcard_duo",
  "scrapbook_trio",
  "film_contact_sheet",
] as const satisfies readonly MemoryCardTemplateKey[];

const FEATURED_MEMORY_CARD_TEMPLATES = FEATURED_TEMPLATE_KEYS.map(
  (key) => MEMORY_CARD_TEMPLATES.find((template) => template.key === key)!,
);

const createdAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function templatePhotoCountLabel(min: number, max: number) {
  return min === max ? `사진 ${min}장` : `사진 ${min}–${max}장`;
}

function TemplateGlyph({ templateKey }: { templateKey: MemoryCardTemplateKey }) {
  const count = getMemoryCardTemplate(templateKey)?.acceptedMin ?? 1;
  return (
    <svg aria-hidden="true" viewBox="0 0 36 30" className="cards-template-glyph">
      <rect x="3" y="3" width="30" height="24" rx="2" />
      {Array.from({ length: Math.min(count, 6) }, (_, index) => (
        <rect
          key={index}
          x={7 + index % 3 * 8}
          y={7 + Math.floor(index / 3) * 8}
          width="6"
          height="6"
          rx="0.8"
        />
      ))}
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="cards-action-icon">
      <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="cards-action-icon">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v2h14v-2" />
    </svg>
  );
}

function getSavedCardCaption(card: MemoryCard) {
  return card.renderModel?.kind === "canonical"
    ? card.renderModel.layout.caption
    : null;
}

function FinalizedMemoryCardImage({
  card,
  className = "",
}: {
  card: MemoryCard;
  className?: string;
}) {
  const [rejectedUrl, setRejectedUrl] = useState<string | null>(null);
  const [refreshedUrl, setRefreshedUrl] = useState<string | null>(null);
  const [refreshedPath, setRefreshedPath] = useState<string | null>(null);
  const signedUrl = refreshedUrl ?? (
    card.resultSignedUrl !== rejectedUrl ? card.resultSignedUrl : null
  );

  const handleError = () => {
    setRejectedUrl(signedUrl);
    setRefreshedUrl(null);
    if (!card.resultStoragePath || refreshedPath === card.resultStoragePath) return;
    setRefreshedPath(card.resultStoragePath);
    void refreshMemoryCardResultSignedUrl(card.resultStoragePath).then(setRefreshedUrl);
  };

  if (!signedUrl) {
    return (
      <div className={`cards-final-image-fallback ${className}`} role="img" aria-label="완성 카드 이미지를 표시할 수 없음">
        완성 카드를 불러오지 못했어요.
      </div>
    );
  }

  return (
    /* Private Storage signed URL; never persisted into card layout metadata. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={signedUrl}
      alt={`${card.creatorName ?? "가족 구성원"}님의 완성된 추억 카드`}
      className={`cards-final-image ${className}`}
      onError={handleError}
    />
  );
}

const minimumPhotoCount = getMinimumMemoryCardPhotoCount();

function getDefaultComposerTemplateKey(photoCount: number) {
  return (
    MEMORY_CARD_TEMPLATES.find(
      ({ acceptedMin, key }) => key === "one_moment" && photoCount >= acceptedMin,
    ) ?? MEMORY_CARD_TEMPLATES.find(({ acceptedMin }) => photoCount >= acceptedMin)
  )?.key ?? null;
}

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
        <span className="cards-photo-unavailable">사진을 불러올 수 없어요</span>
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
  const [showAllTemplates, setShowAllTemplates] = useState(false);
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
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
  const selectedSavedCard = cards.find(({ id }) => id === selectedCardId) ?? null;

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
      setTemplateKey(getDefaultComposerTemplateKey(albumPhotoCount));
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
      setTemplateKey(getDefaultComposerTemplateKey(albumPhotos.length));
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
    setShowAllTemplates(false);
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
    if (
      !nextTemplate ||
      albumPhotoCount < nextTemplate.acceptedMin ||
      templateKey === nextTemplateKey
    ) return;
    setTemplateKey(nextTemplateKey);
    setPhotoDraft({ photoIds: [], placementBySlotId: {} });
    setSelectedSlotId(null);
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

  const renderCardBlob = async (
    renderTemplateKey: MemoryCardTemplateKey,
    renderModel: MemoryCardRenderModel,
  ) => {
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
    return exportMemoryCardPng({
      templateKey: renderTemplateKey,
      renderModel,
      photos: hydratedPhotos,
      dateLabel,
    });
  };

  const saveCard = async () => {
    if (!templateKey || !draftRenderModel || !canPreview || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const resultPng = await renderCardBlob(templateKey, draftRenderModel);
      const saved = await createMemoryCard({
        availablePhotoIds: photos.map(({ id }) => id),
        layout: draftLayout!,
        resultPng,
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
      const blob = await renderCardBlob(exportTemplateKey, renderModel);
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

  const exportSavedCard = async (card: MemoryCard, action: ExportAction) => {
    if (exportingKey) return;
    setExportingKey(`${card.id}-${action}`);
    setError(null);
    try {
      const blob = card.isFinalized
        ? await downloadMemoryCardResult(card)
        : card.renderModel
          ? await renderCardBlob(card.templateKey, card.renderModel)
          : null;
      if (!blob) throw new Error("memory-card-render-unavailable");
      const filename = `fukuoka-memory-card-${card.templateKey}.png`;
      if (action === "share") {
        await shareOrDownloadMemoryCardPng(blob, filename);
      } else {
        downloadMemoryCardPng(blob, filename);
      }
    } catch {
      setError("완성 카드를 내려받지 못했어요. 잠시 후 다시 시도해주세요.");
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
      const { storageCleanupFailed } = await deleteMemoryCard(card);
      setCards((current) => current.filter(({ id }) => id !== card.id));
      if (selectedCardId === card.id) setSelectedCardId(null);
      if (storageCleanupFailed) {
        setError("카드는 삭제했지만 저장 이미지를 정리하지 못했어요.");
      }
    } catch {
      setError("추억 카드를 삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setDeletingCardId(null);
    }
  };

  if (isLoading) {
    return <LoadingState className="cards-empty min-h-[60svh]" label="추억 카드를 불러오고 있어요" />;
  }

  if (loadError) {
    return (
      <EmptyState
        className="cards-empty"
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

  if (composerStep && template && draftLayout) {
    const draftBusy = exportingKey?.startsWith("draft-");

    return (
      <>
        <section className="cards-studio" aria-labelledby="cards-studio-title">
          <header className="cards-studio-heading">
            <span className="cards-sparkle" aria-hidden="true">✦</span>
            <div>
              <h2 id="cards-studio-title" className="cards-studio-title">카드 만들기</h2>
              <p>템플릿을 선택하고 우리만의 추억 카드를 만들어 보세요.</p>
            </div>
            <button type="button" className="cards-close" onClick={closeComposer} aria-label="카드 만들기 닫기">×</button>
          </header>

          <div className="cards-template-strip" aria-label="빠른 템플릿 선택">
          {FEATURED_MEMORY_CARD_TEMPLATES.map((item) => {
            const available = albumPhotoCount >= item.acceptedMin;
            const selected = template.key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                disabled={!available}
                onClick={() => selectTemplate(item.key)}
                className={`cards-template-tile ${selected ? "is-selected" : ""}`}
              >
                <TemplateGlyph templateKey={item.key} />
                <span>{item.displayName}</span>
              </button>
            );
          })}
          </div>

        <Card className="cards-preview-frame">
          <div className="cards-preview-stage">
            <MemoryCardPreview
              templateKey={template.key}
              renderModel={draftRenderModel}
              photos={photos}
              dateLabel={dateLabel}
              onPhotoMediaChange={handlePhotoMediaChange}
            />
          </div>
          <p className="cards-preview-caption">
            <strong>{template.displayName}</strong>
            {templatePhotoCountLabel(template.acceptedMin, template.acceptedMax)}
          </p>
        </Card>

        {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}

          <div className="cards-action-row cards-main-actions">
            <Button
              variant="secondary"
              disabled={!canPreview || isSaving || Boolean(draftBusy)}
              onClick={() => {
                selectSlotForCrop(null);
                setComposerStep("preview");
              }}
            >
              <EyeIcon /> 미리보기
            </Button>
            <Button
              className="cards-primary-action"
              disabled={isSaving || Boolean(draftBusy)}
              onClick={() => setComposerStep("photos")}
            >
              사진 선택하기
            </Button>
          </div>

            <div className="cards-studio-divider" />
            <div className="cards-gallery-heading">
              <h3><span aria-hidden="true">❧</span> 템플릿 선택</h3>
              <button type="button" onClick={() => setShowAllTemplates(true)}>더보기 <span aria-hidden="true">›</span></button>
            </div>
            <div id="cards-template-gallery" className="cards-template-gallery">
              {FEATURED_MEMORY_CARD_TEMPLATES.map((item) => {
                const available = albumPhotoCount >= item.acceptedMin;
                const selected = template.key === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={selected}
                    disabled={!available}
                    onClick={() => selectTemplate(item.key)}
                    className={`cards-template-card ${selected ? "is-selected" : ""}`}
                  >
                    {selected && <span className="cards-template-check" aria-hidden="true">✓</span>}
                    <span className="cards-template-preview">
                      <MemoryCardPreview templateKey={item.key} photos={[]} dateLabel={dateLabel} />
                    </span>
                    <strong>{item.displayName}</strong>
                  </button>
                );
              })}
            </div>

            <div className="cards-tip">
              <span aria-hidden="true">❧</span>
              <p><strong>카드 팁</strong>사진은 앨범에서 선택해 카드에 담을 수 있어요.</p>
              <button type="button" onClick={() => setComposerStep("photos")}>사진 선택하기</button>
            </div>

        {showAllTemplates && (
          <div className="cards-dialog-backdrop" role="presentation" onClick={() => setShowAllTemplates(false)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cards-template-sheet-title"
              className="cards-sheet cards-template-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cards-sheet-heading">
                <div>
                  <h3 id="cards-template-sheet-title">모든 템플릿</h3>
                  <p>8가지 실제 카드 디자인</p>
                </div>
                <button type="button" onClick={() => setShowAllTemplates(false)} aria-label="모든 템플릿 닫기">×</button>
              </header>
              <div className="cards-sheet-body">
                <div className="cards-all-template-grid">
                  {MEMORY_CARD_TEMPLATES.map((item) => {
                    const available = albumPhotoCount >= item.acceptedMin;
                    const selected = template.key === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={!available}
                        onClick={() => {
                          selectTemplate(item.key);
                          setShowAllTemplates(false);
                        }}
                        className={`cards-all-template-item ${selected ? "is-selected" : ""}`}
                      >
                        <TemplateGlyph templateKey={item.key} />
                        <span><strong>{item.displayName}</strong><small>{templatePhotoCountLabel(item.acceptedMin, item.acceptedMax)}</small></span>
                        {selected && <span className="cards-all-template-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {composerStep === "photos" && (
          <div className="cards-dialog-backdrop" role="presentation" onClick={() => setComposerStep("template")}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cards-photo-sheet-title"
              className="cards-sheet cards-photo-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cards-sheet-heading">
                <div>
                  <h3 id="cards-photo-sheet-title">사진 선택</h3>
                  <p>{selectedPhotoIds.length}/{template.acceptedMax}장 선택 · {template.displayName}</p>
                </div>
                <button type="button" onClick={() => setComposerStep("template")} aria-label="사진 선택 닫기">×</button>
              </header>

              <div className="cards-sheet-body">
                <div className="cards-photo-toolbar">
                  <p>{remainingCount > 0 ? `${remainingCount}장을 더 선택해주세요.` : "선택이 완료됐어요."}</p>
                  <Button variant="secondary" onClick={fillRandomly}>랜덤 채우기</Button>
                </div>

                <div className="cards-photo-grid" aria-label="카드에 넣을 사진 선택">
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
                          fetchPriority={getFirstViewFetchPriority(index, CARDS_HIGH_PRIORITY_MEDIA_COUNT)}
                        />
                        {selected && <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-accent-primary text-caption font-bold text-white">{selectionIndex + 1}</span>}
                      </button>
                    );
                  })}
                </div>

                <label className="cards-caption-label" htmlFor="memory-card-caption">카드 문구</label>
                <textarea
                  id="memory-card-caption"
                  value={cardCaption}
                  onChange={(event) => setCardCaption(event.target.value)}
                  placeholder="이 카드에만 남길 문구를 입력하세요"
                  rows={2}
                  className="cards-caption-input"
                />
              </div>

              <div className="cards-action-row cards-sheet-actions">
                <Button variant="secondary" disabled={!canPreview} onClick={reshuffle}>다시 섞기</Button>
                <Button className="cards-primary-action" disabled={!canPreview} onClick={() => setComposerStep("template")}>선택 완료</Button>
              </div>
            </section>
          </div>
        )}

        {composerStep === "preview" && canPreview && (
          <div className="cards-dialog-backdrop" role="presentation" onClick={() => setComposerStep("template")}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cards-preview-dialog-title"
              className="cards-sheet cards-preview-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="cards-sheet-heading">
                <div>
                  <h3 id="cards-preview-dialog-title">카드 미리보기</h3>
                  <p>{template.displayName} · 사진을 눌러 위치를 조정하세요.</p>
                </div>
                <button type="button" onClick={() => setComposerStep("template")} aria-label="카드 미리보기 닫기">×</button>
              </header>
              <div className="cards-sheet-body">
                <div className="cards-dialog-preview">
                  <MemoryCardPreview
                    templateKey={template.key}
                    renderModel={draftRenderModel}
                    photos={photos}
                    dateLabel={dateLabel}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={selectSlotForCrop}
                    onPhotoMediaChange={handlePhotoMediaChange}
                  />
                </div>

                <div className="cards-editor-panel">
                  <h3 className="font-semibold">조정할 사진</h3>
                  <p className="mt-1 text-sm text-text-secondary">미리보기의 사진을 눌러도 열 수 있어요.</p>
                  <div className="cards-slot-grid mt-3" aria-label="조정할 사진 선택">
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

            {selectedSlot && (
              <div className="cards-crop-backdrop" role="presentation" onClick={() => selectSlotForCrop(null)}>
                <div className="cards-crop-sheet" onClick={(event) => event.stopPropagation()}>
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
                </div>
              </div>
            )}

                <div className="cards-preview-tools">
                  <Button variant="secondary" disabled={isSaving || Boolean(draftBusy)} onClick={reshuffle}>다시 섞기</Button>
                  <Button variant="secondary" loading={exportingKey === "draft-download"} disabled={isSaving || Boolean(draftBusy)} onClick={() => draftRenderModel && exportCard("draft", "download", template.key, draftRenderModel)}>PNG 저장</Button>
                  <Button variant="secondary" loading={exportingKey === "draft-share"} disabled={isSaving || Boolean(draftBusy)} onClick={() => draftRenderModel && exportCard("draft", "share", template.key, draftRenderModel)}>공유</Button>
                </div>
                <p className="cards-finalize-note">저장하면 이 모습으로 확정되며 이후에는 보기·다운로드·삭제만 할 수 있어요.</p>
              </div>

              <div className="cards-action-row cards-sheet-actions cards-preview-actions">
                <Button variant="secondary" disabled={isSaving || Boolean(draftBusy)} onClick={() => setComposerStep("photos")}>사진 다시 선택</Button>
                <Button className="cards-primary-action" loading={isSaving} disabled={Boolean(draftBusy)} onClick={saveCard}>
                  <SaveIcon /> {isSaving ? "저장 중" : "카드 저장"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </section>
      </>
    );
  }

  return (
    <>
      <section className="cards-first-actions" aria-label="추억 카드 만들기">
        <div className="cards-count">
          <Badge tone="neutral">{cards.length}장</Badge>
        </div>
        <Button
          className="cards-create-button"
          loading={isLoadingComposerPhotos}
          disabled={albumPhotoCount < minimumPhotoCount}
          onClick={openComposer}
        >
          <span aria-hidden="true">✦</span> 추억 카드 만들기
        </Button>
      </section>

      {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}

      {albumPhotoCount < minimumPhotoCount && (
        <Card className="cards-album-needed mt-5 p-4">
          <p className="font-semibold">카드를 만들려면 사진이 최소 {minimumPhotoCount}장 필요해요.</p>
          <p className="mt-1 text-sm text-text-secondary">현재 앨범 사진 {albumPhotoCount}장 · 사진을 더 추가해주세요.</p>
          <a href="/album" className="tap-target mt-2 inline-flex items-center text-sm font-semibold text-accent-primary">앨범으로 이동 →</a>
        </Card>
      )}

      <section className="cards-keepsakes" aria-labelledby="saved-cards-title">
        <div className="cards-keepsakes-heading">
          <div>
            <p>FAMILY KEEPSAKES</p>
            <h2 id="saved-cards-title">가족의 추억 카드</h2>
          </div>
          {cards.length > 0 && <span className="cards-sort">최신순⌄</span>}
        </div>

        {cards.length === 0 ? (
          <EmptyState
            className="cards-empty mt-4"
            title="아직 저장된 추억 카드가 없어요."
            description="앨범 사진으로 첫 카드를 만들어보세요."
            action={<button type="button" onClick={openComposer} className="cards-empty-action">첫 카드 만들기</button>}
          />
        ) : (
          <div className="cards-saved-list">
            {cards.map((card) => {
              const savedTemplate = getMemoryCardTemplate(card.templateKey)!;
              const cardBusy = exportingKey?.startsWith(`${card.id}-`);
              const caption = getSavedCardCaption(card);
              const photoCount = card.renderModel?.layout.slots.length ?? 0;
              return (
                <article key={card.id} className="cards-saved-card">
                  <span className="cards-binding" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
                  </span>
                  <button
                    type="button"
                    className="cards-saved-open"
                    aria-label={`${caption ?? savedTemplate.displayName} 카드 보기`}
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    <span className="cards-saved-rail" aria-hidden="true" />
                    <span className="cards-saved-icon" aria-hidden="true"><TemplateGlyph templateKey={card.templateKey} /></span>
                    <span className="cards-saved-copy">
                      <span className="cards-saved-chips">
                        <span>{savedTemplate.displayName}</span>
                        <span>{card.creatorName ?? "가족 구성원"}</span>
                      </span>
                      <strong>{caption ?? savedTemplate.displayName}</strong>
                      <small>{photoCount > 0 ? `사진 ${photoCount}장으로 만든 카드` : "이전 형식의 추억 카드"}</small>
                      <time dateTime={card.createdAt}>{createdAtFormatter.format(new Date(card.createdAt))}</time>
                    </span>
                    <span className="cards-saved-thumb">
                      {card.isFinalized ? (
                        <FinalizedMemoryCardImage card={card} />
                      ) : (
                        <MemoryCardPreview
                          templateKey={card.templateKey}
                          renderModel={card.renderModel}
                          photos={photos}
                          dateLabel={dateLabel}
                          onPhotoMediaChange={handlePhotoMediaChange}
                        />
                      )}
                    </span>
                  </button>
                    <details className="cards-saved-menu">
                      <summary aria-label="카드 작업 더보기">•••</summary>
                      <div>
                        <button
                          type="button"
                          disabled={(!card.isFinalized && !card.renderModel) || Boolean(cardBusy)}
                          onClick={() => exportSavedCard(card, "download")}
                        >
                          {exportingKey === `${card.id}-download` ? "저장 중" : "다운로드"}
                        </button>
                        <button
                          type="button"
                          disabled={(!card.isFinalized && !card.renderModel) || Boolean(cardBusy)}
                          onClick={() => exportSavedCard(card, "share")}
                        >
                          {exportingKey === `${card.id}-share` ? "공유 중" : "공유"}
                        </button>
                        {card.isOwner && (
                          <button
                            type="button"
                            disabled={Boolean(deletingCardId)}
                            onClick={() => removeCard(card)}
                            className="cards-delete"
                          >
                            {deletingCardId === card.id ? "삭제 중" : "삭제"}
                          </button>
                        )}
                      </div>
                    </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedSavedCard && (
        <div className="cards-viewer-backdrop" role="presentation" onClick={() => setSelectedCardId(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-card-dialog-title"
            className="cards-viewer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>IMMUTABLE KEEPSAKE</p>
                <h2 id="saved-card-dialog-title">완성된 추억 카드</h2>
              </div>
              <button type="button" onClick={() => setSelectedCardId(null)} aria-label="카드 보기 닫기">닫기</button>
            </header>
            <div className="cards-viewer-art">
              {selectedSavedCard.isFinalized ? (
                <FinalizedMemoryCardImage card={selectedSavedCard} />
              ) : (
                <MemoryCardPreview
                  templateKey={selectedSavedCard.templateKey}
                  renderModel={selectedSavedCard.renderModel}
                  photos={photos}
                  dateLabel={dateLabel}
                  onPhotoMediaChange={handlePhotoMediaChange}
                />
              )}
            </div>
            <p className="cards-viewer-meta">
              {selectedSavedCard.creatorName ?? "가족 구성원"} · {createdAtFormatter.format(new Date(selectedSavedCard.createdAt))}
            </p>
            <div className="cards-action-row">
              <Button
                variant="secondary"
                loading={exportingKey === `${selectedSavedCard.id}-download`}
                disabled={!selectedSavedCard.isFinalized && !selectedSavedCard.renderModel}
                onClick={() => exportSavedCard(selectedSavedCard, "download")}
              >
                다운로드
              </Button>
              <Button
                loading={exportingKey === `${selectedSavedCard.id}-share`}
                disabled={!selectedSavedCard.isFinalized && !selectedSavedCard.renderModel}
                onClick={() => exportSavedCard(selectedSavedCard, "share")}
              >
                공유
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
