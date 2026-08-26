"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, MobileShell } from "@/components/ui";
import {
  isSafeMemberPreview,
  normalizeMemberName,
} from "./boarding-logic";
import { ensureAnonymousAuthSession } from "./current-trip-session";
import { savePendingMember } from "./pending-member";

export function LandingEntry({ invalidInvite = false }: { invalidInvite?: boolean }) {
  const router = useRouter();
  const privateHeroUrl = process.env.NEXT_PUBLIC_PRIVATE_HERO_URL?.trim();
  const [name, setName] = useState("");
  const [error, setError] = useState(
    invalidInvite ? "초대 링크가 올바르지 않아요. 전달받은 링크를 다시 확인해주세요." : "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = normalizeMemberName(name);

    if (!normalizedName) {
      setError("이름을 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const session = await ensureAnonymousAuthSession();
      const response = await fetch("/api/member-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: normalizedName }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "탑승 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.";
        setError(message);
        return;
      }

      if (!isSafeMemberPreview(body)) {
        setError("탑승 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      savePendingMember(body);
      router.push("/boarding");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.includes("configuration")
          ? "앱 연결 설정을 확인해주세요."
          : "탑승 준비 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileShell className="landing-page relative isolate overflow-hidden">
      <main className="safe-top safe-x min-h-svh pb-5">
        <section className="landing-ticket overflow-hidden rounded-[1.8rem] border-2 border-accent-primary/80 shadow-raised">
          <div className="relative min-h-[28rem] px-5 pt-11 text-center min-[390px]:min-h-[29rem] min-[390px]:px-6 min-[390px]:pt-12">
            <header>
              <svg
                aria-hidden="true"
                viewBox="0 0 230 70"
                className="absolute top-4 left-1/2 w-[12.5rem] -translate-x-1/2 text-accent-primary/45"
                fill="none"
              >
                <circle cx="11" cy="54" r="3.5" fill="currentColor" opacity=".45" />
                <path d="M12 54c36-1 34-42 78-34 35 6 41 41 106 21" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 7" />
                <path d="m193 28 25 9-21 15 5-11-15-2 15-3-9-8Z" fill="currentColor" />
              </svg>
              <p className="relative text-[0.68rem] font-bold tracking-[0.22em] text-accent-primary min-[390px]:text-[0.72rem]">
                FUKUOKA FAMILY TRIP
              </p>
              <h1 className="font-editorial mt-5 whitespace-nowrap text-[clamp(1.85rem,8.3vw,2.3rem)] leading-none font-semibold tracking-[-0.055em]">
                전가네 가족여행 출발
              </h1>
              <p className="font-editorial mt-5 inline-flex min-h-10 items-center rounded-pill border border-dashed border-accent-primary/45 bg-surface/55 px-6 text-base font-semibold text-accent-primary shadow-card">
                2026.09.11 – 09.13
              </p>
              <p className="font-editorial mt-5 break-keep text-base leading-relaxed text-text-secondary min-[390px]:text-[1.05rem]">
                우리 가족의 후쿠오카행이 곧 출발합니다.
              </p>
            </header>

            <div className="mt-6 grid h-[13.5rem] grid-cols-[minmax(0,1fr)_6rem] gap-2 rounded-md border border-dashed border-accent-primary/35 px-2 text-left min-[390px]:h-[14rem] min-[390px]:grid-cols-[minmax(0,1fr)_7rem] min-[430px]:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="grid min-w-0 grid-rows-2">
                <div className="flex items-center gap-1 border-b border-dashed border-accent-primary/30">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 -rotate-12 text-accent-secondary/75 min-[390px]:size-5" fill="currentColor">
                    <path d="m2 16 8-5V5.5c0-1.2.7-3.5 2-3.5s2 2.3 2 3.5V11l8 5v2l-8-2.5V20l2 1.5V23l-4-1-4 1v-1.5l2-1.5v-4.5L2 18v-2Z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-bold tracking-[0.12em] text-accent-secondary/80">ROUTE</p>
                    <p className="font-editorial mt-1 whitespace-nowrap text-[0.9rem] font-semibold tracking-[-0.03em] min-[390px]:text-base">
                      ICN <span className="px-0.5 text-accent-primary">→</span> FUKUOKA
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 text-accent-secondary/75 min-[390px]:size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M7 3v4m10-4v4M3 10h18M7 14h2m3 0h2m3 0h1M7 18h2m3 0h2" />
                  </svg>
                  <div>
                    <p className="text-[0.6rem] font-bold tracking-[0.12em] text-accent-secondary/80">DURATION</p>
                    <p className="font-editorial mt-1 text-xl font-semibold">2박 3일</p>
                  </div>
                </div>
              </div>

              {privateHeroUrl && (
                <figure className="landing-sticker min-w-0 self-center text-center">
                  <Image
                    src={privateHeroUrl}
                    alt="가족여행 주인공"
                    width={420}
                    height={347}
                    sizes="(min-width: 430px) 128px, (min-width: 390px) 112px, 96px"
                    priority
                    unoptimized
                    className="h-auto w-full object-contain"
                  />
                  <figcaption className="font-handwritten relative -mt-1 rotate-2 break-keep border border-line bg-[#fffaf0] px-1.5 py-1.5 text-[0.7rem] leading-relaxed text-text-primary shadow-raised min-[390px]:px-2 min-[390px]:text-xs">
                    꽃길만 걷는다고 전해라~♪
                    <span aria-hidden="true" className="absolute -top-1.5 right-4 h-8 w-2 rotate-[14deg] rounded-pill border-2 border-text-secondary/75" />
                  </figcaption>
                </figure>
              )}
            </div>

            <div aria-hidden="true" className="landing-postmark absolute bottom-[-0.65rem] -left-8 size-16 rotate-[-10deg] rounded-full border-2 border-accent-primary/28 text-accent-primary/35 opacity-70">
              <span className="absolute inset-2 rounded-full border border-dashed border-current" />
              <span className="absolute top-5 left-3 text-[0.48rem] font-bold tracking-[0.22em]">FUKUOKA</span>
              <span className="absolute inset-0 grid place-items-center text-xl">✈</span>
              <span className="absolute bottom-4 left-4 text-[0.45rem] font-bold tracking-[0.2em]">BOUND</span>
            </div>
            <div aria-hidden="true" className="absolute bottom-1 left-7 flex rotate-3 flex-col gap-1 text-accent-primary/25">
              <span className="block h-px w-16 bg-current" />
              <span className="block h-px w-20 bg-current" />
              <span className="block h-px w-16 bg-current" />
            </div>
          </div>

          <div className="relative z-20 border-t-2 border-dashed border-accent-primary/70">
            <span aria-hidden="true" className="absolute top-0 -left-4 size-8 -translate-y-1/2 rounded-full border-2 border-accent-primary/80 bg-background" />
            <span aria-hidden="true" className="absolute top-0 -right-4 size-8 -translate-y-1/2 rounded-full border-2 border-accent-primary/80 bg-background" />
          </div>

          <div className="relative min-h-[14.5rem] px-12 pt-6 pb-4 min-[390px]:px-[3.8rem]">
            <div aria-hidden="true" className="landing-stub-rail left-0 border-r border-dashed border-line">
              <span className="landing-barcode" />
              <span className="landing-side-dot">●</span>
              <span className="landing-side-copy">FAMILY TRIP</span>
            </div>
            <div aria-hidden="true" className="landing-stub-rail right-0 border-l border-dashed border-line">
              <span className="landing-barcode" />
              <span className="landing-side-dot">●</span>
              <span className="landing-side-copy">FAMILY TRIP</span>
            </div>

            <form onSubmit={handleSubmit} noValidate={false}>
              <label htmlFor="member-name" className="block whitespace-nowrap text-[0.8rem] font-bold leading-snug min-[390px]:text-[0.9rem]">
                탑승할 가족의 이름을 입력해주세요
              </label>
              <input
                id="member-name"
                name="memberName"
                type="text"
                autoComplete="name"
                required
                value={name}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "member-name-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError("");
                }}
                className="tap-target mt-3 h-12 w-full rounded-md border-2 border-line bg-surface/45 px-4 text-lg font-semibold outline-none transition-colors focus:border-accent-primary"
              />
              <div className="min-h-7 pt-1.5">
                {error && (
                  <p id="member-name-error" role="alert" className="text-caption font-medium text-danger">
                    {error}
                  </p>
                )}
              </div>
              <Button type="submit" fullWidth loading={loading} className="mt-1 min-h-12 rounded-lg text-base">
                {loading ? "탑승권을 확인하고 있어요" : "탑승하기"}
              </Button>
            </form>

            <p aria-hidden="true" className="font-handwritten mt-3 whitespace-nowrap text-center text-xs text-accent-secondary/65 min-[390px]:text-sm">
              ︿ We&apos;re off to Fukuoka! ︿
            </p>
          </div>
        </section>
      </main>
    </MobileShell>
  );
}
