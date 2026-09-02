import type { MemoryCardPhotoSlot } from "./memory-card-template-spec";

export type MemoryCardPhotoPlacement = {
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

export type MemoryCardPoint = { x: number; y: number };

export type PlacedImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type MemoryCardGestureBaseline =
  | {
      kind: "single";
      pointerId: number;
      startPoint: MemoryCardPoint;
      startPlacement: MemoryCardPhotoPlacement;
    }
  | {
      kind: "multi";
      pointerIds: readonly [number, number];
      startCentroid: MemoryCardPoint;
      startDistance: number;
      startAngle: number;
      startPlacement: MemoryCardPhotoPlacement;
    };

export const DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT = {
  zoom: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
} as const satisfies MemoryCardPhotoPlacement;

export const MEMORY_CARD_PHOTO_BACKGROUND_COLOR = "#fffdf8";
export const MEMORY_CARD_MIN_VISIBLE_RATIO = 0.1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hasValidDimensions = (...values: number[]) =>
  values.every((value) => Number.isFinite(value) && value > 0);

export function normalizeDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function midpoint(a: MemoryCardPoint, b: MemoryCardPoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: MemoryCardPoint, b: MemoryCardPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleBetween(a: MemoryCardPoint, b: MemoryCardPoint) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function angleDeltaDegrees(startAngle: number, currentAngle: number) {
  return normalizeDegrees((currentAngle - startAngle) * 180 / Math.PI);
}

export function getMemoryCardPhotoViewport(
  slot: Pick<MemoryCardPhotoSlot, "frame" | "w" | "h">,
): Omit<PlacedImageRect, "rotation"> {
  const padding = slot.frame === "polaroid" ? 18 : slot.frame === "strip" ? 8 : 0;
  const footer = slot.frame === "polaroid" ? 52 : 0;
  return {
    x: padding,
    y: padding,
    width: slot.w - padding * 2,
    height: slot.h - padding * 2 - footer,
  };
}

export function getMemoryCardContainScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return hasValidDimensions(imageWidth, imageHeight, viewportWidth, viewportHeight)
    ? Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight)
    : null;
}

export function getMemoryCardCoverScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return hasValidDimensions(imageWidth, imageHeight, viewportWidth, viewportHeight)
    ? Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight)
    : null;
}

export function getMemoryCardCoverZoom(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const containScale = getMemoryCardContainScale(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
  );
  const coverScale = getMemoryCardCoverScale(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
  );
  return containScale && coverScale ? coverScale / containScale : 1;
}

export function getMemoryCardMaxZoom(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return Math.max(
    6,
    getMemoryCardCoverZoom(
      imageWidth,
      imageHeight,
      viewportWidth,
      viewportHeight,
    ) * 4,
  );
}

export function getMemoryCardCenteredContainPlacement(): MemoryCardPhotoPlacement {
  return { ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT };
}

export function getMemoryCardCenteredCoverPlacement(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): MemoryCardPhotoPlacement {
  return {
    ...DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
    zoom: getMemoryCardCoverZoom(
      imageWidth,
      imageHeight,
      viewportWidth,
      viewportHeight,
    ),
  };
}

function normalizeMemoryCardPhotoPlacement(
  placement: MemoryCardPhotoPlacement,
  maxZoom: number,
): MemoryCardPhotoPlacement {
  return {
    zoom: clamp(Number.isFinite(placement.zoom) ? placement.zoom : 1, 1, maxZoom),
    rotation: normalizeDegrees(Number.isFinite(placement.rotation) ? placement.rotation : 0),
    offsetX: Number.isFinite(placement.offsetX) ? placement.offsetX : 0,
    offsetY: Number.isFinite(placement.offsetY) ? placement.offsetY : 0,
  };
}

const cross = (origin: MemoryCardPoint, a: MemoryCardPoint, b: MemoryCardPoint) =>
  (a.x - origin.x) * (b.y - origin.y) -
  (a.y - origin.y) * (b.x - origin.x);

function convexHull(points: readonly MemoryCardPoint[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (values: MemoryCardPoint[]) => {
    const result: MemoryCardPoint[] = [];
    for (const point of values) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2], result[result.length - 1], point) <= 0
      ) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  const lower = half(sorted);
  const upper = half(sorted.reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function getRecoverableCenterRegion(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  placement: Pick<MemoryCardPhotoPlacement, "zoom" | "rotation">,
) {
  const containScale = getMemoryCardContainScale(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
  );
  if (!containScale) return null;

  const zoom = clamp(
    Number.isFinite(placement.zoom) ? placement.zoom : 1,
    1,
    getMemoryCardMaxZoom(
      imageWidth,
      imageHeight,
      viewportWidth,
      viewportHeight,
    ),
  );
  const radians = normalizeDegrees(
    Number.isFinite(placement.rotation) ? placement.rotation : 0,
  ) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const overlap = Math.min(viewportWidth, viewportHeight) *
    MEMORY_CARD_MIN_VISIBLE_RATIO;
  const halfWidth = Math.max(0, imageWidth * containScale * zoom / 2 - overlap);
  const halfHeight = Math.max(0, imageHeight * containScale * zoom / 2 - overlap);
  const imageOffsets = [-1, 1].flatMap((horizontal) =>
    [-1, 1].map((vertical) => ({
      x: horizontal * halfWidth * cosine - vertical * halfHeight * sine,
      y: horizontal * halfWidth * sine + vertical * halfHeight * cosine,
    }))
  );
  const viewportCorners = [
    { x: 0, y: 0 },
    { x: viewportWidth, y: 0 },
    { x: viewportWidth, y: viewportHeight },
    { x: 0, y: viewportHeight },
  ];
  return convexHull(viewportCorners.flatMap((corner) =>
    imageOffsets.map((offset) => ({
      x: corner.x + offset.x,
      y: corner.y + offset.y,
    }))
  ));
}

function clampPointToRegion(
  point: MemoryCardPoint,
  region: readonly MemoryCardPoint[],
) {
  if (region.every((start, index) =>
    cross(start, region[(index + 1) % region.length], point) >= -1e-9
  )) {
    return point;
  }

  let closest = region[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  region.forEach((start, index) => {
    const end = region[(index + 1) % region.length];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const ratio = lengthSquared
      ? clamp(
          ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
            lengthSquared,
          0,
          1,
        )
      : 0;
    const candidate = {
      x: start.x + deltaX * ratio,
      y: start.y + deltaY * ratio,
    };
    const candidateDistance = (point.x - candidate.x) ** 2 +
      (point.y - candidate.y) ** 2;
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  });
  return closest;
}

export function getMemoryCardPhotoOffsetBounds(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  placement: Pick<MemoryCardPhotoPlacement, "zoom" | "rotation">,
) {
  const region = getRecoverableCenterRegion(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    placement,
  );
  if (!region) return null;
  const xValues = region.map(({ x }) => x / viewportWidth - 0.5);
  const yValues = region.map(({ y }) => y / viewportHeight - 0.5);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  };
}

export function clampMemoryCardPhotoPlacement(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  placement: MemoryCardPhotoPlacement,
) {
  const normalized = normalizeMemoryCardPhotoPlacement(
    placement,
    getMemoryCardMaxZoom(
      imageWidth,
      imageHeight,
      viewportWidth,
      viewportHeight,
    ),
  );
  const region = getRecoverableCenterRegion(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    normalized,
  );
  if (!region) return normalized;
  const center = clampPointToRegion({
    x: viewportWidth * (0.5 + normalized.offsetX),
    y: viewportHeight * (0.5 + normalized.offsetY),
  }, region);
  return {
    ...normalized,
    offsetX: center.x / viewportWidth - 0.5,
    offsetY: center.y / viewportHeight - 0.5,
  };
}

export function getPlacedImageRect(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  placement: MemoryCardPhotoPlacement | null,
): PlacedImageRect | null {
  const containScale = getMemoryCardContainScale(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
  );
  if (!containScale) return null;
  const valid = clampMemoryCardPhotoPlacement(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    placement ?? getMemoryCardCenteredCoverPlacement(
      imageWidth,
      imageHeight,
      viewportWidth,
      viewportHeight,
    ),
  );
  const width = imageWidth * containScale * valid.zoom;
  const height = imageHeight * containScale * valid.zoom;
  const centerX = viewportWidth * (0.5 + valid.offsetX);
  const centerY = viewportHeight * (0.5 + valid.offsetY);
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    rotation: valid.rotation,
  };
}

export function panMemoryCardPhotoPlacement(
  startPlacement: MemoryCardPhotoPlacement,
  delta: MemoryCardPoint,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const valid = clampMemoryCardPhotoPlacement(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    startPlacement,
  );
  return clampMemoryCardPhotoPlacement(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    {
      ...valid,
      offsetX: valid.offsetX + delta.x / viewportWidth,
      offsetY: valid.offsetY + delta.y / viewportHeight,
    },
  );
}

export function rebaseMemoryCardGesture(
  points: ReadonlyMap<number, MemoryCardPoint>,
  placement: MemoryCardPhotoPlacement,
): MemoryCardGestureBaseline | null {
  const entries = [...points.entries()];
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    const [[pointerId, startPoint]] = entries;
    return { kind: "single", pointerId, startPoint, startPlacement: { ...placement } };
  }
  const [[firstId, first], [secondId, second]] = entries;
  return {
    kind: "multi",
    pointerIds: [firstId, secondId],
    startCentroid: midpoint(first, second),
    startDistance: Math.max(distance(first, second), Number.EPSILON),
    startAngle: angleBetween(first, second),
    startPlacement: { ...placement },
  };
}

export function removeMemoryCardPointer(
  points: ReadonlyMap<number, MemoryCardPoint>,
  pointerId: number,
  placement: MemoryCardPhotoPlacement,
) {
  const remaining = new Map(points);
  remaining.delete(pointerId);
  return {
    points: remaining,
    baseline: rebaseMemoryCardGesture(remaining, placement),
  };
}

export function applyMemoryCardGesture(
  baseline: MemoryCardGestureBaseline,
  points: ReadonlyMap<number, MemoryCardPoint>,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (baseline.kind === "single") {
    const point = points.get(baseline.pointerId);
    return point
      ? panMemoryCardPhotoPlacement(
          baseline.startPlacement,
          { x: point.x - baseline.startPoint.x, y: point.y - baseline.startPoint.y },
          imageWidth,
          imageHeight,
          viewportWidth,
          viewportHeight,
        )
      : baseline.startPlacement;
  }

  const first = points.get(baseline.pointerIds[0]);
  const second = points.get(baseline.pointerIds[1]);
  if (!first || !second) return baseline.startPlacement;
  const centroid = midpoint(first, second);
  return panMemoryCardPhotoPlacement(
    {
      ...baseline.startPlacement,
      zoom: baseline.startPlacement.zoom *
        distance(first, second) / baseline.startDistance,
      rotation: baseline.startPlacement.rotation + angleDeltaDegrees(
        baseline.startAngle,
        angleBetween(first, second),
      ),
    },
    {
      x: centroid.x - baseline.startCentroid.x,
      y: centroid.y - baseline.startCentroid.y,
    },
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
  );
}

export function reconcileMemoryCardPhotoPlacements(
  slotIds: readonly string[],
  previousPhotoIds: readonly string[],
  nextPhotoIds: readonly string[],
  previousPlacements: Readonly<Record<string, MemoryCardPhotoPlacement>>,
  createDefaultPlacement: (
    photoId: string,
    slotIndex: number,
  ) => MemoryCardPhotoPlacement = () => DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
) {
  return Object.fromEntries(nextPhotoIds.map((photoId, index) => {
    const slotId = slotIds[index];
    const placement = previousPhotoIds[index] === photoId
      ? previousPlacements[slotId]
      : null;
    return [slotId, { ...(placement ?? createDefaultPlacement(photoId, index)) }];
  }));
}
