import { type NextRequest, NextResponse } from "next/server";
import { readMemberNamePayload } from "@/features/boarding/boarding-logic";
import {
  authenticateRequest,
  resolveInviteTrip,
} from "@/features/boarding/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError("인증 정보를 다시 확인해주세요.", 401);

    const payload: unknown = await request.json().catch(() => null);
    const name = readMemberNamePayload(payload);
    if (!name) return jsonError("이름을 올바르게 입력해주세요.", 400);

    const trip = await resolveInviteTrip(request);
    if (!trip) return jsonError("초대 링크로 접속해주세요.", 403);

    const { data: member, error } = await createSupabaseAdminClient()
      .from("family_members")
      .select("id,name,display_role")
      .eq("trip_id", trip.id)
      .eq("name", name)
      .maybeSingle();

    if (error) throw new Error("Supabase member preview failed.");
    if (!member) return jsonError("등록된 가족 이름을 확인해주세요.", 404);

    return NextResponse.json({
      memberId: member.id,
      name: member.name,
      displayRole: member.display_role,
      tripId: trip.id,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("configuration")
        ? error.message
        : "탑승 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.";
    return jsonError(message, 500);
  }
}
