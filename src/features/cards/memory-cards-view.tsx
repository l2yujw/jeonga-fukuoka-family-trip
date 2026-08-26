"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, LoadingState } from "@/components/ui";
import { loadAlbumPhotos } from "@/features/album/album-repository";
import type { AlbumPhoto } from "@/features/album/album-types";
import { useCurrentTripSession } from "@/features/boarding/trip-access-guard";
import {
  buildMemoryCardLayout,
  getMemoryCardTemplate,
  MEMORY_CARD_TEMPLATES,
  randomFillPhotoIds,
  type MemoryCard,
  type MemoryCardTemplateKey,
} from "./memory-card";
import {
  createMemoryCard,
  deleteMemoryCard,
  loadMemoryCards,
} from "./memory-card-repository";
import { MemoryCardPreview } from "./memory-card-preview";

type ComposerStep = "template" | "photos" | "preview";

const createdAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function MemoryCardsView() {
  const tripSession = useCurrentTripSession();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [composerStep, setComposerStep] = useState<ComposerStep | null>(null);
  const [templateKey, setTemplateKey] = useState<MemoryCardTemplateKey | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([
      loadMemoryCards(tripSession.trip.id),
      loadAlbumPhotos(tripSession.trip.id),
    ])
      .then(([loadedCards, loadedPhotos]) => {
        if (!active) return;
        setCards(loadedCards);
        setPhotos(loadedPhotos);
        setLoadError(false);
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
  }, [reloadVersion, tripSession.trip.id]);

  const template = templateKey ? getMemoryCardTemplate(templateKey) : null;
  const draftLayout = useMemo(
    () =>
      templateKey ? buildMemoryCardLayout(templateKey, selectedPhotoIds) : null,
    [selectedPhotoIds, templateKey],
  );
  const requiredCount = template?.slotIds.length ?? 0;
  const remainingCount = Math.max(0, requiredCount - selectedPhotoIds.length);

  const closeComposer = () => {
    setComposerStep(null);
    setTemplateKey(null);
    setSelectedPhotoIds([]);
    setError(null);
  };

  const selectTemplate = (nextTemplateKey: MemoryCardTemplateKey) => {
    setTemplateKey(nextTemplateKey);
    setSelectedPhotoIds([]);
    setComposerStep("photos");
    setError(null);
  };

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) return current.filter((id) => id !== photoId);
      if (current.length >= requiredCount) return current;
      return [...current, photoId];
    });
  };

  const fillRandomly = () => {
    setSelectedPhotoIds(
      randomFillPhotoIds(
        photos.map(({ id }) => id),
        requiredCount,
      ),
    );
  };

  const saveCard = async () => {
    if (!templateKey || selectedPhotoIds.length !== requiredCount || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const saved = await createMemoryCard({
        availablePhotoIds: photos.map(({ id }) => id),
        photoIds: selectedPhotoIds,
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
        <div className="mt-5 space-y-4">
          {MEMORY_CARD_TEMPLATES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTemplate(item.key)}
              className="tap-target grid w-full grid-cols-[7rem_1fr] items-center gap-4 rounded-lg border border-line bg-surface p-3 text-left shadow-card"
            >
              <MemoryCardPreview templateKey={item.key} photos={[]} />
              <span>
                <span className="font-editorial block text-lg font-semibold">{item.displayName}</span>
                <span className="mt-1 block text-sm text-text-secondary">사진 {item.slotIds.length}장 · 고정 배치</span>
              </span>
            </button>
          ))}
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
            <p className="mt-1 text-sm text-text-secondary">{template.displayName} · {selectedPhotoIds.length}/{requiredCount}장</p>
          </div>
          <Button variant="ghost" onClick={closeComposer}>닫기</Button>
        </div>

        <Card className="mt-5 p-3">
          <MemoryCardPreview templateKey={template.key} layout={draftLayout} photos={photos} />
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setComposerStep("template")}>템플릿 변경</Button>
          <Button variant="secondary" onClick={fillRandomly} disabled={photos.length === 0}>랜덤 채우기</Button>
        </div>

        {remainingCount > 0 && (
          <p role="status" className="mt-3 rounded-md bg-accent-primary/8 px-4 py-3 text-sm text-accent-primary">
            {remainingCount}칸이 비어 있어요.{photos.length < requiredCount ? " 앨범 사진이 더 필요해요." : " 사진을 더 선택해주세요."}
          </p>
        )}

        {photos.length === 0 ? (
          <EmptyState
            className="mt-5 bg-surface/60"
            title="앨범 사진이 아직 없어요."
            description="먼저 앨범에 사진을 올린 뒤 카드를 만들어주세요."
            action={<a href="/album" className="tap-target inline-flex items-center font-semibold text-accent-primary">앨범으로 이동</a>}
          />
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2" aria-label="카드에 넣을 사진 선택">
            {photos.map((photo) => {
              const selectionIndex = selectedPhotoIds.indexOf(photo.id);
              const selected = selectionIndex >= 0;
              const selectionFull = !selected && selectedPhotoIds.length >= requiredCount;
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={selectionFull}
                  onClick={() => togglePhoto(photo.id)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 bg-line/40 disabled:opacity-45 ${selected ? "border-accent-primary" : "border-transparent"}`}
                >
                  {photo.signedUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photo.signedUrl} alt={photo.caption ?? "앨범 여행 사진"} className="size-full object-cover object-center" />
                  ) : (
                    <span className="flex size-full items-center justify-center px-2 text-[10px] text-text-secondary">표시할 수 없는 사진</span>
                  )}
                  {selected && <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-accent-primary text-caption font-bold text-white">{selectionIndex + 1}</span>}
                </button>
              );
            })}
          </div>
        )}

        <Button
          fullWidth
          className="mt-5"
          disabled={remainingCount > 0}
          onClick={() => setComposerStep("preview")}
        >
          카드 미리보기
        </Button>
      </section>
    );
  }

  if (composerStep === "preview" && template && draftLayout) {
    return (
      <section aria-labelledby="preview-title">
        <p className="text-caption font-bold tracking-[0.16em] text-accent-primary">STEP 3</p>
        <h2 id="preview-title" className="font-editorial mt-1 text-section font-semibold">카드 미리보기</h2>
        <p className="mt-1 text-sm text-text-secondary">{template.displayName}</p>
        <Card className="mt-5 p-3"><MemoryCardPreview templateKey={template.key} layout={draftLayout} photos={photos} /></Card>
        {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={isSaving} onClick={() => setComposerStep("photos")}>사진 다시 고르기</Button>
          <Button loading={isSaving} onClick={saveCard}>{isSaving ? "저장 중" : "카드 저장"}</Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Badge tone="neutral">{cards.length}장</Badge>
        <Button onClick={() => setComposerStep("template")}>추억 카드 만들기</Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">{error}</p>}

      {photos.length === 0 && (
        <Card className="mt-5 p-4">
          <p className="font-semibold">카드에 넣을 앨범 사진이 없어요.</p>
          <p className="mt-1 text-sm text-text-secondary">앨범에 사진을 추가하면 새 카드를 만들 수 있어요.</p>
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
              return (
                <article key={card.id} className="overflow-hidden rounded-lg border border-line/70 bg-surface p-3 shadow-card">
                  <MemoryCardPreview templateKey={card.templateKey} layout={card.layout} photos={photos} />
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
