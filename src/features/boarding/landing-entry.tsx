"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, MobileShell } from "@/components/ui";
import { demoBoardingAdapter } from "./demo-adapter";

export function LandingEntry() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = demoBoardingAdapter.findMember(name.trim());

    if (!member) {
      setError("등록된 가족 이름을 확인해주세요.");
      return;
    }

    setError("");
    setLoading(true);
    demoBoardingAdapter.begin(member);
    router.push("/boarding");
  }

  return (
    <MobileShell className="relative isolate overflow-hidden">
      <main className="safe-top safe-x flex min-h-svh flex-col pb-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[58%] overflow-hidden">
          <div className="absolute -top-20 -right-20 size-72 rounded-full bg-accent-primary/8 blur-3xl" />
          <div className="absolute top-28 -left-24 size-56 rounded-full bg-accent-secondary/8 blur-3xl" />
          <svg viewBox="0 0 320 150" className="absolute top-3 right-1 w-64 text-accent-primary/35" fill="none">
            <path d="M18 117C78 115 75 34 143 57c52 17 63 60 151 13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 7" />
            <circle cx="18" cy="117" r="4" fill="currentColor" />
            <path d="m286 60 18 8-18 8 4-7-11-1 11-1-4-7Z" fill="currentColor" />
          </svg>
        </div>

        <header className="pt-10 text-center">
          <p className="text-caption font-bold tracking-[0.22em] text-accent-primary">
            FUKUOKA FAMILY TRIP
          </p>
          <h1 className="font-editorial mt-5 text-[clamp(2rem,9vw,2.7rem)] leading-[1.22] font-semibold tracking-[-0.04em]">
            전가네 가족여행 출발
          </h1>
          <p className="mt-4 inline-flex min-h-9 items-center rounded-pill border border-line bg-surface/75 px-4 text-sm font-medium text-text-secondary shadow-card">
            2026.10.09 – 10.11
          </p>
          <p className="font-editorial mt-6 text-lg text-text-secondary">
            우리 가족의 후쿠오카행이 곧 출발합니다.
          </p>
        </header>

        <Card className="relative mt-auto overflow-hidden p-5 sm:p-6" variant="elevated">
          <div aria-hidden="true" className="absolute top-0 left-0 h-1 w-full bg-[repeating-linear-gradient(90deg,var(--app-color-accent-primary)_0_12px,transparent_12px_20px)] opacity-65" />
          <form onSubmit={handleSubmit} noValidate={false}>
            <label htmlFor="member-name" className="block text-sm font-semibold">
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
              className="tap-target mt-3 w-full rounded-md border border-line bg-background/55 px-4 py-3 text-lg font-semibold outline-none transition-colors placeholder:text-text-secondary/50 focus:border-accent-primary"
            />
            <div className="min-h-7 pt-1.5">
              {error && (
                <p id="member-name-error" role="alert" className="text-caption font-medium text-danger">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" fullWidth loading={loading} className="mt-1">
              {loading ? "탑승권을 확인하고 있어요" : "탑승하기"}
            </Button>
          </form>
        </Card>
      </main>
    </MobileShell>
  );
}
