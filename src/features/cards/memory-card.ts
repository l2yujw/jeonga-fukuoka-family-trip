import {
  getLegacyMemoryCardTemplateSpec,
  getMemoryCardTemplateSpec,
  getMinimumMemoryCardPhotoCount,
  MEMORY_CARD_TEMPLATE_SPECS,
  type MemoryCardTemplateKey,
} from "./memory-card-template-spec";
import {
  DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT,
  reconcileMemoryCardPhotoPlacements,
  type MemoryCardPhotoPlacement,
} from "./memory-card-photo-placement";
import { parseMemoryCardLayoutV4, type MemoryCardLayoutV4 } from "./watercolor-layout";
import { getWatercolorTemplate } from "./watercolor-template-spec";

export {
  MEMORY_CARD_TEMPLATE_SPECS as MEMORY_CARD_TEMPLATES,
  getMemoryCardTemplateSpec as getMemoryCardTemplate,
  getMinimumMemoryCardPhotoCount,
};
export type { MemoryCardTemplateKey };

type MemoryCardSlotMapping = {
  slotId: string;
  photoId: string;
};

export type MemoryCardSlotMappingV3 = MemoryCardSlotMapping & {
  placement: MemoryCardPhotoPlacement;
};

export type MemoryCardLayoutV2 = {
  version: 2;
  slots: MemoryCardSlotMapping[];
  caption: string | null;
};

export type MemoryCardLayoutV3 = {
  version: 3;
  slots: MemoryCardSlotMappingV3[];
  caption: string | null;
};

export type { MemoryCardPhotoPlacement };

export type CanonicalExperimentalMemoryCardLayoutV1 = {
  version: 1;
  slots: MemoryCardSlotMapping[];
  caption: string | null;
};

export type LegacyMemoryCardLayoutV1 = {
  version: 1;
  slots: MemoryCardSlotMapping[];
};

export type MemoryCardRenderModel =
  | { kind: "watercolor"; layoutVersion: 4; layout: MemoryCardLayoutV4 }
  | {
      kind: "canonical";
      layoutVersion: 1 | 2 | 3;
      layout:
        | CanonicalExperimentalMemoryCardLayoutV1
        | MemoryCardLayoutV2
        | MemoryCardLayoutV3;
    }
  | {
      kind: "legacy-simple-v1";
      layoutVersion: 1;
      layout: LegacyMemoryCardLayoutV1;
    };

export type PersistedMemoryCardRow = {
  id: string;
  trip_id: string;
  creator_member_id: string;
  creator_auth_user_id: string;
  template_key: string;
  layout_version: number;
  layout_json: unknown;
  result_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryCard = {
  id: string;
  templateKey: MemoryCardTemplateKey;
  renderModel: MemoryCardRenderModel | null;
  resultStoragePath: string | null;
  resultSignedUrl: string | null;
  isFinalized: boolean;
  creatorName: string | null;
  createdAt: string;
  isOwner: boolean;
};

export function getMemoryCardRenderPhotoIds(
  renderModel: MemoryCardRenderModel,
) {
  return [...new Set(renderModel.layout.slots.map(({ photoId }) => photoId))];
}

export function getMemoryCardReferencedPhotoIds(
  cards: readonly Pick<MemoryCard, "renderModel" | "isFinalized">[],
) {
  return [
    ...new Set(
      cards.flatMap(({ isFinalized, renderModel }) =>
        !isFinalized && renderModel ? getMemoryCardRenderPhotoIds(renderModel) : [],
      ),
    ),
  ];
}

export function normalizeMemoryCardCaption(value: string) {
  return value.normalize("NFC").trim() || null;
}

function parseCanonicalLayout(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
  version: 1 | 2,
  captionRequired: boolean,
): CanonicalExperimentalMemoryCardLayoutV1 | MemoryCardLayoutV2 | null {
  const template = getMemoryCardTemplateSpec(templateKey);
  if (!template || !value || typeof value !== "object") return null;

  const candidate = value as {
    version?: unknown;
    slots?: unknown;
    caption?: unknown;
  };
  const hasCaption = Object.prototype.hasOwnProperty.call(candidate, "caption");
  if (
    candidate.version !== version ||
    !Array.isArray(candidate.slots) ||
    candidate.slots.length < template.acceptedMin ||
    candidate.slots.length > template.acceptedMax ||
    (captionRequired && !hasCaption) ||
    (hasCaption && candidate.caption !== null && typeof candidate.caption !== "string")
  ) {
    return null;
  }

  const slots = candidate.slots as Array<{
    slotId?: unknown;
    photoId?: unknown;
  }>;
  const photoIds = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    if (
      !slot ||
      typeof slot !== "object" ||
      slot.slotId !== template.slots[index].id ||
      typeof slot.photoId !== "string" ||
      !slot.photoId ||
      photoIds.has(slot.photoId)
    ) {
      return null;
    }
    photoIds.add(slot.photoId);
  }

  const parsed = {
    version,
    slots: slots.map(({ slotId, photoId }) => ({
      slotId: slotId as string,
      photoId: photoId as string,
    })),
    caption: normalizeMemoryCardCaption(
      typeof candidate.caption === "string" ? candidate.caption : "",
    ),
  };
  return version === 2
    ? (parsed as MemoryCardLayoutV2)
    : (parsed as CanonicalExperimentalMemoryCardLayoutV1);
}

export function buildMemoryCardLayoutV2(
  templateKey: MemoryCardTemplateKey,
  photoIds: readonly string[],
  caption: string | null = null,
): MemoryCardLayoutV2 {
  const template = getMemoryCardTemplateSpec(templateKey);
  if (
    !template ||
    photoIds.length < template.acceptedMin ||
    photoIds.length > template.acceptedMax
  ) {
    throw new Error("invalid-memory-card-photo-count");
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw new Error("duplicate-memory-card-photo");
  }

  return {
    version: 2,
    slots: photoIds.map((photoId, index) => ({
      slotId: template.slots[index].id,
      photoId,
    })),
    caption: normalizeMemoryCardCaption(caption ?? ""),
  };
}

export function buildMemoryCardLayoutV3(
  templateKey: MemoryCardTemplateKey,
  photoIds: readonly string[],
  caption: string | null = null,
  placementBySlotId: Readonly<Record<string, MemoryCardPhotoPlacement>> = {},
): MemoryCardLayoutV3 {
  const template = getMemoryCardTemplateSpec(templateKey);
  if (
    !template ||
    photoIds.length < template.acceptedMin ||
    photoIds.length > template.acceptedMax
  ) {
    throw new Error("invalid-memory-card-photo-count");
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw new Error("duplicate-memory-card-photo");
  }

  return {
    version: 3,
    slots: photoIds.map((photoId, index) => ({
      slotId: template.slots[index].id,
      photoId,
      placement: {
        ...(placementBySlotId[template.slots[index].id] ??
          DEFAULT_MEMORY_CARD_PHOTO_PLACEMENT),
      },
    })),
    caption: normalizeMemoryCardCaption(caption ?? ""),
  };
}

export function parseMemoryCardLayoutV2(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
) {
  return parseCanonicalLayout(templateKey, value, 2, true) as MemoryCardLayoutV2 | null;
}

function isMemoryCardPhotoPlacement(
  value: unknown,
): value is MemoryCardPhotoPlacement {
  if (!value || typeof value !== "object") return false;
  const placement = value as Partial<MemoryCardPhotoPlacement>;
  return (
    typeof placement.zoom === "number" &&
    Number.isFinite(placement.zoom) &&
    placement.zoom >= 1 &&
    typeof placement.rotation === "number" &&
    Number.isFinite(placement.rotation) &&
    placement.rotation >= -180 &&
    placement.rotation < 180 &&
    typeof placement.offsetX === "number" &&
    Number.isFinite(placement.offsetX) &&
    typeof placement.offsetY === "number" &&
    Number.isFinite(placement.offsetY)
  );
}

export function parseMemoryCardLayoutV3(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
): MemoryCardLayoutV3 | null {
  const template = getMemoryCardTemplateSpec(templateKey);
  if (!template || !value || typeof value !== "object") return null;
  const candidate = value as {
    version?: unknown;
    slots?: unknown;
    caption?: unknown;
  };
  if (
    candidate.version !== 3 ||
    !Array.isArray(candidate.slots) ||
    candidate.slots.length < template.acceptedMin ||
    candidate.slots.length > template.acceptedMax ||
    !Object.prototype.hasOwnProperty.call(candidate, "caption") ||
    (candidate.caption !== null && typeof candidate.caption !== "string")
  ) {
    return null;
  }

  const slots = candidate.slots as Array<{
    slotId?: unknown;
    photoId?: unknown;
    placement?: unknown;
  }>;
  const photoIds = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    if (
      !slot ||
      typeof slot !== "object" ||
      slot.slotId !== template.slots[index].id ||
      typeof slot.photoId !== "string" ||
      !slot.photoId ||
      photoIds.has(slot.photoId) ||
      !isMemoryCardPhotoPlacement(slot.placement)
    ) {
      return null;
    }
    photoIds.add(slot.photoId);
  }

  return {
    version: 3,
    slots: slots.map(({ slotId, photoId, placement }) => {
      const parsedPlacement = placement as MemoryCardPhotoPlacement;
      return {
        slotId: slotId as string,
        photoId: photoId as string,
        placement: {
          zoom: parsedPlacement.zoom,
          rotation: parsedPlacement.rotation,
          offsetX: parsedPlacement.offsetX,
          offsetY: parsedPlacement.offsetY,
        },
      };
    }),
    caption: normalizeMemoryCardCaption(
      typeof candidate.caption === "string" ? candidate.caption : "",
    ),
  };
}

export function parseCanonicalExperimentalMemoryCardLayoutV1(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
) {
  if (templateKey === "one_moment" || templateKey === "instant_memory") return null;
  return parseCanonicalLayout(templateKey, value, 1, false) as
    | CanonicalExperimentalMemoryCardLayoutV1
    | null;
}

export function parseLegacyMemoryCardLayoutV1(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
): LegacyMemoryCardLayoutV1 | null {
  const template = getLegacyMemoryCardTemplateSpec(templateKey);
  if (!template || !value || typeof value !== "object") return null;
  const candidate = value as { version?: unknown; slots?: unknown };
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.slots) ||
    candidate.slots.length !== template.slots.length
  ) {
    return null;
  }

  const slots = candidate.slots as Array<{ slotId?: unknown; photoId?: unknown }>;
  const photoIds = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    if (
      !slot ||
      typeof slot !== "object" ||
      slot.slotId !== template.slots[index].id ||
      typeof slot.photoId !== "string" ||
      !slot.photoId ||
      photoIds.has(slot.photoId)
    ) {
      return null;
    }
    photoIds.add(slot.photoId);
  }

  return {
    version: 1,
    slots: slots.map(({ slotId, photoId }) => ({
      slotId: slotId as string,
      photoId: photoId as string,
    })),
  };
}

export function parseMemoryCardRenderModel(
  templateKey: MemoryCardTemplateKey,
  layoutVersion: number,
  value: unknown,
): MemoryCardRenderModel | null {
  if (layoutVersion === 4) {
    const layout = parseMemoryCardLayoutV4(templateKey, value);
    return layout ? { kind: "watercolor", layoutVersion: 4, layout } : null;
  }
  if (layoutVersion === 3) {
    const layout = parseMemoryCardLayoutV3(templateKey, value);
    return layout ? { kind: "canonical", layoutVersion: 3, layout } : null;
  }
  if (layoutVersion === 2) {
    const layout = parseMemoryCardLayoutV2(templateKey, value);
    return layout ? { kind: "canonical", layoutVersion: 2, layout } : null;
  }
  if (layoutVersion !== 1) return null;

  const canonical = parseCanonicalExperimentalMemoryCardLayoutV1(templateKey, value);
  if (canonical) {
    return { kind: "canonical", layoutVersion: 1, layout: canonical };
  }
  const legacy = parseLegacyMemoryCardLayoutV1(templateKey, value);
  return legacy
    ? { kind: "legacy-simple-v1", layoutVersion: 1, layout: legacy }
    : null;
}

export function createMemoryCardRenderModel(
  layout: MemoryCardLayoutV2 | MemoryCardLayoutV3 | MemoryCardLayoutV4,
): MemoryCardRenderModel {
  if (layout.version === 4) return { kind: "watercolor", layoutVersion: 4, layout };
  return { kind: "canonical", layoutVersion: layout.version, layout };
}

export function randomFillPhotoIds(
  availablePhotoIds: readonly string[],
  count: number,
  random = Math.random,
) {
  const shuffled = [...new Set(availablePhotoIds)];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, count);
}

export function getRandomPhotoCount(
  templateKey: MemoryCardTemplateKey,
  availableCount: number,
  layoutVersion: 1 | 2 | 3 | 4 = 3,
) {
  const template = layoutVersion === 4 ? getWatercolorTemplate(templateKey) : getMemoryCardTemplateSpec(templateKey);
  if (!template || availableCount < template.acceptedMin) return 0;
  return Math.min(availableCount, template.acceptedMax);
}

export function reshuffleMemoryCardLayout(
  templateKey: MemoryCardTemplateKey,
  layout: MemoryCardLayoutV2,
  availablePhotoIds: readonly string[],
  random?: () => number,
): MemoryCardLayoutV2;
export function reshuffleMemoryCardLayout(
  templateKey: MemoryCardTemplateKey,
  layout: MemoryCardLayoutV3,
  availablePhotoIds: readonly string[],
  random?: () => number,
): MemoryCardLayoutV3;
export function reshuffleMemoryCardLayout(
  templateKey: MemoryCardTemplateKey,
  layout: MemoryCardLayoutV2 | MemoryCardLayoutV3,
  availablePhotoIds: readonly string[],
  random = Math.random,
) {
  const count = layout.slots.length;
  const template = getMemoryCardTemplateSpec(templateKey);
  if (!template || getRandomPhotoCount(templateKey, count) !== count) {
    throw new Error("invalid-memory-card-photo-count");
  }
  const currentIds = layout.slots.map(({ photoId }) => photoId);
  let nextIds = randomFillPhotoIds(availablePhotoIds, count, random);
  if (
    nextIds.length > 0 &&
    nextIds.every((photoId, index) => photoId === currentIds[index])
  ) {
    if (nextIds.length === 1) {
      const alternative = [...new Set(availablePhotoIds)].find(
        (photoId) => photoId !== currentIds[0],
      );
      if (alternative) nextIds = [alternative];
    } else {
      nextIds = [...nextIds.slice(1), nextIds[0]];
    }
  }
  if (layout.version === 2) {
    return buildMemoryCardLayoutV2(templateKey, nextIds, layout.caption);
  }
  return buildMemoryCardLayoutV3(
    templateKey,
    nextIds,
    layout.caption,
    reconcileMemoryCardPhotoPlacements(
      template.slots.map(({ id }) => id),
      currentIds,
      nextIds,
      Object.fromEntries(layout.slots.map(({ slotId, placement }) => [slotId, placement])),
    ),
  );
}

export function getMemoryCardRenderTemplate(
  templateKey: MemoryCardTemplateKey,
  renderModel: MemoryCardRenderModel,
) {
  if (renderModel.kind === "watercolor") return getWatercolorTemplate(templateKey, renderModel.layout.templateRevision);
  return renderModel.kind === "legacy-simple-v1"
    ? getLegacyMemoryCardTemplateSpec(templateKey)
    : getMemoryCardTemplateSpec(templateKey);
}

export function resolveMemoryCardSlots<T>(
  templateKey: MemoryCardTemplateKey,
  renderModel: MemoryCardRenderModel,
  photosById: ReadonlyMap<string, T>,
) {
  const selected = new Map<string, {
    photoId: string;
    placement: MemoryCardPhotoPlacement | null;
  }>(
    renderModel.layout.slots.map((slot) => [slot.slotId, {
      photoId: slot.photoId,
      placement: "placement" in slot
        ? (slot as MemoryCardSlotMappingV3).placement
        : null,
    }]),
  );
  const template = getMemoryCardRenderTemplate(templateKey, renderModel);
  return (template?.slots ?? []).map((slot, index) => {
    const mapping = selected.get(slot.id) ?? null;
    const photoId = mapping?.photoId ?? null;
    return {
      slotId: slot.id,
      photoId,
      photo: photoId ? (photosById.get(photoId) ?? null) : null,
      placement: mapping?.placement ?? null,
      optionalEmpty:
        renderModel.kind === "canonical" &&
        index >= renderModel.layout.slots.length &&
        index >= (template?.acceptedMin ?? 0),
    };
  });
}

export function mapPersistedMemoryCardRows(
  rows: readonly PersistedMemoryCardRow[],
  creatorNames: ReadonlyMap<string, string>,
  authUserId: string,
  resultSignedUrls: ReadonlyMap<string, string | null> = new Map(),
): MemoryCard[] {
  return rows.flatMap((row) => {
    const template = getMemoryCardTemplateSpec(row.template_key);
    if (!template) return [];

    return [
      {
        id: row.id,
        templateKey: template.key,
        renderModel: parseMemoryCardRenderModel(
          template.key,
          row.layout_version,
          row.layout_json,
        ),
        resultStoragePath: row.result_storage_path,
        resultSignedUrl: row.result_storage_path
          ? resultSignedUrls.get(row.result_storage_path) ?? null
          : null,
        isFinalized: Boolean(row.result_storage_path),
        creatorName: creatorNames.get(row.creator_member_id) ?? null,
        createdAt: row.created_at,
        isOwner: row.creator_auth_user_id === authUserId,
      },
    ];
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildMemoryCardResultStoragePath(
  tripId: string,
  authUserId: string,
  createUuid: () => string = () => crypto.randomUUID(),
) {
  const resultId = createUuid();
  if (
    !UUID_PATTERN.test(tripId) ||
    !UUID_PATTERN.test(authUserId) ||
    !UUID_V4_PATTERN.test(resultId)
  ) {
    throw new Error("invalid-memory-card-result-path");
  }
  return `${tripId}/${authUserId}/${resultId}.png`;
}

export function isMemoryCardResultStoragePath(
  storagePath: string,
  tripId: string,
  authUserId: string,
) {
  const [pathTripId, pathAuthUserId, filename, ...rest] = storagePath.split("/");
  return (
    rest.length === 0 &&
    pathTripId === tripId &&
    pathAuthUserId === authUserId &&
    UUID_V4_PATTERN.test(filename?.slice(0, -4) ?? "") &&
    filename?.endsWith(".png") === true
  );
}

export function buildMemoryCardInsertPayload({
  authUserId,
  availablePhotoIds,
  layout,
  memberId,
  resultStoragePath,
  templateKey,
  tripId,
}: {
  authUserId: string;
  availablePhotoIds: ReadonlySet<string>;
  layout: unknown;
  memberId: string;
  resultStoragePath: string;
  templateKey: MemoryCardTemplateKey;
  tripId: string;
}) {
  const validatedLayout = layout && typeof layout === "object" && "version" in layout && layout.version === 4
    ? parseMemoryCardLayoutV4(templateKey, layout)
    : parseMemoryCardLayoutV3(templateKey, layout);
  if (!validatedLayout) throw new Error("invalid-memory-card-layout");
  if (
    validatedLayout.slots.some(
      ({ photoId }) => !availablePhotoIds.has(photoId),
    )
  ) {
    throw new Error("invalid-memory-card-photos");
  }
  if (!isMemoryCardResultStoragePath(resultStoragePath, tripId, authUserId)) {
    throw new Error("invalid-memory-card-result-path");
  }

  return {
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: templateKey,
    layout_version: validatedLayout.version,
    layout_json: validatedLayout,
    result_storage_path: resultStoragePath,
  };
}
