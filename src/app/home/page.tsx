import { Badge, BottomNav, Card, MobileShell } from "@/components/ui";

const accessCards = [
  { number: "01", title: "여행 일정", tone: "bg-accent-primary/10 text-accent-primary" },
  { number: "02", title: "사진 공유", tone: "bg-accent-secondary/12 text-accent-secondary" },
  { number: "03", title: "추억 카드 만들기", tone: "bg-[#b8825e]/12 text-[#8a5e40]" },
] as const;

export default function HomePage() {
  return (
    <MobileShell className="flex min-h-svh flex-col">
      <main className="safe-top safe-x flex-1 pb-8">
        <header className="relative overflow-hidden rounded-xl border border-line bg-surface px-6 py-7 shadow-card">
          <div aria-hidden="true" className="absolute -top-6 -right-8 size-36 rounded-pill border border-accent-primary/15" />
          <div aria-hidden="true" className="absolute top-8 -right-2 size-24 rounded-pill border border-dashed border-accent-primary/25" />
          <p className="text-caption font-bold tracking-[0.2em] text-accent-primary">FUKUOKA · 2026</p>
          <h1 className="font-editorial mt-5 text-[2rem] leading-tight font-semibold tracking-[-0.035em]">
            후쿠오카 가족여행
          </h1>
          <p className="font-editorial mt-2 text-lg text-accent-primary">함께하는 2박 3일</p>
          <p className="mt-6 text-sm font-semibold text-text-secondary">2026.09.11–13</p>
          <div className="mt-7 flex items-center gap-3 text-accent-primary" aria-hidden="true">
            <span className="size-2 rounded-pill bg-current" />
            <span className="flex-1 border-t border-dashed border-current/45" />
            <span className="text-xl">✈︎</span>
          </div>
        </header>

        <section className="mt-8" aria-labelledby="access-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="access-title" className="font-editorial text-section font-semibold">여행 메뉴</h2>
            <Badge>준비 중</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {accessCards.map((item) => (
              <Card key={item.title} className="overflow-hidden">
                <button
                  type="button"
                  disabled
                  aria-describedby="coming-soon-note"
                  className="tap-target flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed"
                >
                  <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-md text-caption font-bold ${item.tone}`}>
                    {item.number}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">{item.title}</span>
                  <span className="text-caption font-medium text-text-secondary">준비 중</span>
                </button>
              </Card>
            ))}
          </div>
          <p id="coming-soon-note" className="mt-4 text-center text-caption text-text-secondary">
            다음 여행 메뉴는 차례로 준비하고 있어요.
          </p>
        </section>
      </main>

      <BottomNav
        items={[
          { href: "/home", label: "홈", icon: "●", active: true },
          { label: "일정", icon: "□", disabled: true },
          { label: "앨범", icon: "▧", disabled: true },
          { label: "카드", icon: "◇", disabled: true },
        ]}
      />
    </MobileShell>
  );
}
