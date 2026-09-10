import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest, resolveInviteTrip } from "@/features/boarding/server/request-context";
import {
  clearSwitchIntent, readSwitchIntent, signSwitchIntent,
  SWITCH_COOKIE_NAME, switchCookieOptions,
} from "@/features/boarding/server/switch-intent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

async function handleSwitch(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return clearSwitchIntent(jsonError("인증 정보를 다시 확인해주세요.", 401));
    const trip = await resolveInviteTrip(request);
    if (!trip) return clearSwitchIntent(jsonError("초대 링크로 접속해주세요.", 403));

    if (request.method === "DELETE") {
      return clearSwitchIntent(NextResponse.json({ active: false }));
    }
    const { data: membership, error } = await createSupabaseAdminClient()
      .from("trip_memberships")
      .select("id,family_members!inner(trip_id,boarded_at)")
      .eq("trip_id", trip.id)
      .eq("auth_user_id", user.id)
      .eq("family_members.trip_id", trip.id)
      .not("family_members.boarded_at", "is", null)
      .maybeSingle();
    if (error) throw new Error("Supabase membership lookup failed.");

    if (request.method === "GET") {
      const intent = readSwitchIntent(request, user.id, trip.id);
      return intent && membership?.id === intent.membershipId
        ? NextResponse.json({ active: true, expiresAt: intent.expiresAt }, { headers: { "Cache-Control": "no-store" } })
        : clearSwitchIntent(NextResponse.json({ active: false }, { headers: { "Cache-Control": "no-store" } }));
    }
    if (!membership) return clearSwitchIntent(jsonError("현재 가족으로 다시 입장해주세요.", 409));
    const token = signSwitchIntent({ authUserId: user.id, tripId: trip.id, membershipId: membership.id });
    const response = NextResponse.json({ status: "switch_ready" });
    response.cookies.set(SWITCH_COOKIE_NAME, token, switchCookieOptions);
    return response;
  } catch {
    return jsonError("사용자 변경을 준비할 수 없어요. 잠시 후 다시 시도해주세요.", 500);
  }
}

export const POST = handleSwitch;
export const GET = handleSwitch;
export const DELETE = handleSwitch;
