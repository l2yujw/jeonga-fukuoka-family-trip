"use client";

import { BottomNav, MobileShell } from "@/components/ui";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";
import { ScheduleView } from "@/features/schedule/schedule-view";

export default function SchedulePage() {
  return (
    <TripAccessGuard>
      {() => (
        <MobileShell className="schedule-page flex min-h-svh flex-col overflow-x-clip">
          <main className="flex-1">
            <ScheduleView />
          </main>
          <BottomNav activeHref="/schedule" />
        </MobileShell>
      )}
    </TripAccessGuard>
  );
}
