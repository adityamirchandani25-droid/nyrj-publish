import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { checkAmbassadorAccessCode } from "../ambassador-access.server.ts";

const oldCode = process.env.AMBASSADOR_ACCESS_CODE;
const oldPassword = process.env.AMBASSADOR_PASSWORD;
afterEach(() => {
  if (oldCode === undefined) delete process.env.AMBASSADOR_ACCESS_CODE;
  else process.env.AMBASSADOR_ACCESS_CODE = oldCode;
  if (oldPassword === undefined) delete process.env.AMBASSADOR_PASSWORD;
  else process.env.AMBASSADOR_PASSWORD = oldPassword;
});

test("current ambassador code grants registration and a rotated code expires", () => {
  process.env.AMBASSADOR_ACCESS_CODE = "active-code-123";
  assert.equal(checkAmbassadorAccessCode(" active-code-123 "), true);
  assert.equal(checkAmbassadorAccessCode("wrong-code"), false);
  process.env.AMBASSADOR_ACCESS_CODE = "new-code-456";
  assert.equal(checkAmbassadorAccessCode("active-code-123"), false);
  assert.equal(checkAmbassadorAccessCode("new-code-456"), true);
});

test("missing code and password fail with a configuration error", () => {
  delete process.env.AMBASSADOR_ACCESS_CODE;
  delete process.env.AMBASSADOR_PASSWORD;
  assert.throws(() => checkAmbassadorAccessCode("any-code"), /not configured/);
});
