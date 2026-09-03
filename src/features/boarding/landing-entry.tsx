"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoadingState, MobileShell } from "@/components/ui";
import {
  isSafeMemberPreview,
  normalizeMemberName,
} from "./boarding-logic";
import {
  ensureAnonymousAuthSession,
  getCurrentTripSession,
} from "./current-trip-session";
import { savePendingMember } from "./pending-member";

export function LandingEntry({ invalidInvite = false }: { invalidInvite?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);

  useEffect(() => {
    if (invalidInvite) return;

    let active = true;

    getCurrentTripSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          router.replace("/home");
          return;
        }
        setCheckingMembership(false);
      })
      .catch(() => {
        if (active) setCheckingMembership(false);
      });

    return () => {
      active = false;
    };
  }, [invalidInvite, router]);

  if (checkingMembership && !invalidInvite) {
    return (
      <MobileShell className="safe-top safe-x">
        <LoadingState className="min-h-svh" label="여행 정보를 확인하고 있어요" />
      </MobileShell>
    );
  }

  if (invalidInvite) {
    return (
      <MobileShell className="safe-x safe-top safe-bottom flex items-center">
        <main
          aria-labelledby="invalid-invite-title"
          className="w-full rounded-xl border border-line bg-surface p-8 text-center shadow-card"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-5 flex size-12 items-center justify-center rounded-pill bg-accent-primary/10 text-section text-accent-primary"
          >
            ✦
          </span>
          <p className="text-caption font-bold tracking-[0.16em] text-accent-primary uppercase">
            FUKUOKA FAMILY TRIP
          </p>
          <h1
            id="invalid-invite-title"
            className="mt-3 break-keep [text-wrap:balance] font-editorial text-page-title font-semibold"
          >
            초대 링크를 확인해주세요
          </h1>
          <p role="alert" className="mt-4 text-sm text-text-secondary">
            초대 링크가 올바르지 않아요. 전달받은 링크를 다시 확인해주세요.
          </p>
        </main>
      </MobileShell>
    );
  }

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
    <MobileShell className="landing-raster-page">
      {error && (
        <p id="member-name-error" role="alert" className="landing-form-error">
          {error}
        </p>
      )}

      <main className="landing-plate" aria-labelledby="landing-title">
        <Image
          src="/api/landing-visual"
          alt=""
          aria-hidden="true"
          width={853}
          height={1842}
          draggable="false"
          priority
          unoptimized
          className="landing-plate-image"
        />

        <div className="sr-only">
          <p>FUKUOKA FAMILY TRIP</p>
          <h1 id="landing-title">전가네 가족여행 출발</h1>
          <p>2026.09.11 – 09.13</p>
          <p>우리 가족의 후쿠오카행이 곧 출발합니다.</p>
          <p>ICN에서 후쿠오카까지, 2박 3일</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="member-name" className="sr-only">
            탑승할 가족의 이름을 입력해주세요
          </label>
          <input
            id="member-name"
            name="memberName"
            type="text"
            autoComplete="name"
            required
            value={name}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "member-name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            className="landing-name-overlay"
          />

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="landing-submit-overlay"
          >
            <span className={loading ? "landing-loading-label" : "sr-only"}>
              {loading ? "탑승권을 확인하고 있어요" : "탑승하기"}
            </span>
          </button>
        </form>
      </main>
    </MobileShell>
  );
}
