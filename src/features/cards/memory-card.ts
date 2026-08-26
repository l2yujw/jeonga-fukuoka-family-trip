export const MEMORY_CARD_TEMPLATES = [
  {
    key: "polaroid_moodboard",
    displayName: "Polaroid Moodboard",
    slotIds: ["hero", "left", "right"],
  },
  {
    key: "four_cut",
    displayName: "Four Cut",
    slotIds: ["cut-1", "cut-2", "cut-3", "cut-4"],
  },
  {
    key: "editorial_collage",
    displayName: "Editorial Collage",
    slotIds: ["feature", "top", "bottom"],
  },
] as const;

export type MemoryCardTemplateKey =
  (typeof MEMORY_CARD_TEMPLATES)[number]["key"];

export type MemoryCardLayoutV1 = {
  version: 1;
  slots: Array<{
    slotId: string;
    photoId: string;
  }>;
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
  layout: MemoryCardLayoutV1 | null;
  creatorName: string | null;
  createdAt: string;
  isOwner: boolean;
};

export function getMemoryCardTemplate(key: string) {
  return MEMORY_CARD_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function buildMemoryCardLayout(
  templateKey: MemoryCardTemplateKey,
  photoIds: readonly string[],
): MemoryCardLayoutV1 {
  const template = getMemoryCardTemplate(templateKey);
  if (!template || photoIds.length > template.slotIds.length) {
    throw new Error("invalid-memory-card-photo-count");
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw new Error("duplicate-memory-card-photo");
  }

  return {
    version: 1,
    slots: photoIds.map((photoId, index) => ({
      slotId: template.slotIds[index],
      photoId,
    })),
  };
}

export function parseMemoryCardLayoutV1(
  templateKey: MemoryCardTemplateKey,
  value: unknown,
): MemoryCardLayoutV1 | null {
  const template = getMemoryCardTemplate(templateKey);
  if (!template || !value || typeof value !== "object") return null;

  const candidate = value as { version?: unknown; slots?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.slots)) return null;
  if (candidate.slots.length !== template.slotIds.length) return null;

  const slots = candidate.slots as Array<{ slotId?: unknown; photoId?: unknown }>;
  const photoIds = new Set<string>();

  for (const [index, slot] of slots.entries()) {
    if (
      !slot ||
      typeof slot !== "object" ||
      slot.slotId !== template.slotIds[index] ||
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

export function randomFillPhotoIds(
  availablePhotoIds: readonly string[],
  slotCount: number,
  random = Math.random,
) {
  const shuffled = [...new Set(availablePhotoIds)];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, slotCount);
}

export function resolveMemoryCardSlots<T>(
  templateKey: MemoryCardTemplateKey,
  layout: MemoryCardLayoutV1,
  photosById: ReadonlyMap<string, T>,
) {
  const selected = new Map(layout.slots.map((slot) => [slot.slotId, slot.photoId]));
  return (getMemoryCardTemplate(templateKey)?.slotIds ?? []).map((slotId) => {
    const photoId = selected.get(slotId) ?? null;
    return { slotId, photoId, photo: photoId ? (photosById.get(photoId) ?? null) : null };
  });
}

export function mapPersistedMemoryCardRows(
  rows: readonly PersistedMemoryCardRow[],
  creatorNames: ReadonlyMap<string, string>,
  authUserId: string,
): MemoryCard[] {
  return rows.flatMap((row) => {
    const template = getMemoryCardTemplate(row.template_key);
    if (!template) return [];

    return [{
      id: row.id,
      templateKey: template.key,
      layout:
        row.layout_version === 1
          ? parseMemoryCardLayoutV1(template.key, row.layout_json)
          : null,
      creatorName: creatorNames.get(row.creator_member_id) ?? null,
      createdAt: row.created_at,
      isOwner: row.creator_auth_user_id === authUserId,
    }];
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
  const validatedLayout = parseMemoryCardLayoutV1(templateKey, layout);
  if (!validatedLayout) throw new Error("invalid-memory-card-layout");
  if (validatedLayout.slots.some(({ photoId }) => !availablePhotoIds.has(photoId))) {
    throw new Error("invalid-memory-card-photos");
  }

  return {
    trip_id: tripId,
    creator_member_id: memberId,
    creator_auth_user_id: authUserId,
    template_key: templateKey,
    layout_version: 1,
    layout_json: validatedLayout,
    result_storage_path: null,
  };
}
