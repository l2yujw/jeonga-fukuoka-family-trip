import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { serveLandingVisual } from "@/features/boarding/server/landing-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";

export const runtime = "nodejs";

const HOME_RUNTIME_BASE_FILE =
  "Jeonga_Fukuoka_Feedback05_B_ORIGINAL_Runtime_Base_895x1756_v16.png";

export async function GET(request: NextRequest) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;

  return serveLandingVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    async () => {
      const localImagePath = join(
        process.cwd(),
        "local-references",
        "feedback05",
        HOME_RUNTIME_BASE_FILE,
      );
      return new Uint8Array(await readFile(localImagePath)).buffer;
    },
  );
}
