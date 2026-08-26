import "server-only";

import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken, INVITE_COOKIE_NAME } from "./invite";

export type InviteTrip = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
};

export async function authenticateRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) return null;

  const { data, error } = await createSupabaseServerClient().auth.getUser(match[1]);
  return error || !data.user?.is_anonymous ? null : data.user;
}

export async function resolveInviteTrip(request: NextRequest) {
  const rawToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const { data, error } = await createSupabaseAdminClient()
    .from("trips")
    .select("id,slug,title,destination,start_date,end_date")
    .eq("invite_token_hash", hashInviteToken(rawToken))
    .maybeSingle();

  if (error) throw new Error("Supabase invite validation failed.");
  return data as InviteTrip | null;
}
