import { type NextRequest, NextResponse } from "next/server";
import {
  readMemberIdPayload,
  type CurrentTripSession,
} from "@/features/boarding/boarding-logic";
import {
  authenticateRequest,
  resolveInviteTrip,
} from "@/features/boarding/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  family_member_id: string;
};

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError("인증 정보를 다시 확인해주세요.", 401);

    const payload: unknown = await request.json().catch(() => null);
    const memberId = readMemberIdPayload(payload);
    if (!memberId) return jsonError("가족 정보를 올바르게 확인해주세요.", 400);

    const trip = await resolveInviteTrip(request);
    if (!trip) return jsonError("초대 링크로 접속해주세요.", 403);

    const admin = createSupabaseAdminClient();
    const { data: member, error: memberError } = await admin
      .from("family_members")
      .select("id,name,display_role,boarded_at")
      .eq("id", memberId)
      .eq("trip_id", trip.id)
      .maybeSingle();

    if (memberError) throw new Error("Supabase member lookup failed.");
    if (!member) return jsonError("등록된 가족 이름을 확인해주세요.", 404);

    const readMembership = async () => {
      const { data, error } = await admin
        .from("trip_memberships")
        .select("family_member_id")
        .eq("trip_id", trip.id)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw new Error("Supabase membership lookup failed.");
      return data as MembershipRow | null;
    };

    let membership = await readMembership();
    if (membership && membership.family_member_id !== member.id) {
      return jsonError("이미 다른 가족으로 탑승이 완료되었어요.", 409);
    }

    if (!membership) {
      const { error: insertError } = await admin.from("trip_memberships").insert({
        trip_id: trip.id,
        family_member_id: member.id,
        auth_user_id: user.id,
      });

      if (insertError) {
        if (insertError.code !== "23505") {
          throw new Error("Supabase membership creation failed.");
        }
        membership = await readMembership();
        if (!membership || membership.family_member_id !== member.id) {
          return jsonError("이미 다른 가족으로 탑승이 완료되었어요.", 409);
        }
      }
    }

    let boardedAt = member.boarded_at;
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

    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("configuration")
        ? error.message
        : "탑승을 완료할 수 없어요. 잠시 후 다시 시도해주세요.";
    return jsonError(message, 500);
  }
}
