import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";
import { serveLandingVisual } from "@/features/boarding/server/landing-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";

export const runtime = "nodejs";

const albumAssets = {
  "Jeonga_Fukuoka_Album_TopFloral_v1.png":
    "Jeonga_Fukuoka_Album_TopFloral_v1.png",
  "Jeonga_Fukuoka_Album_OurMomentsGarden_v1.png":
    "Jeonga_Fukuoka_Album_OurMomentsGarden_v1.png",
} as const;

type AlbumAssetRouteContext = {
  params: Promise<{ asset: string }>;
};

export async function GET(
  request: NextRequest,
  context: AlbumAssetRouteContext,
) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const { asset } = await context.params;

  return serveLandingVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    async () => {
      const filename = albumAssets[asset as keyof typeof albumAssets];
      if (!filename) throw new Error("Unknown Album asset.");
      return new Uint8Array(
        await readFile(join(process.cwd(), "private-assets", "album", filename)),
      ).buffer;
    },
  );
}
