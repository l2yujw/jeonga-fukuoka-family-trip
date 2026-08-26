import type { AlbumPhoto } from "@/features/album/album-types";
import {
  getMemoryCardRenderTemplate,
  type MemoryCardRenderModel,
  type MemoryCardTemplateKey,
} from "./memory-card";
import {
  MEMORY_CARD_CANVAS,
  MEMORY_CARD_FONT_STACKS,
  MEMORY_CARD_TEXT_STYLES,
  type MemoryCardCaptionStyle,
  type MemoryCardPhotoSlot,
  type MemoryCardTextSlot,
} from "./memory-card-template-spec";

export const MEMORY_CARD_EXPORT_SIZES = [
  { width: 1080, height: 1920 },
  { width: 720, height: 1280 },
] as const;

type ExportSize = (typeof MEMORY_CARD_EXPORT_SIZES)[number];

export type MemoryCardRenderInput = {
  templateKey: MemoryCardTemplateKey;
  renderModel: MemoryCardRenderModel;
  photos: readonly AlbumPhoto[];
  dateLabel: string;
};

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("memory-card-image-load-failed"));
    image.src = url;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new Error("memory-card-blob-failed")),
      "image/png",
    );
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function drawPhotoSlot(
  context: CanvasRenderingContext2D,
  slot: MemoryCardPhotoSlot,
  image: HTMLImageElement | null,
  scale: number,
) {
  const width = slot.w * scale;
  const height = slot.h * scale;
  const padding = (slot.frame === "polaroid" ? 18 : slot.frame === "strip" ? 8 : 0) * scale;
  const footer = (slot.frame === "polaroid" ? 52 : 0) * scale;

  context.save();
  context.translate((slot.x + slot.w / 2) * scale, (slot.y + slot.h / 2) * scale);
  context.rotate((slot.r * Math.PI) / 180);
  context.shadowColor = slot.frame === "polaroid"
    ? "rgba(58, 48, 40, 0.18)"
    : "transparent";
  context.shadowBlur = slot.frame === "polaroid" ? 18 * scale : 0;
  context.fillStyle = slot.frame === "strip" ? "#2f2925" : "#fffdf8";
  context.fillRect(-width / 2, -height / 2, width, height);
  context.shadowColor = "transparent";

  const imageX = -width / 2 + padding;
  const imageY = -height / 2 + padding;
  const imageWidth = width - padding * 2;
  const imageHeight = height - padding * 2 - footer;
  context.save();
  context.beginPath();
  context.rect(imageX, imageY, imageWidth, imageHeight);
  context.clip();
  if (image) {
    drawCover(context, image, imageX, imageY, imageWidth, imageHeight);
  } else {
    context.fillStyle = "#ded7cc";
    context.fillRect(imageX, imageY, imageWidth, imageHeight);
  }
  context.restore();
  context.restore();
}

function ellipsize(
  value: string,
  maxWidth: number,
  measure: (value: string) => number,
) {
  let visible = value.trimEnd();
  while (visible && measure(`${visible}…`) > maxWidth) {
    visible = visible.slice(0, -1).trimEnd();
  }
  return visible ? `${visible}…` : measure("…") <= maxWidth ? "…" : "";
}

export function wrapMemoryCardText(
  value: string,
  maxWidth: number,
  maxLines: number,
  measure: (value: string) => number,
) {
  const characters = Array.from(value.trim());
  const lines: string[] = [];
  let cursor = 0;

  while (cursor < characters.length && lines.length < maxLines) {
    let line = "";
    while (cursor < characters.length) {
      const character = characters[cursor];
      if (character === "\n") {
        cursor += 1;
        break;
      }
      if (line && measure(line + character) > maxWidth) break;
      if (!line && measure(character) > maxWidth) {
        cursor += 1;
        continue;
      }
      line += character;
      cursor += 1;
    }

    const hasMore = cursor < characters.length;
    if (lines.length === maxLines - 1 && hasMore) {
      lines.push(ellipsize(line, maxWidth, measure));
      break;
    }
    if (line.trim()) lines.push(line.trimEnd());
  }

  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  slot: MemoryCardTextSlot,
  style: MemoryCardCaptionStyle,
  scale: number,
) {
  const x = (slot.x + (style.textAlign === "center" ? slot.maxWidth / 2 : 0)) * scale;
  const lines = wrapMemoryCardText(
    value,
    slot.maxWidth * scale,
    style.maxLines,
    (text) => context.measureText(text).width,
  );
  lines.forEach((line, index) => {
    context.fillText(line, x, (slot.y + index * style.lineHeight) * scale);
  });
}

function drawTextSlot(
  context: CanvasRenderingContext2D,
  slot: MemoryCardTextSlot,
  value: string,
  scale: number,
) {
  if (!value) return;
  const style: MemoryCardCaptionStyle = MEMORY_CARD_TEXT_STYLES[slot.style];
  context.save();
  context.textBaseline = "top";
  context.textAlign = style.textAlign;
  context.fillStyle = style.color;
  context.font = `${style.fontWeight} ${style.fontSize * scale}px ${MEMORY_CARD_FONT_STACKS[style.fontFamily]}`;
  if ("letterSpacing" in context) {
    context.letterSpacing = `${(style.letterSpacing ?? 0) * scale}px`;
  }
  drawWrappedText(context, value, slot, style, scale);
  context.restore();
}

export function getMemoryCardExportDimensions(
  input: Pick<MemoryCardRenderInput, "templateKey" | "renderModel">,
  size: ExportSize,
) {
  const template = getMemoryCardRenderTemplate(input.templateKey, input.renderModel);
  if (!template) throw new Error("memory-card-template-missing");
  const scale = size.width / MEMORY_CARD_CANVAS.width;
  return {
    width: Math.round(template.exportBounds.width * scale),
    height: Math.round(template.exportBounds.height * scale),
  };
}

export async function renderMemoryCardPng(
  input: MemoryCardRenderInput,
  size: ExportSize,
) {
  const template = getMemoryCardRenderTemplate(input.templateKey, input.renderModel);
  if (!template) throw new Error("memory-card-template-missing");
  await document.fonts?.ready;

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = size.width;
  renderCanvas.height = size.height;
  const context = renderCanvas.getContext("2d");
  if (!context) throw new Error("memory-card-canvas-unavailable");
  const scale = size.width / MEMORY_CARD_CANVAS.width;
  const bounds = template.exportBounds;

  if (bounds.background === "template") {
    context.fillStyle = template.backgroundColor;
    context.fillRect(
      bounds.x * scale,
      bounds.y * scale,
      bounds.width * scale,
      bounds.height * scale,
    );
  }

  const photoIds = new Map(
    input.renderModel.layout.slots.map(({ slotId, photoId }) => [slotId, photoId]),
  );
  const photos = new Map(input.photos.map((photo) => [photo.id, photo]));
  const loadedImages = new Map<string, HTMLImageElement | null>();
  await Promise.all(input.renderModel.layout.slots.map(async ({ photoId }) => {
    const url = photos.get(photoId)?.signedUrl;
    if (!url || loadedImages.has(photoId)) return;
    loadedImages.set(photoId, await loadImage(url).catch(() => null));
  }));

  for (const slot of [...template.slots].sort((a, b) => a.z - b.z)) {
    const photoId = photoIds.get(slot.id);
    drawPhotoSlot(
      context,
      slot,
      photoId ? (loadedImages.get(photoId) ?? null) : null,
      scale,
    );
  }

  const caption = input.renderModel.kind === "canonical"
    ? input.renderModel.layout.caption
    : null;
  for (const slot of template.textSlots) {
    const value = slot.id === "title"
      ? "FUKUOKA · FAMILY JOURNAL"
      : slot.id === "t2"
        ? input.dateLabel
        : caption ?? "";
    drawTextSlot(context, slot, value, scale);
  }

  const finalCanvas = document.createElement("canvas");
  const dimensions = getMemoryCardExportDimensions(input, size);
  finalCanvas.width = dimensions.width;
  finalCanvas.height = dimensions.height;
  const finalContext = finalCanvas.getContext("2d");
  if (!finalContext) throw new Error("memory-card-canvas-unavailable");
  finalContext.drawImage(
    renderCanvas,
    Math.round(bounds.x * scale),
    Math.round(bounds.y * scale),
    dimensions.width,
    dimensions.height,
    0,
    0,
    dimensions.width,
    dimensions.height,
  );

  return canvasToPngBlob(finalCanvas);
}

export async function exportMemoryCardPng(
  input: MemoryCardRenderInput,
  render = renderMemoryCardPng,
) {
  try {
    return await render(input, MEMORY_CARD_EXPORT_SIZES[0]);
  } catch {
    return render(input, MEMORY_CARD_EXPORT_SIZES[1]);
  }
}

export function downloadMemoryCardPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type ShareNavigator = Pick<Navigator, "canShare" | "share">;

export async function shareOrDownloadMemoryCardPng(
  blob: Blob,
  filename: string,
  options: {
    navigator?: ShareNavigator | null;
    download?: (blob: Blob, filename: string) => void;
  } = {},
) {
  const shareNavigator = options.navigator === undefined
    ? (typeof navigator === "undefined" ? null : navigator)
    : options.navigator;
  const download = options.download ?? downloadMemoryCardPng;
  const file = new File([blob], filename, { type: "image/png" });
  const shareData = { files: [file], title: "후쿠오카 가족 추억 카드" };

  if (!shareNavigator?.share || !shareNavigator.canShare?.(shareData)) {
    download(blob, filename);
    return "downloaded" as const;
  }

  try {
    await shareNavigator.share(shareData);
    return "shared" as const;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled" as const;
    }
    download(blob, filename);
    return "downloaded" as const;
  }
}
