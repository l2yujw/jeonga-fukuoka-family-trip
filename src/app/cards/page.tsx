"use client";

import { BottomNav, MobileShell } from "@/components/ui";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";
import { MemoryCardsView } from "@/features/cards/memory-cards-view";

function CardsBotanical() {
  return (
    <svg className="cards-hero-botanical" viewBox="0 0 112 118" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M101 113C83 88 69 57 67 18M96 105C82 87 54 79 31 78M77 72C64 53 42 43 20 40" />
        <path d="M78 76c13-8 22-7 27-4-8 8-18 11-27 4ZM55 59c-13-7-22-5-27-1 9 7 18 8 27 1ZM86 91c11-5 18-2 22 2-8 6-16 6-22-2ZM50 82c-11 1-17 7-18 12 10 1 17-3 18-12Z" fill="currentColor" />
      </g>
      <g className="cards-flower-petals">
        <ellipse cx="66" cy="20" rx="7" ry="17" />
        <ellipse cx="66" cy="20" rx="7" ry="17" transform="rotate(60 66 20)" />
        <ellipse cx="66" cy="20" rx="7" ry="17" transform="rotate(120 66 20)" />
        <ellipse cx="20" cy="40" rx="5" ry="11" />
        <ellipse cx="20" cy="40" rx="5" ry="11" transform="rotate(60 20 40)" />
        <ellipse cx="20" cy="40" rx="5" ry="11" transform="rotate(120 20 40)" />
      </g>
      <g className="cards-flower-centers">
        <circle cx="66" cy="20" r="5" />
        <circle cx="20" cy="40" r="3.5" />
      </g>
    </svg>
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
                <span>가족여행의 장면을 감성 카드로 남겨요</span>
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
