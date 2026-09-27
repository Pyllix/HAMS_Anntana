import assert from "node:assert/strict";
import { test } from "node:test";
import { canStartApiRequest, isSessionExpiredResponse } from "./sessionRequestPolicy.js";

test("protected API reads and writes require a confirmed session", () => {
  assert.equal(canStartApiRequest("GET", "/assets", false), false);
  assert.equal(canStartApiRequest("POST", "/borrowings", false), false);
  assert.equal(canStartApiRequest("GET", "/assets", true), true);
});

test("session bootstrap and explicit user lookup can run before authentication", () => {
  assert.equal(canStartApiRequest("GET", "/auth/session", false), true);
  assert.equal(canStartApiRequest("GET", "/auth/csrf", false), true);
  assert.equal(canStartApiRequest("POST", "/auth/sign-in", false), true);
  assert.equal(canStartApiRequest("GET", "/users/user-a", false, true), true);
});

test("sign-out can clear a stale server session", () => {
  assert.equal(canStartApiRequest("POST", "/auth/sign-out", false), true);
});
test("only the server session-expired response triggers expiry handling", () => {
  assert.equal(isSessionExpiredResponse(401, "SESSION_EXPIRED"), true);
  assert.equal(isSessionExpiredResponse(401, "INVALID_CREDENTIALS"), false);
  assert.equal(isSessionExpiredResponse(403, "SESSION_EXPIRED"), false);
});
