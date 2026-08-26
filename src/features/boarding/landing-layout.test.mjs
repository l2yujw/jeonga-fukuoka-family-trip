import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getLandingControlHitHeight,
  LANDING_MIN_HIT_HEIGHT,
} from "./landing-layout.ts";

const supportedWidths = [360, 375, 390, 402, 430];

test("landing controls keep 44px hit targets at supported widths", () => {
  for (const width of supportedWidths) {
    assert.equal(getLandingControlHitHeight(width, "input"), LANDING_MIN_HIT_HEIGHT);
    assert.equal(getLandingControlHitHeight(width, "submit"), LANDING_MIN_HIT_HEIGHT);
  }
});

test("landing errors render before the plate in document flow", async () => {
  const component = await readFile(
    new URL("./landing-entry.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.ok(
    component.indexOf('className="landing-form-error"') <
      component.indexOf('className="landing-plate"'),
  );
  assert.match(css, /\.landing-name-overlay\s*\{[^}]*min-height:\s*var\(--app-tap-target-min\)/s);
  assert.match(css, /\.landing-submit-overlay\s*\{[^}]*min-height:\s*var\(--app-tap-target-min\)/s);
  assert.doesNotMatch(
    css.match(/\.landing-form-error\s*\{[^}]*\}/s)?.[0] ?? "",
    /position:\s*absolute/,
  );
});

test("invalid or missing invites render a safe fallback before private landing UI", async () => {
  const component = await readFile(
    new URL("./landing-entry.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const fallbackStart = component.indexOf("if (invalidInvite)");
  const fallbackEnd = component.indexOf("async function handleSubmit");
  const fallback = component.slice(fallbackStart, fallbackEnd);

  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
  assert.match(
    fallback,
    /초대 링크가 올바르지 않아요\. 전달받은 링크를 다시 확인해주세요\./,
  );
  assert.doesNotMatch(fallback, /<Image|<form|\/api\/landing-visual/);
  assert.match(component, /src="\/api\/landing-visual"/);
  assert.match(page, /cookies\(\)/);
  assert.match(
    page,
    /invalidInvite=\{invite === "invalid" \|\| !hasInviteCookie\}/,
  );
});
