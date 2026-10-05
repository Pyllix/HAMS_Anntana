import assert from "node:assert/strict";
import test from "node:test";
import { useAuthStore } from "../src/stores/authStore";
import { shouldInvalidateAccountBoundState } from "../src/services/authBroadcast";
import {
  clearEmployeePhotoGrantCache,
  getEmployeePhotoBlob,
} from "../src/services/imageUploadService";
import type { User } from "../src/types/TypeUser";

test("sign-out and session expiry invalidate account-bound image state", () => {
  assert.equal(shouldInvalidateAccountBoundState({ type: "SIGNED_OUT" }, "user-1"), true);
  assert.equal(shouldInvalidateAccountBoundState({ type: "SESSION_EXPIRED" }, "user-1"), true);
});

test("account changes invalidate only state bound to a different account", () => {
  assert.equal(shouldInvalidateAccountBoundState({ type: "ACCOUNT_CHANGED", userId: "user-2" }, "user-1"), true);
  assert.equal(shouldInvalidateAccountBoundState({ type: "ACCOUNT_CHANGED", userId: "user-1" }, "user-1"), false);
  assert.equal(shouldInvalidateAccountBoundState({ type: "ACCOUNT_CHANGED", userId: "user-1" }, null), true);
});

test("updating the signed-in user's photo revision refreshes session display state only", () => {
  const user: User = {
    id: "admin-1",
    employeeId: "EMP-1",
    userName: "admin",
    firstname: "Admin",
    lastname: "User",
    email: "admin@example.test",
    emailVerified: true,
    imageUrl: null,
    hasEmployeePhoto: true,
    photoRevision: "revision-1",
    section_id: "section-1",
    role: "ADMIN",
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: "2026-10-04T00:00:00.000Z",
    updatedAt: "2026-10-04T00:00:00.000Z",
  };
  const session = {
    id: "session-1",
    userId: user.id,
    expiresAt: "2026-10-04T01:00:00.000Z",
    idleExpiresAt: "2026-10-04T01:00:00.000Z",
    absoluteExpiresAt: "2026-10-04T12:00:00.000Z",
  };
  useAuthStore.getState().login(user, session);

  useAuthStore.getState().updateUserPhoto({
    imageUrl: null,
    hasEmployeePhoto: true,
    photoRevision: "revision-2",
  });

  const state = useAuthStore.getState();
  assert.equal(state.user?.photoRevision, "revision-2");
  assert.equal(state.user?.hasEmployeePhoto, true);
  assert.equal(state.user?.id, user.id);
  assert.equal(state.session, session);
  assert.equal(state.isAuthenticated, true);
  useAuthStore.getState().logout();
});

test("local logout clears Employee Photo grants even when no photo component is mounted", async () => {
  clearEmployeePhotoGrantCache();
  let grantRequests = 0;
  const api = {
    async get() {
      grantRequests += 1;
      return { data: {
        hasEmployeePhoto: true,
        photoRevision: "revision-1",
        url: `https://api.cloudinary.com/v1_1/test-cloud/image/download/logout-${grantRequests}`,
        expiresAt: "2099-01-01T00:00:00.000Z",
      } };
    },
  };
  const fetchImpl = async () => new Response(new Blob(["synthetic photo"], {
    type: "image/jpeg",
  }), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  const read = () => getEmployeePhotoBlob("employee-signout-test", {
    accountId: "admin-signout-test",
    photoRevision: "revision-1",
    api: api as never,
    fetchImpl: fetchImpl as typeof fetch,
  });

  await read();
  useAuthStore.getState().logout();
  await read();

  assert.equal(grantRequests, 2, "the next session must request a fresh photo grant");
  clearEmployeePhotoGrantCache();
});
