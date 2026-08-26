import { BottomNav, MobileShell } from "@/components/ui";
import { ScheduleView } from "@/features/schedule/schedule-view";

export default function SchedulePage() {
  return (
    <MobileShell className="journal-page flex min-h-svh flex-col overflow-hidden">
      <main className="safe-top safe-x flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <header className="schedule-header relative mb-7 overflow-hidden border-b border-text-primary/15 pb-6">
          <div aria-hidden="true" className="absolute top-0 right-0 text-right text-[0.58rem] font-bold leading-relaxed tracking-[0.18em] text-accent-secondary/65">
            TRAVEL NOTES<br />VOL. 01
          </div>
          <p className="text-[0.62rem] font-bold tracking-[0.25em] text-accent-primary">FUKUOKA · 2026</p>
          <h1 className="font-editorial mt-3 text-[2.75rem] leading-none font-semibold tracking-[-0.06em]">여행 일정</h1>
          <p className="font-editorial mt-4 text-lg font-semibold text-accent-primary">9.11 금 – 9.13 일</p>
          <p className="mt-1 break-keep text-sm font-medium text-text-secondary">후쿠오카 · 가라츠 · 유후인 · 벳부 · 아소</p>
          <span aria-hidden="true" className="font-handwritten absolute right-1 bottom-3 rotate-[-8deg] text-sm text-accent-secondary/70">our family route ♡</span>
        </header>

        <ScheduleView />
      </main>

      <BottomNav
        items={[
          { href: "/home", label: "홈", icon: "●" },
          { href: "/schedule", label: "일정", icon: "□", active: true },
          { href: "/album", label: "앨범", icon: "▧" },
          { label: "카드", icon: "◇", disabled: true },
        ]}
      />
    </MobileShell>
  );
}
