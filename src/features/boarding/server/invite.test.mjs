import assert from "node:assert/strict";
import test from "node:test";
import { hashInviteToken } from "./invite.ts";

test("invite tokens use SHA-256 lowercase hexadecimal hashes", () => {
  assert.equal(
    hashInviteToken("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});
