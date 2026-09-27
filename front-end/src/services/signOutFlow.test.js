import assert from "node:assert/strict";
import { test } from "node:test";
import { revokeBeforeClearingSession } from "./signOutFlow.js";

test("clears client state only after the server revokes the session", async () => {
  const events = [];

  await revokeBeforeClearingSession(
    async () => events.push("server-revoked"),
    () => events.push("client-cleared"),
  );

  assert.deepEqual(events, ["server-revoked", "client-cleared"]);
});

test("keeps client state when server sign-out fails", async () => {
  const events = [];

  await assert.rejects(
    revokeBeforeClearingSession(
      async () => {
        events.push("server-failed");
        throw new Error("network failure");
      },
      () => events.push("client-cleared"),
    ),
    /network failure/,
  );

  assert.deepEqual(events, ["server-failed"]);
});
