import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { serveLandingVisual } from "@/features/boarding/server/landing-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";

export const runtime = "nodejs";

// Production must use a protected private asset source before Vercel deployment.
const localImagePath = join(
  process.cwd(),
  "local-references",
  "feedback01-landing-final-extended.png",
);

export async function GET(request: NextRequest) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;

  return serveLandingVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    async () => new Uint8Array(await readFile(localImagePath)).buffer,
  );
}
