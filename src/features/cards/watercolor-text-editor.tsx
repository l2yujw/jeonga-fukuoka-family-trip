"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import type { MemoryCardSlotMappingV3 } from "./memory-card";
import { getWatercolorDraftValue, projectWatercolorLayout, setWatercolorDraftValue, setWatercolorTripDateDisplay, validateWatercolorValues, type WatercolorDraft } from "./watercolor-layout";
import type { WatercolorField, WatercolorTemplate } from "./watercolor-template-spec";
import { WatercolorPreview, type WatercolorValidation } from "./watercolor-preview";
import type { WatercolorAppearance } from "./watercolor-appearance";
const groupOf = (f: WatercolorField) => f.kind === "isoDate" || /note|signoff|location/.test(f.id) ? "메모·날짜" : "제목·소개";
export function WatercolorTextEditor({ template, initialDraft, slots, photos, appearance, initialFieldId, trip, onApply, onCancel }: {
  appearance?: WatercolorAppearance;
  template: WatercolorTemplate;
  initialDraft: WatercolorDraft;
  slots: readonly MemoryCardSlotMappingV3[];
  photos: readonly AlbumPhoto[];
  initialFieldId?: string | null;
  trip: { startDate: string; endDate: string };
  onApply: (draft: WatercolorDraft) => void;
  onCancel: () => void;
}) {
  const [workingDraft, setWorkingDraft] = useState(() => structuredClone(initialDraft));
  const [activeId, setActiveId] = useState(initialFieldId ?? template.fields[0].id);
  const [validation, setValidation] = useState<WatercolorValidation>({ ready: false, errors: {} });
  const dialog = useRef<HTMLDialogElement>(null), composing = useRef(false);
  const layout = useMemo(() => projectWatercolorLayout(template, slots, workingDraft), [template, slots, workingDraft]);
  const onValidation = useCallback((value: WatercolorValidation) => setValidation(value), []);
  const fieldErrors = validateWatercolorValues(template, layout);
  const errors = { ...fieldErrors, ...validation.errors };
  const fields = template.fields.filter(f => !f.photoSlotId);
  const showTripDates = workingDraft.cardValues["trip.start"] !== null;
  const groups = ["제목·소개", "메모·날짜"].filter(g => fields.some(f => groupOf(f) === g));
  const selectField = useCallback((id: string) => {
    setActiveId(id);
    const input = document.getElementById(`wc-input-${id}`);
    const group = input?.closest("details");
    if (group)
      group.open = true;
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "nearest" });
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    const input = document.getElementById(`wc-input-${initialFieldId ?? template.fields[0].id}`);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "nearest" });
    return () => { document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [initialFieldId, template, selectField]);
  const apply = () => { if (composing.current || !validation.ready || Object.keys(errors).length)
    return; onApply(structuredClone(workingDraft)); };
  return <dialog ref={dialog} className="wc-text-dialog" aria-labelledby="wc-text-title" onCancel={e => { e.preventDefault(); if (!composing.current)
    onCancel(); }} onClick={e => { if (e.target === e.currentTarget) {
    const b = e.currentTarget.getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
      onCancel();
  } }} onKeyDown={e => { if (e.key === "Enter" && (composing.current || e.nativeEvent.isComposing || e.keyCode === 229))
    e.stopPropagation(); }}>
  <header><h2 id="wc-text-title">카드 정보</h2><button type="button" onClick={onCancel} aria-label="카드 정보 취소">×</button></header>
  <div className="wc-editor-scroll">
   <p>모든 문구는 선택이에요. 비워두면 카드에 표시되지 않아요.<br />사진별 문구와 날짜는 사진을 눌러 편집하세요.</p>
   <details className="wc-info-preview"><summary>카드 미리보기</summary><div className="wc-editor-preview"><WatercolorPreview templateKey={template.key} layout={layout} photos={photos} appearance={appearance} selectedFieldId={activeId} onSelectField={selectField} onValidation={onValidation}/></div></details>
   <label className="wc-date-toggle"><input type="checkbox" checked={showTripDates} onChange={event => {
     setValidation({ ready: false, errors: {} });
     setWorkingDraft(current => setWatercolorTripDateDisplay(current, event.target.checked, trip));
   }}/>여행 날짜 표시</label>
   {groups.map(group => <details key={group} open={group === groupOf(template.fields.find(f => f.id === activeId)!)}>
    <summary>{group}</summary>
    {fields.filter(f => groupOf(f) === group && (f.kind !== "isoDate" || showTripDates)).map(field => {
        const unbound = Boolean(field.photoSlotId && !slots.some(s => s.slotId === field.photoSlotId));
        const value = getWatercolorDraftValue(workingDraft, field, slots) ?? "";
        const common = { id: `wc-input-${field.id}`, value, disabled: unbound, "aria-invalid": Boolean(errors[field.id]), "aria-describedby": `wc-help-${field.id}`, onFocus: () => setActiveId(field.id), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setValidation({ ready: false, errors: {} });
            setWorkingDraft(current => setWatercolorDraftValue(current, field, slots, event.target.value || null));
          } };
        return <div key={field.id} className="wc-field" data-active={field.id === activeId}>
      <label htmlFor={common.id}>{field.label}</label>
      {field.kind === "isoDate" ? <input {...common} type="date" min="0001-01-01" max="9999-12-31"/> : <textarea {...common} rows={Math.min(3, field.maxLines)} placeholder="문구 없음" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}/>}
      <p id={`wc-help-${field.id}`} className={errors[field.id] ? "wc-error" : ""}>{unbound ? "사진을 선택하면 이 문구를 편집할 수 있어요." : errors[field.id] ?? (field.kind === "isoDate" ? "카드에 표시할 날짜 · 원본 정보는 그대로 유지돼요." : `${Array.from(value.normalize("NFC")).length}/${field.maxCodePoints}자 · 최대 ${field.maxLines}줄`)}</p>
     </div>;
      })}
   </details>)}
   {errors._scene && <p role="alert" className="wc-error">{errors._scene}</p>}
  </div>
  <footer><button type="button" onClick={onCancel}>취소</button><button type="button" onClick={apply} disabled={!validation.ready || Boolean(Object.keys(errors).length)}>적용</button></footer>
 </dialog>;
}
