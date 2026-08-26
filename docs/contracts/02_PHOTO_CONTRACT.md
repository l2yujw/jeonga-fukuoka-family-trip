# Photo Contract

## Storage path
Private bucket: `trip-photos`

Object path stored in `photos.storage_path`:
`{tripId}/{authUserId}/{objectId}.{ext}`

- `objectId` is a generated UUID.
- The extension is derived from the validated MIME type.
- The original filename is metadata only and never appears in the object path.

## Metadata
```ts
type Photo = {
  id: string;
  tripId: string;
  uploaderMemberId: string;
  uploaderName: string | null;
  uploaderAuthUserId: string;
  storagePath: string;
  signedUrl: string | null; // runtime only
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};
```

## Upload pipeline
1. pick
2. decode for preview and dimensions when supported
3. private Storage upload
4. DB metadata insert
5. if insert fails, best-effort remove the uploaded object
6. prepend only after metadata persistence succeeds

HEIC/HEIF originals remain uploadable when the browser cannot decode a preview;
dimensions may be null and the persisted card may show an unavailable fallback.

## Private read / delete
- Query trip metadata newest-first, then create short-lived signed URLs at runtime.
- Never persist signed URLs or request public URLs.
- Delete metadata first, then best-effort remove the private object. A cleanup failure
  does not recreate metadata.

## Caption
원본 사진 caption과 card item caption은 별도.
card caption 변경이 photo.caption을 수정하지 않는다.
