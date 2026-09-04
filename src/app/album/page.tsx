"use client";

import { useState } from "react";
import { BottomNav, MobileShell } from "@/components/ui";
import { AlbumView } from "@/features/album/album-view";
import { TripAccessGuard } from "@/features/boarding/trip-access-guard";

export default function AlbumPage() {
  return (
    <TripAccessGuard>
      {() => <AlbumPageContent />}
    </TripAccessGuard>
  );
}

function AlbumPageContent() {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <MobileShell className="album-page-shell flex min-h-svh flex-col">
      <main className="album-page-main flex-1">
        <AlbumView onComposerOpenChange={setIsComposerOpen} />
      </main>

      {!isComposerOpen && <BottomNav activeHref="/album" />}
    </MobileShell>
  );
}
