"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingState, MobileShell } from "@/components/ui";
import type { CurrentTripSession } from "./boarding-logic";
import { getCurrentTripSession } from "./current-trip-session";

const CurrentTripSessionContext = createContext<CurrentTripSession | null>(null);

export function TripAccessGuard({
  children,
}: {
  children: (session: CurrentTripSession) => ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<CurrentTripSession | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentTripSession()
      .then((current) => {
        if (!active) return;
        if (!current) {
          router.replace("/");
          return;
        }
        setSession(current);
      })
      .catch(() => {
        if (active) router.replace("/");
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (!session) {
    return (
      <MobileShell className="safe-top safe-x">
        <LoadingState className="min-h-svh" label="여행 정보를 확인하고 있어요" />
      </MobileShell>
    );
  }

  return (
    <CurrentTripSessionContext.Provider value={session}>
      {children(session)}
    </CurrentTripSessionContext.Provider>
  );
}

export function useCurrentTripSession() {
  const session = useContext(CurrentTripSessionContext);
  if (!session) throw new Error("Current trip session is unavailable.");
  return session;
}
