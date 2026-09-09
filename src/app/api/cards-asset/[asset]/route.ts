import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";
import { serveLandingVisual } from "@/features/boarding/server/landing-visual";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";

export const runtime = "nodejs";

const cardsAssets = {
  "Jeonga_Fukuoka_Cards_TopFloral_v1.png":
    "Jeonga_Fukuoka_Cards_TopFloral_v1.png",
} as const;

const watercolorAssets = [
  "paper.png", "polaroid-flower.png", "polaroid-sprig.png", "fourcut-flower.png",
  "editorial-sprig.png", "editorial-flower.png", "postcard-stamp.png", "scrapbook-flower.png",
  "film-flower.png", "moment-sprig.png", "instant-sprig.png", "tape-pink.png",
  "NanumMyeongjo-Regular.ttf", "NanumPenScript-Regular.ttf",
] as const;

type CardsAssetRouteContext = {
  params: Promise<{ asset: string }>;
};

export async function GET(
  request: NextRequest,
  context: CardsAssetRouteContext,
) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const { asset } = await context.params;

  const watercolorName = watercolorAssets.find(name => asset === `wc-${name}`);
  const response = await serveLandingVisual(
    inviteToken,
    async () => Boolean(await resolveInviteTrip(request)),
    async () => {
      const filename = watercolorName
        ? `templates/watercolor-2026-v1/${watercolorName}`
        : Object.hasOwn(cardsAssets, asset) ? cardsAssets[asset as keyof typeof cardsAssets] : null;
      if (!filename) throw new Error("Unknown Cards asset.");
      return new Uint8Array(
        await readFile(join(process.cwd(), "private-assets", "cards", filename)),
      ).buffer;
    },
  );
  if (response.ok && watercolorName?.endsWith(".ttf")) response.headers.set("Content-Type", "font/ttf");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
