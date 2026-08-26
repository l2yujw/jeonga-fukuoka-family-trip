"use client";

import { useState, type CSSProperties } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
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
  type MemoryCardPhotoSlot,
  type MemoryCardTextSlot,
} from "./memory-card-template-spec";

type MemoryCardPreviewProps = {
  templateKey: MemoryCardTemplateKey;
  renderModel?: MemoryCardRenderModel | null;
  photos: readonly AlbumPhoto[];
  dateLabel?: string;
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
  renderModel,
  photos,
  templateKey,
}: MemoryCardPreviewProps) {
  const [unavailablePhotoIds, setUnavailablePhotoIds] = useState<Set<string>>(
    new Set(),
  );

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
    polaroid: "bg-surface p-[3.5%] pb-[12%] shadow-card",
    strip: "bg-text-primary p-[1.6%]",
  } as const;
  const caption = previewModel.kind === "canonical"
    ? previewModel.layout.caption
    : null;

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
        const canRender = Boolean(
          photo?.signedUrl &&
          resolved?.photoId &&
          !unavailablePhotoIds.has(resolved.photoId),
        );

        return (
          <div
            key={slot.id}
            className={`absolute overflow-hidden ${frameClass[slot.frame]}`}
            style={photoSlotStyle(slot, bounds)}
          >
            <div className="relative size-full overflow-hidden bg-line/40">
              {canRender ? (
                /* Signed URLs are short-lived runtime values from private Storage. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photo!.signedUrl!}
                  alt={photo!.caption ?? "추억 카드에 선택한 여행 사진"}
                  onError={() =>
                    setUnavailablePhotoIds((current) =>
                      new Set(current).add(resolved!.photoId!),
                    )
                  }
                  className="size-full object-cover object-center"
                />
              ) : resolved?.optionalEmpty ? null : (
                <span className="flex size-full items-center justify-center bg-line/45 px-1 text-center text-[clamp(6px,2vw,10px)] font-semibold text-text-secondary">
                  {resolved?.photoId
                    ? "사진을 표시할 수 없어요"
                    : "사진 선택"}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {template.textSlots.map((slot) => {
        const value = slot.id === "title"
          ? "FUKUOKA · FAMILY JOURNAL"
          : slot.id === "t2"
            ? dateLabel
            : caption ?? "";
        return (
          <p
            key={slot.id}
            style={textSlotStyle(slot, bounds)}
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
