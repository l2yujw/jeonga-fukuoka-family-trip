import assert from "node:assert/strict";
import test from "node:test";
import {
  ALBUM_FILE_MAX_BYTES,
  validateAlbumFile,
} from "./demo-album-adapter.ts";

test("album prototype accepts supported images and rejects invalid files", () => {
  assert.equal(validateAlbumFile({ size: 1, type: "image/jpeg" }), null);
  assert.equal(
    validateAlbumFile({ size: ALBUM_FILE_MAX_BYTES, type: "image/heic" }),
    null,
  );
  assert.match(validateAlbumFile({ size: 0, type: "image/png" }), /비어 있는/);
  assert.match(
    validateAlbumFile({ size: ALBUM_FILE_MAX_BYTES + 1, type: "image/png" }),
    /15MB/,
  );
  assert.match(validateAlbumFile({ size: 1, type: "image/gif" }), /JPEG/);
});
