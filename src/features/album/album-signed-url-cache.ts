export const ALBUM_SIGNED_URL_LIFETIME_SECONDS = 3600;
export const ALBUM_SIGNED_URL_REFRESH_SAFETY_MS = 5 * 60 * 1000;
export const ALBUM_SIGNED_URL_BATCH_SIZE = 40;

export type AlbumSignedUrlBatchSigner = (
  storagePaths: readonly string[],
) => Promise<ReadonlyMap<string, string | null>>;

type PendingUrl = {
  promise: Promise<string | null>;
  resolve: (url: string | null) => void;
};

export function createAlbumSignedUrlBroker(
  now: () => number = Date.now,
) {
  const cache = new Map<string, { url: string; expiresAt: number }>();
  const inFlight = new Map<string, PendingUrl>();
  const queues = new Map<
    string,
    { paths: Set<string>; signer: AlbumSignedUrlBatchSigner }
  >();
  const cacheKey = (authScope: string, storagePath: string) =>
    `${authScope}\u0000${storagePath}`;

  const flush = async (
    authScope: string,
    queue: { paths: Set<string>; signer: AlbumSignedUrlBatchSigner },
  ) => {
    if (queues.get(authScope) === queue) queues.delete(authScope);
    const storagePaths = [...queue.paths];
    const signedUrls = new Map<string, string | null>();
    await Promise.all(
      Array.from(
        { length: Math.ceil(storagePaths.length / ALBUM_SIGNED_URL_BATCH_SIZE) },
        async (_, index) => {
          const chunk = storagePaths.slice(
            index * ALBUM_SIGNED_URL_BATCH_SIZE,
            (index + 1) * ALBUM_SIGNED_URL_BATCH_SIZE,
          );
          try {
            for (const [path, url] of await queue.signer(chunk)) {
              signedUrls.set(path, url);
            }
          } catch {
            // A failed chunk must not discard URLs resolved by sibling chunks.
          }
        },
      ),
    );

    const expiresAt = now() + ALBUM_SIGNED_URL_LIFETIME_SECONDS * 1000;
    for (const storagePath of storagePaths) {
      const key = cacheKey(authScope, storagePath);
      const pending = inFlight.get(key);
      const url = signedUrls.get(storagePath) ?? null;
      if (url) cache.set(key, { url, expiresAt });
      pending?.resolve(url);
      inFlight.delete(key);
    }
  };

  const resolve = async (
    authScope: string,
    storagePaths: readonly string[],
    signer: AlbumSignedUrlBatchSigner,
  ) => {
    const result = new Map<string, string | null>();
    const pendingByPath = new Map<string, Promise<string | null>>();

    for (const storagePath of new Set(storagePaths)) {
      const key = cacheKey(authScope, storagePath);
      const cached = cache.get(key);
      if (
        cached &&
        cached.expiresAt > now() + ALBUM_SIGNED_URL_REFRESH_SAFETY_MS
      ) {
        result.set(storagePath, cached.url);
        continue;
      }

      const existing = inFlight.get(key);
      if (existing) {
        pendingByPath.set(storagePath, existing.promise);
        continue;
      }

      let resolvePending!: (url: string | null) => void;
      const promise = new Promise<string | null>((resolveUrl) => {
        resolvePending = resolveUrl;
      });
      inFlight.set(key, { promise, resolve: resolvePending });
      pendingByPath.set(storagePath, promise);

      let queue = queues.get(authScope);
      if (!queue) {
        queue = { paths: new Set(), signer };
        queues.set(authScope, queue);
        queueMicrotask(() => void flush(authScope, queue!));
      }
      queue.paths.add(storagePath);
    }

    await Promise.all(
      [...pendingByPath].map(async ([storagePath, pending]) => {
        result.set(storagePath, await pending);
      }),
    );
    return result;
  };

  return {
    resolve,
    invalidate(authScope: string, storagePath: string) {
      cache.delete(cacheKey(authScope, storagePath));
    },
  };
}

export const albumSignedUrlBroker = createAlbumSignedUrlBroker();
