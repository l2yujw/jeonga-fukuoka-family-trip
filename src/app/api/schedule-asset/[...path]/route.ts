import type { NextRequest } from "next/server";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";
import { resolveInviteTrip } from "@/features/boarding/server/request-context";
import {
  readScheduleAssetFile,
  serveScheduleAsset,
} from "@/features/schedule/server/schedule-asset";

export const runtime = "nodejs";

type ScheduleAssetRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(
  request: NextRequest,
  context: ScheduleAssetRouteContext,
) {
  const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const { path } = await context.params;

  return serveScheduleAsset(
    inviteToken,
    path,
    async () => Boolean(await resolveInviteTrip(request)),
    readScheduleAssetFile,
  );
}
