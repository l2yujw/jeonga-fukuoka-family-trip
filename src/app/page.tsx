import { cookies } from "next/headers";
import { LandingEntry } from "@/features/boarding/landing-entry";
import { INVITE_COOKIE_NAME } from "@/features/boarding/server/invite";

type LandingPageProps = {
  searchParams: Promise<{ invite?: string | string[] }>;
};

export default async function Home({ searchParams }: LandingPageProps) {
  const invite = (await searchParams).invite;
  const hasInviteCookie = Boolean((await cookies()).get(INVITE_COOKIE_NAME));

  return <LandingEntry invalidInvite={invite === "invalid" || !hasInviteCookie} />;
}
