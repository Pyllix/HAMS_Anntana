import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import process from "node:process";
import { after, before, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

interface RecordedRequest {
  method: string;
  path: string;
  data: unknown;
  withCredentials: boolean | undefined;
  csrf: unknown;
}

const requests: RecordedRequest[] = [];
const originalAdapter = axios.defaults.adapter;
let signInResponse: unknown;
let sessionResponse: unknown;
let verificationResponse: unknown = { status: true };
let verificationStatus = 200;
let vite: ViteDevServer | undefined;
let authService: any;
let twoFactorLoginPage: any;

function requestPath(config: AxiosRequestConfig): string {
  return new URL(`${config.baseURL ?? ""}${config.url ?? "/"}`, "http://local.test").pathname;
}

function bodyOf(request: RecordedRequest | undefined): unknown {
  assert.ok(request);
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
    } else if (method === "POST" && path === "/api/auth/send-verification-email") {
      if (verificationStatus !== 200) {
        throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, {
          data: { message: "Verification request failed" },
          status: verificationStatus,
          statusText: "Error",
          headers: { "retry-after": "120" },
          config,
        });
      }
      data = verificationResponse;
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
  twoFactorLoginPage = await vite.ssrLoadModule("/src/pages/TwoFactorLogin.tsx");
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
  assert.ok(totpRequest);
  assert.ok(recoveryRequest);
  assert.deepEqual(bodyOf(totpRequest), { code: "123456", trustBrowser: false });
  assert.deepEqual(bodyOf(recoveryRequest), { code: "A1B2C3D4", trustBrowser: true });
  assert.equal(totpRequest.method, "POST");
  assert.equal(recoveryRequest.method, "POST");
  assert.ok(totpRequest.withCredentials && recoveryRequest.withCredentials);
  assert.equal(totpRequest.csrf, "csrf-test-token");
  assert.equal(recoveryRequest.csrf, "csrf-test-token");
});

test("TOTP and recovery code input stay in the mode selected by the user", () => {
  assert.deepEqual(
    twoFactorLoginPage.parseTwoFactorInput("A1B2C3D4", false),
    { useRecoveryCode: false, code: "1234" },
  );
  assert.deepEqual(
    twoFactorLoginPage.parseTwoFactorInput("A1B2C3D4", true),
    { useRecoveryCode: true, code: "A1B2C3D4" },
  );
  assert.deepEqual(
    twoFactorLoginPage.parseTwoFactorInput("123456", false),
    { useRecoveryCode: false, code: "123456" },
  );
  assert.deepEqual(
    twoFactorLoginPage.parseTwoFactorInput("12345678", true),
    { useRecoveryCode: true, code: "12345678" },
  );
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

function verificationError(status: number, code?: string, retryAfter?: string): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    data: { code },
    status,
    statusText: "Error",
    headers: retryAfter ? { "retry-after": retryAfter } : {},
    config: { headers: new axios.AxiosHeaders() },
  });
}

test("only the server's unverified-email sign-in response offers verification resend", () => {
  const unverified = verificationError(403, "EMAIL_NOT_VERIFIED");
  assert.equal(authService.isEmailVerificationRequired(unverified), true);
  assert.match(authService.getLoginErrorMessage(unverified), /อีเมลนี้ยังไม่ได้รับการยืนยัน/);
  assert.equal(authService.isEmailVerificationRequired(verificationError(403, "CSRF_INVALID")), false);
  assert.equal(authService.isEmailVerificationRequired(verificationError(401, "INVALID_EMAIL_OR_PASSWORD")), false);
  assert.equal(authService.isEmailVerificationRequired(new Error("Network error")), false);
  assert.equal(authService.isEmailVerificationRequired(null), false);
  assert.equal(authService.getLoginErrorMessage(verificationError(401)), "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
});

test("verification resend works without a session and sends only the email with CSRF", async () => {
  requests.length = 0;
  verificationStatus = 200;
  verificationResponse = { status: true };

  assert.equal(await authService.sendVerificationEmail("  unverified@example.test  "), 300);

  const postRequests = requests.filter((request) => request.method === "POST");
  assert.equal(postRequests.length, 1);
  const request = postRequests[0];
  assert.equal(request.path, "/api/auth/send-verification-email");
  assert.deepEqual(bodyOf(request), { email: "unverified@example.test" });
  assert.equal(request.withCredentials, true);
  assert.equal(request.csrf, "csrf-test-token");
  assert.equal(requests.some((entry) => entry.path === "/api/auth/session"), false);
});

test("a failed verification response never reports successful submission", async () => {
  verificationStatus = 429;
  await assert.rejects(authService.sendVerificationEmail("unverified@example.test"), (error) => {
    assert.equal(authService.getVerificationEmailRetryDelay(error), 120);
    assert.match(authService.getVerificationEmailErrorMessage(error), /กรุณารอ/);
    return true;
  });

  verificationStatus = 200;
  verificationResponse = { status: false };
  await assert.rejects(authService.sendVerificationEmail("unverified@example.test"));
  verificationResponse = { status: true };
});

test("verification retry honors the server delay and defaults to five minutes when absent", () => {
  assert.equal(authService.getVerificationEmailRetryDelay(verificationError(429, undefined, "120")), 120);
  assert.equal(authService.getVerificationEmailRetryDelay(verificationError(429)), 300);
  assert.equal(authService.getVerificationEmailRetryDelay(verificationError(429, undefined, "invalid")), 300);
  assert.equal(authService.getVerificationEmailRetryDelay(verificationError(500)), 0);
  const retryAt = new Date(Date.now() + 120_000).toUTCString();
  const seconds = authService.getVerificationEmailRetryDelay(verificationError(429, undefined, retryAt));
  assert.ok(seconds >= 119 && seconds <= 120);
});

test("verification errors distinguish connectivity from server failure without exposing server text", () => {
  assert.match(authService.getVerificationEmailErrorMessage(new AxiosError("Network Error")), /เชื่อมต่อไม่ได้/);
  assert.match(authService.getVerificationEmailErrorMessage(verificationError(400)), /ลองเข้าสู่ระบบอีกครั้ง/);
  assert.match(authService.getVerificationEmailErrorMessage(verificationError(500)), /ส่งไม่สำเร็จ/);
  assert.match(authService.getVerificationEmailErrorMessage(new Error("Unexpected response")), /ส่งไม่สำเร็จ/);
});

test("verification success uses the server cooldown and throttling can return a longer hourly wait", async () => {
  verificationResponse = { status: true, retryAfterSeconds: 420 };
  assert.equal(await authService.sendVerificationEmail("unverified@example.test"), 420);
  verificationResponse = { status: true, retryAfterSeconds: 60 };
  assert.equal(await authService.sendVerificationEmail("unverified@example.test"), 300);
  verificationResponse = { status: true };
  const error = verificationError(429);
  error.response!.data = { retryAfterSeconds: 1800 };
  assert.equal(authService.getVerificationEmailRetryDelay(error), 1800);
});
