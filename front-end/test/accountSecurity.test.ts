import assert from "node:assert/strict";
import axios, { type AxiosRequestConfig } from "axios";
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
let vite: ViteDevServer | undefined;
let securityService: any;
let authStore: any;

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

    let data = {};
    if (method === "GET" && path === "/api/auth/csrf") {
      data = { csrfToken: "csrf-account-security" };
    } else if (method === "GET" && path === "/api/auth/2fa/status") {
      data = { enrolled: true, required: true };
    } else if (method === "POST" && path === "/api/auth/2fa/replace-authenticator") {
      data = { totpURI: "otpauth://totp/HAMS:user@example.test?secret=NEWSECRET" };
    } else if (method === "POST" && path === "/api/auth/2fa/regenerate-recovery-codes") {
      data = { recoveryCodes: Array.from({ length: 10 }, (_, index) => `NEWCODE${index}`) };
    } else if (method === "POST" && path === "/api/auth/step-up/totp") {
      data = { expiresAt: new Date(Date.now() + 300_000).toISOString() };
    } else if (method === "POST" && path === "/api/users/user-2/reset-2fa") {
      data = { message: "2FA reset" };
    } else if (method === "PATCH" && path === "/api/users/user-2/reset-password") {
      data = { message: "Password reset" };
    }

    return { data, status: 200, statusText: "OK", headers: {}, config };
  };

  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  });
  securityService = await vite.ssrLoadModule("/src/services/accountSecurityService.ts");
  ({ useAuthStore: authStore } = await vite.ssrLoadModule("/src/stores/authStore.ts"));
  authStore.getState().login(
    { id: "admin-1", role: "ADMIN" },
    { id: "session-1", expiresAt: "2099-01-01T00:00:00.000Z" },
  );
});

after(async () => {
  await vite?.close();
  axios.defaults.adapter = originalAdapter;
});

test("self-service requests use authenticated cookie endpoints and exact verification fields", async () => {
  requests.length = 0;

  assert.deepEqual(await securityService.getTwoFactorStatus(), { enrolled: true, required: true });
  await securityService.startAuthenticatorReplacement("current-password", "123456");
  await securityService.verifyAuthenticatorReplacement("654321");
  assert.equal((await securityService.regenerateRecoveryCodes("123456")).length, 10);
  await securityService.changeOwnPassword("old-password", "new-password-123");

  const securityRequests = requests.filter((request) => request.path !== "/api/auth/csrf");
  assert.deepEqual(
    securityRequests.map(({ method, path }) => `${method} ${path}`),
    [
      "GET /api/auth/2fa/status",
      "POST /api/auth/2fa/replace-authenticator",
      "POST /api/auth/2fa/verify-authenticator-replacement",
      "POST /api/auth/2fa/regenerate-recovery-codes",
      "POST /api/auth/change-password",
    ],
  );
  assert.deepEqual(bodyOf(securityRequests[1]), { currentPassword: "current-password", currentTotpCode: "123456" });
  assert.deepEqual(bodyOf(securityRequests[2]), { code: "654321" });
  assert.deepEqual(bodyOf(securityRequests[3]), { code: "123456" });
  assert.deepEqual(bodyOf(securityRequests[4]), { currentPassword: "old-password", newPassword: "new-password-123" });
  assert.ok(securityRequests.slice(1).every((request) => request.withCredentials && request.csrf === "csrf-account-security"));
});

test("ADMIN Step-up is reused only for the same signed-in session and target actions send no secrets in extra fields", async () => {
  requests.length = 0;
  securityService.clearAdminStepUp();

  assert.equal(securityService.isAdminStepUpActive(), false);
  await securityService.createAdminStepUp("123456");
  assert.equal(securityService.isAdminStepUpActive(), true);
  await securityService.adminResetPassword("user-2", "NewPassword123");
  await securityService.adminResetTwoFactor("user-2", "ตรวจสอบตัวตนตามเอกสารงาน");

  const stepUp = requests.find((request) => request.path === "/api/auth/step-up/totp");
  const passwordReset = requests.find((request) => request.path.endsWith("/reset-password"));
  const twoFactorReset = requests.find((request) => request.path.endsWith("/reset-2fa"));
  assert.deepEqual(bodyOf(stepUp), { code: "123456" });
  assert.deepEqual(bodyOf(passwordReset), { newPassword: "NewPassword123" });
  assert.deepEqual(bodyOf(twoFactorReset), {
    reason: "ตรวจสอบตัวตนตามเอกสารงาน",
    identityVerifiedOutsideHams: true,
  });

  authStore.getState().login(
    { id: "admin-1", role: "ADMIN" },
    { id: "session-2", expiresAt: "2099-01-01T00:00:00.000Z" },
  );
  assert.equal(securityService.isAdminStepUpActive(), false);
});

test("ADMIN Step-up cache expires in memory without writing credentials to browser storage", () => {
  securityService.rememberAdminStepUp(new Date(Date.now() + 300_000).toISOString());
  assert.equal(securityService.isAdminStepUpActive(), true);
  assert.equal(securityService.isAdminStepUpActive(Date.now() + 300_001), false);
  assert.equal(globalThis.localStorage, undefined);
  assert.equal(globalThis.sessionStorage, undefined);
});
