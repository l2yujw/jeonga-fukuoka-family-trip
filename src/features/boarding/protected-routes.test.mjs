import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("protected route bodies stay behind client-only membership resolution", async () => {
  for (const route of ["home", "schedule", "album", "cards"]) {
    const source = await readFile(new URL(`../../app/${route}/page.tsx`, import.meta.url), "utf8");
    assert.match(source, /^"use client";/);
    assert.match(source, /<TripAccessGuard>[\s\S]*\{\(\) =>/);
  }

  const guard = await readFile(new URL("./trip-access-guard.tsx", import.meta.url), "utf8");
  assert.match(guard, /children: \(session: CurrentTripSession\) => ReactNode/);
  assert.match(guard, /\{children\(session\)\}/);
});
