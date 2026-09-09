"use client";
import { memo, useEffect, useRef, useState } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import { getWatercolorFieldBox, getWatercolorTemplate, type WatercolorBox } from "./watercolor-template-spec";
import type { MemoryCardTemplateKey } from "./memory-card-template-spec";
import { createWatercolorDraft, projectWatercolorLayout, type MemoryCardLayoutV4 } from "./watercolor-layout";
import { paintWatercolorScene, prepareWatercolorScene } from "./watercolor-scene";
export type WatercolorValidation = {
  ready: boolean;
  errors: Record<string, string>;
};
export const watercolorHitStyle = (b: WatercolorBox) => ({ position: "absolute" as const, left: `${b.x / 1080 * 100}%`, top: `${b.y / 1920 * 100}%`, width: `${b.w / 1080 * 100}%`, height: `${b.h / 1920 * 100}%`, transform: `rotate(${b.r}deg)` });
export function WatercolorPreview({ templateKey, layout, photos, onSelectField, onSelectSlot, selectedFieldId, selectedSlotId, onValidation }: {
  templateKey: MemoryCardTemplateKey;
  layout: MemoryCardLayoutV4;
  photos: readonly AlbumPhoto[];
  onSelectField?: (id: string) => void;
  onSelectSlot?: (id: string) => void;
  selectedFieldId?: string | null;
  selectedSlotId?: string | null;
  onValidation?: (state: WatercolorValidation) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const template = getWatercolorTemplate(templateKey, layout.templateRevision);
  const width = 540;
  useEffect(() => {
    let active = true;
    onValidation?.({ ready: false, errors: {} });
    void prepareWatercolorScene(templateKey, layout, photos, true).then(scene => {
      if (!active)
        return;
      const c = canvas.current?.getContext("2d");
      if (c) {
        paintWatercolorScene(c, scene, width, true);
        setFailure(null);
        onValidation?.({ ready: true, errors: scene.errors });
      }
    }).catch(error => {
      if (!active)
        return;
      const message = error instanceof Error ? error.message : "미리보기를 준비하지 못했어요.";
      setFailure(message);
      onValidation?.({ ready: false, errors: { _scene: message } });
    });
    return () => { active = false; };
  }, [templateKey, layout, photos, width, onValidation]);
  if (!template)
    return <p role="alert">지원하지 않는 카드 버전이에요.</p>;
  return <div className="wc-preview" aria-label={`${template.displayName} 카드 미리보기`}>
  <div className="wc-scene">
   <canvas ref={canvas} width={width} height={width * 16 / 9} role="img" aria-label={`${template.displayName} 합성 미리보기`}/>
   {onSelectSlot && template.slots.map((s, i) => layout.slots.some(x => x.slotId === s.id) && <button type="button" key={s.id} className="wc-hit wc-photo-hit" aria-label={`사진 ${i + 1} 위치 조정`} aria-pressed={s.id === selectedSlotId} onClick={() => onSelectSlot(s.id)} style={watercolorHitStyle(s)}/>)}
   {onSelectField && template.fields.map(f => <button type="button" key={f.id} className="wc-hit wc-text-hit" aria-label={`${f.label} 편집`} aria-pressed={f.id === selectedFieldId} onClick={() => onSelectField(f.id)} style={watercolorHitStyle(getWatercolorFieldBox(template, f))}/>)}
  </div>
  {failure && <p role="alert" className="wc-error">{failure}</p>}
 </div>;
}
// Eight trusted templates only. Reuse the small bitmap across strip/gallery mounts;
// user photos and draft text never enter this cache, and no PNG encoding is needed.
const miniatures = new Map<MemoryCardTemplateKey, Promise<HTMLCanvasElement>>();
function getMiniature(templateKey: MemoryCardTemplateKey) {
  let miniature = miniatures.get(templateKey);
  if (!miniature) {
    miniature = (async () => {
      const template = getWatercolorTemplate(templateKey)!;
      const layout = projectWatercolorLayout(template, [], createWatercolorDraft(template, { title: "", startDate: "", endDate: "" }));
      layout.textValues = Object.fromEntries(Object.keys(layout.textValues).map(id => [id, null]));
      layout.dateValues = Object.fromEntries(Object.keys(layout.dateValues).map(id => [id, null]));
      const scene = await prepareWatercolorScene(templateKey, layout, [], true);
      const canvas = document.createElement("canvas");
      canvas.width = 180; canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("템플릿 미리보기를 준비하지 못했어요.");
      paintWatercolorScene(context, scene, 180, true);
      return canvas;
    })().catch(error => { miniatures.delete(templateKey); throw error; });
    miniatures.set(templateKey, miniature);
  }
  return miniature;
}
export const WatercolorThumbnail = memo(function WatercolorThumbnail({ templateKey }: {
  templateKey: MemoryCardTemplateKey;
}) {
  const template = getWatercolorTemplate(templateKey)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let active = true;
    void getMiniature(templateKey).then(bitmap => {
      if (active) { canvas.current?.getContext("2d")?.drawImage(bitmap, 0, 0); setFailure(false); }
    }).catch(() => { if (active) setFailure(true); });
    return () => { active = false; };
  }, [templateKey]);
  return <div className="wc-miniature" data-template={templateKey}>
    <canvas ref={canvas} width={180} height={320} role="img" aria-label={`${template.displayName} 템플릿 미니어처`}/>
    {failure && <small role="alert">미리보기를 불러오지 못했어요.</small>}
  </div>;
});
