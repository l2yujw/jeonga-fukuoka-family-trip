import { LandingEntry } from "@/features/boarding/landing-entry";

type LandingPageProps = {
  searchParams: Promise<{ invite?: string | string[] }>;
};

export default async function Home({ searchParams }: LandingPageProps) {
  const invite = (await searchParams).invite;
  return <LandingEntry invalidInvite={invite === "invalid"} />;
}
