import { createHash } from "node:crypto";

export const INVITE_COOKIE_NAME = "jeonga_trip_invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
