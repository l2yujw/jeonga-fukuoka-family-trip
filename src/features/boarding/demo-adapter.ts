// Temporary Phase 2 seam. Replace this module with the Supabase adapter later.
export type DemoMember = {
  name: "류정원";
  displayRole: "전가네 큰손자";
};

export type DemoBoardingSession = {
  member: DemoMember;
  boarded: boolean;
  online: boolean;
};

export type DemoFamilySlot = {
  id: string;
  member: DemoMember | null;
  boarded: boolean;
  online: boolean;
};

const DEMO_MEMBER: DemoMember = {
  name: "류정원",
  displayRole: "전가네 큰손자",
};

const SESSION_KEY = "jeonga-phase-2-demo-boarding";

function isDemoSession(value: unknown): value is DemoBoardingSession {
  if (!value || typeof value !== "object") return false;
  const session = value as DemoBoardingSession;
  return (
    session.member?.name === DEMO_MEMBER.name &&
    session.member.displayRole === DEMO_MEMBER.displayRole &&
    typeof session.boarded === "boolean" &&
    typeof session.online === "boolean"
  );
}

function saveSession(session: DemoBoardingSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export const demoBoardingAdapter = {
  findMember(name: string) {
    return name === DEMO_MEMBER.name ? DEMO_MEMBER : null;
  },

  begin(member: DemoMember) {
    return saveSession({ member, boarded: false, online: false });
  },

  readSession() {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      const parsed: unknown = value ? JSON.parse(value) : null;
      return isDemoSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  complete(session: DemoBoardingSession) {
    return saveSession({ ...session, boarded: true, online: true });
  },

  familySlots(session: DemoBoardingSession): DemoFamilySlot[] {
    return [
      {
        id: "current",
        member: session.member,
        boarded: session.boarded,
        online: session.online,
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `anonymous-${index + 1}`,
        member: null,
        boarded: false,
        online: false,
      })),
    ];
  },
};
