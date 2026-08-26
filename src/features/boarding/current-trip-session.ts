import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CURRENT_TRIP_SLUG,
  type CurrentTripSession,
  type FamilyRosterMember,
} from "./boarding-logic";

type MembershipRow = {
  family_member_id: string;
  family_members: {
    id: string;
    name: string;
    display_role: string;
    boarded_at: string | null;
  };
  trips: {
    id: string;
    slug: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
  };
};

export async function getCurrentAuthSession() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function ensureAnonymousAuthSession(): Promise<Session> {
  const existing = await getCurrentAuthSession();
  if (existing) return existing;

  const { data, error } =
    await getSupabaseBrowserClient().auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error("Anonymous Supabase session was not created.");
  }
  return data.session;
}

export async function getCurrentTripSession(): Promise<CurrentTripSession | null> {
  const authSession = await getCurrentAuthSession();
  if (!authSession) return null;

  const { data, error } = await getSupabaseBrowserClient()
    .from("trip_memberships")
    .select(
      "family_member_id, family_members!inner(id,name,display_role,boarded_at), trips!inner(id,slug,title,destination,start_date,end_date)",
    )
    .eq("auth_user_id", authSession.user.id)
    .eq("trips.slug", CURRENT_TRIP_SLUG)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as MembershipRow;
  if (!row.family_members.boarded_at) return null;

  return {
    trip: {
      id: row.trips.id,
      slug: row.trips.slug,
      title: row.trips.title,
      destination: row.trips.destination,
      startDate: row.trips.start_date,
      endDate: row.trips.end_date,
    },
    member: {
      id: row.family_members.id,
      name: row.family_members.name,
      displayRole: row.family_members.display_role,
      boardedAt: row.family_members.boarded_at,
    },
  };
}

export async function loadFamilyRoster(tripId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("family_members")
    .select("id,name,display_role,boarded_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(
    (member): FamilyRosterMember => ({
      id: member.id,
      name: member.name,
      displayRole: member.display_role,
      boardedAt: member.boarded_at,
    }),
  );
}
