import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  resolveScheduleAssetPath,
  readScheduleAssetFile,
  SCHEDULE_ASSET_CACHE_CONTROL,
  serveScheduleAsset,
} from "./schedule-asset.ts";

const token = "private-family-invite";
const unusedAsset = async () => new ArrayBuffer(0);

test("Schedule asset boundary rejects missing and invalid invites before reading", async () => {
  let validationCalls = 0;
  let readCalls = 0;
  const missing = await serveScheduleAsset(
    undefined,
    ["detail", "item.webp"],
    async () => {
      validationCalls += 1;
      return true;
    },
    async () => {
      readCalls += 1;
      return new ArrayBuffer(0);
    },
  );
  const invalid = await serveScheduleAsset(
    token,
    ["detail", "item.webp"],
    async () => false,
    unusedAsset,
  );

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(validationCalls, 0);
  assert.equal(readCalls, 0);
});

test("real file reads reject symlinks that escape the private root", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "schedule-root-"));
  const outside = await mkdtemp(join(tmpdir(), "schedule-outside-"));
  context.after(() => Promise.all([
    rm(root, { force: true, recursive: true }),
    rm(outside, { force: true, recursive: true }),
  ]));
  await mkdir(join(root, "detail"));
  await writeFile(join(outside, "secret.webp"), "secret");
  const linked = join(root, "detail", "linked.webp");
  await symlink(join(outside, "secret.webp"), linked);

  await assert.rejects(readScheduleAssetFile(linked, root));
});

test("Schedule asset paths stay inside the private root and allow only PNG/WebP", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "schedule-assets-"));
  context.after(() => rm(root, { force: true, recursive: true }));

  assert.equal(
    resolveScheduleAssetPath(["detail", "item.webp"], root),
    resolve(root, "detail", "item.webp"),
  );
  for (const path of [
    ["..", "secret.png"],
    ["%2e%2e", "secret.png"],
    ["detail%2f..%2fsecret.png"],
    ["detail\\..\\secret.png"],
    ["detail", "item.jpg"],
    [],
  ]) {
    assert.equal(resolveScheduleAssetPath(path, root), null, path.join("/"));
  }
});

test("valid invites receive private image responses without path details", async () => {
  const response = await serveScheduleAsset(
    token,
    ["plates", "body", "day-1.png"],
    async () => true,
    async () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer,
    "/private/schedule",
  );
  const missing = await serveScheduleAsset(
    token,
    ["detail", "missing.webp"],
    async () => true,
    async () => {
      throw new Error("/private/schedule/detail/missing.webp");
    },
    "/private/schedule",
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), SCHEDULE_ASSET_CACHE_CONTROL);
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /private|schedule|webp/i);
});

test("runtime Schedule sources use only the private API and traced private files", async () => {
  const sourceRoot = new URL("../../../", import.meta.url);
  const sourceNames = await readdir(sourceRoot, { recursive: true });
  const runtimeSources = await Promise.all(
    sourceNames
      .filter((name) => /\.(?:css|ts|tsx)$/.test(name))
      .map((name) => readFile(new URL(name, sourceRoot), "utf8")),
  );
  assert.doesNotMatch(runtimeSources.join("\n"), /\/assets\/schedule\//);

  await assert.rejects(
    access(new URL("../../../../public/assets/schedule", import.meta.url)),
  );
  await access(new URL("../../../../private-assets/schedule", import.meta.url));

  const [route, config] = await Promise.all([
    readFile(new URL("../../../app/api/schedule-asset/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../../next.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /resolveInviteTrip\(request\)/);
  assert.match(route, /serveScheduleAsset\(/);
  assert.match(config, /outputFileTracingIncludes/);
  assert.match(config, /private-assets\/schedule\/\*\*\/\*/);
});
