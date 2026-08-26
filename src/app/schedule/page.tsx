import { BottomNav, MobileShell } from "@/components/ui";
import { ScheduleView } from "@/features/schedule/schedule-view";

export default function SchedulePage() {
  return (
    <MobileShell className="flex min-h-svh flex-col">
      <main className="safe-top safe-x flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <header className="mb-6">
          <p className="text-caption font-bold tracking-[0.2em] text-accent-primary">FUKUOKA · 2026</p>
          <h1 className="font-editorial mt-2 text-page-title font-semibold tracking-[-0.03em]">여행 일정</h1>
          <p className="mt-2 font-semibold">9.11 금 – 9.13 일</p>
          <p className="mt-1 break-keep text-sm text-text-secondary">후쿠오카 · 가라츠 · 유후인 · 벳부 · 아소</p>
        </header>

        <ScheduleView />
      </main>

      <BottomNav
        items={[
          { href: "/home", label: "홈", icon: "●" },
          { href: "/schedule", label: "일정", icon: "□", active: true },
          { label: "앨범", icon: "▧", disabled: true },
          { label: "카드", icon: "◇", disabled: true },
        ]}
      />
    </MobileShell>
  );
}
