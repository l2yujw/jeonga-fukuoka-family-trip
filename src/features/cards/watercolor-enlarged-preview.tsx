"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { WatercolorPreview } from "./watercolor-preview";

export function WatercolorEnlargedPreview({ disabled, ...scene }: Pick<ComponentProps<typeof WatercolorPreview>, "templateKey" | "layout" | "photos" | "appearance"> & { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const origin = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      origin?.focus({ preventScroll: true });
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="wc-expand" disabled={disabled} onClick={() => setOpen(true)} aria-label="카드 확대 보기">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" /></svg>
      확대 보기
    </button>
    {open && <dialog ref={dialog} className="wc-enlarged" aria-label="카드 확대 보기" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <header><h2>카드 확대 보기</h2><button type="button" autoFocus aria-label="확대 보기 닫기" onClick={() => setOpen(false)}>×</button></header>
      <div className="wc-enlarged-scroll">
        <WatercolorPreview {...scene} width={1080} emptyPhotoHints={false} />
      </div>
    </dialog>}
  </>;
}
