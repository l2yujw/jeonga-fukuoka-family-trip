"use client";

import { BottomNav, MobileShell } from "@/components/ui";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";
import { MemoryCardsView } from "@/features/cards/memory-cards-view";

export default function CardsPage() {
  return (
    <TripAccessGuard>
      {() => (
        <MobileShell className="journal-page flex min-h-svh flex-col overflow-hidden">
          <main className="safe-top safe-x flex-1 pb-8">
            <header className="mb-6 border-b border-line pb-5">
              <p className="text-caption font-bold tracking-[0.18em] text-accent-primary">FUKUOKA · MEMORY CARDS</p>
              <h1 className="font-editorial mt-2 text-page-title font-semibold tracking-[-0.03em]">추억 카드</h1>
              <p className="mt-1 text-sm text-text-secondary">여행 사진을 한 장의 기억으로 남겨보세요.</p>
            </header>
            <MemoryCardsView />
          </main>
          <BottomNav activeHref="/cards" />
        </MobileShell>
      )}
    </TripAccessGuard>
  );
}
