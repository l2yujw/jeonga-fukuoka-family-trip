import {
  Badge,
  BottomNav,
  Button,
  Card,
  EmptyState,
  LoadingState,
  MobileShell,
  Pill,
  SectionHeader,
  Toast,
} from "@/components/ui";

const colors = [
  ["배경", "bg-background"],
  ["표면", "bg-surface"],
  ["테라코타", "bg-accent-primary"],
  ["세이지", "bg-accent-secondary"],
  ["온라인", "bg-online"],
  ["위험", "bg-danger"],
] as const;

export default function Home() {
  return (
    <MobileShell>
      <main className="safe-top safe-x pb-10">
        <header className="relative overflow-hidden rounded-xl border border-line bg-surface px-6 py-8 shadow-card">
          <div
            aria-hidden="true"
            className="absolute -top-3 right-8 h-8 w-20 rotate-2 bg-accent-primary/10"
          />
          <p className="text-caption font-bold tracking-[0.18em] text-accent-primary uppercase">
            Phase 1 · Temporary Preview
          </p>
          <h1 className="font-editorial mt-3 text-page-title leading-tight font-semibold tracking-[-0.03em]">
            따뜻하고 오래 남는
            <br />
            여행의 시각 언어
          </h1>
          <p className="mt-4 max-w-sm text-sm text-text-secondary">
            전가네 후쿠오카 가족여행을 위한 모바일 디자인 파운데이션입니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill tone="primary">Warm editorial</Pill>
            <Pill tone="sage">Modern scrapbook</Pill>
          </div>
        </header>

        <section id="tokens" className="mt-10" aria-labelledby="tokens-title">
          <SectionHeader
            id="tokens-title"
            eyebrow="Tokens"
            title="색상과 표면"
            description="크림 바탕 위에 절제된 여행의 색을 쌓습니다."
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {colors.map(([label, color]) => (
              <Card key={label} className="p-2.5">
                <div className={`aspect-square rounded-md border border-line/70 ${color}`} />
                <p className="mt-2 text-caption font-medium text-text-secondary">{label}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="components" className="mt-10" aria-labelledby="components-title">
          <SectionHeader
            id="components-title"
            eyebrow="Components"
            title="버튼과 상태"
            action={<Badge tone="online">준비됨</Badge>}
          />
          <Card variant="elevated" className="mt-4 space-y-3 p-5">
            <Button fullWidth>Primary button</Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Card>
        </section>

        <section className="mt-10" aria-labelledby="cards-title">
          <SectionHeader id="cards-title" eyebrow="Surfaces" title="카드 계층" />
          <div className="mt-4 grid gap-3">
            <Card className="p-5">
              <Badge tone="primary">Default</Badge>
              <p className="font-editorial mt-3 text-lg font-semibold">기본 카드</p>
              <p className="mt-1 text-sm text-text-secondary">
                부드러운 선과 작은 그림자로 내용을 묶습니다.
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Card variant="elevated" className="p-4">
                <p className="font-semibold">Elevated</p>
                <p className="mt-1 text-caption text-text-secondary">강조 표면</p>
              </Card>
              <Card variant="outlined" className="p-4">
                <p className="font-semibold">Outlined</p>
                <p className="mt-1 text-caption text-text-secondary">조용한 구분</p>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="feedback-title">
          <SectionHeader id="feedback-title" eyebrow="Feedback" title="빈 화면과 피드백" />
          <Card className="mt-4 overflow-hidden">
            <LoadingState />
          </Card>
          <EmptyState
            className="mt-3"
            title="아직 담긴 내용이 없어요"
            description="필요한 순간에 안내 문구와 행동을 함께 보여줍니다."
            action={<Button variant="secondary">다시 살펴보기</Button>}
          />
          <Toast
            className="mt-3"
            title="변경 내용이 저장되었어요"
            message="현재 화면에서 바로 확인할 수 있습니다."
          />
        </section>
      </main>

      <BottomNav
        items={[
          { href: "#", label: "기초", icon: "●", active: true },
          { href: "#tokens", label: "토큰", icon: "◇" },
          { href: "#components", label: "UI", icon: "□" },
        ]}
      />
    </MobileShell>
  );
}
