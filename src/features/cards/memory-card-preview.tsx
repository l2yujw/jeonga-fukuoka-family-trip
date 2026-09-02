"use client";

import { useState, type CSSProperties } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import {
  getMemoryCardPhotoViewport,
  getPlacedImageRect,
  MEMORY_CARD_PHOTO_BACKGROUND_COLOR,
} from "./memory-card-photo-placement";
import {
  getMemoryCardRenderTemplate,
  resolveMemoryCardSlots,
  type MemoryCardRenderModel,
  type MemoryCardTemplateKey,
} from "./memory-card";
import {
  getMemoryCardTemplateSpec,
  MEMORY_CARD_FONT_STACKS,
  MEMORY_CARD_TEXT_STYLES,
  type ExportBounds,
  type MemoryCardCaptionStyle,
  type MemoryCardDecoration,
  type MemoryCardPhotoSlot,
  type MemoryCardTextSlot,
} from "./memory-card-template-spec";

type MemoryCardPreviewProps = {
  templateKey: MemoryCardTemplateKey;
  renderModel?: MemoryCardRenderModel | null;
  photos: readonly AlbumPhoto[];
  dateLabel?: string;
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string) => void;
};

const percent = (value: number, total: number) => `${(value / total) * 100}%`;

function photoSlotStyle(
  slot: MemoryCardPhotoSlot,
  bounds: ExportBounds,
): CSSProperties {
  return {
    left: percent(slot.x - bounds.x, bounds.width),
    top: percent(slot.y - bounds.y, bounds.height),
    width: percent(slot.w, bounds.width),
    height: percent(slot.h, bounds.height),
    zIndex: slot.z,
    transform: `rotate(${slot.r}deg)`,
  };
}

function decorationStyle(
  decoration: MemoryCardDecoration,
  bounds: ExportBounds,
  zIndex: number,
): CSSProperties {
  return {
    left: percent(decoration.x - bounds.x, bounds.width),
    top: percent(decoration.y - bounds.y, bounds.height),
    width: percent(decoration.w, bounds.width),
    height: percent(decoration.h, bounds.height),
    zIndex,
    backgroundImage: `linear-gradient(to bottom, ${decoration.fromColor}, ${decoration.toColor})`,
  };
}

function textSlotStyle(
  slot: MemoryCardTextSlot,
  bounds: ExportBounds,
): CSSProperties {
  const style: MemoryCardCaptionStyle = MEMORY_CARD_TEXT_STYLES[slot.style];
  return {
    left: percent(slot.x - bounds.x, bounds.width),
    top: percent(slot.y - bounds.y, bounds.height),
    width: percent(slot.maxWidth, bounds.width),
    color: style.color,
    fontFamily: MEMORY_CARD_FONT_STACKS[style.fontFamily],
    fontSize: `${(style.fontSize / bounds.width) * 100}cqw`,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight / style.fontSize,
    letterSpacing: style.letterSpacing
      ? `${(style.letterSpacing / bounds.width) * 100}cqw`
      : undefined,
    textAlign: style.textAlign,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: style.maxLines,
  };
}

export function MemoryCardPreview({
  dateLabel = "",
  onSelectSlot,
  renderModel,
  photos,
  selectedSlotId,
  templateKey,
}: MemoryCardPreviewProps) {
  const [unavailablePhotoIds, setUnavailablePhotoIds] = useState<Set<string>>(
    new Set(),
  );
  const [naturalDimensions, setNaturalDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  if (renderModel === null) {
    return (
      <div className="flex aspect-[9/16] items-center justify-center rounded-md bg-line/35 px-6 text-center text-sm text-text-secondary">
        카드 구성을 불러올 수 없어요.
      </div>
    );
  }

  const emptyModel: MemoryCardRenderModel = {
    kind: "canonical",
    layoutVersion: 2,
    layout: { version: 2, slots: [], caption: null },
  };
  const previewModel = renderModel ?? emptyModel;
  const template = renderModel
    ? getMemoryCardRenderTemplate(templateKey, renderModel)
    : getMemoryCardTemplateSpec(templateKey);
  if (!template) return null;

  const bounds = template.exportBounds;
  const slots = resolveMemoryCardSlots(
    templateKey,
    previewModel,
    new Map(photos.map((photo) => [photo.id, photo])),
  );
  const resolvedBySlot = new Map(slots.map((slot) => [slot.slotId, slot]));
  const frameClass = {
    plain: "bg-surface",
    polaroid: "bg-surface shadow-card",
    strip: "bg-text-primary",
  } as const;
  const caption = previewModel.kind === "canonical"
    ? previewModel.layout.caption
    : null;
  const overlayZ = Math.max(0, ...template.slots.map(({ z }) => z)) + 1;

  const scene = (
    <div
      className="relative w-full overflow-hidden rounded-sm [container-type:inline-size]"
      style={{
        aspectRatio: `${bounds.width} / ${bounds.height}`,
        backgroundColor: template.backgroundColor,
      }}
    >
      {[...template.slots].sort((a, b) => a.z - b.z).map((slot) => {
        const resolved = resolvedBySlot.get(slot.id);
        const photo = resolved?.photo;
        const viewport = getMemoryCardPhotoViewport(slot);
        const dimensions = photo
          ? naturalDimensions[photo.id] ?? (
              photo.width && photo.height
                ? { width: photo.width, height: photo.height }
                : null
            )
          : null;
        const placed = dimensions
          ? getPlacedImageRect(
              dimensions.width,
              dimensions.height,
              viewport.width,
              viewport.height,
              resolved?.placement ?? null,
            )
          : null;
        const canRender = Boolean(
          photo?.signedUrl &&
          resolved?.photoId &&
          !unavailablePhotoIds.has(resolved.photoId),
        );
        const slotNumber = previewModel.layout.slots.findIndex(
          ({ slotId }) => slotId === slot.id,
        ) + 1;
        const selected = Boolean(resolved?.photoId && selectedSlotId === slot.id);
        const className = `absolute overflow-hidden ${frameClass[slot.frame]} ${
          selected ? "ring-2 ring-inset ring-accent-primary" : ""
        }`;
        const content = (
          <div
            className="absolute overflow-hidden"
            style={{
              left: percent(viewport.x, slot.w),
              top: percent(viewport.y, slot.h),
              width: percent(viewport.width, slot.w),
              height: percent(viewport.height, slot.h),
              backgroundColor: MEMORY_CARD_PHOTO_BACKGROUND_COLOR,
            }}
          >
            {canRender ? (
              /* Signed URLs are short-lived runtime values from private Storage. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo!.signedUrl!}
                alt={photo!.caption ?? "추억 카드에 선택한 여행 사진"}
                onLoad={({ currentTarget }) => {
                  const next = {
                    width: currentTarget.naturalWidth,
                    height: currentTarget.naturalHeight,
                  };
                  setNaturalDimensions((current) =>
                    current[photo!.id]?.width === next.width &&
                    current[photo!.id]?.height === next.height
                      ? current
                      : { ...current, [photo!.id]: next },
                  );
                }}
                onError={() =>
                  setUnavailablePhotoIds((current) =>
                    new Set(current).add(resolved!.photoId!),
                  )
                }
                className="absolute block max-w-none"
                style={placed
                  ? {
                      left: percent(placed.x, viewport.width),
                      top: percent(placed.y, viewport.height),
                      width: percent(placed.width, viewport.width),
                      height: percent(placed.height, viewport.height),
                      transform: `rotate(${placed.rotation}deg)`,
                    }
                  : { inset: 0, width: "100%", height: "100%" }}
                draggable={false}
              />
            ) : resolved?.optionalEmpty ? null : (
              <span className="flex size-full items-center justify-center bg-line/45 px-1 text-center text-[clamp(6px,2vw,10px)] font-semibold text-text-secondary">
                {resolved?.photoId
                  ? "사진을 표시할 수 없어요"
                  : "사진 선택"}
              </span>
            )}
          </div>
        );

        return onSelectSlot && resolved?.photoId ? (
          <button
            key={slot.id}
            type="button"
            aria-label={`사진 ${slotNumber} 위치 조정`}
            aria-pressed={selected}
            onClick={() => onSelectSlot(slot.id)}
            className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary`}
            style={photoSlotStyle(slot, bounds)}
          >
            {content}
          </button>
        ) : (
          <div
            key={slot.id}
            className={className}
            style={photoSlotStyle(slot, bounds)}
          >
            {content}
          </div>
        );
      })}

      {template.decorations?.map((decoration) => (
        <div
          key={decoration.id}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={decorationStyle(decoration, bounds, overlayZ)}
        />
      ))}

      {template.textSlots.map((slot) => {
        const value = slot.id === "title"
          ? "FUKUOKA · FAMILY JOURNAL"
          : slot.id === "t2"
            ? dateLabel
            : caption ?? "";
        return (
          <p
            key={slot.id}
            style={{ ...textSlotStyle(slot, bounds), zIndex: overlayZ + 1 }}
            className="absolute m-0 overflow-hidden break-words"
          >
            {value}
          </p>
        );
      })}
    </div>
  );

  return (
    <div
      className={templateKey === "four_cut"
        ? "rounded-md bg-line/25 p-3"
        : "overflow-hidden rounded-md"}
      aria-label={`${template.displayName} 카드 미리보기`}
    >
      <div className={templateKey === "four_cut" ? "mx-auto w-[58%] shadow-raised" : "w-full"}>
        {scene}
      </div>
    </div>
  );
}
