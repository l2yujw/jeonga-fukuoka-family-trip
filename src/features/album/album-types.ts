export type AlbumPhoto = {
  id: string;
  storagePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  signedUrl: string | null;
  uploaderName: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  isOwner: boolean;
};

export type LocalPhotoDraft = {
  file: File;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
};

export type AlbumUploadDraft = {
  clientId: string;
  draft: LocalPhotoDraft;
  caption: string;
  status: "ready" | "uploading" | "failed";
  error?: string;
};

export type PersistedPhotoRow = {
  id: string;
  trip_id: string;
  uploader_member_id: string;
  uploader_auth_user_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  caption: string | null;
  taken_at: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};
