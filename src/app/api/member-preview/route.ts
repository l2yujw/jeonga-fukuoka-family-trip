import { type NextRequest, NextResponse } from "next/server";
import {
  classifyMembershipClaim,
  readMemberNamePayload,
  type MembershipClaimRow,
} from "@/features/boarding/boarding-logic";
import {
  authenticateRequest,
  resolveInviteTrip,
} from "@/features/boarding/server/request-context";
import { clearSwitchIntent, readSwitchIntent } from "@/features/boarding/server/switch-intent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const jsonError = (error: string, status: number, code?: string) =>
  NextResponse.json(code ? { error, code } : { error }, { status });

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return clearSwitchIntent(jsonError("인증 정보를 다시 확인해주세요.", 401));

    const payload: unknown = await request.json().catch(() => null);
    const name = readMemberNamePayload(payload);
    if (!name) return jsonError("이름을 올바르게 입력해주세요.", 400);

    const trip = await resolveInviteTrip(request);
    if (!trip) return clearSwitchIntent(jsonError("초대 링크로 접속해주세요.", 403));

    const intent = readSwitchIntent(request, user.id, trip.id);
    if (intent === null) return clearSwitchIntent(jsonError("변경 시간이 만료됐어요. 홈에서 다시 변경해주세요.", 409));
    const admin = createSupabaseAdminClient();
    const { data: member, error } = await admin
      .from("family_members")
      .select("id,name,display_role")
      .eq("trip_id", trip.id)
      .eq("name", name)
      .maybeSingle();

    if (error) throw new Error("Supabase member preview failed.");
    if (!member) return jsonError("등록된 가족 이름을 확인해주세요.", 404);

    const [currentAuthResult, targetMemberResult] = await Promise.all([
      admin
        .from("trip_memberships")
        .select("id,auth_user_id,family_member_id")
        .eq("trip_id", trip.id)
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      admin
        .from("trip_memberships")
        .select("id,auth_user_id,family_member_id")
        .eq("trip_id", trip.id)
        .eq("family_member_id", member.id)
        .maybeSingle(),
    ]);
    if (currentAuthResult.error || targetMemberResult.error) {
      throw new Error("Supabase membership preview lookup failed.");
    }

    const claimState = classifyMembershipClaim({
      authUserId: user.id,
      currentAuthMembership: currentAuthResult.data as MembershipClaimRow | null,
      targetMemberId: member.id,
      targetMemberMembership: targetMemberResult.data as MembershipClaimRow | null,
    });
    if (intent && currentAuthResult.data?.id !== intent.membershipId) {
      return clearSwitchIntent(jsonError("현재 가족 연결이 바뀌었어요. 다시 입장해주세요.", 409));
    }
    if (!intent && claimState.status === "conflict") {
      return jsonError(claimState.error, 409, claimState.code);
    }

    const claimedElsewhere = Boolean(targetMemberResult.data && targetMemberResult.data.auth_user_id !== user.id);
    return NextResponse.json({
      memberId: member.id,
      name: member.name,
      displayRole: member.display_role,
      tripId: trip.id,
      ...(intent ? { claimedElsewhere } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("configuration")
        ? error.message
        : "탑승 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.";
    return jsonError(message, 500);
  }
}
