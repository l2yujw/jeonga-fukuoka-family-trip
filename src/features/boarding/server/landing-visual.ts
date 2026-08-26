export const LANDING_VISUAL_CACHE_CONTROL = "private, no-store";

const errorResponse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: {
      "Cache-Control": LANDING_VISUAL_CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

export async function serveLandingVisual(
  inviteToken: string | undefined,
  validateInvite: () => Promise<boolean>,
  readImage: () => Promise<ArrayBuffer>,
) {
  if (!inviteToken) return errorResponse("Unauthorized.", 401);

  try {
    if (!(await validateInvite())) return errorResponse("Unauthorized.", 401);
  } catch {
    return errorResponse("Landing visual authorization is unavailable.", 503);
  }

  try {
    return new Response(await readImage(), {
      headers: {
        "Cache-Control": LANDING_VISUAL_CACHE_CONTROL,
        "Content-Type": "image/png",
      },
    });
  } catch {
    return errorResponse("Private landing visual is unavailable.", 404);
  }
}
