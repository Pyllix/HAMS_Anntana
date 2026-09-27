import assert from "node:assert/strict";
import axios from "axios";
import process from "node:process";
import { after, before, test } from "node:test";
import { createServer } from "vite";

const requests = [];
const originalAdapter = axios.defaults.adapter;
let signInResponse;
let sessionResponse;
let vite;
let authService;

function requestPath(config) {
  return new URL(`${config.baseURL ?? ""}${config.url ?? "/"}`, "http://local.test").pathname;
}

function bodyOf(request) {
  return typeof request.data === "string" ? JSON.parse(request.data) : request.data;
}

before(async () => {
  axios.defaults.adapter = async (config) => {
    const path = requestPath(config);
    const method = (config.method ?? "get").toUpperCase();
    requests.push({
      method,
      path,
      data: config.data,
      withCredentials: config.withCredentials,
      csrf: config.headers.get("X-CSRF-Token"),
    });

    let data;
    if (method === "GET" && path === "/api/auth/csrf") {
      data = { csrfToken: "csrf-test-token" };
    } else if (method === "POST" && path === "/api/auth/sign-in") {
      data = signInResponse;
    } else if (method === "GET" && path === "/api/auth/session") {
      data = sessionResponse;
    } else if (method === "POST" && path === "/api/auth/2fa/enable") {
      data = { totpURI: "otpauth://totp/HAMS:admin@example.test?secret=JBSWY3DPEHPK3PXP" };
    } else if (method === "POST" && path === "/api/auth/2fa/verify-setup") {
      data = { backupCodes: Array.from({ length: 10 }, (_, index) => `CODE${index}`) };
    } else {
      data = { id: path.split("/").at(-1) };
    }

    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };

  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  });
  authService = await vite.ssrLoadModule("/src/services/authService.ts");
});

after(async () => {
  await vite?.close();
  axios.defaults.adapter = originalAdapter;
});

test("password sign-in sends an unenrolled account into the enrollment flow", async () => {
  requests.length = 0;
  signInResponse = {
    requiresTwoFactor: true,
    twoFactorRedirect: "/2fa/enroll",
  };

  const result = await authService.authLogin("admin@example.test", "correct-password");

  assert.deepEqual(result, { kind: "pre-auth", step: "ENROLLMENT" });
  assert.deepEqual(
    requests.filter((request) => request.method === "POST").map((request) => request.path),
    ["/api/auth/sign-in"],
  );
});

test("a page reload restores enrollment pre-auth without creating an authenticated session", async () => {
  requests.length = 0;
  sessionResponse = {
    session: null,
    user: { id: "admin-1", email: "admin@example.test", enrollmentComplete: false },
    twoFactorRequired: false,
  };

  const result = await authService.getCurrentAuthState();

  assert.deepEqual(result, { kind: "pre-auth", step: "ENROLLMENT" });
  assert.deepEqual(requests.map((request) => request.path), ["/api/auth/session"]);
});

test("a page reload restores the enrolled pre-auth context at the TOTP challenge", async () => {
  requests.length = 0;
  sessionResponse = {
    session: null,
    user: { id: "staff-1", email: "staff@example.test", enrollmentComplete: true },
    twoFactorRequired: true,
  };

  const result = await authService.getCurrentAuthState();

  assert.deepEqual(result, { kind: "pre-auth", step: "TOTP" });
  assert.deepEqual(requests.map((request) => request.path), ["/api/auth/session"]);
});

test("TOTP and recovery verification send the browser-trust choice to their public endpoints", async () => {
  requests.length = 0;

  await authService.verifyTotpAtLogin("123456");
  await authService.verifyRecoveryCodeAtLogin("A1B2C3D4", true);

  const totpRequest = requests.find((request) => request.path === "/api/auth/2fa/verify-totp");
  const recoveryRequest = requests.find((request) => request.path === "/api/auth/2fa/verify-recovery-code");
  assert.deepEqual(bodyOf(totpRequest), { code: "123456", trustBrowser: false });
  assert.deepEqual(bodyOf(recoveryRequest), { code: "A1B2C3D4", trustBrowser: true });
  assert.equal(totpRequest.method, "POST");
  assert.equal(recoveryRequest.method, "POST");
  assert.ok(totpRequest.withCredentials && recoveryRequest.withCredentials);
  assert.equal(totpRequest.csrf, "csrf-test-token");
  assert.equal(recoveryRequest.csrf, "csrf-test-token");
});

test("enrollment sends codes and acknowledgement only to the pre-auth 2FA endpoints", async () => {
  requests.length = 0;

  await authService.enableTwoFactor("current-password");
  await authService.verifyTwoFactorSetup("123456");
  await authService.acknowledgeRecoveryCodes();

  const postRequests = requests.filter((request) => request.method === "POST");
  assert.deepEqual(postRequests.map((request) => request.path), [
    "/api/auth/2fa/enable",
    "/api/auth/2fa/verify-setup",
    "/api/auth/2fa/acknowledge-recovery-codes",
  ]);
  assert.deepEqual(postRequests.map(bodyOf), [
    { password: "current-password" },
    { code: "123456" },
    { acknowledged: true },
  ]);
  assert.ok(postRequests.every((request) => request.withCredentials));
  assert.ok(postRequests.every((request) => request.csrf === "csrf-test-token"));
});
test("a trusted password sign-in restores the full server session", async () => {
  requests.length = 0;
  signInResponse = { requiresTwoFactor: false, user: { id: "staff-2" } };
  sessionResponse = {
    session: {
      id: "session-2",
      userId: "staff-2",
      expiresAt: "2026-10-01T12:00:00.000Z",
      idleExpiresAt: "2026-10-01T12:00:00.000Z",
      absoluteExpiresAt: "2026-10-01T18:00:00.000Z",
    },
    user: { id: "staff-2", enrollmentComplete: true },
  };

  const result = await authService.authLogin("staff@example.test", "correct-password");

  assert.equal(result.kind, "authenticated");
  assert.equal(result.user.id, "staff-2");
  assert.equal(result.session.userId, "staff-2");
  assert.ok(requests.some((request) => request.path === "/api/auth/session"));
});

test("locked 2FA attempts tell the user how long to wait", () => {
  const message = authService.getTwoFactorErrorMessage({
    response: { status: 423, data: { code: "TOTP_LOCKED", retryAfterSeconds: 120 } },
  });

  assert.match(message, /2 นาที/);
});
