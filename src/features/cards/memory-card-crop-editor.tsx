"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import {
  applyMemoryCardGesture,
  clampMemoryCardPhotoPlacement,
  getMemoryCardCenteredContainPlacement,
  getMemoryCardCenteredCoverPlacement,
  getMemoryCardMaxZoom,
  getMemoryCardPhotoOffsetBounds,
  getMemoryCardPhotoViewport,
  getPlacedImageRect,
  MEMORY_CARD_PHOTO_BACKGROUND_COLOR,
  normalizeDegrees,
  rebaseMemoryCardGesture,
  removeMemoryCardPointer,
  type MemoryCardGestureBaseline,
  type MemoryCardPhotoPlacement,
  type MemoryCardPoint,
} from "./memory-card-photo-placement";
import type { MemoryCardPhotoSlot } from "./memory-card-template-spec";

type MemoryCardCropEditorProps = {
  initialPlacement: MemoryCardPhotoPlacement;
  photo: AlbumPhoto;
  slot: MemoryCardPhotoSlot;
  slotNumber: number;
  onApply: (placement: MemoryCardPhotoPlacement) => void;
  onCancel: () => void;
};

type SafariGestureEvent = Event & {
  rotation: number;
  scale: number;
};

export function MemoryCardCropEditor({
  initialPlacement,
  onApply,
  onCancel,
  photo,
  slot,
  slotNumber,
}: MemoryCardCropEditorProps) {
  const viewport = getMemoryCardPhotoViewport(slot);
  const initialDimensions = photo.width && photo.height
    ? { width: photo.width, height: photo.height }
    : null;
  const [dimensions, setDimensions] = useState(initialDimensions);
  const [draft, setDraft] = useState(() => initialDimensions
    ? clampMemoryCardPhotoPlacement(
        initialDimensions.width,
        initialDimensions.height,
        viewport.width,
        viewport.height,
        initialPlacement,
      )
    : initialPlacement);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const placementRef = useRef(draft);
  const pointersRef = useRef(new Map<number, MemoryCardPoint>());
  const baselineRef = useRef<MemoryCardGestureBaseline | null>(null);
  const safariBaselineRef = useRef<MemoryCardPhotoPlacement | null>(null);

  const setValidDraft = (placement: MemoryCardPhotoPlacement) => {
    const next = dimensions
      ? clampMemoryCardPhotoPlacement(
          dimensions.width,
          dimensions.height,
          viewport.width,
          viewport.height,
          placement,
        )
      : placement;
    placementRef.current = next;
    setDraft(next);
  };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const start = (rawEvent: Event) => {
      if (pointersRef.current.size > 0) return;
      rawEvent.preventDefault();
      safariBaselineRef.current = { ...placementRef.current };
    };
    const change = (rawEvent: Event) => {
      const baseline = safariBaselineRef.current;
      if (!baseline || pointersRef.current.size > 0) return;
      rawEvent.preventDefault();
      const event = rawEvent as SafariGestureEvent;
      setValidDraft({
        ...baseline,
        zoom: baseline.zoom * event.scale,
        rotation: baseline.rotation + event.rotation,
      });
    };
    const end = () => {
      safariBaselineRef.current = null;
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || pointersRef.current.size > 0) return;
      event.preventDefault();
      setValidDraft({
        ...placementRef.current,
        zoom: placementRef.current.zoom * Math.exp(-event.deltaY * 0.01),
      });
    };
    if ("GestureEvent" in window) {
      surface.addEventListener("gesturestart", start, { passive: false });
      surface.addEventListener("gesturechange", change, { passive: false });
      surface.addEventListener("gestureend", end);
    }
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if ("GestureEvent" in window) {
        surface.removeEventListener("gesturestart", start);
        surface.removeEventListener("gesturechange", change);
        surface.removeEventListener("gestureend", end);
      }
      surface.removeEventListener("wheel", wheel);
    };
  });

  const toViewportPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * viewport.width / bounds.width,
      y: (event.clientY - bounds.top) * viewport.height / bounds.height,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, toViewportPoint(event));
    event.currentTarget.setPointerCapture(event.pointerId);
    baselineRef.current = rebaseMemoryCardGesture(
      pointersRef.current,
      placementRef.current,
    );
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !baselineRef.current || !dimensions) {
      return;
    }
    event.preventDefault();
    pointersRef.current.set(event.pointerId, toViewportPoint(event));
    setValidDraft(applyMemoryCardGesture(
      baselineRef.current,
      pointersRef.current,
      dimensions.width,
      dimensions.height,
      viewport.width,
      viewport.height,
    ));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const next = removeMemoryCardPointer(
      pointersRef.current,
      event.pointerId,
      placementRef.current,
    );
    pointersRef.current = next.points;
    baselineRef.current = next.baseline;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateDraft = (patch: Partial<MemoryCardPhotoPlacement>) => {
    setValidDraft({ ...placementRef.current, ...patch });
  };

  const placed = dimensions
    ? getPlacedImageRect(
        dimensions.width,
        dimensions.height,
        viewport.width,
        viewport.height,
        draft,
      )
    : null;
  const maxZoom = dimensions
    ? getMemoryCardMaxZoom(
        dimensions.width,
        dimensions.height,
        viewport.width,
        viewport.height,
      )
    : 6;
  const offsetBounds = dimensions
    ? getMemoryCardPhotoOffsetBounds(
        dimensions.width,
        dimensions.height,
        viewport.width,
        viewport.height,
        draft,
      )
    : null;
  const showEntirePhoto = () => {
    setValidDraft(getMemoryCardCenteredContainPlacement());
  };
  const fillFrame = () => {
    setValidDraft(dimensions
      ? getMemoryCardCenteredCoverPlacement(
          dimensions.width,
          dimensions.height,
          viewport.width,
          viewport.height,
        )
      : getMemoryCardCenteredContainPlacement());
  };
  return (
    <section className="mt-5 rounded-lg border border-line bg-surface p-4" aria-labelledby="crop-editor-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="crop-editor-title" className="font-semibold">사진 위치 조정</h3>
        <span className="text-caption text-text-secondary">사진 {slotNumber}</span>
      </div>
      <p className="mt-1 text-sm text-text-secondary">한 손가락으로 이동 · 두 손가락으로 확대/회전</p>

      <div
        ref={surfaceRef}
        role="img"
        aria-label={`사진 ${slotNumber} 자르기 영역`}
        className="relative mt-3 w-full cursor-grab overflow-hidden rounded-md border border-line active:cursor-grabbing"
        style={{
          aspectRatio: `${viewport.width} / ${viewport.height}`,
          backgroundColor: MEMORY_CARD_PHOTO_BACKGROUND_COLOR,
          touchAction: "none",
          userSelect: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onLostPointerCapture={finishPointer}
      >
        {photo.signedUrl ? (
          /* Signed URLs are short-lived runtime values from private Storage. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.signedUrl}
            alt=""
            draggable={false}
            onLoad={({ currentTarget }) => {
              const nextDimensions = {
                width: currentTarget.naturalWidth,
                height: currentTarget.naturalHeight,
              };
              setDimensions(nextDimensions);
              const next = clampMemoryCardPhotoPlacement(
                nextDimensions.width,
                nextDimensions.height,
                viewport.width,
                viewport.height,
                placementRef.current,
              );
              placementRef.current = next;
              setDraft(next);
            }}
            className="pointer-events-none absolute block max-w-none"
            style={placed
              ? {
                  left: `${placed.x / viewport.width * 100}%`,
                  top: `${placed.y / viewport.height * 100}%`,
                  width: `${placed.width / viewport.width * 100}%`,
                  height: `${placed.height / viewport.height * 100}%`,
                  transform: `rotate(${placed.rotation}deg)`,
                }
              : { inset: 0, width: "100%", height: "100%", visibility: "hidden" }}
          />
        ) : (
          <span className="flex size-full items-center justify-center px-4 text-center text-sm text-text-secondary">
            사진을 표시할 수 없어요.
          </span>
        )}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-line" />
      </div>

      <p className="mt-2 hidden text-caption text-text-secondary sm:block">
        트랙패드는 브라우저에 따라 확대만 지원될 수 있어요. 회전은 아래 조절을 사용해주세요.
      </p>

      <label className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold" htmlFor="memory-card-zoom">
        확대
        <span className="font-normal text-text-secondary">{draft.zoom.toFixed(2)}×</span>
      </label>
      <div className="mt-1 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <button type="button" aria-label="사진 축소" onClick={() => updateDraft({ zoom: draft.zoom - 0.25 })} className="min-h-11 rounded-md border border-line text-lg font-semibold">
          −
        </button>
        <input
          id="memory-card-zoom"
          type="range"
          min="1"
          max={maxZoom}
          step="0.05"
          value={draft.zoom}
          onChange={(event) => updateDraft({ zoom: Number(event.target.value) })}
          className="h-11 w-full accent-accent-primary"
        />
        <button type="button" aria-label="사진 확대" onClick={() => updateDraft({ zoom: draft.zoom + 0.25 })} className="min-h-11 rounded-md border border-line text-lg font-semibold">
          +
        </button>
      </div>

      <label className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold" htmlFor="memory-card-rotation">
        회전
        <span className="font-normal text-text-secondary">{Math.round(draft.rotation)}°</span>
      </label>
      <input
        id="memory-card-rotation"
        type="range"
        min="-180"
        max="179"
        step="1"
        value={draft.rotation}
        onChange={(event) => updateDraft({ rotation: Number(event.target.value) })}
        className="mt-1 h-11 w-full accent-accent-primary"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => updateDraft({ rotation: normalizeDegrees(draft.rotation - 90) })} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          ↶ 90°
        </button>
        <button type="button" onClick={() => updateDraft({ rotation: normalizeDegrees(draft.rotation + 90) })} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          ↷ 90°
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold" htmlFor="memory-card-offset-x">
          가로 위치
          <input
            id="memory-card-offset-x"
            type="range"
            min={offsetBounds?.minX ?? -1}
            max={offsetBounds?.maxX ?? 1}
            step="0.01"
            value={draft.offsetX}
            onChange={(event) => updateDraft({ offsetX: Number(event.target.value) })}
            className="mt-1 h-11 w-full accent-accent-primary"
          />
        </label>
        <label className="text-sm font-semibold" htmlFor="memory-card-offset-y">
          세로 위치
          <input
            id="memory-card-offset-y"
            type="range"
            min={offsetBounds?.minY ?? -1}
            max={offsetBounds?.maxY ?? 1}
            step="0.01"
            value={draft.offsetY}
            onChange={(event) => updateDraft({ offsetY: Number(event.target.value) })}
            className="mt-1 h-11 w-full accent-accent-primary"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={showEntirePhoto} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          사진 전체
        </button>
        <button type="button" onClick={fillFrame} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          프레임 채우기
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={fillFrame} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          초기화
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-md border border-line text-sm font-semibold">
          취소
        </button>
        <button type="button" onClick={() => onApply(placementRef.current)} className="min-h-11 rounded-md bg-accent-primary px-2 text-sm font-semibold text-white">
          적용
        </button>
      </div>
    </section>
  );
}
