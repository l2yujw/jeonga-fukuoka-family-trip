export const ALBUM_MEDIA_ROOT_MARGIN = "1000px 0px";
export const ALBUM_INITIAL_MEDIA_PREWARM_COUNT = 6;
export const ALBUM_HIGH_PRIORITY_MEDIA_COUNT = 2;
export const CARDS_INITIAL_MEDIA_PREWARM_COUNT = 9;
export const CARDS_HIGH_PRIORITY_MEDIA_COUNT = 3;

type PrewarmableMedia = {
  mediaState: "idle" | "loading" | "ready" | "error";
};

export function getInitialMediaPrewarmCandidates<T extends PrewarmableMedia>(
  media: readonly T[],
  count: number,
) {
  return media.slice(0, count).filter(({ mediaState }) => mediaState === "idle");
}

export function getFirstViewFetchPriority(index: number, count: number) {
  return index < count ? "high" : "auto";
}

// The next image-byte optimization is responsive transformed thumbnails;
// originals remain the source for crop and export.

type NearViewportObserver = {
  disconnect: () => void;
  observe: (target: Element) => void;
};

export type NearViewportObserverFactory = (
  callback: (entries: readonly Pick<IntersectionObserverEntry, "isIntersecting">[]) => void,
  options: IntersectionObserverInit,
) => NearViewportObserver;

export function observeNearViewport(
  target: Element,
  activate: () => void,
  createObserver: NearViewportObserverFactory | null =
    typeof IntersectionObserver === "undefined"
      ? null
      : (callback, options) => new IntersectionObserver(callback, options),
) {
  if (!createObserver) {
    activate();
    return () => undefined;
  }

  let activated = false;
  const observer = createObserver((entries) => {
    if (activated || !entries.some(({ isIntersecting }) => isIntersecting)) return;
    activated = true;
    activate();
    observer.disconnect();
  }, { root: null, rootMargin: ALBUM_MEDIA_ROOT_MARGIN, threshold: 0 });
  observer.observe(target);
  return () => observer.disconnect();
}
