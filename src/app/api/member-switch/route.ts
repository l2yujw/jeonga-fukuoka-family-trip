import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  resolveInviteTrip,
} from "@/features/boarding/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BLOCKED_OWNED_CONTENT_ERROR =
  "이미 이 사용자로 만든 사진이나 추억 카드가 있어 자동 변경할 수 없어요.";

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError("인증 정보를 다시 확인해주세요.", 401);

    const trip = await resolveInviteTrip(request);
    if (!trip) return jsonError("초대 링크로 접속해주세요.", 403);

    const { data: status, error } = await createSupabaseAdminClient().rpc(
      "release_trip_membership_for_switch",
      { p_trip_id: trip.id, p_auth_user_id: user.id },
    );
    if (error) throw new Error("Supabase member switch failed.");

    if (status === "blocked_owned_content") {
      return NextResponse.json(
        { status, error: BLOCKED_OWNED_CONTENT_ERROR },
        { status: 409 },
      );
    }
    if (status === "released" || status === "already_released") {
      return NextResponse.json({ status });
    }

    throw new Error("Unexpected member switch status.");
  } catch {
    return jsonError(
      "사용자 변경을 완료할 수 없어요. 잠시 후 다시 시도해주세요.",
      500,
    );
  }
}
