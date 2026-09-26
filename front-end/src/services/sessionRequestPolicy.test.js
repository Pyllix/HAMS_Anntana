import assert from "node:assert/strict";
import { test } from "node:test";
import { canStartApiRequest } from "./sessionRequestPolicy.js";

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