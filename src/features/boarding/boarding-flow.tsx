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
    <MobileShell className="safe-top safe-x">
      <main className="pb-8">
        <header className="pt-3 text-center">
          <Badge tone="sage">탑승 완료</Badge>
          <h1 ref={completionHeading} tabIndex={-1} className="font-editorial mt-4 text-page-title font-semibold outline-none">
            {session.member.name}
          </h1>
          <p className="mt-1 text-sm font-semibold text-accent-primary">{session.member.displayRole}</p>
          <p className="font-editorial mx-auto mt-4 max-w-xs break-keep text-lg leading-relaxed text-text-secondary">
            후쿠오카행 전가네 가족여행에 합류했습니다.
          </p>
        </header>

        <Card className="mt-6 overflow-hidden p-5">
          <div className="flex items-end justify-between gap-4 border-b border-dashed border-line pb-4">
            <div>
              <p className="text-caption font-bold tracking-[0.14em] text-text-secondary">FAMILY BOARDING</p>
              <h2 className="font-editorial mt-1 text-section font-semibold">가족 탑승 현황</h2>
            </div>
            <p className="shrink-0 font-editorial text-lg font-semibold text-accent-primary">
              {boardedCount} / 9 탑승 완료
            </p>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-2.5" aria-label="가족 탑승 현황 9명">
            {slots.map((slot) => (
              <li
                key={slot.id}
                aria-label={slot.member ? `${slot.member.name}, 탑승 완료${slot.online ? ", 온라인" : ""}` : "아직 탑승하지 않은 가족"}
                className={`relative flex aspect-[0.92] min-w-0 flex-col items-center justify-center rounded-md border p-2 text-center ${slot.boarded ? "border-accent-primary bg-accent-primary/7 shadow-card" : "border-line/75 bg-background/45 text-text-secondary/35"}`}
              >
                <span className={`flex size-10 items-center justify-center rounded-pill ${slot.boarded ? "bg-accent-primary text-white" : "bg-line/55"}`} aria-hidden="true">
                  {slot.boarded ? "✓" : "·"}
                </span>
                {slot.member && (
                  <>
                    <span className="mt-2 w-full truncate text-sm font-bold">{slot.member.name}</span>
                    <span className="mt-0.5 text-[11px] font-semibold text-accent-primary">방금 탑승</span>
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
