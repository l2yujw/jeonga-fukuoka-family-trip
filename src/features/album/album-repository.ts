import type { CurrentTripSession } from "@/features/boarding/boarding-logic";
import { getCurrentAuthSession } from "@/features/boarding/current-trip-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AlbumPhoto,
  LocalPhotoDraft,
  PersistedPhotoRow,
} from "./album-types";
import {
  buildPhotoInsertPayload,
  buildStoragePath,
  mapPersistedPhotoRows,
  normalizeCaption,
} from "./album-utils";

const PHOTO_BUCKET = "trip-photos";
const SIGNED_URL_LIFETIME_SECONDS = 3600;
const PHOTO_COLUMNS =
  "id,trip_id,uploader_member_id,uploader_auth_user_id,storage_path,original_filename,mime_type,caption,taken_at,width,height,created_at";

async function requireAuthUserId() {
  const session = await getCurrentAuthSession();
  if (!session) throw new Error("album-auth-session-missing");
  return session.user.id;
}

async function createSignedUrl(storagePath: string) {
  try {
    const { data, error } = await getSupabaseBrowserClient()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_LIFETIME_SECONDS);

    if (!error) return data.signedUrl;
  } catch {
    // A single unavailable object must not prevent the album metadata from loading.
  }

  console.warn("[album] signed URL unavailable");
  return null;
}

async function createSignedUrls(rows: readonly PersistedPhotoRow[]) {
  return new Map(
    await Promise.all(
      rows.map(async (row) => [row.storage_path, await createSignedUrl(row.storage_path)] as const),
    ),
  );
}

async function removeStorageObject(storagePath: string) {
  try {
    const { error } = await getSupabaseBrowserClient()
      .storage.from(PHOTO_BUCKET)
      .remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
}

export async function loadAlbumPhotos(tripId: string) {
  const authUserId = await requireAuthUserId();
  const supabase = getSupabaseBrowserClient();
  const [photosResult, rosterResult] = await Promise.all([
    supabase
      .from("photos")
      .select(PHOTO_COLUMNS)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    supabase.from("family_members").select("id,name").eq("trip_id", tripId),
  ]);

  if (photosResult.error) throw photosResult.error;
  if (rosterResult.error) throw rosterResult.error;

  const rows = (photosResult.data ?? []) as PersistedPhotoRow[];
  const signedUrls = await createSignedUrls(rows);
  const uploaderNames = new Map(
    (rosterResult.data ?? []).map((member) => [member.id, member.name]),
  );

  return mapPersistedPhotoRows(rows, uploaderNames, authUserId, signedUrls);
}

export async function loadHomeAlbumPreview(tripId: string) {
  const authUserId = await requireAuthUserId();
  const { count, data, error } = await getSupabaseBrowserClient()
    .from("photos")
    .select(PHOTO_COLUMNS, { count: "exact" })
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const rows = (data ?? []) as PersistedPhotoRow[];
  const [photo = null] = mapPersistedPhotoRows(
    rows,
    new Map(),
    authUserId,
    await createSignedUrls(rows),
  );
  return { count: count ?? rows.length, photo };
}

export async function loadHomeAlbumPhoto(tripId: string, photoId: string) {
  const authUserId = await requireAuthUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", photoId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rows = [data as PersistedPhotoRow];
  return mapPersistedPhotoRows(
    rows,
    new Map(),
    authUserId,
    await createSignedUrls(rows),
  )[0] ?? null;
}

export async function uploadAlbumPhoto({
  caption,
  draft,
  tripSession,
}: {
  caption: string;
  draft: LocalPhotoDraft;
  tripSession: CurrentTripSession;
}) {
  const authUserId = await requireAuthUserId();
  const supabase = getSupabaseBrowserClient();
  const storagePath = buildStoragePath(
    tripSession.trip.id,
    authUserId,
    draft.file.type,
  );
  const payload = buildPhotoInsertPayload({
    authUserId,
    caption,
    draft,
    memberId: tripSession.member.id,
    storagePath,
    tripId: tripSession.trip.id,
  });

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, draft.file, {
      contentType: draft.file.type.toLowerCase(),
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("photos")
    .insert(payload)
    .select(PHOTO_COLUMNS)
    .single();

  if (insertError) {
    const cleanedUp = await removeStorageObject(storagePath);
    if (!cleanedUp) console.warn("[album] failed upload left an object for later cleanup");
    throw insertError;
  }

  const row = data as PersistedPhotoRow;
  return mapPersistedPhotoRows(
    [row],
    new Map([[tripSession.member.id, tripSession.member.name]]),
    authUserId,
    new Map([[storagePath, await createSignedUrl(storagePath)]]),
  )[0];
}

export async function updateAlbumPhotoCaption(photo: AlbumPhoto, caption: string) {
  if (!photo.isOwner) throw new Error("photo-not-owned");

  const normalizedCaption = normalizeCaption(caption);
  const { data, error } = await getSupabaseBrowserClient()
    .from("photos")
    .update({ caption: normalizedCaption })
    .eq("id", photo.id)
    .select("caption")
    .single();

  if (error) throw error;
  return data.caption as string | null;
}

export async function downloadAlbumPhoto(photo: AlbumPhoto) {
  await requireAuthUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .storage.from(PHOTO_BUCKET)
    .download(photo.storagePath);

  if (error) throw error;
  return data;
}

export async function deleteAlbumPhoto(photo: AlbumPhoto) {
  if (!photo.isOwner) throw new Error("photo-not-owned");

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("photos")
    .delete()
    .eq("id", photo.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("photo-delete-not-authorized");

  const cleanedUp = await removeStorageObject(photo.storagePath);
  if (!cleanedUp) console.warn("[album] photo metadata deleted; object cleanup failed");
  return { storageCleanupFailed: !cleanedUp };
}
