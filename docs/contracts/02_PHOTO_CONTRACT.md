# Photo Contract

## Storage path
`trip-photos/{tripId}/{photoId}.{ext}`

## Metadata
```ts
type Photo = {
  id: string;
  tripId: string;
  uploaderMemberId: string;
  uploaderName: string;
  storagePath: string;
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};
```

## Upload pipeline
1. pick
2. decode
3. orientation normalize
4. resize/compress when needed
5. EXIF/GPS 제거 권장
6. Storage upload
7. DB metadata insert

## Caption
원본 사진 caption과 card item caption은 별도.
card caption 변경이 photo.caption을 수정하지 않는다.
