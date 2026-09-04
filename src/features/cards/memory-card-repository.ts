import type { CurrentTripSession } from "@/features/boarding/boarding-logic";
import { getCurrentAuthSession } from "@/features/boarding/current-trip-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildMemoryCardInsertPayload,
  buildMemoryCardResultStoragePath,
  mapPersistedMemoryCardRows,
  type MemoryCard,
  type MemoryCardLayoutV3,
  type MemoryCardTemplateKey,
  type PersistedMemoryCardRow,
} from "./memory-card";

export const MEMORY_CARD_RESULT_BUCKET = "memory-card-results";
const MEMORY_CARD_RESULT_SIGNED_URL_LIFETIME_SECONDS = 3600;
const MEMORY_CARD_COLUMNS =
  "id,trip_id,creator_member_id,creator_auth_user_id,template_key,layout_version,layout_json,result_storage_path,created_at,updated_at";

async function requireAuthUserId() {
  const session = await getCurrentAuthSession();
  if (!session) throw new Error("memory-card-auth-session-missing");
  return session.user.id;
}

async function signResultStoragePaths(storagePaths: readonly string[]) {
  const signedUrls = new Map<string, string | null>(
    storagePaths.map((storagePath) => [storagePath, null] as const),
  );
  if (storagePaths.length === 0) return signedUrls;

  try {
    const { data, error } = await getSupabaseBrowserClient()
      .storage.from(MEMORY_CARD_RESULT_BUCKET)
      .createSignedUrls(
        [...storagePaths],
        MEMORY_CARD_RESULT_SIGNED_URL_LIFETIME_SECONDS,
      );
    if (error) return signedUrls;
    data.forEach((item, index) => {
      const path = item.path && signedUrls.has(item.path)
        ? item.path
        : storagePaths[index];
      if (path && !item.error && item.signedUrl) {
        signedUrls.set(path, item.signedUrl);
      }
    });
  } catch {
    // Finalized metadata remains readable when a private URL cannot be signed.
  }
  return signedUrls;
}

async function removeResultStorageObject(storagePath: string) {
  try {
    const { error } = await getSupabaseBrowserClient()
      .storage.from(MEMORY_CARD_RESULT_BUCKET)
      .remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
}

export async function refreshMemoryCardResultSignedUrl(storagePath: string) {
  try {
    const { data, error } = await getSupabaseBrowserClient()
      .storage.from(MEMORY_CARD_RESULT_BUCKET)
      .createSignedUrl(
        storagePath,
        MEMORY_CARD_RESULT_SIGNED_URL_LIFETIME_SECONDS,
      );
    return error ? null : data.signedUrl;
  } catch {
    return null;
  }
}

async function loadMemoryCardsWithLimit(tripId: string, limit?: number) {
  const authUserId = await requireAuthUserId();
  const supabase = getSupabaseBrowserClient();
  let cardsQuery = supabase
    .from("memory_cards")
    .select(MEMORY_CARD_COLUMNS)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (limit) cardsQuery = cardsQuery.limit(limit);

  const [cardsResult, rosterResult] = await Promise.all([
    cardsQuery,
    supabase.from("family_members").select("id,name").eq("trip_id", tripId),
  ]);

  if (cardsResult.error) throw cardsResult.error;
  if (rosterResult.error) throw rosterResult.error;

  const rows = (cardsResult.data ?? []) as PersistedMemoryCardRow[];
  const resultSignedUrls = await signResultStoragePaths(
    rows.flatMap(({ result_storage_path }) =>
      result_storage_path ? [result_storage_path] : []),
  );

  return mapPersistedMemoryCardRows(
    rows,
    new Map((rosterResult.data ?? []).map((member) => [member.id, member.name])),
    authUserId,
    resultSignedUrls,
  );
}

export function loadMemoryCards(tripId: string) {
  return loadMemoryCardsWithLimit(tripId);
}

export async function loadLatestMemoryCard(tripId: string) {
  return (await loadMemoryCardsWithLimit(tripId, 1))[0] ?? null;
}

export async function createMemoryCard({
  availablePhotoIds,
  layout,
  resultPng,
  templateKey,
  tripSession,
}: {
  availablePhotoIds: readonly string[];
  layout: MemoryCardLayoutV3;
  resultPng: Blob;
  templateKey: MemoryCardTemplateKey;
  tripSession: CurrentTripSession;
}) {
  const authUserId = await requireAuthUserId();
  const resultStoragePath = buildMemoryCardResultStoragePath(
    tripSession.trip.id,
    authUserId,
  );
  const payload = buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(availablePhotoIds),
    layout,
    memberId: tripSession.member.id,
    resultStoragePath,
    templateKey,
    tripId: tripSession.trip.id,
  });
  const supabase = getSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from(MEMORY_CARD_RESULT_BUCKET)
    .upload(resultStoragePath, resultPng, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("memory_cards")
    .insert(payload)
    .select(MEMORY_CARD_COLUMNS)
    .single();

  if (error) {
    const cleanedUp = await removeResultStorageObject(resultStoragePath);
    if (!cleanedUp) {
      console.warn("[cards] failed finalize left an object for later cleanup");
    }
    throw error;
  }
  return mapPersistedMemoryCardRows(
    [data as PersistedMemoryCardRow],
    new Map([[tripSession.member.id, tripSession.member.name]]),
    authUserId,
    await signResultStoragePaths([resultStoragePath]),
  )[0];
}

export async function downloadMemoryCardResult(card: MemoryCard) {
  if (!card.resultStoragePath) throw new Error("memory-card-result-missing");
  await requireAuthUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .storage.from(MEMORY_CARD_RESULT_BUCKET)
    .download(card.resultStoragePath);
  if (error) throw error;
  return data;
}

export async function deleteMemoryCard(card: MemoryCard) {
  if (!card.isOwner) throw new Error("memory-card-not-owned");

  const { data, error } = await getSupabaseBrowserClient()
    .from("memory_cards")
    .delete()
    .eq("id", card.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("memory-card-delete-not-authorized");

  if (!card.resultStoragePath) return { storageCleanupFailed: false };
  const cleanedUp = await removeResultStorageObject(card.resultStoragePath);
  if (!cleanedUp) {
    console.warn("[cards] card metadata deleted; result cleanup failed");
  }
  return { storageCleanupFailed: !cleanedUp };
}
