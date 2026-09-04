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
  onPhotoError: () => void;
};

type SafariGestureEvent = Event & {
  rotation: number;
  scale: number;
};

export function MemoryCardCropEditor({
  initialPlacement,
  onApply,
  onCancel,
  onPhotoError,
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
  const centeredCover = dimensions
    ? getMemoryCardCenteredCoverPlacement(
        dimensions.width,
        dimensions.height,
        viewport.width,
        viewport.height,
      )
    : null;
  const centered = draft.rotation === 0 && draft.offsetX === 0 && draft.offsetY === 0;
  const fitMode = centered && Math.abs(draft.zoom - 1) < 0.001
    ? "contain"
    : centeredCover && centered && Math.abs(draft.zoom - centeredCover.zoom) < 0.001
      ? "cover"
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
    <section className="cards-crop-workbench" aria-labelledby="crop-editor-title">
      <header className="cards-crop-heading">
        <div>
          <span>PHOTO WORKBENCH</span>
          <h3 id="crop-editor-title">사진 {slotNumber} 조정</h3>
        </div>
        <p>한 손가락으로 이동 · 두 손가락으로 확대/회전</p>
      </header>

      <div className="cards-crop-canvas-mat">
        <div
          ref={surfaceRef}
          role="img"
          aria-label={`사진 ${slotNumber} 자르기 영역`}
          className="cards-crop-surface"
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
              onError={onPhotoError}
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
          <span aria-hidden="true" className="cards-crop-surface-edge" />
        </div>
      </div>

      <p className="cards-crop-trackpad-note">
        트랙패드는 브라우저에 따라 확대만 지원될 수 있어요. 회전은 아래 조절을 사용해주세요.
      </p>

      <div className="cards-crop-controls">
        <div className="cards-crop-tool">
          <label className="cards-crop-tool-label" htmlFor="memory-card-zoom">
            <span>확대</span>
            <output htmlFor="memory-card-zoom">{draft.zoom.toFixed(2)}×</output>
          </label>
          <div className="cards-crop-zoom-control">
            <button type="button" aria-label="사진 축소" onClick={() => updateDraft({ zoom: draft.zoom - 0.25 })} className="cards-crop-step">
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
              className="cards-crop-range"
            />
            <button type="button" aria-label="사진 확대" onClick={() => updateDraft({ zoom: draft.zoom + 0.25 })} className="cards-crop-step">
              +
            </button>
          </div>
        </div>

        <div className="cards-crop-tool">
          <label className="cards-crop-tool-label" htmlFor="memory-card-rotation">
            <span>회전</span>
            <output htmlFor="memory-card-rotation">{Math.round(draft.rotation)}°</output>
          </label>
          <div className="cards-crop-rotation-control">
            <input
              id="memory-card-rotation"
              type="range"
              min="-180"
              max="179"
              step="1"
              value={draft.rotation}
              onChange={(event) => updateDraft({ rotation: Number(event.target.value) })}
              className="cards-crop-range"
            />
            <div className="cards-crop-rotation-actions">
              <button type="button" onClick={() => updateDraft({ rotation: normalizeDegrees(draft.rotation - 90) })}>
                ↶ 90°
              </button>
              <button type="button" onClick={() => updateDraft({ rotation: normalizeDegrees(draft.rotation + 90) })}>
                ↷ 90°
              </button>
            </div>
          </div>
        </div>

        <div className="cards-crop-tool cards-crop-position-tool">
          <div className="cards-crop-position-grid">
            <label htmlFor="memory-card-offset-x">
              <span>가로 위치</span>
              <input
                id="memory-card-offset-x"
                type="range"
                min={offsetBounds?.minX ?? -1}
                max={offsetBounds?.maxX ?? 1}
                step="0.01"
                value={draft.offsetX}
                onChange={(event) => updateDraft({ offsetX: Number(event.target.value) })}
                className="cards-crop-range"
              />
            </label>
            <label htmlFor="memory-card-offset-y">
              <span>세로 위치</span>
              <input
                id="memory-card-offset-y"
                type="range"
                min={offsetBounds?.minY ?? -1}
                max={offsetBounds?.maxY ?? 1}
                step="0.01"
                value={draft.offsetY}
                onChange={(event) => updateDraft({ offsetY: Number(event.target.value) })}
                className="cards-crop-range"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="cards-crop-fit" aria-label="사진 맞춤 방식">
        <button type="button" aria-pressed={fitMode === "contain"} onClick={showEntirePhoto}>
          사진 전체
        </button>
        <button type="button" aria-pressed={fitMode === "cover"} onClick={fillFrame}>
          프레임 채우기
        </button>
      </div>

      <footer className="cards-crop-actions">
        <button type="button" onClick={fillFrame} className="cards-crop-reset">
          초기화
        </button>
        <button type="button" onClick={onCancel} className="cards-crop-cancel">
          취소
        </button>
        <button type="button" onClick={() => onApply(placementRef.current)} className="cards-crop-apply">
          적용
        </button>
      </footer>
    </section>
  );
}
