"use client";

import {
  useEffect,
  useMemo,
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
import type { MemoryCardSlotMappingV3 } from "./memory-card";
import type { WatercolorTemplate } from "./watercolor-template-spec";
import { getWatercolorDraftValue, projectWatercolorLayout, setWatercolorDraftValue, validateWatercolorValues, type WatercolorDraft } from "./watercolor-layout";
import { prepareWatercolorScene } from "./watercolor-scene";
import type { WatercolorValidation } from "./watercolor-preview";

type MemoryCardCropEditorProps = {
  initialPlacement: MemoryCardPhotoPlacement;
  photo: AlbumPhoto;
  slot: MemoryCardPhotoSlot;
  slotNumber: number;
  template: WatercolorTemplate;
  initialTextDraft: WatercolorDraft;
  slots: readonly MemoryCardSlotMappingV3[];
  photos: readonly AlbumPhoto[];
  onApply: (placement: MemoryCardPhotoPlacement, text: WatercolorDraft) => void;
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
  template,
  initialTextDraft,
  slots,
  photos,
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
  const [textDraft, setTextDraft] = useState(() => structuredClone(initialTextDraft));
  const fields = template.fields.filter(field => field.photoSlotId === slot.id);
  const dateField = fields.find(field => field.kind === "isoDate");
  const [showDate, setShowDate] = useState(() => Boolean(dateField && getWatercolorDraftValue(initialTextDraft, dateField, slots)));
  const rememberedDate = useRef(dateField ? getWatercolorDraftValue(initialTextDraft, dateField, slots) : null);
  const composing = useRef(false);
  const [validation, setValidation] = useState<WatercolorValidation>({ ready: false, errors: {} });
  const layout = useMemo(() => projectWatercolorLayout(template, slots.map(s => s.slotId === slot.id ? { ...s, placement: draft } : s), textDraft), [template, slots, slot.id, draft, textDraft]);
  useEffect(() => {
    let active = true;
    void prepareWatercolorScene(template.key, layout, photos, true).then(scene => {
      if (active) setValidation({ ready: true, errors: scene.errors });
    }).catch(error => { if (active) setValidation({ ready: false, errors: { _scene: error instanceof Error ? error.message : "미리보기를 준비하지 못했어요." } }); });
    return () => { active = false; };
  }, [template.key, layout, photos]);
  const errors = { ...validateWatercolorValues(template, layout), ...validation.errors };
  if (showDate && dateField && !getWatercolorDraftValue(textDraft, dateField, slots)) errors[dateField.id] = "표시할 날짜를 선택해주세요.";
  const changeText = (field: WatercolorTemplate["fields"][number], value: string | null) => {
    setValidation({ ready: false, errors: {} });
    setTextDraft(current => setWatercolorDraftValue(current, field, slots, value));
  };

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
    setValidation({ ready: false, errors: {} });
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
          <span>PHOTO EDIT</span>
          <h3 id="crop-editor-title">사진 {slotNumber} 편집</h3>
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

      <section className="wc-photo-annotations" aria-label="사진 문구">
        <h4>사진 문구 <small>선택</small></h4>
        {fields.length === 0 && <p>이 사진에는 별도 문구 영역이 없어요.</p>}
        {fields.filter(field => field.kind === "plainText").map(field => {
          const value = getWatercolorDraftValue(textDraft, field, slots) ?? "";
          return <div className="wc-field" key={field.id}>
            <label htmlFor={`photo-field-${field.id}`}>{field.label}</label>
            <textarea id={`photo-field-${field.id}`} value={value} rows={Math.min(3, field.maxLines)} placeholder="문구 없음" aria-invalid={Boolean(errors[field.id])} aria-describedby={`photo-help-${field.id}`}
              onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
              onChange={event => changeText(field, event.target.value || null)} />
            <p id={`photo-help-${field.id}`} className={errors[field.id] ? "wc-error" : ""}>{errors[field.id] ?? `${Array.from(value.normalize("NFC")).length}/${field.maxCodePoints}자 · 최대 ${field.maxLines}줄 · 비워도 괜찮아요`}</p>
          </div>;
        })}
        {dateField && <div className="wc-field">
          <label className="wc-date-toggle"><input type="checkbox" checked={showDate} onChange={event => {
            const show = event.target.checked;
            if (!show) rememberedDate.current = getWatercolorDraftValue(textDraft, dateField, slots);
            setShowDate(show);
            changeText(dateField, show ? rememberedDate.current : null);
          }}/>사진 날짜 표시</label>
          {showDate && <><label htmlFor="photo-date">사진 날짜</label><input id="photo-date" type="date" min="0001-01-01" max="9999-12-31" value={getWatercolorDraftValue(textDraft, dateField, slots) ?? ""} onChange={event => changeText(dateField, event.target.value || null)} aria-invalid={Boolean(errors[dateField.id])} aria-describedby="photo-date-help" />
          <p id="photo-date-help" className={errors[dateField.id] ? "wc-error" : ""}>{errors[dateField.id] ?? "이 사진에 남길 날짜를 직접 선택해주세요."}</p></>}
        </div>}
        {Object.entries(errors).filter(([id]) => !fields.some(field => field.id === id)).map(([id, error]) => <p className="wc-error" role="alert" key={id}>{error}</p>)}
      </section>

      <footer className="cards-crop-actions">
        <button type="button" onClick={fillFrame} className="cards-crop-reset">
          초기화
        </button>
        <button type="button" onClick={onCancel} className="cards-crop-cancel">
          취소
        </button>
        <button type="button" disabled={!validation.ready || Boolean(Object.keys(errors).length)} onClick={() => { if (!composing.current) onApply(placementRef.current, structuredClone(textDraft)); }} className="cards-crop-apply">
          적용
        </button>
      </footer>
    </section>
  );
}
