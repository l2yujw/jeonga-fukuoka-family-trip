export type AlbumPhoto = {
  id: string;
  uploaderName: string;
  uploaderMemberId: string | null;
  previewUrl: string;
  originalFilename: string;
  mimeType: string;
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  isOwner: boolean;
};

export type LocalPhotoDraft = {
  file: File;
  previewUrl: string;
  width: number | null;
  height: number | null;
};
