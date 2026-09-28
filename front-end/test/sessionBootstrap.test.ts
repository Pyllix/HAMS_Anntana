import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreServerSession } from "../src/services/sessionBootstrap.ts";

test("restores the browser session and profile from the server", async () => {
  const calls: string[] = [];
  const session = {
    id: "session-1",
    userId: "user-1",
    expiresAt: "2026-10-01T12:00:00.000Z",
    idleExpiresAt: "2026-10-01T12:00:00.000Z",
    absoluteExpiresAt: "2026-10-01T18:00:00.000Z",
  };
  const user = { id: "user-1", role: "ADMIN" };

  const restored = await restoreServerSession(
    async () => {
      calls.push("server-session");
      return { data: { session, user: { id: "user-1" } } };
    },
    async (userId) => {
      calls.push("profile:" + userId);
      return user;
    },
  );

  assert.deepEqual(calls, ["server-session", "profile:user-1"]);
  assert.deepEqual(restored, { session, user });
});

test("does not restore from a missing server session", async () => {
  let profileRequested = false;

  const restored = await restoreServerSession(
    async () => ({ data: { session: null } }),
    async () => {
      profileRequested = true;
      return { id: "user-1" };
    },
  );

  assert.equal(restored, null);
  assert.equal(profileRequested, false);
});

test("does not restore when session and user identity disagree", async () => {
  const restored = await restoreServerSession(
    async () => ({
      data: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-2" },
      },
    }),
    async () => ({ id: "user-1" }),
  );

  assert.equal(restored, null);
});
