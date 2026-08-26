import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LANDING_VISUAL_CACHE_CONTROL,
  serveLandingVisual,
} from "./landing-visual.ts";

const token = "raw-family-invite-token";
const unusedImage = async () => new ArrayBuffer(0);

test("missing and invalid invite cookies are denied", async () => {
  let validationCalls = 0;
  const missing = await serveLandingVisual(
    undefined,
    async () => {
      validationCalls += 1;
      return true;
    },
    unusedImage,
  );
  const invalid = await serveLandingVisual(token, async () => false, unusedImage);

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(validationCalls, 0);
});

test("valid invite returns an existing private PNG with no-store caching", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "landing-visual-"));
  const imagePath = join(directory, "private.png");
  const image = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
  await writeFile(imagePath, image);
  context.after(() => rm(directory, { force: true, recursive: true }));

  const response = await serveLandingVisual(
    token,
    async () => true,
    async () => new Uint8Array(await readFile(imagePath)).buffer,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), LANDING_VISUAL_CACHE_CONTROL);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), image);
});

test("valid invite with a missing private image returns a safe 404", async () => {
  const response = await serveLandingVisual(
    token,
    async () => true,
    async () => readFile("/definitely-missing-private-landing-visual.png"),
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), LANDING_VISUAL_CACHE_CONTROL);
  assert.equal(await response.text(), "Private landing visual is unavailable.");
});

test("errors never return the raw invite token", async () => {
  const validationError = await serveLandingVisual(
    token,
    async () => {
      throw new Error(token);
    },
    unusedImage,
  );
  const imageError = await serveLandingVisual(
    token,
    async () => true,
    async () => {
      throw new Error(token);
    },
  );

  assert.equal(validationError.status, 503);
  assert.doesNotMatch(await validationError.text(), new RegExp(token));
  assert.doesNotMatch(await imageError.text(), new RegExp(token));
});
