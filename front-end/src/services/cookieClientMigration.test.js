import assert from "node:assert/strict";
import axios, { AxiosError } from "axios";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import process from "node:process";

const requests = [];
const tokenReads = [];
const storedValues = new Map();
let expiredRoute = null;
let sessionExpiryEvents = 0;
let vite;
let assetService;
let borrowService;
let repairApiService;
let repairService;
let assessmentService;
let sparepartService;
let spareApprovalService;
let partOrderService;
let userService;
let budgetTypeService;
let departmentService;
const originalAdapter = axios.defaults.adapter;

const storage = {
  get length() {
    return storedValues.size;
  },
  getItem(key) {
    if (key === "token") {
      tokenReads.push(key);
      return "legacy-browser-token";
    }
    return storedValues.get(key) ?? null;
  },
  setItem(key, value) {
    storedValues.set(key, String(value));
  },
  removeItem(key) {
    storedValues.delete(key);
  },
  key(index) {
    return [...storedValues.keys()][index] ?? null;
  },
};

function getRequestPath(config) {
  const base = config.baseURL === "/api" ? "/api" : "";
  const pathname = new URL(base + (config.url ?? "/"), "http://local.test").pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function responseFor(path, method) {
  if (path === "/api/auth/csrf") return { csrfToken: "csrf-test-token" };
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

function assertCookieRequest(request, method, url) {
  assert.equal(request.method, method);
  assert.equal(request.baseURL, "/api");
  assert.equal(request.url, url);
  assert.equal(request.withCredentials, true);
  assert.equal(request.authorization, undefined);
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
  globalThis.localStorage = storage;
  globalThis.window = new EventTarget();
  globalThis.window.localStorage = storage;
  globalThis.window.sessionStorage = storage;
  globalThis.window.addEventListener("hams:session-expired", () => {
    sessionExpiryEvents += 1;
  });

  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  });
  await vite.ssrLoadModule("/src/services/apiClient.ts");
  const { useAuthStore } = await vite.ssrLoadModule("/src/stores/authStore.ts");
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
  delete globalThis.localStorage;
  delete globalThis.window;
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
    (error) => error?.response?.data?.code === "SESSION_EXPIRED",
  );
  expiredRoute = null;
  const sparepartWrite = requests.find((request) => request.method === "POST" && request.path === "/api/spare-parts");
  assertCookieRequest(sparepartWrite, "POST", "/spare-parts");
  assert.equal(sessionExpiryEvents, eventsBefore + 1);
  assert.equal(requests.filter((request) => request.path === "/api/spare-parts").length, 1);

  expiredRoute = "PATCH /api/part-orders/101/purchasing-info";
  await assert.rejects(
    partOrderService.updatePurchasingInfo(101, { orderNo: "PO-101" }),
    (error) => error?.response?.data?.code === "SESSION_EXPIRED",
  );
  expiredRoute = null;
  const partOrderWrite = requests.find((request) => request.method === "PATCH" && request.path === "/api/part-orders/101/purchasing-info");
  assertCookieRequest(partOrderWrite, "PATCH", "/part-orders/101/purchasing-info");
  assert.equal(sessionExpiryEvents, eventsBefore + 2);
  assert.equal(requests.filter((request) => request.path === "/api/part-orders/101/purchasing-info").length, 1);
  assert.deepEqual(tokenReads, []);
});