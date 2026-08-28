"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, LoadingState, MobileShell } from "@/components/ui";
import {
  createFamilySlots,
  isCurrentTripSession,
  resolveBoardingInitialization,
  type CurrentTripSession,
  type FamilyRosterMember,
  type PendingMemberPreview,
} from "./boarding-logic";
import {
  getCurrentAuthSession,
  getCurrentTripSession,
  loadFamilyRoster,
} from "./current-trip-session";
import {
  clearPendingMember,
  readPendingMember,
} from "./pending-member";

type Stage = "loading" | "confirm" | "boarding" | "complete" | "error";

export function BoardingFlow() {
  const router = useRouter();
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<PendingMemberPreview | null>(null);
  const [session, setSession] = useState<CurrentTripSession | null>(null);
  const [roster, setRoster] = useState<FamilyRosterMember[]>([]);
  const [stage, setStage] = useState<Stage>("loading");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const saved = readPendingMember();
    resolveBoardingInitialization(saved, getCurrentTripSession)
      .then(async (initialization) => {
        if (!active) return;

        if (initialization.stage === "confirm") {
          setPending(initialization.pending);
          setStage("confirm");
          return;
        }

        if (initialization.stage === "redirect") {
          router.replace("/");
          return;
        }

        const members = await loadFamilyRoster(initialization.session.trip.id);
        if (!active) return;
        setSession(initialization.session);
        setRoster(members);
        setStage("complete");
      })
      .catch(() => {
        if (!active) return;
        setError("탑승 정보를 불러오지 못했어요. 네트워크 연결을 확인해주세요.");
        setStage("error");
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (stage !== "boarding" || !session) return;
    const delay = 1800;
    let active = true;
    let timer = 0;
    const animation = new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, delay);
    });

    Promise.all([animation, loadFamilyRoster(session.trip.id)])
      .then(([, members]) => {
        if (!active) return;
        setRoster(members);
        setStage("complete");
      })
      .catch(() => {
        if (!active) return;
        setError("가족 탑승 현황을 불러오지 못했어요. 다시 시도해주세요.");
        setStage("error");
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [session, stage]);

  useEffect(() => {
    if (stage === "complete") completionHeading.current?.focus();
  }, [stage]);

  const claimMember = async () => {
    if (!pending || claiming) return;
    setClaiming(true);
    setError("");

    try {
      const authSession = await getCurrentAuthSession();
      if (!authSession) {
        clearPendingMember();
        router.replace("/");
        return;
      }

      const response = await fetch("/api/claim-member", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId: pending.memberId }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok || !isCurrentTripSession(body)) {
        const message =
          body && typeof body === "object" && "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "탑승을 완료할 수 없어요. 잠시 후 다시 시도해주세요.";
        setError(message);
        return;
      }

      clearPendingMember();
      setPending(null);
      setSession(body);
      setStage("boarding");
    } catch {
      setError("탑승을 완료할 수 없어요. 네트워크 연결을 확인해주세요.");
    } finally {
      setClaiming(false);
    }
  };

  const startAgain = () => {
    clearPendingMember();
    router.push("/");
  };

  if (stage === "loading") {
    return (
      <MobileShell className="safe-top safe-x">
        <LoadingState className="min-h-svh" label="탑승권을 확인하고 있어요" />
      </MobileShell>
    );
  }

  if (stage === "error") {
    return (
      <MobileShell className="safe-top safe-x flex min-h-svh items-center">
        <main className="w-full text-center">
          <p role="alert" className="break-keep text-sm font-medium text-danger">{error}</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>다시 시도</Button>
        </main>
      </MobileShell>
    );
  }

  if (stage === "boarding") {
    return (
      <MobileShell className="boarding-transition-page" aria-busy="true">
        <main
          className="boarding-transition"
          role="status"
          aria-live="polite"
          aria-labelledby="boarding-transition-title"
        >
          <div className="boarding-transition__upper" aria-hidden="true">
            <svg className="boarding-transition__upper-botanical" viewBox="0 0 170 150" focusable="false">
              <path className="boarding-botanical-stem" d="M-8 5C25 23 36 57 69 75c31 17 55 36 96 47M30 44C42 37 54 27 60 13M64 73c17-4 33-17 43-32M99 94c19-1 35-10 49-25" />
              <g className="boarding-botanical-leaves">
                <ellipse cx="18" cy="27" rx="6" ry="15" transform="rotate(-38 18 27)" />
                <ellipse cx="35" cy="50" rx="6" ry="16" transform="rotate(52 35 50)" />
                <ellipse cx="47" cy="32" rx="6" ry="15" transform="rotate(31 47 32)" />
                <ellipse cx="61" cy="65" rx="6" ry="16" transform="rotate(-47 61 65)" />
                <ellipse cx="79" cy="75" rx="6" ry="15" transform="rotate(53 79 75)" />
                <ellipse cx="92" cy="54" rx="6" ry="15" transform="rotate(34 92 54)" />
                <ellipse cx="110" cy="99" rx="6" ry="16" transform="rotate(-45 110 99)" />
                <ellipse cx="130" cy="83" rx="6" ry="15" transform="rotate(40 130 83)" />
                <ellipse cx="139" cy="116" rx="6" ry="15" transform="rotate(-48 139 116)" />
              </g>
              <g className="boarding-botanical-flowers">
                <g transform="translate(59 20)"><circle cy="-6" r="5" /><circle cx="6" r="5" /><circle cy="6" r="5" /><circle cx="-6" r="5" /><circle className="boarding-botanical-flower-core" r="2.5" /></g>
                <g transform="translate(106 42)"><circle cy="-6" r="5" /><circle cx="6" r="5" /><circle cy="6" r="5" /><circle cx="-6" r="5" /><circle className="boarding-botanical-flower-core" r="2.5" /></g>
                <g transform="translate(148 69)"><circle cy="-5" r="4.5" /><circle cx="5" r="4.5" /><circle cy="5" r="4.5" /><circle cx="-5" r="4.5" /><circle className="boarding-botanical-flower-core" r="2" /></g>
              </g>
            </svg>

            <svg className="boarding-transition__upper-route" viewBox="0 0 150 90" focusable="false">
              <path d="M3 64c29 0 39-4 40-22 2-23 34-23 35 0 1 22-16 24 13 26 23 2 32-5 43-19" />
              <text x="128" y="52">✈︎</text>
            </svg>

            <svg className="boarding-transition__postmark" viewBox="0 0 145 100" focusable="false">
              <defs>
                <path id="boarding-postmark-top" d="M17 51a33 33 0 0 1 66 0" />
                <path id="boarding-postmark-bottom" d="M17 57a33 33 0 0 0 66 0" />
              </defs>
              <circle cx="50" cy="54" r="39" />
              <circle cx="50" cy="54" r="32" />
              <text><textPath href="#boarding-postmark-top" startOffset="50%">JEONGA FAMILY</textPath></text>
              <text><textPath href="#boarding-postmark-bottom" startOffset="50%">FUKUOKA</textPath></text>
              <path className="boarding-transition__postmark-star" d="m50 42 2.5 6 6.5.5-5 4 1.5 6.5-5.5-3.5-5.5 3.5 1.5-6.5-5-4 6.5-.5Z" />
              <path className="boarding-transition__postmark-lines" d="M91 34c13-8 28 8 42 0M89 43c14-8 28 8 44 0M89 52c14-8 29 8 46 0M88 61c15-8 31 8 48 0" />
            </svg>
          </div>

          <section className="boarding-transition__copy">
            <p className="boarding-transition__eyebrow">BOARDING...</p>
            <div className="boarding-transition__mini-route" aria-hidden="true"><span>✈︎</span></div>
            <h1 id="boarding-transition-title"><span>탑승권을</span><span>확인하고 있어요</span></h1>
            <p className="boarding-transition__wait">잠시만 기다려주세요.</p>
          </section>

          <section className="boarding-ticket" aria-label="인천에서 후쿠오카로 이동 중">
            <div className="boarding-ticket__inner" aria-hidden="true">
              <div className="boarding-ticket__destinations">
                <span><strong>ICN</strong><small>SEOUL</small></span>
                <span className="boarding-ticket__flight">✈︎</span>
                <span><strong>FUK</strong><small>FUKUOKA</small></span>
              </div>
              <div className="boarding-route-progress">
                <span className="boarding-route-progress__origin" />
                <span className="boarding-route-progress__dashes" />
                <span className="boarding-progress" />
                <span className="boarding-plane">✈︎</span>
                <span className="boarding-route-progress__destination" />
              </div>
            </div>
          </section>

          <div className="boarding-transition__lower" aria-hidden="true">
            <svg className="boarding-transition__lower-route" viewBox="0 0 190 100" focusable="false">
              <path d="M5 28c33-3 47 7 42 28-5 22 31 25 36 3 6-24-16-26 15-29 27-2 46 8 69-10" />
              <text x="158" y="28">✈︎</text>
            </svg>
            <span className="boarding-transition__papers"><i /><i /><i /></span>
            <span className="boarding-transition__passport"><i /><b>PASSPORT</b></span>
            <svg className="boarding-transition__lower-botanical" viewBox="0 0 110 155" focusable="false">
              <path d="M54 160C51 119 64 73 83 11M55 126c-12-23-25-39-42-50m48 31c14-14 25-21 43-27M68 72c-10-14-16-28-18-43" />
              <g><ellipse cx="45" cy="117" rx="5" ry="13" transform="rotate(-35 45 117)" /><ellipse cx="68" cy="99" rx="5" ry="13" transform="rotate(44 68 99)" /><ellipse cx="34" cy="97" rx="5" ry="13" transform="rotate(-45 34 97)" /><ellipse cx="76" cy="66" rx="5" ry="13" transform="rotate(42 76 66)" /><ellipse cx="56" cy="56" rx="5" ry="13" transform="rotate(-34 56 56)" /></g>
              <g className="boarding-transition__lower-flowers"><circle cx="83" cy="12" r="5" /><circle cx="103" cy="79" r="5" /><circle cx="50" cy="30" r="5" /><circle cx="13" cy="76" r="5" /></g>
            </svg>
          </div>
        </main>
      </MobileShell>
    );
  }

  if (stage === "confirm") {
    if (!pending) return null;
    return (
      <MobileShell className="boarding-confirm-raster-page">
        {error && (
          <p id="boarding-confirm-error" role="alert" className="boarding-confirm-raster-error">
            {error}
          </p>
        )}

        <main className="boarding-confirm-plate" aria-labelledby="boarding-confirm-title">
          <Image
            src="/api/boarding-confirm-visual"
            alt=""
            aria-hidden="true"
            width={941}
            height={2020}
            draggable="false"
            priority
            unoptimized
            className="boarding-confirm-plate-image"
          />

          <div className="sr-only">
            <h1 id="boarding-confirm-title">탑승 확인</h1>
            <p>탑승 정보를 확인해주세요</p>
          </div>

          <p
            className="boarding-confirm-value boarding-confirm-value--passenger"
            data-long={pending.name.length > 4 || undefined}
          >
            <span>{pending.name}</span>
          </p>
          <p
            className="boarding-confirm-value boarding-confirm-value--role"
            data-long={pending.displayRole.length > 8 || undefined}
          >
            <span>{pending.displayRole}</span>
          </p>

          <button
            type="button"
            className="boarding-confirm-action boarding-confirm-action--primary"
            disabled={claiming}
            aria-busy={claiming || undefined}
            aria-describedby={error ? "boarding-confirm-error" : undefined}
            onClick={claimMember}
          >
            <span className="boarding-confirm-action-icon" aria-hidden="true">✈︎</span>
            <span>네, 탑승할게요</span>
          </button>
          <button
            type="button"
            className="boarding-confirm-action boarding-confirm-action--secondary"
            disabled={claiming}
            onClick={startAgain}
          >
            <span className="boarding-confirm-action-icon" aria-hidden="true">✎</span>
            <span>다시 입력</span>
          </button>
        </main>
      </MobileShell>
    );
  }

  if (!session) return null;
  const slots = createFamilySlots(roster, session.member.id);
  const boardedCount = roster.filter((member) => member.boardedAt).length;

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
                aria-label={slot.member ? `${slot.member.name}, ${slot.boarded ? "탑승 완료" : "탑승 대기"}${slot.online ? ", 온라인" : ""}` : "아직 등록되지 않은 가족"}
                className={`cabin-seat relative flex aspect-[0.92] min-w-0 flex-col items-center justify-center p-2 text-center ${slot.boarded ? "cabin-seat--boarded" : "text-text-secondary/35"}`}
              >
                <span className={`relative z-10 flex size-9 items-center justify-center rounded-full ${slot.boarded ? "bg-accent-primary text-white shadow-card" : "border border-line/80 bg-background/65"}`} aria-hidden="true">
                  {slot.boarded ? "✓" : slots.indexOf(slot) + 1}
                </span>
                {slot.member && (
                  <>
                    <span className="relative z-10 mt-1.5 w-full truncate text-sm font-bold">{slot.member.name}</span>
                    <span className="relative z-10 mt-0.5 text-[10px] font-bold text-accent-primary">{slot.boarded ? "탑승 완료" : "탑승 대기"}</span>
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
