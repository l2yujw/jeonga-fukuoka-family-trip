import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { serveLandingVisual as serveBoardingStatusVisual } from "@/features/boarding/server/landing-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";

export const runtime = "nodejs";

// Production must use a protected private asset source before Vercel deployment.
const localPlatePath = join(
  process.cwd(),
  "local-references",
  "feedback04",
  "Jeonga_Fukuoka_Feedback04_Runtime_Visual_Plate_v8.png",
);
const localNeutralSeatPatchPath = join(
  process.cwd(),
  "local-references",
  "feedback04",
  "Jeonga_Fukuoka_Feedback04_Neutral_Seat_Patch_v8.png",
);

export async function GET(request: NextRequest) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const localImagePath = request.nextUrl.searchParams.get("asset") === "neutral-seat-patch"
    ? localNeutralSeatPatchPath
    : localPlatePath;

  return serveBoardingStatusVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    async () => new Uint8Array(await readFile(localImagePath)).buffer,
  );
}
