"use client";

import { useState } from "react";
import type { AlbumPhoto } from "@/features/album/album-types";
import {
  resolveMemoryCardSlots,
  type MemoryCardLayoutV1,
  type MemoryCardTemplateKey,
} from "./memory-card";

type MemoryCardPreviewProps = {
  templateKey: MemoryCardTemplateKey;
  layout?: MemoryCardLayoutV1 | null;
  photos: readonly AlbumPhoto[];
};

export function MemoryCardPreview({
  layout,
  photos,
  templateKey,
}: MemoryCardPreviewProps) {
  const [unavailablePhotoIds, setUnavailablePhotoIds] = useState<Set<string>>(
    new Set(),
  );

  if (layout === null) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-md bg-line/35 px-6 text-center text-sm text-text-secondary">
        카드 구성을 불러올 수 없어요.
      </div>
    );
  }

  const slots = resolveMemoryCardSlots(
    templateKey,
    layout ?? { version: 1, slots: [] },
    new Map(photos.map((photo) => [photo.id, photo])),
  );

  const slotPhoto = (index: number) => {
    const slot = slots[index];
    const photo = slot?.photo;
    const canRender =
      photo?.signedUrl &&
      slot.photoId &&
      !unavailablePhotoIds.has(slot.photoId);

    return canRender ? (
      /* Signed URLs are short-lived runtime values from private Storage. */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={photo.signedUrl!}
        alt={photo.caption ?? "추억 카드에 선택한 여행 사진"}
        onError={() =>
          setUnavailablePhotoIds((current) =>
            new Set(current).add(slot.photoId as string),
          )
        }
        className="size-full object-cover object-center"
      />
    ) : (
      <span className="flex size-full items-center justify-center bg-line/45 px-2 text-center text-[10px] font-semibold text-text-secondary">
        {slot?.photoId ? "사진을 표시할 수 없어요" : "사진 선택"}
      </span>
    );
  };

  if (templateKey === "four_cut") {
    return (
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-[#d7a078] p-4">
        <div className="flex h-full w-[58%] flex-col gap-1.5 bg-text-primary p-2 pb-5 shadow-raised">
          {slots.map((slot, index) => (
            <div key={slot.slotId} className="min-h-0 flex-1 overflow-hidden bg-surface">
              {slotPhoto(index)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (templateKey === "editorial_collage") {
    return (
      <div className="aspect-[4/5] overflow-hidden rounded-md bg-[#f3eadb] p-4">
        <p className="font-editorial mb-2 border-b border-text-primary/25 pb-1 text-[10px] font-bold tracking-[0.16em]">
          FUKUOKA · FAMILY JOURNAL
        </p>
        <div className="grid h-[calc(100%-2.25rem)] grid-cols-3 grid-rows-2 gap-1.5">
          <div className="col-span-2 row-span-2 overflow-hidden">{slotPhoto(0)}</div>
          <div className="overflow-hidden">{slotPhoto(1)}</div>
          <div className="overflow-hidden">{slotPhoto(2)}</div>
        </div>
      </div>
    );
  }

  const frameClasses = [
    "top-[9%] left-1/2 z-10 w-[58%] -translate-x-1/2 -rotate-1",
    "bottom-[6%] left-[5%] w-[40%] -rotate-4",
    "right-[5%] bottom-[5%] w-[40%] rotate-4",
  ];

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-[#ddc7a8]">
      <span aria-hidden="true" className="home-tape absolute top-3 left-1/2 z-10 -translate-x-1/2" />
      {slots.map((slot, index) => (
        <div
          key={slot.slotId}
          className={`absolute aspect-[4/5] bg-surface p-1.5 pb-4 shadow-card ${frameClasses[index]}`}
        >
          <div className="size-full overflow-hidden bg-line/35">{slotPhoto(index)}</div>
        </div>
      ))}
    </div>
  );
}
