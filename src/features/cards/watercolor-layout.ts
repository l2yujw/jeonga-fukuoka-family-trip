import type { MemoryCardSlotMappingV3 } from "./memory-card";
import type { MemoryCardPhotoPlacement } from "./memory-card-photo-placement";
import { getWatercolorTemplate, WATERCOLOR_REVISION, type WatercolorTemplate } from "./watercolor-template-spec";
import type { MemoryCardTemplateKey } from "./memory-card-template-spec";
export type MemoryCardLayoutV4 = {
  version: 4;
  templateRevision: typeof WATERCOLOR_REVISION;
  slots: MemoryCardSlotMappingV3[];
  textValues: Record<string, string | null>;
  dateValues: Record<string, string | null>;
  caption: string | null;
};
export type WatercolorDraft = {
  cardValues: Record<string, string | null>;
  annotationsByPhotoId: Record<string, Record<string, string | null>>;
};
export function createWatercolorDraft(template: WatercolorTemplate, trip: {
  title: string;
  startDate: string;
  endDate: string;
}): WatercolorDraft {
  return { cardValues: Object.fromEntries(template.fields.filter(f => !f.photoSlotId).map(f => [f.id, f.defaultPolicy === "trip title" ? trip.title : f.id === "trip.start" ? trip.startDate : f.id === "trip.end" ? trip.endDate : null])), annotationsByPhotoId: {} };
}
export function getWatercolorDraftValue(draft: WatercolorDraft, field: WatercolorTemplate["fields"][number], slots: readonly {
  slotId: string;
  photoId: string;
}[]) {
  const photoId = slots.find(s => s.slotId === field.photoSlotId)?.photoId;
  return field.photoSlotId ? (photoId ? draft.annotationsByPhotoId[photoId]?.[field.role!] ?? null : null) : draft.cardValues[field.id] ?? null;
}
export function setWatercolorDraftValue(draft: WatercolorDraft, field: WatercolorTemplate["fields"][number], slots: readonly {
  slotId: string;
  photoId: string;
}[], value: string | null): WatercolorDraft {
  if (!field.photoSlotId)
    return { ...draft, cardValues: { ...draft.cardValues, [field.id]: value } };
  const photoId = slots.find(s => s.slotId === field.photoSlotId)?.photoId;
  if (!photoId)
    return draft;
  return { ...draft, annotationsByPhotoId: { ...draft.annotationsByPhotoId, [photoId]: { ...draft.annotationsByPhotoId[photoId], [field.role!]: value } } };
}
export function projectWatercolorLayout(template: WatercolorTemplate, slots: readonly MemoryCardSlotMappingV3[], draft: WatercolorDraft): MemoryCardLayoutV4 {
  const values = (kind: string) => Object.fromEntries(template.fields.filter(f => f.kind === kind).map(f => [f.id, getWatercolorDraftValue(draft, f, slots)]));
  const textValues = values("plainText");
  return { version: 4, templateRevision: WATERCOLOR_REVISION, slots: structuredClone([...slots]), textValues, dateValues: values("isoDate"), caption: textValues[template.primary] };
}
export function normalizeWatercolorText(value: string | null) {
  if (value === null)
    return null;
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n");
  if (Array.from(text).some(c => { const cp = c.codePointAt(0)!; return cp === 0 || (cp >= 0xd800 && cp <= 0xdfff); }))
    throw new Error("안전하게 저장할 수 없는 문자가 있어요.");
  return text.trim() ? text : null;
}
export function isWatercolorDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const days = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1];
}
export function validateWatercolorValues(template: WatercolorTemplate, layout: Pick<MemoryCardLayoutV4, "textValues" | "dateValues">) {
  const errors: Record<string, string> = {};
  for (const field of template.fields) {
    const raw = (field.kind === "isoDate" ? layout.dateValues : layout.textValues)?.[field.id];
    if (raw !== null && typeof raw !== "string") {
      errors[field.id] = "문구 값을 확인해주세요.";
      continue;
    }
    if (field.kind === "isoDate") {
      if (raw !== null && !isWatercolorDate(raw))
        errors[field.id] = "유효한 날짜를 입력해주세요.";
      continue;
    }
    try {
      const value = normalizeWatercolorText(raw);
      if (value && (Array.from(value).length > field.maxCodePoints || value.split("\n").length > field.maxLines))
        errors[field.id] = `${field.maxCodePoints}자, ${field.maxLines}줄 이내로 줄여주세요.`;
      if (value && /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
        errors[field.id] = "지원하지 않는 제어 문자가 있어요.";
    }
    catch {
      errors[field.id] = "안전하게 저장할 수 없는 문자가 있어요.";
    }
  }
  const start = layout.dateValues?.["trip.start"], end = layout.dateValues?.["trip.end"];
  if ((start === null) !== (end === null) || (isWatercolorDate(start) && isWatercolorDate(end) && start > end)) {
    errors["trip.start"] = "시작일과 종료일을 함께 입력하고 순서를 확인해주세요.";
    errors["trip.end"] = errors["trip.start"];
  }
  return errors;
}
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isWatercolorPlacement(v: unknown): v is MemoryCardPhotoPlacement {
  return object(v) && exactKeys(v, ["zoom", "rotation", "offsetX", "offsetY"]) && Object.values(v).every(n => typeof n === "number" && Number.isFinite(n)) && Number(v.zoom) >= 1 && Number(v.zoom) <= 10000 && Number(v.rotation) >= -180 && Number(v.rotation) < 180 && Math.abs(Number(v.offsetX)) <= 10000 && Math.abs(Number(v.offsetY)) <= 10000;
}
// Match JSONB's UTF-8 text sizing (including separator spaces), without persisting URLs.
export function watercolorPayloadBytes(value: unknown): number {
  const json = (v: unknown): string => Array.isArray(v) ? `[${v.map(json).join(", ")}]` : object(v) ? `{${Object.entries(v).map(([k, val]) => `${JSON.stringify(k)}: ${json(val)}`).join(", ")}}` : JSON.stringify(v);
  return new TextEncoder().encode(json(value)).length;
}
export function parseMemoryCardLayoutV4(key: MemoryCardTemplateKey, value: unknown): MemoryCardLayoutV4 | null {
  if (!object(value) || !exactKeys(value, ["version", "templateRevision", "slots", "textValues", "dateValues", "caption"]) || value.version !== 4 || value.templateRevision !== WATERCOLOR_REVISION)
    return null;
  if (watercolorPayloadBytes(value) > 32768)
    return null;
  const template = getWatercolorTemplate(key, value.templateRevision);
  if (!template || !Array.isArray(value.slots) || value.slots.length !== template.slots.length || !object(value.textValues) || !object(value.dateValues))
    return null;
  if (!exactKeys(value.textValues, template.fields.filter(f => f.kind === "plainText").map(f => f.id)) || !exactKeys(value.dateValues, template.fields.filter(f => f.kind === "isoDate").map(f => f.id)))
    return null;
  const ids = new Set<string>();
  for (const [i, slot] of value.slots.entries()) {
    if (!object(slot) || !exactKeys(slot, ["slotId", "photoId", "placement"]) || slot.slotId !== template.slots[i].id || typeof slot.photoId !== "string" || !uuid.test(slot.photoId) || ids.has(slot.photoId.toLowerCase()) || !isWatercolorPlacement(slot.placement))
      return null;
    ids.add(slot.photoId.toLowerCase());
  }
  const layout = value as MemoryCardLayoutV4;
  if (Object.keys(validateWatercolorValues(template, layout)).length)
    return null;
  try {
    const textValues = Object.fromEntries(Object.entries(layout.textValues).map(([k, v]) => [k, normalizeWatercolorText(v)]));
    if (normalizeWatercolorText(layout.caption) !== textValues[template.primary])
      return null;
    const parsed = { ...structuredClone(layout), textValues, caption: textValues[template.primary] };
    return watercolorPayloadBytes(parsed) <= 32768 ? parsed : null;
  }
  catch {
    return null;
  }
}
export function finalizeWatercolorLayout(key: MemoryCardTemplateKey, layout: MemoryCardLayoutV4) {
  const parsed = parseMemoryCardLayoutV4(key, layout);
  if (!parsed)
    throw new Error("카드의 사진·문구·날짜를 확인해주세요.");
  return parsed;
}
