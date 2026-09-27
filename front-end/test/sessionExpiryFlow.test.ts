import assert from "node:assert/strict";
import { test } from "node:test";
import { clearClientSessionState } from "../src/services/clientSessionCleanup.ts";
import {
  createSessionExpiryHandler,
  dispatchSessionExpiryIfNeeded,
  subscribeToSessionExpiry,
} from "../src/services/sessionExpiryFlow.ts";

test("server session expiry clears client state and routes through the lifecycle handler", () => {
  const target = new EventTarget();
  const calls: string[] = [];
  let authenticated = true;
  const queryClient = { clear: () => calls.push("clear-query-cache") };
  const actions = {
    clearDrafts: () => calls.push("clear-drafts"),
    logout: () => calls.push("logout"),
    publish: (message: { type: string }) => calls.push(`broadcast-${message.type.toLowerCase().replaceAll("_", "-")}`),
    redirectToLogin: () => calls.push("redirect-to-login"),
  };
  const handler = createSessionExpiryHandler({
    isAuthenticated: () => authenticated,
    hideWarning: () => calls.push("hide-warning"),
    clearSession: (options) => clearClientSessionState(queryClient, options, actions),
  });
  const unsubscribe = subscribeToSessionExpiry(target, handler);

  assert.equal(dispatchSessionExpiryIfNeeded(target, 401, "SESSION_EXPIRED"), true);
  assert.deepEqual(calls, [
    "hide-warning",
    "clear-query-cache",
    "logout",
    "broadcast-session-expired",
    "redirect-to-login",
  ]);

  assert.equal(dispatchSessionExpiryIfNeeded(target, 401, "INVALID_CREDENTIALS"), false);
  assert.equal(dispatchSessionExpiryIfNeeded(target, 403, "SESSION_EXPIRED"), false);
  authenticated = false;
  dispatchSessionExpiryIfNeeded(target, 401, "SESSION_EXPIRED");
  assert.equal(calls.length, 5);

  unsubscribe();
  authenticated = true;
  dispatchSessionExpiryIfNeeded(target, 401, "SESSION_EXPIRED");
  assert.equal(calls.length, 5);
});