export const LANDING_VISUAL_CACHE_CONTROL = "private, no-store";

type PrivateVisualCacheOptions = {
  cacheControl: string;
  etag: string;
  ifNoneMatch: string | null;
};

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
  cacheOptions?: PrivateVisualCacheOptions,
) {
  if (!inviteToken) return errorResponse("Unauthorized.", 401);

  try {
    if (!(await validateInvite())) return errorResponse("Unauthorized.", 401);
  } catch {
    return errorResponse("Landing visual authorization is unavailable.", 503);
  }

  const responseHeaders = {
    "Cache-Control": cacheOptions?.cacheControl ?? LANDING_VISUAL_CACHE_CONTROL,
    "Content-Type": "image/png",
    ...(cacheOptions ? { ETag: cacheOptions.etag } : {}),
  };
  const ifNoneMatch = cacheOptions?.ifNoneMatch;
  if (
    cacheOptions &&
    ifNoneMatch?.split(",").some((value) =>
      value.trim() === "*" ||
      value.trim().replace(/^W\//, "") === cacheOptions.etag
    )
  ) {
    return new Response(null, { status: 304, headers: responseHeaders });
  }

  try {
    return new Response(await readImage(), {
      headers: responseHeaders,
    });
  } catch {
    return errorResponse("Private landing visual is unavailable.", 404);
  }
}
