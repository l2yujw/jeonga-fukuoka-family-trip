"use client";

import { useState } from "react";
import { BottomNav, MobileShell } from "@/components/ui";
import { AlbumView } from "@/features/album/album-view";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";

export default function AlbumPage() {
  return (
    <TripAccessGuard>
      {() => <AlbumPageContent />}
    </TripAccessGuard>
  );
}

function AlbumPageContent() {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <MobileShell className="flex min-h-svh flex-col">
      <main className="safe-top safe-x flex-1 pb-8">
        <header className="mb-6 border-b border-line pb-5">
          <p className="text-caption font-bold tracking-[0.18em] text-accent-primary">
            FUKUOKA · FAMILY ALBUM
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-editorial text-page-title font-semibold tracking-[-0.03em]">
                함께한 사진
              </h1>
              <p className="mt-1 text-sm text-text-secondary">가족 공유 앨범</p>
            </div>
            <p className="shrink-0 text-caption font-semibold text-text-secondary">
              2026.09.11 – 09.13
            </p>
          </div>
        </header>

        <AlbumView onComposerOpenChange={setIsComposerOpen} />
      </main>

      {!isComposerOpen && (
        <BottomNav
          items={[
            { href: "/home", label: "홈", icon: "●" },
            { href: "/schedule", label: "일정", icon: "□" },
            { href: "/album", label: "앨범", icon: "▧", active: true },
            { label: "카드", icon: "◇", disabled: true },
          ]}
        />
      )}
    </MobileShell>
  );
}
