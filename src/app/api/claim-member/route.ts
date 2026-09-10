import { type NextRequest, NextResponse } from "next/server";
import {
  classifyMembershipClaim,
  readMemberIdPayload,
  type CurrentTripSession,
  type MembershipClaimRow,
  type MembershipClaimState,
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
    const memberId = readMemberIdPayload(payload);
    if (!memberId) return jsonError("가족 정보를 올바르게 확인해주세요.", 400);

    const trip = await resolveInviteTrip(request);
    if (!trip) return clearSwitchIntent(jsonError("초대 링크로 접속해주세요.", 403));

    const intent = readSwitchIntent(request, user.id, trip.id);
    if (intent === null) return clearSwitchIntent(jsonError("변경 시간이 만료됐어요. 홈에서 다시 변경해주세요.", 409));
    const admin = createSupabaseAdminClient();
    const { data: member, error: memberError } = await admin
      .from("family_members")
      .select("id,name,display_role,boarded_at")
      .eq("id", memberId)
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (memberError) throw new Error("Supabase member lookup failed.");
    if (!member) return jsonError("등록된 가족 이름을 확인해주세요.", 404);

    let boardedAt = member.boarded_at;
    if (intent) {
      const { data: transfer, error } = await admin.rpc("transfer_trip_membership_for_switch", {
        p_trip_id: trip.id,
        p_auth_user_id: user.id,
        p_target_member_id: member.id,
        p_expected_membership_id: intent.membershipId,
      });
      if (error || !transfer ||
          !["transferred", "already_target"].includes(transfer.status) ||
          typeof transfer.boarded_at !== "string") {
        return jsonError("프로필 변경을 완료하지 못했어요. 다시 시도하거나 현재 프로필로 돌아가주세요.", 500);
      }
      boardedAt = transfer.boarded_at;
    } else {
      const readClaimState = async (): Promise<MembershipClaimState> => {
        const [currentAuthResult, targetMemberResult] = await Promise.all([
          admin
            .from("trip_memberships")
            .select("auth_user_id,family_member_id")
            .eq("trip_id", trip.id)
            .eq("auth_user_id", user.id)
            .maybeSingle(),
          admin
            .from("trip_memberships")
            .select("auth_user_id,family_member_id")
            .eq("trip_id", trip.id)
            .eq("family_member_id", member.id)
            .maybeSingle(),
        ]);
        if (currentAuthResult.error || targetMemberResult.error) {
          throw new Error("Supabase membership lookup failed.");
        }
        return classifyMembershipClaim({
          authUserId: user.id,
          currentAuthMembership:
            currentAuthResult.data as MembershipClaimRow | null,
          targetMemberId: member.id,
          targetMemberMembership:
            targetMemberResult.data as MembershipClaimRow | null,
        });
      };

      let claimState = await readClaimState();
      if (claimState.status === "conflict") {
        return jsonError(claimState.error, 409, claimState.code);
      }

      if (claimState.status === "fresh") {
        const { error: insertError } = await admin.from("trip_memberships").insert({
          trip_id: trip.id,
          family_member_id: member.id,
          auth_user_id: user.id,
        });

        if (insertError) {
          if (insertError.code !== "23505") {
            throw new Error("Supabase membership creation failed.");
          }
          claimState = await readClaimState();
          if (claimState.status === "conflict") {
            return jsonError(claimState.error, 409, claimState.code);
          }
          if (claimState.status === "fresh") {
            return jsonError("탑승 정보를 확인할 수 없어요. 다시 시도해주세요.", 409);
          }
        }
      }

      if (!boardedAt) {
        const now = new Date().toISOString();
        const { data: updated, error: updateError } = await admin
          .from("family_members")
          .update({ boarded_at: now })
          .eq("id", member.id)
          .eq("trip_id", trip.id)
          .is("boarded_at", null)
          .select("boarded_at")
          .maybeSingle();

        if (updateError) throw new Error("Supabase boarding update failed.");
        boardedAt = updated?.boarded_at ?? null;

        if (!boardedAt) {
          const { data: refreshed, error: refreshError } = await admin
            .from("family_members")
            .select("boarded_at")
            .eq("id", member.id)
            .single();
          if (refreshError || !refreshed.boarded_at) {
            throw new Error("Supabase boarding state could not be confirmed.");
          }
          boardedAt = refreshed.boarded_at;
        }
      }

    }

    const session: CurrentTripSession = {
      trip: {
        id: trip.id,
        slug: trip.slug,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
      },
      member: {
        id: member.id,
        name: member.name,
        displayRole: member.display_role,
        boardedAt,
      },
    };

    const response = NextResponse.json(session);
    return intent ? clearSwitchIntent(response) : response;
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("configuration")
        ? error.message
        : "탑승을 완료할 수 없어요. 잠시 후 다시 시도해주세요.";
    return jsonError(message, 500);
  }
}
