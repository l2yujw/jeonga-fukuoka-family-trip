import type { CurrentTripSession } from "@/features/boarding/boarding-logic";
import { getCurrentAuthSession, getCurrentTripSession } from "@/features/boarding/current-trip-session";
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

import type { MemoryCardLayoutV4 } from "./watercolor-layout";

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

export type MemoryCardSaveAttempt = {
  payload: ReturnType<typeof buildMemoryCardInsertPayload>;
  resultPng: Blob;
  tripSession: CurrentTripSession;
  authUserId: string;
};
export class MemoryCardOutcomeUnknown extends Error {
  attempt: MemoryCardSaveAttempt;
  constructor(attempt: MemoryCardSaveAttempt) {
    super("저장 결과를 확인 중이에요. 다시 확인해도 같은 카드의 저장 상태만 조회해요.");
    this.name = "MemoryCardOutcomeUnknown";
    this.attempt = attempt;
  }
}
const stableJson = (value: unknown): string => {
  if(Array.isArray(value))return `[${value.map(stableJson).join(",")}]`;
  if(value && typeof value === "object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson((value as Record<string,unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
async function requireAttemptIdentity(attempt: MemoryCardSaveAttempt) {
  if(await requireAuthUserId() !== attempt.authUserId)throw new Error("인증 정보가 변경되었어요. 이전 저장 결과는 원래 탑승 정보에서 확인해주세요.");
  if(attempt.payload.layout_version === 4){
    const current = await getCurrentTripSession();
    if(current?.trip.id !== attempt.tripSession.trip.id || current?.member.id !== attempt.tripSession.member.id)throw new Error("탑승 정보가 변경되었어요. 이전 저장 결과는 원래 탑승 정보에서 확인해주세요.");
  }
}
function mapSavedAttempt(attempt:MemoryCardSaveAttempt,row:PersistedMemoryCardRow,signed:Map<string,string|null>) {
  return mapPersistedMemoryCardRows([row],new Map([[attempt.tripSession.member.id,attempt.tripSession.member.name]]),attempt.authUserId,signed)[0];
}
export async function verifyMemoryCardSave(attempt: MemoryCardSaveAttempt): Promise<MemoryCard|null> {
  await requireAttemptIdentity(attempt);
  const {payload}=attempt;
  try {
    const {data,error}=await getSupabaseBrowserClient().from("memory_cards").select(MEMORY_CARD_COLUMNS)
      .eq("trip_id",payload.trip_id).eq("creator_auth_user_id",attempt.authUserId)
      .eq("creator_member_id",payload.creator_member_id).eq("result_storage_path",payload.result_storage_path).maybeSingle();
    if(error||!data)return null;
    const row=data as PersistedMemoryCardRow;
    if(row.trip_id!==payload.trip_id||row.creator_auth_user_id!==attempt.authUserId||row.creator_member_id!==payload.creator_member_id||row.result_storage_path!==payload.result_storage_path||row.template_key!==payload.template_key||row.layout_version!==payload.layout_version||stableJson(row.layout_json)!==stableJson(payload.layout_json))return null;
    return mapSavedAttempt(attempt,row,await signResultStoragePaths([payload.result_storage_path]));
  } catch {return null;}
}
function definiteInsertRejection(error:unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code):"";
  return /^(22|23)[0-9A-Z]{3}$/.test(code)||["42501","PGRST102","PGRST204","PGRST205","PGRST301","PGRST302"].includes(code);
}
function definiteUploadRejection(error:unknown) {
  const status=error&&typeof error==="object"&&"statusCode" in error?Number(error.statusCode):0;
  return status>=400&&status<500&&status!==408;
}
export async function createMemoryCard({availablePhotoIds,layout,resultPng,templateKey,tripSession,expectedAuthUserId}: {
  availablePhotoIds:readonly string[];layout: MemoryCardLayoutV3 | MemoryCardLayoutV4;resultPng:Blob;
  templateKey:MemoryCardTemplateKey;tripSession:CurrentTripSession;expectedAuthUserId?:string;
}) {
  layout=structuredClone(layout);
  tripSession=structuredClone(tripSession);
  availablePhotoIds=[...availablePhotoIds];
  const authUserId = await requireAuthUserId();
  if(expectedAuthUserId&&expectedAuthUserId!==authUserId)throw new Error("인증 정보가 변경되었어요. 다시 확인해주세요.");
  const resultStoragePath=buildMemoryCardResultStoragePath(tripSession.trip.id,authUserId);
  const payload=buildMemoryCardInsertPayload({authUserId,availablePhotoIds:new Set(availablePhotoIds),layout,memberId: tripSession.member.id,resultStoragePath,templateKey,tripId: tripSession.trip.id});
  const attempt:MemoryCardSaveAttempt={payload:structuredClone(payload),resultPng,tripSession:structuredClone(tripSession),authUserId};
  await requireAttemptIdentity(attempt);
  const supabase=getSupabaseBrowserClient();
  const unknown=async()=>{
    try {const saved=await verifyMemoryCardSave(attempt);if(saved)return saved;}catch{ /* Keep the original attempt under its original identity. */ }
    throw new MemoryCardOutcomeUnknown(attempt);
  };
  try{
    const {error}=await supabase.storage.from(MEMORY_CARD_RESULT_BUCKET).upload(resultStoragePath, resultPng,{contentType:"image/png",upsert: false});
    if(error){if(definiteUploadRejection(error))throw Object.assign(new Error(error.message),{definiteUpload:true});return unknown();}
  }catch(error){if(error&&typeof error==="object"&&"definiteUpload" in error)throw error;return unknown();}
  // This attempt has not inserted yet; identity changes cannot reuse its bytes for another member.
  try { await requireAttemptIdentity(attempt); } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : "인증 정보가 변경되었어요."} 업로드된 이미지의 정리는 원래 탑승 정보에서 별도 확인이 필요해요.`);
  }
  try{
    const {data,error}=await supabase.from("memory_cards").insert(attempt.payload).select(MEMORY_CARD_COLUMNS).single();
    if(error){
      if(definiteInsertRejection(error)){
        const cleaned=await removeResultStorageObject(resultStoragePath);
        throw Object.assign(new Error(cleaned?error.message:`${error.message} (저장 이미지 정리는 별도 확인이 필요해요.)`),{definiteInsert:true});
      }
      return unknown();
    }
    if(!data)return unknown();
    return mapSavedAttempt(attempt,data as PersistedMemoryCardRow,await signResultStoragePaths([resultStoragePath]));
  }catch(error){if(error&&typeof error==="object"&&"definiteInsert" in error)throw error;return unknown();}
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
