export const CURRENT_TRIP_SLUG = "jeonga-fukuoka-2026";
export const FAMILY_SLOT_COUNT = 10;

export type SafeMemberPreview = {
  memberId: string;
  name: string;
  displayRole: string;
  tripId: string;
};

export type PendingMemberPreview = SafeMemberPreview & {
  version: 1;
};

export type CurrentTripSession = {
  trip: {
    id: string;
    slug: string;
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
  };
  member: {
    id: string;
    name: string;
    displayRole: string;
    boardedAt: string;
  };
};

export type FamilyRosterMember = {
  id: string;
  name: string;
  displayRole: string;
  boardedAt: string | null;
  seatOrder: number | null;
};

export type FamilySlot = {
  id: string;
  seatNumber: number;
  member: FamilyRosterMember | null;
  boarded: boolean;
  current: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

export function normalizeMemberName(value: string) {
  return value.normalize("NFC").trim();
}

export function readMemberNamePayload(value: unknown) {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  const name = normalizeMemberName(value.name);
  return name && name.length <= 100 ? name : null;
}

export function readMemberIdPayload(value: unknown) {
  if (!isRecord(value) || typeof value.memberId !== "string") return null;
  return UUID_PATTERN.test(value.memberId) ? value.memberId : null;
}

export function isSafeMemberPreview(value: unknown): value is SafeMemberPreview {
  if (!isRecord(value)) return false;
  return (
    typeof value.memberId === "string" &&
    UUID_PATTERN.test(value.memberId) &&
    typeof value.tripId === "string" &&
    UUID_PATTERN.test(value.tripId) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.displayRole === "string" &&
    value.displayRole.length > 0
  );
}

export function isPendingMemberPreview(
  value: unknown,
): value is PendingMemberPreview {
  return isRecord(value) && value.version === 1 && isSafeMemberPreview(value);
}

export function isCurrentTripSession(value: unknown): value is CurrentTripSession {
  if (!isRecord(value) || !isRecord(value.trip) || !isRecord(value.member)) {
    return false;
  }

  return (
    typeof value.trip.id === "string" &&
    UUID_PATTERN.test(value.trip.id) &&
    typeof value.trip.slug === "string" &&
    typeof value.trip.title === "string" &&
    typeof value.trip.destination === "string" &&
    typeof value.trip.startDate === "string" &&
    typeof value.trip.endDate === "string" &&
    typeof value.member.id === "string" &&
    UUID_PATTERN.test(value.member.id) &&
    typeof value.member.name === "string" &&
    typeof value.member.displayRole === "string" &&
    typeof value.member.boardedAt === "string"
  );
}

export async function resolveBoardingInitialization(
  pending: PendingMemberPreview | null,
  loadCurrentSession: () => Promise<CurrentTripSession | null>,
) {
  if (pending) return { stage: "confirm" as const, pending };

  const session = await loadCurrentSession();
  return session
    ? { stage: "complete" as const, session }
    : { stage: "redirect" as const };
}

export function createFamilySlots(
  roster: FamilyRosterMember[],
  currentMemberId: string,
): FamilySlot[] {
  const slots: FamilySlot[] = Array.from(
    { length: FAMILY_SLOT_COUNT },
    (_, index) => ({
      id: `seat-${index + 1}`,
      seatNumber: index + 1,
      member: null,
      boarded: false,
      current: false,
    }),
  );
  const unassigned: FamilyRosterMember[] = [];

  for (const member of roster) {
    const seatIndex =
      typeof member.seatOrder === "number" && Number.isInteger(member.seatOrder)
        ? member.seatOrder - 1
        : -1;
    if (
      seatIndex >= 0 &&
      seatIndex < FAMILY_SLOT_COUNT &&
      !slots[seatIndex].member
    ) {
      slots[seatIndex].member = member;
    } else {
      unassigned.push(member);
    }
  }

  for (const member of unassigned) {
    const slot = slots.find(({ member: occupant }) => !occupant);
    if (!slot) break;
    slot.member = member;
  }

  for (const slot of slots) {
    slot.boarded = Boolean(slot.member?.boardedAt);
    slot.current = slot.member?.id === currentMemberId;
  }

  return slots;
}
