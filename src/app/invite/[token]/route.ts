import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  hashInviteToken,
  INVITE_COOKIE_MAX_AGE,
  INVITE_COOKIE_NAME,
} from "@/features/boarding/server/invite";

type InviteRouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: InviteRouteContext) {
  const { token } = await context.params;
  const invalidRedirect = () =>
    NextResponse.redirect(new URL("/?invite=invalid", request.url));

  if (!token || token.length > 1024) return invalidRedirect();

  try {
    const { data: trip, error } = await createSupabaseAdminClient()
      .from("trips")
      .select("id")
      .eq("invite_token_hash", hashInviteToken(token))
      .maybeSingle();

    if (error) throw new Error("Supabase invite lookup failed.");
    if (!trip) return invalidRedirect();

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(INVITE_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: INVITE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("configuration")
        ? error.message
        : "Invite validation is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
