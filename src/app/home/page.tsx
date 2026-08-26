"use client";

import { BottomNav, MobileShell } from "@/components/ui";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";

const accessCards = [
  {
    number: "01",
    kicker: "ROUTE NOTE",
    title: "여행 일정",
    subtitle: "우리의 3일 코스",
    motif: "route",
    href: "/schedule",
  },
  {
    number: "02",
    kicker: "FAMILY ALBUM",
    title: "사진 공유",
    subtitle: "함께 모은 순간들",
    motif: "album",
    href: "/album",
  },
  {
    number: "03",
    kicker: "MEMORY CARD",
    title: "추억 카드 만들기",
    subtitle: "한 장에 담는 여행",
    motif: "memory",
    href: "/cards",
  },
] as const;

export default function HomePage() {
  return (
    <TripAccessGuard>
      {() => (
        <MobileShell className="journal-page flex min-h-svh flex-col overflow-hidden">
      <main className="safe-top safe-x flex-1 pb-8">
        <header className="home-hero relative isolate min-h-[25rem] overflow-hidden rounded-[2rem] border border-[#d8c9b8] px-6 pt-7 pb-6 shadow-raised">
          <div aria-hidden="true" className="home-tape absolute top-4 right-7" />
          <div aria-hidden="true" className="home-postmark absolute right-[-1.25rem] bottom-8 grid size-28 rotate-[-10deg] place-items-center rounded-full border-2 border-accent-primary/25 text-center text-[0.52rem] font-bold tracking-[0.18em] text-accent-primary/45">
            <span className="absolute inset-2 rounded-full border border-dashed border-current" />
            FUKUOKA<br />MEMORIES
          </div>

          <p className="text-[0.65rem] font-bold tracking-[0.25em] text-accent-secondary">A FAMILY TRAVEL JOURNAL</p>
          <div className="mt-8 max-w-[17rem]">
            <p className="font-editorial text-[1.15rem] font-semibold text-accent-primary">함께하는 2박 3일</p>
            <h1 className="font-editorial mt-2 text-[2.8rem] leading-[1.05] font-semibold tracking-[-0.065em]">
              후쿠오카<br />가족여행
            </h1>
          </div>

          <div aria-hidden="true" className="home-collage absolute right-5 bottom-[5.1rem] h-32 w-28">
            <span className="absolute top-2 right-1 h-20 w-[4.8rem] rotate-6 rounded-sm border-[5px] border-surface bg-accent-secondary/22 shadow-card" />
            <span className="absolute bottom-0 left-0 h-20 w-[4.8rem] -rotate-6 rounded-sm border-[5px] border-surface bg-accent-primary/18 shadow-card">
              <span className="absolute inset-x-2 top-3 h-px rotate-[-18deg] bg-accent-primary/45" />
              <span className="absolute top-3 left-5 h-12 w-px rotate-[42deg] bg-accent-primary/45" />
              <span className="font-handwritten absolute right-1 bottom-0 text-[0.55rem] text-accent-primary">family</span>
            </span>
          </div>

          <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between border-t border-text-primary/15 pt-4">
            <p className="font-editorial text-lg font-semibold">2026.09.11–13</p>
            <p className="text-[0.62rem] font-bold tracking-[0.2em] text-text-secondary">VOL. 01 · FUKUOKA</p>
          </div>
        </header>

        <section className="mt-8" aria-labelledby="access-title">
          <div className="flex items-end justify-between border-b border-text-primary/15 pb-3">
            <div>
              <p className="text-[0.62rem] font-bold tracking-[0.22em] text-accent-primary">THREE LITTLE CHAPTERS</p>
              <h2 id="access-title" className="font-editorial mt-1 text-[1.45rem] font-semibold">여행을 펼쳐보세요</h2>
            </div>
            <span aria-hidden="true" className="font-handwritten rotate-[-7deg] text-sm text-accent-secondary">with love ♡</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {accessCards.map((item, index) => {
              const content = (
                <>
                  <span className="relative z-10 block">
                    <span className="block text-[0.6rem] font-bold tracking-[0.18em] opacity-65">{item.kicker}</span>
                    <span className="font-editorial mt-5 block break-keep text-[1.35rem] leading-tight font-semibold">{item.title}</span>
                    <span className="mt-2 block text-xs font-semibold opacity-65">{item.subtitle}</span>
                  </span>
                  <span aria-hidden="true" className="absolute right-4 bottom-4 text-[0.65rem] font-bold tracking-[0.14em] opacity-55">{item.number}</span>
                  <span aria-hidden="true" className={`home-card-motif home-card-motif--${item.motif}`} />
                  <span className="absolute top-4 right-4 grid size-7 place-items-center rounded-full border border-current/25 text-sm" aria-hidden="true">
                    {"href" in item ? "↗" : "·"}
                  </span>
                </>
              );

              const className = `home-menu-card home-menu-card--${item.motif} relative min-h-[11.5rem] overflow-hidden rounded-xl p-4 text-left shadow-card ${index === 0 ? "col-span-2 min-h-[9.6rem]" : ""}`;

              return (
                <a key={item.title} href={item.href} className={`${className} tap-target block`}>
                  {content}
                </a>
              );
            })}
          </div>
        </section>
      </main>

      <BottomNav
        items={[
          { href: "/home", label: "홈", icon: "●", active: true },
          { href: "/schedule", label: "일정", icon: "□" },
          { href: "/album", label: "앨범", icon: "▧" },
          { href: "/cards", label: "카드", icon: "◇" },
        ]}
      />
        </MobileShell>
      )}
    </TripAccessGuard>
  );
}
