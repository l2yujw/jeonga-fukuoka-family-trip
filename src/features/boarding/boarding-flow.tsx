"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, LoadingState, MobileShell } from "@/components/ui";
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

type SourceBox = { left: number; top: number; width: number; height: number };
const PLATE_WIDTH = 1122;
const PLATE_HEIGHT = 1402;

const sourceBoxStyle = ({ left, top, width, height }: SourceBox) => ({
  left: `${left * 100 / PLATE_WIDTH}%`,
  top: `${top * 100 / PLATE_HEIGHT}%`,
  width: `${width * 100 / PLATE_WIDTH}%`,
  height: `${height * 100 / PLATE_HEIGHT}%`,
});

const SEAT_OVERLAYS = [
  { ring: { left: 446, top: 436, width: 74, height: 79 }, nameMask: { left: 463, top: 517, width: 41, height: 18 }, statusMask: { left: 475, top: 540, width: 17, height: 17 }, name: { left: 426, top: 517, width: 108, height: 18 }, state: { left: 477, top: 542, width: 40, height: 13 } },
  { ring: { left: 594, top: 436, width: 74, height: 79 }, nameMask: { left: 612, top: 517, width: 41, height: 18 }, statusMask: { left: 624, top: 540, width: 17, height: 17 }, name: { left: 574, top: 517, width: 108, height: 18 }, state: { left: 626, top: 542, width: 40, height: 13 } },
  { ring: { left: 446, top: 574, width: 74, height: 79 }, nameMask: { left: 463, top: 653, width: 41, height: 18 }, statusMask: { left: 475, top: 676, width: 17, height: 17 }, name: { left: 426, top: 653, width: 108, height: 18 }, state: { left: 477, top: 678, width: 40, height: 13 } },
  { ring: { left: 594, top: 574, width: 74, height: 79 }, nameMask: { left: 612, top: 653, width: 41, height: 18 }, statusMask: { left: 624, top: 676, width: 17, height: 17 }, name: { left: 574, top: 653, width: 108, height: 18 }, state: { left: 626, top: 678, width: 40, height: 13 } },
  { ring: { left: 446, top: 710, width: 74, height: 79 }, nameMask: { left: 463, top: 790, width: 41, height: 18 }, statusMask: { left: 475, top: 812, width: 38, height: 17 }, name: { left: 426, top: 790, width: 108, height: 18 }, state: { left: 477, top: 814, width: 40, height: 13 } },
  { ring: { left: 594, top: 710, width: 74, height: 79 }, nameMask: { left: 612, top: 790, width: 41, height: 18 }, statusMask: { left: 624, top: 812, width: 17, height: 17 }, name: { left: 574, top: 790, width: 108, height: 18 }, state: { left: 626, top: 814, width: 40, height: 13 } },
  { ring: { left: 446, top: 847, width: 74, height: 79 }, nameMask: { left: 463, top: 926, width: 41, height: 19 }, statusMask: { left: 475, top: 947, width: 17, height: 17 }, name: { left: 426, top: 926, width: 108, height: 19 }, state: { left: 477, top: 949, width: 40, height: 13 } },
  { ring: { left: 594, top: 847, width: 74, height: 79 }, nameMask: { left: 612, top: 926, width: 41, height: 19 }, statusMask: { left: 624, top: 947, width: 17, height: 17 }, name: { left: 574, top: 926, width: 108, height: 19 }, state: { left: 626, top: 949, width: 40, height: 13 } },
  { ring: { left: 446, top: 974, width: 74, height: 77 }, nameMask: { left: 463, top: 1051, width: 41, height: 19 }, statusMask: { left: 475, top: 1071, width: 17, height: 18 }, name: { left: 426, top: 1051, width: 108, height: 19 }, state: { left: 477, top: 1074, width: 40, height: 13 } },
  { ring: { left: 594, top: 974, width: 74, height: 77 }, nameMask: { left: 612, top: 1051, width: 41, height: 19 }, statusMask: { left: 624, top: 1071, width: 17, height: 18 }, name: { left: 574, top: 1051, width: 108, height: 19 }, state: { left: 626, top: 1074, width: 40, height: 13 } },
] as const;

const FOOTER_MASKS = [
  { left: 474, top: 1193, width: 97, height: 19 },
  { left: 584, top: 1193, width: 49, height: 19 },
] as const;

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
            width={863}
            height={1823}
            draggable="false"
            priority
            unoptimized
            className="boarding-confirm-plate-image"
          />

          <div className="sr-only">
            <h1 id="boarding-confirm-title">탑승 확인</h1>
            <p>탑승 정보를 확인해주세요</p>
          </div>

          <span
            className="boarding-confirm-sample-mask boarding-confirm-sample-mask--passenger"
            aria-hidden="true"
          />
          <span
            className="boarding-confirm-sample-mask boarding-confirm-sample-mask--role"
            aria-hidden="true"
          />

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
            aria-label="네, 탑승할게요"
            aria-describedby={error ? "boarding-confirm-error" : undefined}
            onClick={claimMember}
          />
          <button
            type="button"
            className="boarding-confirm-action boarding-confirm-action--secondary"
            disabled={claiming}
            aria-label="다시 입력"
            onClick={startAgain}
          />
        </main>
      </MobileShell>
    );
  }

  if (!session) return null;
  const slots = createFamilySlots(roster, session.member.id);
  const boardedCount = roster.filter((member) => member.boardedAt).length;

  return (
    <MobileShell className="boarding-status-page">
      <main className="boarding-status-artboard">
        <Image
          src="/api/boarding-status-visual"
          alt=""
          aria-hidden="true"
          width={1122}
          height={1402}
          draggable="false"
          priority
          unoptimized
          className="boarding-status-plate-image"
        />

        <h1 ref={completionHeading} tabIndex={-1} className="sr-only">가족 탑승 현황</h1>

        <ol className="boarding-status-seats" aria-label="10개 좌석의 가족 탑승 상태">
          {slots.map((slot) => {
            const overlay = SEAT_OVERLAYS[slot.seatNumber - 1];
            const state = slot.boarded ? "탑승 완료" : "탑승 대기";

            return (
              <li
                key={slot.id}
                aria-hidden={!slot.member || undefined}
                aria-label={slot.member ? `${slot.seatNumber}번 좌석, ${slot.member.name}, ${state}${slot.current ? ", 현재 사용자" : ""}` : undefined}
                className={`boarding-status-seat${slot.boarded ? " boarding-status-seat--boarded" : ""}${slot.current ? " boarding-status-seat--current" : ""}`}
              >
                {slot.seatNumber === 5 && (
                  <span className="boarding-status-seat-five-patch" aria-hidden="true">
                    <Image
                      src="/api/boarding-status-visual?asset=neutral-seat-patch"
                      alt=""
                      aria-hidden="true"
                      width={101}
                      height={110}
                      draggable="false"
                      unoptimized
                    />
                    <span className="boarding-status-seat-five-number">5</span>
                  </span>
                )}

                {slot.current && (
                  <span
                    className="boarding-status-current-ring"
                    aria-hidden="true"
                    style={sourceBoxStyle(overlay.ring)}
                  />
                )}

                <span
                  className="boarding-status-mask boarding-status-name-mask"
                  aria-hidden="true"
                  style={sourceBoxStyle(overlay.nameMask)}
                />
                <span
                  className="boarding-status-mask boarding-status-state-mask"
                  aria-hidden="true"
                  style={sourceBoxStyle(overlay.statusMask)}
                />

                {slot.member && (
                  <>
                    <strong
                      className="boarding-status-seat-name"
                      aria-hidden="true"
                      style={sourceBoxStyle(overlay.name)}
                    >
                      {slot.member.name}
                    </strong>
                    <span
                      className="boarding-status-seat-state"
                      aria-hidden="true"
                      style={sourceBoxStyle(overlay.state)}
                    >
                      <span className="boarding-status-seat-dot" />
                      {slot.current && <em>나</em>}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {FOOTER_MASKS.map((mask, index) => (
          <span
            key={index}
            className="boarding-status-mask boarding-status-footer-mask"
            aria-hidden="true"
            style={sourceBoxStyle(mask)}
          />
        ))}

        <p className="boarding-status-summary">
          {boardedCount} / {roster.length} 탑승 완료
        </p>

        <button
          type="button"
          className="boarding-status-cta"
          aria-label="여행 시작하기"
          onClick={() => router.push("/home")}
        />
      </main>
    </MobileShell>
  );
}
