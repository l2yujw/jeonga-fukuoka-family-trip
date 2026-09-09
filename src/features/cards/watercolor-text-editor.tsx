"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import type { MemoryCardSlotMappingV3 } from "./memory-card";
import { getWatercolorDraftValue, projectWatercolorLayout, setWatercolorDraftValue, validateWatercolorValues, type WatercolorDraft } from "./watercolor-layout";
import type { WatercolorField, WatercolorTemplate } from "./watercolor-template-spec";
import { WatercolorPreview, type WatercolorValidation } from "./watercolor-preview";
const groupOf = (f: WatercolorField) => f.photoSlotId ? "사진별 문구" : f.kind === "isoDate" || /note|signoff|location/.test(f.id) ? "메모·날짜" : "제목·소개";
export function WatercolorTextEditor({ template, initialDraft, slots, photos, initialFieldId, onApply, onCancel }: {
  template: WatercolorTemplate;
  initialDraft: WatercolorDraft;
  slots: readonly MemoryCardSlotMappingV3[];
  photos: readonly AlbumPhoto[];
  initialFieldId?: string | null;
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
  const groups = ["제목·소개", "사진별 문구", "메모·날짜"].filter(g => template.fields.some(f => groupOf(f) === g));
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
    dialog.current?.showModal();
    const input = document.getElementById(`wc-input-${initialFieldId ?? template.fields[0].id}`);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "nearest" });
    return () => previous?.focus({ preventScroll: true });
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
  <header><h2 id="wc-text-title">문구 편집</h2><button type="button" onClick={onCancel} aria-label="문구 편집 취소">×</button></header>
  <div className="wc-editor-scroll">
   <p>이 카드에만 남기는 문구예요. 비워두면 인쇄되지 않아요.</p>
   <div className="wc-editor-preview"><WatercolorPreview templateKey={template.key} layout={layout} photos={photos} selectedFieldId={activeId} onSelectField={selectField} onValidation={onValidation}/></div>
   {groups.map(group => <details key={group} open={group === groupOf(template.fields.find(f => f.id === activeId)!)}>
    <summary>{group}</summary>
    {template.fields.filter(f => groupOf(f) === group).map(field => {
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
