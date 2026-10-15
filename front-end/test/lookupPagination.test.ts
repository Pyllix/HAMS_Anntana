import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { apiClient } from "../src/services/apiClient";
import { getAllUsers } from "../src/services/assetService";
import { getSparepartGroups } from "../src/services/sparepartService";
import { fetchRepairReceivers } from "../src/services/repairApiService";
import type { RepairJob } from "../src/types/TypeRepairWorkflow";
import { findBorrowExtensionById } from "../src/services/borrowService";

const repairJob: RepairJob = {
  jobId: "job-1", jobNo: "REP-001", assetId: "asset-1", sectionId: "section-1",
  reporterId: "user-1", reportType: "REPAIR", jobStatusId: 1, symptom: "เปิดไม่ติด",
  urgencyStatus: "NORMAL", isRepeatRepair: false,
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  createdBy: "user-1", updatedBy: "user-1",
  reporter: { userId: "user-1", firstName: "ผู้แจ้ง", lastName: "ทดสอบ" },
};

interface RequestConfig {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

function mockPages<T>(t: TestContext, path: string, rows: T[]) {
  const calls: Array<{ page: number; limit: number; params: Record<string, unknown> }> = [];
  t.mock.method(apiClient, "get", async (url: string, config?: RequestConfig) => {
    assert.equal(url, path);
    const params = config?.params ?? {};
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 20);
    calls.push({ page, limit, params });
    return { data: {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit),
        hasNextPage: page < Math.ceil(rows.length / limit) },
    } };
  });
  return calls;
}

test("asset owner choices include users beyond the first 100, in API order", async (t) => {
  const users = Array.from({ length: 205 }, (_, index) => ({ id: `user-${index + 1}` }));
  const calls = mockPages(t, "/users", users);
  const result = await getAllUsers();
  assert.equal(result.length, 205);
  assert.deepEqual(result, users);
  assert.ok(calls.length > 1);
  assert.ok(calls.every(({ limit }) => limit <= 100));
});

test("spare group choices include categories beyond the first 100", async (t) => {
  const groups = Array.from({ length: 105 }, (_, index) => ({ id: index + 1, name: `Group ${index + 1}` }));
  mockPages(t, "/spare-part-groups", groups);
  const result = await getSparepartGroups();
  assert.equal(result.length, 105);
  assert.deepEqual(result, groups);
});

test("repair receivers include all section members and the reporter exactly once", async (t) => {
  const users = Array.from({ length: 205 }, (_, index) => ({
    id: `user-${index + 1}`, firstname: `ชื่อ${index + 1}`, lastname: "ทดสอบ", section_id: "section-1",
  }));
  const calls = mockPages(t, "/users", users);
  const result = await fetchRepairReceivers(repairJob);
  assert.equal(result.length, 205);
  assert.equal(new Set(result.map((user) => user.userId)).size, 205);
  assert.ok(result.some((user) => user.userId === "user-205"));
  assert.ok(calls.every(({ params }) => params.section_id === "section-1"));
});

test("an extension notification can open a request older than the latest 100", async (t) => {
  const requests = Array.from({ length: 205 }, (_, index) => ({ id: `extension-${index + 1}` }));
  const calls = mockPages(t, "/borrowings/extensions/requests", requests);
  assert.equal((await findBorrowExtensionById("extension-205"))?.id, "extension-205");
  assert.ok(calls.length > 1);
});

test("extension lookup stops as soon as it finds the requested record", async (t) => {
  const requests = Array.from({ length: 205 }, (_, index) => ({ id: `extension-${index + 1}` }));
  const calls = mockPages(t, "/borrowings/extensions/requests", requests);
  assert.equal((await findBorrowExtensionById("extension-1"))?.id, "extension-1");
  assert.equal(calls.length, 1);
});

test("a missing extension is reported only after checking the final page", async (t) => {
  const calls = mockPages(t, "/borrowings/extensions/requests",
    Array.from({ length: 205 }, (_, index) => ({ id: `extension-${index + 1}` })));
  assert.equal(await findBorrowExtensionById("missing"), null);
  assert.deepEqual(calls.map(({ page }) => page), [1, 2, 3]);
});

test("empty lookup collections finish without fetching another page", async (t) => {
  for (const [path, load] of [
    ["/users", getAllUsers],
    ["/spare-part-groups", getSparepartGroups],
    ["/borrowings/extensions/requests", () => findBorrowExtensionById("missing")],
  ] as const) {
    const calls = mockPages(t, path, []);
    assert.deepEqual(await load(), path.includes("extensions") ? null : []);
    assert.equal(calls.length, 1);
  }
});

test("receiver choices retain a reporter missing from the section list", async (t) => {
  mockPages(t, "/users", [{ id: "peer", firstname: "ก", lastname: "ทดสอบ" }]);
  const result = await fetchRepairReceivers(repairJob);
  assert.deepEqual(new Set(result.map((user) => user.userId)), new Set(["peer", "user-1"]));
});

test("a failure on a later lookup page is not returned as a complete list", async (t) => {
  t.mock.method(apiClient, "get", async (_url: string, config?: RequestConfig) => {
    if (config?.params?.page === 2) throw new Error("second page unavailable");
    return { data: { data: [{ id: "first" }], meta: { page: 1, limit: 100, total: 101, totalPages: 2 } } };
  });
  await assert.rejects(getAllUsers(), /second page unavailable/);
  await assert.rejects(getSparepartGroups(), /second page unavailable/);
  await assert.rejects(findBorrowExtensionById("missing"), /second page unavailable/);
});

test("lookup readers reject missing pagination metadata", async (t) => {
  t.mock.method(apiClient, "get", async () => ({ data: { data: [{ id: "first" }] } }));
  await assert.rejects(getAllUsers(), /pagination/);
  await assert.rejects(findBorrowExtensionById("missing"), /pagination/);
});

test("lookup readers reject a repeated page instead of looping indefinitely", async (t) => {
  t.mock.method(apiClient, "get", async () => ({ data: {
    data: [{ id: "first" }], meta: { page: 1, limit: 100, total: 101, totalPages: 2 },
  } }));
  await assert.rejects(getAllUsers(), /pagination/);
  await assert.rejects(findBorrowExtensionById("missing"), /pagination/);
});
