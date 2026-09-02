"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAlbumPhotoSignedUrls,
  refreshAlbumPhotoSignedUrl,
} from "./album-repository";
import { observeNearViewport } from "./album-media-observer";
import type { AlbumPhoto, PhotoMediaState } from "./album-types";

export function useNearViewport<T extends Element>() {
  const [isNearViewport, setIsNearViewport] = useState(false);
  const activated = useRef(false);
  const stopObserving = useRef<() => void>(() => undefined);
  const observe = useCallback((node: T | null) => {
    stopObserving.current();
    if (!node || activated.current) return;
    stopObserving.current = observeNearViewport(node, () => {
      if (activated.current) return;
      activated.current = true;
      setIsNearViewport(true);
    });
  }, []);

  useEffect(() => () => stopObserving.current(), []);

  return [observe, isNearViewport] as const;
}

export type AlbumPhotoMediaChange = (
  photoId: string,
  mediaState: PhotoMediaState,
  signedUrl?: string | null,
) => void;

export function useNearViewportPhoto(
  photo: AlbumPhoto,
  onMediaChange?: AlbumPhotoMediaChange,
) {
  const [observe, isNearViewport] = useNearViewport<HTMLElement>();
  const [localMedia, setLocalMedia] = useState<{
    mediaState: PhotoMediaState;
    rejectedUrl: string | null;
    signedUrl: string | null;
    storagePath: string;
  } | null>(null);
  const retriedPath = useRef<string | null>(null);

  const transition = useCallback((
    nextState: PhotoMediaState,
    signedUrl: string | null = null,
    rejectedUrl: string | null = null,
  ) => {
    setLocalMedia({
      mediaState: nextState,
      rejectedUrl,
      signedUrl,
      storagePath: photo.storagePath,
    });
    onMediaChange?.(photo.id, nextState, signedUrl);
  }, [onMediaChange, photo.id, photo.storagePath]);

  const currentLocalMedia = localMedia?.storagePath === photo.storagePath
    ? localMedia
    : null;
  const signedUrl = currentLocalMedia?.signedUrl ?? (
    photo.signedUrl !== currentLocalMedia?.rejectedUrl ? photo.signedUrl : null
  );
  const mediaState: PhotoMediaState = signedUrl
    ? "ready"
    : currentLocalMedia?.mediaState ?? photo.mediaState;

  useEffect(() => {
    if (!isNearViewport || signedUrl) return;

    let active = true;
    queueMicrotask(() => {
      if (active) transition("loading");
    });
    void loadAlbumPhotoSignedUrls([photo.storagePath]).then(
      (urls) => {
        if (!active) return;
        const url = urls.get(photo.storagePath) ?? null;
        transition(url ? "ready" : "error", url);
      },
      () => {
        if (active) transition("error");
      },
    );
    return () => {
      active = false;
    };
  }, [isNearViewport, photo.storagePath, signedUrl, transition]);

  const onError = useCallback(() => {
    if (!signedUrl) return;
    if (retriedPath.current === photo.storagePath) {
      transition("error", null, signedUrl);
      return;
    }
    retriedPath.current = photo.storagePath;
    transition("loading", null, signedUrl);
    void refreshAlbumPhotoSignedUrl(photo.storagePath).then(
      (url) => {
        transition(url ? "ready" : "error", url);
      },
      () => transition("error"),
    );
  }, [photo.storagePath, signedUrl, transition]);

  return { mediaState, observe, onError, signedUrl };
}
