import type { NextRequest } from "next/server";
import { serveLandingVisual as serveBoardingStatusVisual } from "@/features/boarding/server/landing-visual";
import { loadPrivateVisual } from "@/features/boarding/server/private-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const asset = request.nextUrl.searchParams.get("asset") === "neutral-seat-patch"
    ? "neutral-seat-patch"
    : "status";

  return serveBoardingStatusVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    () => loadPrivateVisual(asset),
  );
}
