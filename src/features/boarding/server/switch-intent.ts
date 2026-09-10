import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SWITCH_COOKIE_NAME = "jeonga_member_switch";
export const SWITCH_MAX_AGE = 5 * 60;
export const switchCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SWITCH_MAX_AGE,
};

type SwitchIntent = {
  authUserId: string;
  tripId: string;
  membershipId: string;
  expiresAt: number;
};

function signature(payload: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Switch signing server configuration is missing.");
  return createHmac("sha256", secret)
    .update(`jeonga:member-switch:v1:${payload}`)
    .digest("base64url");
}

export function signSwitchIntent(identity: Omit<SwitchIntent, "expiresAt">, now = Date.now()) {
  const intent = { ...identity, expiresAt: now + SWITCH_MAX_AGE * 1000 };
  const payload = Buffer.from(JSON.stringify(intent)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySwitchIntent(
  token: string, authUserId: string, tripId: string, now = Date.now(),
): SwitchIntent | null {
  if (token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, supplied] = parts;
  const expected = signature(payload);
  if (!/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const intent = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return intent.authUserId === authUserId && intent.tripId === tripId &&
      typeof intent.membershipId === "string" && intent.membershipId.length > 0 &&
      Number.isSafeInteger(intent.expiresAt) && intent.expiresAt > now &&
      intent.expiresAt <= now + SWITCH_MAX_AGE * 1000 ? intent : null;
  } catch {
    return null;
  }
}

// undefined means ordinary entry; null means a presented but invalid intent.
export function readSwitchIntent(request: NextRequest, authUserId: string, tripId: string) {
  const token = request.cookies.get(SWITCH_COOKIE_NAME)?.value;
  return token === undefined ? undefined : verifySwitchIntent(token, authUserId, tripId);
}

export function clearSwitchIntent(response: NextResponse) {
  response.cookies.set(SWITCH_COOKIE_NAME, "", { ...switchCookieOptions, maxAge: 0 });
  return response;
}
