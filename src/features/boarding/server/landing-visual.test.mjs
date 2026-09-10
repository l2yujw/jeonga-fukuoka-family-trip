import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { mock } from "node:test";
import {
  LANDING_VISUAL_CACHE_CONTROL,
  serveLandingVisual,
} from "./landing-visual.ts";

const token = "raw-family-invite-token";
const unusedImage = async () => new ArrayBuffer(0);

// Exercise the real routes and loader with synthetic bytes, never family assets.
const imageBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
let inviteResult = true;
let inviteError = false;
let downloadResult;
let downloadThrows = false;
let events = [];
await mock.module(new URL("./request-context.ts", import.meta.url).href, {
  exports: {
    resolveInviteTrip: async () => {
      events.push("invite");
      if (inviteError) throw new Error("sensitive authorization error");
      return inviteResult ? { id: "test-trip" } : null;
    },
  },
});
await mock.module(new URL("../../../lib/supabase/admin.ts", import.meta.url).href, {
  exports: {
    createSupabaseAdminClient: () => ({
      storage: {
        from: (bucket) => {
          events.push(bucket);
          return {
            download: async (path) => {
              events.push(path);
              if (downloadThrows) throw new Error("sensitive storage error");
              return downloadResult ?? { data: new Blob([imageBytes]), error: null };
            },
          };
        },
      },
    }),
  },
});
const { loadPrivateVisual } = await import("./private-visual.ts");
const { GET: landing } = await import("../../../app/api/landing-visual/route.ts");
const { GET: confirm } = await import("../../../app/api/boarding-confirm-visual/route.ts");
const { GET: status } = await import("../../../app/api/boarding-status-visual/route.ts");
const visualRoutes = [
  [landing, "", "boarding/landing-final.png"],
  [confirm, "", "boarding/confirm-final.png"],
  [status, "", "boarding/status-final.png"],
  [status, "?asset=neutral-seat-patch", "boarding/neutral-seat-patch.png"],
];
const request = (query = "", invite = token) => ({
  cookies: { get: (name) => name === "jeonga_trip_invite" && invite ? { value: invite } : undefined },
  nextUrl: new URL(`https://example.test/api/visual${query}`),
});

test.beforeEach(() => {
  inviteResult = true;
  inviteError = false;
  downloadResult = undefined;
  downloadThrows = false;
  events = [];
});

test("all visual routes authorize before downloading the four exact private objects", async () => {
  for (const [get, query, path] of visualRoutes) {
    events = [];
    const response = await get(request(query));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("cache-control"), LANDING_VISUAL_CACHE_CONTROL);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes);
    assert.deepEqual(events, ["invite", "app-visuals", path]);
  }
});

test("all visual routes deny missing or invalid invites without touching storage", async () => {
  for (const [get, query] of visualRoutes) {
    events = [];
    const missing = await get(request(query, ""));
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get("cache-control"), LANDING_VISUAL_CACHE_CONTROL);
    assert.deepEqual(events, []);
    inviteResult = false;
    const invalid = await get(request(query));
    assert.equal(invalid.status, 401);
    assert.deepEqual(events, ["invite"]);
    inviteResult = true;
  }
});

test("invite lookup errors fail closed before any private download", async () => {
  inviteError = true;
  for (const [get, query] of visualRoutes) {
    events = [];
    const response = await get(request(query));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /sensitive/);
    assert.deepEqual(events, ["invite"]);
  }
});

test("neutral-seat query never passes arbitrary paths or buckets to storage", async () => {
  for (const asset of ["../secret.png", "boarding/landing-final.png", "__proto__", "constructor", "https://example.test/private.png", "neutral-seat-patch/../secret"]) {
    events = [];
    const response = await status(request(`?asset=${encodeURIComponent(asset)}&bucket=trip-photos&path=secret.png`));
    assert.equal(response.status, 200);
    assert.deepEqual(events, ["invite", "app-visuals", "boarding/status-final.png"]);
    await assert.rejects(loadPrivateVisual(asset), /Unknown private visual/);
    assert.equal(events.length, 3);
  }
});

test("storage errors, missing objects and empty objects return only the existing safe failure", async () => {
  for (const result of [
    { data: new Blob([imageBytes]), error: { message: "sensitive storage error" } },
    { data: null, error: null },
    { data: new Blob([]), error: null },
    "throws",
  ]) {
    downloadThrows = result === "throws";
    downloadResult = downloadThrows ? undefined : result;
    await assert.rejects(loadPrivateVisual("landing"));
    for (const [get, query] of visualRoutes) {
      const response = await get(request(query));
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), LANDING_VISUAL_CACHE_CONTROL);
      assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
      assert.equal(await response.text(), "Private landing visual is unavailable.");
    }
  }
});

test("visual routes use server-only private downloads without local files or public storage changes", async () => {
  const helper = await readFile(new URL("./private-visual.ts", import.meta.url), "utf8");
  assert.match(helper, /^import "server-only";/);
  assert.match(helper, /createSupabaseAdminClient/);
  for (const route of ["landing-visual", "boarding-confirm-visual", "boarding-status-visual"]) {
    const source = await readFile(new URL(`../../../app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /resolveInviteTrip\(request\)/);
    assert.doesNotMatch(source + helper, /local-references|node:fs|readFile|getPublicUrl|createSignedUrl|createBucket|updateBucket|create policy|public:\s*true|process\.env/);
  }
});

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

test("optional private ETag is evaluated only after authorization", async () => {
  const cacheOptions = {
    cacheControl: "private, max-age=0, must-revalidate",
    etag: '"home-visual-v16"',
    ifNoneMatch: '"home-visual-v16"',
  };
  let reads = 0;
  const readImage = async () => {
    reads += 1;
    return Uint8Array.from([1, 2, 3]).buffer;
  };

  const missing = await serveLandingVisual(
    undefined,
    async () => true,
    readImage,
    cacheOptions,
  );
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get("etag"), null);

  const unauthorized = await serveLandingVisual(
    token,
    async () => false,
    readImage,
    cacheOptions,
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("etag"), null);
  assert.equal(reads, 0);

  const mismatch = await serveLandingVisual(
    token,
    async () => true,
    readImage,
    { ...cacheOptions, ifNoneMatch: '"home-visual-v15"' },
  );
  assert.equal(mismatch.status, 200);
  assert.equal(mismatch.headers.get("etag"), cacheOptions.etag);
  assert.equal(mismatch.headers.get("cache-control"), cacheOptions.cacheControl);
  assert.equal(reads, 1);

  const match = await serveLandingVisual(
    token,
    async () => true,
    readImage,
    cacheOptions,
  );
  assert.equal(match.status, 304);
  assert.equal(match.headers.get("etag"), cacheOptions.etag);
  assert.equal(match.headers.get("cache-control"), cacheOptions.cacheControl);
  assert.equal(await match.text(), "");
  assert.equal(reads, 1);
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
