"use client";

import { BottomNav, MobileShell } from "@/components/ui";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";
import { MemoryCardsView } from "@/features/cards/memory-cards-view";

function CardsBotanical() {
  return (
    /* Exact crop from the approved Cards authority; copy and controls stay live DOM. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/api/cards-asset/Jeonga_Fukuoka_Cards_TopFloral_v1.png"
      alt=""
      aria-hidden="true"
      className="cards-hero-botanical"
    />
  );
}

export default function CardsPage() {
  return (
    <TripAccessGuard>
      {() => (
        <MobileShell className="cards-page journal-page flex min-h-svh flex-col">
          <main className="cards-main safe-top safe-x flex-1">
            <header className="cards-hero">
              <div>
                <p>FUKUOKA · MEMORY CARDS</p>
                <h1>추억 카드</h1>
                <span>가족여행의 장면을 담은 추억 카드를 확인하고 간직하세요.</span>
              </div>
              <CardsBotanical />
            </header>
            <MemoryCardsView />
          </main>
          <BottomNav activeHref="/cards" className="cards-bottom-nav" />
        </MobileShell>
      )}
    </TripAccessGuard>
  );
}
