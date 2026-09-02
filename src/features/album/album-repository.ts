import type { CurrentTripSession } from "@/features/boarding/boarding-logic";
import { getCurrentAuthSession } from "@/features/boarding/current-trip-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AlbumPhoto,
  LocalPhotoDraft,
  PersistedPhotoRow,
} from "./album-types";
import {
  ALBUM_SIGNED_URL_LIFETIME_SECONDS,
  albumSignedUrlBroker,
} from "./album-signed-url-cache";
import {
  buildPhotoInsertPayload,
  buildStoragePath,
  mapPersistedPhotoRows,
  normalizeCaption,
} from "./album-utils";

const PHOTO_BUCKET = "trip-photos";
const PHOTO_COLUMNS =
  "id,trip_id,uploader_member_id,uploader_auth_user_id,storage_path,original_filename,mime_type,caption,taken_at,width,height,created_at";

async function requireAuthUserId() {
  const session = await getCurrentAuthSession();
  if (!session) throw new Error("album-auth-session-missing");
  return session.user.id;
}

let batchedAuthUserId: Promise<string> | null = null;

function requireBatchedAuthUserId() {
  if (batchedAuthUserId) return batchedAuthUserId;
  const request = requireAuthUserId();
  batchedAuthUserId = request;
  const clear = () => setTimeout(() => {
    if (batchedAuthUserId === request) batchedAuthUserId = null;
  }, 0);
  void request.then(clear, clear);
  return request;
}

async function signStoragePaths(storagePaths: readonly string[]) {
  const signedUrls = new Map<string, string | null>(
    storagePaths.map((storagePath) => [storagePath, null] as const),
  );
  try {
    const { data, error } = await getSupabaseBrowserClient()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrls([...storagePaths], ALBUM_SIGNED_URL_LIFETIME_SECONDS);

    if (error) return signedUrls;
    for (const [index, item] of data.entries()) {
      const storagePath = item.path && signedUrls.has(item.path)
        ? item.path
        : storagePaths[index];
      if (storagePath && !item.error && item.signedUrl) {
        signedUrls.set(storagePath, item.signedUrl);
      }
    }
  } catch {
    // A failed signing batch leaves each path independently unavailable.
  }
  return signedUrls;
}

function resolveSignedUrls(authUserId: string, storagePaths: readonly string[]) {
  return albumSignedUrlBroker.resolve(authUserId, storagePaths, signStoragePaths);
}

export async function loadAlbumPhotoSignedUrls(
  storagePaths: readonly string[],
) {
  const authUserId = await requireBatchedAuthUserId();
  return resolveSignedUrls(authUserId, storagePaths);
}

export async function refreshAlbumPhotoSignedUrl(storagePath: string) {
  const authUserId = await requireAuthUserId();
  albumSignedUrlBroker.invalidate(authUserId, storagePath);
  return (
    await resolveSignedUrls(authUserId, [storagePath])
  ).get(storagePath) ?? null;
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

export async function loadAlbumPhotoMetadata(tripId: string) {
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
  const uploaderNames = new Map(
    (rosterResult.data ?? []).map((member) => [member.id, member.name]),
  );

  return mapPersistedPhotoRows(rows, uploaderNames, authUserId, new Map());
}

export async function loadAlbumPhotos(tripId: string) {
  return loadAlbumPhotoMetadata(tripId);
}

export async function loadAlbumPhotosByIds(
  tripId: string,
  photoIds: readonly string[],
) {
  const uniquePhotoIds = [...new Set(photoIds)];
  if (uniquePhotoIds.length === 0) return [];

  const authUserId = await requireAuthUserId();
  const supabase = getSupabaseBrowserClient();
  const [photosResult, rosterResult] = await Promise.all([
    supabase
      .from("photos")
      .select(PHOTO_COLUMNS)
      .eq("trip_id", tripId)
      .in("id", uniquePhotoIds)
      .order("created_at", { ascending: false }),
    supabase.from("family_members").select("id,name").eq("trip_id", tripId),
  ]);

  if (photosResult.error) throw photosResult.error;
  if (rosterResult.error) throw rosterResult.error;

  return mapPersistedPhotoRows(
    (photosResult.data ?? []) as PersistedPhotoRow[],
    new Map((rosterResult.data ?? []).map((member) => [member.id, member.name])),
    authUserId,
    new Map(),
  );
}

export async function loadAlbumPhotoCount(tripId: string) {
  await requireAuthUserId();
  const { count, error } = await getSupabaseBrowserClient()
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if (error) throw error;
  return count ?? 0;
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
    await resolveSignedUrls(
      authUserId,
      rows.map(({ storage_path }) => storage_path),
    ),
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
    await resolveSignedUrls(
      authUserId,
      rows.map(({ storage_path }) => storage_path),
    ),
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
    await resolveSignedUrls(authUserId, [storagePath]),
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
