import {
  isPendingMemberPreview,
  type SafeMemberPreview,
} from "./boarding-logic";

const PENDING_MEMBER_KEY = "jeonga:pending-member:v1";

export function savePendingMember(preview: SafeMemberPreview) {
  sessionStorage.setItem(
    PENDING_MEMBER_KEY,
    JSON.stringify({
      version: 1,
      memberId: preview.memberId,
      name: preview.name,
      displayRole: preview.displayRole,
      tripId: preview.tripId,
    }),
  );
}

export function readPendingMember() {
  try {
    const stored = sessionStorage.getItem(PENDING_MEMBER_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    if (isPendingMemberPreview(parsed)) return parsed;
  } catch {
    // Invalid session state is discarded below.
  }

  clearPendingMember();
  return null;
}

export function clearPendingMember() {
  sessionStorage.removeItem(PENDING_MEMBER_KEY);
}
