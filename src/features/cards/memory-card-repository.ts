import type { CurrentTripSession } from "@/features/boarding/boarding-logic";
import { getCurrentAuthSession } from "@/features/boarding/current-trip-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildMemoryCardInsertPayload,
  buildMemoryCardLayoutV2,
  mapPersistedMemoryCardRows,
  type MemoryCard,
  type MemoryCardTemplateKey,
  type PersistedMemoryCardRow,
} from "./memory-card";

const MEMORY_CARD_COLUMNS =
  "id,trip_id,creator_member_id,creator_auth_user_id,template_key,layout_version,layout_json,result_storage_path,created_at,updated_at";

async function requireAuthUserId() {
  const session = await getCurrentAuthSession();
  if (!session) throw new Error("memory-card-auth-session-missing");
  return session.user.id;
}

export async function loadMemoryCards(tripId: string) {
  const authUserId = await requireAuthUserId();
  const supabase = getSupabaseBrowserClient();
  const [cardsResult, rosterResult] = await Promise.all([
    supabase
      .from("memory_cards")
      .select(MEMORY_CARD_COLUMNS)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    supabase.from("family_members").select("id,name").eq("trip_id", tripId),
  ]);

  if (cardsResult.error) throw cardsResult.error;
  if (rosterResult.error) throw rosterResult.error;

  return mapPersistedMemoryCardRows(
    (cardsResult.data ?? []) as PersistedMemoryCardRow[],
    new Map((rosterResult.data ?? []).map((member) => [member.id, member.name])),
    authUserId,
  );
}

export async function createMemoryCard({
  availablePhotoIds,
  caption,
  photoIds,
  templateKey,
  tripSession,
}: {
  availablePhotoIds: readonly string[];
  caption: string;
  photoIds: readonly string[];
  templateKey: MemoryCardTemplateKey;
  tripSession: CurrentTripSession;
}) {
  const authUserId = await requireAuthUserId();
  const layout = buildMemoryCardLayoutV2(templateKey, photoIds, caption);
  const payload = buildMemoryCardInsertPayload({
    authUserId,
    availablePhotoIds: new Set(availablePhotoIds),
    layout,
    memberId: tripSession.member.id,
    templateKey,
    tripId: tripSession.trip.id,
  });

  const { data, error } = await getSupabaseBrowserClient()
    .from("memory_cards")
    .insert(payload)
    .select(MEMORY_CARD_COLUMNS)
    .single();

  if (error) throw error;
  return mapPersistedMemoryCardRows(
    [data as PersistedMemoryCardRow],
    new Map([[tripSession.member.id, tripSession.member.name]]),
    authUserId,
  )[0];
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
}
