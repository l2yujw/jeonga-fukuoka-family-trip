import {
  getLegacyMemoryCardTemplateSpec,
  getMemoryCardTemplateSpec,
  getMinimumMemoryCardPhotoCount,
  MEMORY_CARD_TEMPLATE_SPECS,
  type MemoryCardTemplateKey,
} from "./memory-card-template-spec";

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

export type MemoryCardLayoutV2 = {
  version: 2;
  slots: MemoryCardSlotMapping[];
  caption: string | null;
};

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
  | {
      kind: "canonical";
      layoutVersion: 1 | 2;
      layout: CanonicalExperimentalMemoryCardLayoutV1 | MemoryCardLayoutV2;
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
  creatorName: string | null;
  createdAt: string;
  isOwner: boolean;
};

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

export function parseMemoryCardLayoutV2(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
) {
  return parseCanonicalLayout(templateKey, value, 2, true) as MemoryCardLayoutV2 | null;
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
  layout: MemoryCardLayoutV2,
): MemoryCardRenderModel {
  return { kind: "canonical", layoutVersion: 2, layout };
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
) {
  const template = getMemoryCardTemplateSpec(templateKey);
  if (!template || availableCount < template.acceptedMin) return 0;
  return Math.min(availableCount, template.acceptedMax);
}

export function reshuffleMemoryCardLayout(
  templateKey: MemoryCardTemplateKey,
  layout: MemoryCardLayoutV2,
  availablePhotoIds: readonly string[],
  random = Math.random,
) {
  const count = layout.slots.length;
  if (getRandomPhotoCount(templateKey, count) !== count) {
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
  return buildMemoryCardLayoutV2(templateKey, nextIds, layout.caption);
}

export function getMemoryCardRenderTemplate(
  templateKey: MemoryCardTemplateKey,
  renderModel: MemoryCardRenderModel,
) {
  return renderModel.kind === "legacy-simple-v1"
    ? getLegacyMemoryCardTemplateSpec(templateKey)
    : getMemoryCardTemplateSpec(templateKey);
}

export function resolveMemoryCardSlots<T>(
  templateKey: MemoryCardTemplateKey,
  renderModel: MemoryCardRenderModel,
  photosById: ReadonlyMap<string, T>,
) {
  const selected = new Map(
    renderModel.layout.slots.map((slot) => [slot.slotId, slot.photoId]),
  );
  const template = getMemoryCardRenderTemplate(templateKey, renderModel);
  return (template?.slots ?? []).map((slot, index) => {
    const photoId = selected.get(slot.id) ?? null;
    return {
      slotId: slot.id,
      photoId,
      photo: photoId ? (photosById.get(photoId) ?? null) : null,
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
        creatorName: creatorNames.get(row.creator_member_id) ?? null,
        createdAt: row.created_at,
        isOwner: row.creator_auth_user_id === authUserId,
      },
    ];
  });
}

export function buildMemoryCardInsertPayload({
  authUserId,
  availablePhotoIds,
  layout,
  memberId,
  templateKey,
  tripId,
}: {
  authUserId: string;
  availablePhotoIds: ReadonlySet<string>;
  layout: unknown;
  memberId: string;
  templateKey: MemoryCardTemplateKey;
  tripId: string;
}) {
  const validatedLayout = parseMemoryCardLayoutV2(templateKey, layout);
  if (!validatedLayout) throw new Error("invalid-memory-card-layout");
  if (
    validatedLayout.slots.some(
      ({ photoId }) => !availablePhotoIds.has(photoId),
    )
  ) {
    throw new Error("invalid-memory-card-photos");
  }

  return {
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: templateKey,
    layout_version: 2,
    layout_json: validatedLayout,
    result_storage_path: null,
  };
}
