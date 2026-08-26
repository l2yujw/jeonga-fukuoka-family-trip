"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, LoadingState, MobileShell } from "@/components/ui";
import {
  demoBoardingAdapter,
  type DemoBoardingSession,
} from "./demo-adapter";

type Stage = "confirm" | "boarding" | "complete";

export function BoardingFlow() {
  const router = useRouter();
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const [session, setSession] = useState<DemoBoardingSession | null>(null);
  const [stage, setStage] = useState<Stage>("confirm");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = demoBoardingAdapter.readSession();
      if (!saved) {
        router.replace("/");
        return;
      }
      setSession(saved);
      setStage(saved.boarded ? "complete" : "confirm");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (stage !== "boarding" || !session) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 650 : 900;
    const timer = window.setTimeout(() => {
      setSession(demoBoardingAdapter.complete(session));
      setStage("complete");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session, stage]);

  useEffect(() => {
    if (stage === "complete") completionHeading.current?.focus();
  }, [stage]);

  if (!session) {
    return (
      <MobileShell className="safe-top safe-x">
        <LoadingState className="min-h-svh" label="탑승권을 확인하고 있어요" />
      </MobileShell>
    );
  }

  if (stage === "boarding") {
    return (
      <MobileShell className="safe-top safe-x flex min-h-svh items-center justify-center">
        <main className="w-full text-center" role="status" aria-live="polite">
          <p className="text-caption font-bold tracking-[0.22em] text-accent-primary">BOARDING...</p>
          <h1 className="font-editorial mt-4 text-page-title font-semibold">탑승권을 확인하고 있어요</h1>
          <div className="mx-auto mt-10 max-w-xs px-4" aria-hidden="true">
            <div className="relative h-16">
              <div className="absolute inset-x-0 top-8 border-t-2 border-dashed border-line" />
              <span className="absolute top-[25px] left-0 size-3 rounded-pill bg-accent-primary" />
              <span className="absolute top-[25px] right-0 size-3 rounded-pill border-2 border-accent-secondary bg-background" />
              <span className="boarding-plane absolute top-3 left-0 text-3xl text-accent-primary">✈︎</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-line/60">
              <div className="boarding-progress h-full rounded-pill bg-accent-primary" />
            </div>
          </div>
        </main>
      </MobileShell>
    );
  }

  if (stage === "confirm") {
    return (
      <MobileShell className="safe-top safe-x flex min-h-svh items-center">
        <main className="w-full py-8 text-center">
          <p className="text-caption font-bold tracking-[0.2em] text-accent-primary">PASSENGER CHECK</p>
          <h1 className="font-editorial mt-8 text-hero font-semibold tracking-[-0.04em]">
            {session.member.name}
          </h1>
          <p className="mt-2 font-semibold text-accent-primary">{session.member.displayRole}</p>
          <Card variant="elevated" className="relative mt-9 overflow-hidden p-6">
            <span aria-hidden="true" className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-pill border border-line bg-background" />
            <span aria-hidden="true" className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-pill border border-line bg-background" />
            <p className="font-editorial text-section font-semibold">맞으신가요?</p>
            <div className="my-5 border-t border-dashed border-line" />
            <Button fullWidth onClick={() => setStage("boarding")}>
              네, 탑승할게요
            </Button>
            <Button fullWidth variant="ghost" className="mt-2" onClick={() => router.push("/")}>
              다시 입력
            </Button>
          </Card>
        </main>
      </MobileShell>
    );
  }

  const slots = demoBoardingAdapter.familySlots(session);
  const boardedCount = slots.filter((slot) => slot.boarded).length;

  return (
    <MobileShell className="cabin-page safe-top safe-x overflow-hidden">
      <main className="pb-8">
        <header className="relative pt-2 text-center">
          <p className="text-[0.62rem] font-bold tracking-[0.25em] text-accent-secondary">WELCOME ON BOARD</p>
          <Badge tone="sage" className="mt-3 border border-accent-secondary/20">탑승 완료</Badge>
          <h1 ref={completionHeading} tabIndex={-1} className="font-editorial mt-4 text-[2rem] font-semibold tracking-[-0.04em] outline-none">
            {session.member.name}님,
          </h1>
          <p className="font-editorial mt-1 text-[1.35rem] font-semibold text-accent-primary">우리 여행에 잘 오셨어요.</p>
          <p className="mt-2 text-xs font-semibold text-text-secondary">{session.member.displayRole}</p>
        </header>

        <section className="cabin-window mx-auto mt-6" aria-label="인천에서 후쿠오카로 향하는 여행 경로">
          <div className="cabin-window__view">
            <p className="text-[0.6rem] font-bold tracking-[0.2em] text-accent-secondary">NOW ARRIVING</p>
            <div className="mt-4 flex items-center gap-3 text-accent-primary">
              <span className="font-editorial text-lg font-semibold">ICN</span>
              <span className="size-1.5 rounded-full bg-current" />
              <span className="relative flex-1 border-t border-dashed border-current/55">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#e8eee5] px-1 text-base">✈︎</span>
              </span>
              <span className="size-1.5 rounded-full border border-current" />
              <span className="font-editorial text-lg font-semibold">FUKUOKA</span>
            </div>
            <p className="font-editorial mt-5 break-keep text-base font-semibold leading-relaxed text-text-primary/80">
              후쿠오카행 전가네 가족여행에 합류했습니다.
            </p>
          </div>
        </section>

        <Card className="cabin-panel relative mt-6 overflow-hidden border-accent-secondary/20 p-5">
          <div className="flex items-end justify-between gap-3 border-b border-text-primary/10 pb-4">
            <div>
              <p className="text-[0.62rem] font-bold tracking-[0.2em] text-accent-secondary">FAMILY SEAT ROW</p>
              <h2 className="font-editorial mt-1 text-section font-semibold">가족 탑승 현황</h2>
            </div>
            <div className="shrink-0 rounded-sm bg-accent-primary px-3 py-2 text-center text-surface shadow-card">
              <p className="text-[0.55rem] font-bold tracking-[0.14em] opacity-75">ON BOARD</p>
              <p className="font-editorial text-lg font-semibold leading-none">{boardedCount} / 9</p>
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-4" aria-label="가족 탑승 현황 9명">
            {slots.map((slot) => (
              <li
                key={slot.id}
                aria-label={slot.member ? `${slot.member.name}, 탑승 완료${slot.online ? ", 온라인" : ""}` : "아직 탑승하지 않은 가족"}
                className={`cabin-seat relative flex aspect-[0.92] min-w-0 flex-col items-center justify-center p-2 text-center ${slot.boarded ? "cabin-seat--boarded" : "text-text-secondary/35"}`}
              >
                <span className={`relative z-10 flex size-9 items-center justify-center rounded-full ${slot.boarded ? "bg-accent-primary text-white shadow-card" : "border border-line/80 bg-background/65"}`} aria-hidden="true">
                  {slot.boarded ? "✓" : slots.indexOf(slot) + 1}
                </span>
                {slot.member && (
                  <>
                    <span className="relative z-10 mt-1.5 w-full truncate text-sm font-bold">{slot.member.name}</span>
                    <span className="relative z-10 mt-0.5 text-[10px] font-bold text-accent-primary">방금 탑승</span>
                  </>
                )}
                {slot.online && (
                  <span className="absolute top-2 right-2 size-2.5 rounded-pill border-2 border-surface bg-online" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Button fullWidth className="mt-5" onClick={() => router.push("/home")}>
          여행 시작하기
        </Button>
      </main>
    </MobileShell>
  );
}
