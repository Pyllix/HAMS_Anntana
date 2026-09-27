import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { after, before, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";
import process from "node:process";

interface RecordedRequest {
  baseURL: string | undefined;
  url: string | undefined;
  path: string;
  method: string;
  params: unknown;
  data: unknown;
  withCredentials: boolean | undefined;
  authorization: unknown;
  csrf: unknown;
}

const requests: RecordedRequest[] = [];
const tokenReads: string[] = [];
const localStorageValues = new Map([
  ["token", "legacy-browser-token"],
  ["userId", "legacy-user-id"],
  ["protected-draft:other-account", "draft-that-must-survive"],
]);
const sessionStorageValues = new Map([
  ["token", "legacy-session-token"],
  ["userId", "legacy-session-user"],
  ["protected-draft:other-account", "session-draft-that-must-survive"],
]);
let expiredRoute: string | null = null;
let sessionExpiryEvents = 0;
let vite: ViteDevServer | undefined;
let apiClient: any;
let authService: any;
let storageAtBoot: unknown;
let assetService: any;
let borrowService: any;
let repairApiService: any;
let repairService: any;
let assessmentService: any;
let sparepartService: any;
let spareApprovalService: any;
let partOrderService: any;
let userService: any;
let budgetTypeService: any;
let departmentService: any;
const originalAdapter = axios.defaults.adapter;

function createStorage(values: Map<string, string>): Storage {
  return {
    get length() {
      return values.size;
    },
    getItem(key: string) {
      if (key === "token") tokenReads.push(key);
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
  };
}

const localStorage = createStorage(localStorageValues);
const sessionStorage = createStorage(sessionStorageValues);

function getRequestPath(config: AxiosRequestConfig): string {
  const base = config.baseURL === "/api" ? "/api" : "";
  const pathname = new URL(base + (config.url ?? "/"), "http://local.test").pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function responseFor(path: string, method: string) {
  if (path === "/api/auth/csrf") return { csrfToken: "csrf-test-token" };
  if (path === "/api/auth/sign-in" && method === "POST") {
    return { user: { id: "cookie-user", role: "DEPARTMENT_STAFF" } };
  }
  if (path === "/api/auth/session") {
    return {
      session: {
        id: "cookie-session",
        userId: "cookie-user",
        expiresAt: "2099-01-01T12:00:00.000Z",
        idleExpiresAt: "2099-01-01T12:00:00.000Z",
        absoluteExpiresAt: "2099-01-01T12:00:00.000Z",
      },
      user: { id: "cookie-user", role: "DEPARTMENT_STAFF" },
    };
  }
  if (path === "/api/auth/sign-out" && method === "POST") {
    return { message: "Signed out successfully" };
  }
  if (path === "/api/users/cookie-user" && method === "GET") {
    return { id: "cookie-user", role: "DEPARTMENT_STAFF" };
  }
  if (path === "/api/asset" && method === "GET") {
    return {
      data: [{ id: "asset-1", name: "Test asset" }],
      meta: { page: 2, limit: 25, total: 1, totalPages: 1 },
    };
  }
  if (path === "/api/repairs" && method === "GET") {
    return { data: [], meta: { hasNextPage: false } };
  }
  if (path === "/api/users" && method === "GET") {
    return { data: [{ id: "user-1", firstname: "Test" }] };
  }
  if (path === "/api/budget-types" && method === "GET") {
    return [{ id: 1, name: "Annual" }];
  }
  if (method === "PATCH" && path.includes("/steps/next")) {
    return { id: "repair-1", status: "updated" };
  }
  if (path === "/api/users" && method === "POST") {
    return { id: "user-2", firstname: "New" };
  }
  if (path === "/api/users/user-1" && method === "PATCH") {
    return { id: "user-1", firstname: "Updated" };
  }
  if (path === "/api/borrowings" && method === "POST") {
    return { id: "borrow-1" };
  }
  return { id: path.split("/").at(-1), status: "saved" };
}

function assertCookieRequest(request: RecordedRequest | undefined, method: string, url: string): asserts request is RecordedRequest {
  assert.ok(request);
  assert.equal(request.method, method);
  assert.equal(request.baseURL, "/api");
  assert.equal(request.url, url);
  assert.equal(request.withCredentials, true);
  assert.equal(request.authorization, undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSessionExpiredCode(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error.response)) return false;
  const data = error.response.data;
  return isRecord(data) && data.code === "SESSION_EXPIRED";
}

before(async () => {
  axios.defaults.adapter = async (config) => {
    const method = (config.method ?? "get").toUpperCase();
    const path = getRequestPath(config);
    const request = {
      baseURL: config.baseURL,
      url: config.url,
      path,
      method,
      params: config.params,
      data: config.data,
      withCredentials: config.withCredentials,
      authorization: config.headers.get("Authorization"),
      csrf: config.headers.get("X-CSRF-Token"),
    };
    requests.push(request);

    if (expiredRoute === `${method} ${path}`) {
      const response = {
        data: { code: "SESSION_EXPIRED", message: "Session expired" },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      };
      throw new AxiosError("Session expired", "ERR_BAD_REQUEST", config, undefined, response);
    }

    return {
      data: responseFor(path, method),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
  globalThis.window.localStorage = localStorage;
  globalThis.window.sessionStorage = sessionStorage;
  globalThis.window.addEventListener("hams:session-expired", () => {
    sessionExpiryEvents += 1;
  });

  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  });
  ({ apiClient } = await vite.ssrLoadModule("/src/services/apiClient.ts"));
  const { useAuthStore } = await vite.ssrLoadModule("/src/stores/authStore.ts");
  authService = await vite.ssrLoadModule("/src/services/authService.ts");
  storageAtBoot = {
    localToken: localStorageValues.has("token"),
    localUserId: localStorageValues.has("userId"),
    sessionToken: sessionStorageValues.has("token"),
    sessionUserId: sessionStorageValues.has("userId"),
    localDraft: localStorageValues.get("protected-draft:other-account"),
    sessionDraft: sessionStorageValues.get("protected-draft:other-account"),
  };
  useAuthStore.getState().login(
    { id: "test-user", role: "ADMIN" },
    { expiresAt: "2099-01-01T00:00:00.000Z" },
  );
  [
    assetService,
    borrowService,
    repairApiService,
    repairService,
    assessmentService,
    sparepartService,
    spareApprovalService,
    partOrderService,
    userService,
    budgetTypeService,
    departmentService,
  ] = await Promise.all([
    vite.ssrLoadModule("/src/services/assetService.ts"),
    vite.ssrLoadModule("/src/services/borrowService.ts"),
    vite.ssrLoadModule("/src/services/repairApiService.ts"),
    vite.ssrLoadModule("/src/services/repairService.ts"),
    vite.ssrLoadModule("/src/services/assessmentService.ts"),
    vite.ssrLoadModule("/src/services/sparepartService.ts"),
    vite.ssrLoadModule("/src/services/spareApprovalService.ts"),
    vite.ssrLoadModule("/src/services/partOrderService.ts"),
    vite.ssrLoadModule("/src/services/userService.ts"),
    vite.ssrLoadModule("/src/services/budgetTypeService.ts"),
    vite.ssrLoadModule("/src/services/departmentService.ts"),
  ]);
});

after(async () => {
  await vite?.close();
  axios.defaults.adapter = originalAdapter;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
  Reflect.deleteProperty(globalThis, "window");
});

test("clears only old auth keys on startup and preserves account drafts", () => {
  assert.deepEqual(storageAtBoot, {
    localToken: false,
    localUserId: false,
    sessionToken: false,
    sessionUserId: false,
    localDraft: "draft-that-must-survive",
    sessionDraft: "session-draft-that-must-survive",
  });
  assert.deepEqual(tokenReads, []);
});

test("sign-in, reload, sign-out, and API calls use cookies without Bearer tokens", async () => {
  requests.length = 0;
  const login = await authService.authLogin("staff@example.org", "password");
  assert.equal(login.kind, "authenticated");

  const restored = await authService.getCurrentAuthState();
  assert.equal(restored.kind, "authenticated");
  await authService.revokeCurrentSession();

  const businessRequest = await apiClient.get("/asset");
  assertCookieRequest(
    requests.find((request) => request.path === "/api/auth/sign-in"),
    "POST",
    "/auth/sign-in",
  );
  assertCookieRequest(
    requests.find((request) => request.path === "/api/auth/session"),
    "GET",
    "/auth/session",
  );
  assertCookieRequest(
    requests.find((request) => request.path === "/api/auth/sign-out"),
    "POST",
    "/auth/sign-out",
  );
  assert.equal(businessRequest.status, 200);
  assert.equal(
    requests.every((request) => request.authorization === undefined),
    true,
  );
  assert.equal(localStorageValues.has("token"), false);
  assert.equal(sessionStorageValues.has("token"), false);
});

test("discards legacy Bearer headers and rejects direct Render API URLs", async () => {
  requests.length = 0;
  await apiClient.get("/asset", {
    headers: { Authorization: "Bearer legacy-browser-token" },
  });
  const request = requests.at(-1);
  assertCookieRequest(request, "GET", "/asset");

  await assert.rejects(
    apiClient.get("https://hams-anntana.onrender.com/api/asset"),
    (error) => isRecord(error) && error.code === "ERR_BAD_REQUEST",
  );
  assert.equal(requests.length, 1);
});

test("asset and borrowing requests use the shared cookie client for reads and writes", async () => {
  requests.length = 0;
  const assets = await assetService.getAssetsPaginated({
    page: 2,
    limit: 25,
    search: " monitor ",
  });
  assert.equal(assets.data[0].id, "asset-1");
  assert.deepEqual(assets.meta, { page: 2, limit: 25, total: 1, totalPages: 1 });
  const assetRead = requests.find((request) => request.method === "GET" && request.path === "/api/asset");
  assertCookieRequest(assetRead, "GET", "/asset");
  assert.deepEqual(assetRead.params, { page: 2, limit: 25, search: "monitor" });

  await assetService.createAsset({ name: "New asset" });
  const assetCreate = requests.find((request) => request.method === "POST" && request.path === "/api/asset");
  assertCookieRequest(assetCreate, "POST", "/asset");
  assert.equal(assetCreate.csrf, "csrf-test-token");

  await assetService.updateAsset("asset-1", { name: "Updated asset" });
  const assetUpdate = requests.find((request) => request.method === "PATCH" && request.path === "/api/asset/asset-1");
  assertCookieRequest(assetUpdate, "PATCH", "/asset/asset-1");
  assert.equal(assetUpdate.csrf, "csrf-test-token");

  await borrowService.postBorrow({ assetId: "asset-1", deliveryMethod: "PICKUP" });
  const borrowCreate = requests.find((request) => request.method === "POST" && request.path === "/api/borrowings");
  assertCookieRequest(borrowCreate, "POST", "/borrowings");
  assert.equal(borrowCreate.csrf, "csrf-test-token");
  await borrowService.returnAsset("borrow-1", {
    returnedByUserId: "test-user",
    returnCondition: "Normal",
    returnRemark: "Returned in good condition",
  });
  const borrowReturn = requests.find((request) => request.method === "PATCH" && request.path === "/api/borrowings/borrow-1/return");
  assertCookieRequest(borrowReturn, "PATCH", "/borrowings/borrow-1/return");
  assert.equal(borrowReturn.csrf, "csrf-test-token");
});

test("repair and spare-part requests use the shared client and attach CSRF to updates", async () => {
  requests.length = 0;
  assert.deepEqual(await repairApiService.fetchRepairJobSummaries(), []);
  const repairRead = requests.find((request) => request.method === "GET" && request.path === "/api/repairs");
  assertCookieRequest(repairRead, "GET", "/repairs");
  await repairService.createRepairTicket({
    assetId: "asset-1",
    symptom: "Does not start",
    urgencyStatus: "NORMAL",
    reportType: "Repair",
  });
  const repairSubmit = requests.find((request) => request.method === "POST" && request.path === "/api/repairs");
  assertCookieRequest(repairSubmit, "POST", "/repairs");
  assert.equal(repairSubmit.csrf, "csrf-test-token");

  await assessmentService.advanceRepairStep("repair-1", { note: "Complete" });
  const repairUpdate = requests.find((request) => request.method === "PATCH" && request.path === "/api/repairs/repair-1/steps/next");
  assertCookieRequest(repairUpdate, "PATCH", "/repairs/repair-1/steps/next");
  assert.equal(repairUpdate.csrf, "csrf-test-token");

  await sparepartService.stockInSparepart({ sparepartId: 1, qty: 2 });
  const stockIn = requests.find((request) => request.method === "POST" && request.path === "/api/spare-parts/stock-in");
  assertCookieRequest(stockIn, "POST", "/spare-parts/stock-in");
  assert.equal(stockIn.csrf, "csrf-test-token");
  await spareApprovalService.approveSpareRequest("repair-2", { note: "Approve requested parts" });
  const spareApproval = requests.find((request) => request.method === "PATCH" && request.path === "/api/repairs/repair-2/steps/next");
  assertCookieRequest(spareApproval, "PATCH", "/repairs/repair-2/steps/next");
  assert.equal(spareApproval.csrf, "csrf-test-token");
});

test("user-management and reference requests use the shared cookie client", async () => {
  requests.length = 0;
  assert.deepEqual(await userService.getAllUser(), [{ id: "user-1", firstname: "Test" }]);
  const usersRead = requests.find((request) => request.method === "GET" && request.path === "/api/users");
  assertCookieRequest(usersRead, "GET", "/users/");
  assert.equal((await userService.getUserById("user-1")).id, "user-1");
  const userDetail = requests.find((request) => request.method === "GET" && request.path === "/api/users/user-1");
  assertCookieRequest(userDetail, "GET", "/users/user-1");

  await userService.createUser({ firstname: "New" });
  const usersCreate = requests.find((request) => request.method === "POST" && request.path === "/api/users");
  assertCookieRequest(usersCreate, "POST", "/users");
  assert.equal(usersCreate.csrf, "csrf-test-token");

  await userService.updateUserById("user-1", { firstname: "Updated" });
  const usersUpdate = requests.find((request) => request.method === "PATCH" && request.path === "/api/users/user-1");
  assertCookieRequest(usersUpdate, "PATCH", "/users/user-1");
  assert.equal(usersUpdate.csrf, "csrf-test-token");
  assert.deepEqual(typeof usersUpdate.data === "string" ? JSON.parse(usersUpdate.data) : usersUpdate.data, { firstname: "Updated" });

  await userService.deleteUserById("user-1");
  const usersDelete = requests.find((request) => request.method === "DELETE" && request.path === "/api/users/user-1");
  assertCookieRequest(usersDelete, "DELETE", "/users/user-1");
  assert.equal(usersDelete.csrf, "csrf-test-token");

  assert.deepEqual(await budgetTypeService.getBudgetTypes(), [{ id: 1, name: "Annual" }]);
  const referenceRead = requests.find((request) => request.method === "GET" && request.path === "/api/budget-types");
  assertCookieRequest(referenceRead, "GET", "/budget-types");
  await departmentService.getDepartmentById("section-1");
  const departmentRead = requests.find((request) => request.method === "GET" && request.path === "/api/sections/section-1");
  assertCookieRequest(departmentRead, "GET", "/sections/section-1");

  await departmentService.updateDepartment("section-1", { name: "Updated section" });
  const departmentUpdate = requests.find((request) => request.method === "PATCH" && request.path === "/api/sections/section-1");
  assertCookieRequest(departmentUpdate, "PATCH", "/sections/section-1");
  assert.equal(departmentUpdate.csrf, "csrf-test-token");

  await departmentService.deleteDepartmentById("section-1");
  const departmentDelete = requests.find((request) => request.method === "DELETE" && request.path === "/api/sections/section-1");
  assertCookieRequest(departmentDelete, "DELETE", "/sections/section-1");
  assert.equal(departmentDelete.csrf, "csrf-test-token");
});

test("expired sessions reach the central flow and reject fallback writes", async () => {
  requests.length = 0;
  const eventsBefore = sessionExpiryEvents;
  expiredRoute = "POST /api/spare-parts";
  await assert.rejects(
    sparepartService.createSparepart({ name: "New part", price: 10 }),
    hasSessionExpiredCode,
  );
  expiredRoute = null;
  const sparepartWrite = requests.find((request) => request.method === "POST" && request.path === "/api/spare-parts");
  assertCookieRequest(sparepartWrite, "POST", "/spare-parts");
  assert.equal(sessionExpiryEvents, eventsBefore + 1);
  assert.equal(requests.filter((request) => request.path === "/api/spare-parts").length, 1);

  expiredRoute = "PATCH /api/part-orders/101/purchasing-info";
  await assert.rejects(
    partOrderService.updatePurchasingInfo(101, { orderNo: "PO-101" }),
    hasSessionExpiredCode,
  );
  expiredRoute = null;
  const partOrderWrite = requests.find((request) => request.method === "PATCH" && request.path === "/api/part-orders/101/purchasing-info");
  assertCookieRequest(partOrderWrite, "PATCH", "/part-orders/101/purchasing-info");
  assert.equal(sessionExpiryEvents, eventsBefore + 2);
  assert.equal(requests.filter((request) => request.path === "/api/part-orders/101/purchasing-info").length, 1);
  assert.deepEqual(tokenReads, []);
});
