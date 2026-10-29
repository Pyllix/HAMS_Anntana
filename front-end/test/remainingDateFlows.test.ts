import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "../src/services/apiClient";
import { getPartOrdersPage, updateOrderStatus } from "../src/services/partOrderService";
import { mapApiRepairJob, type ApiRepairJob } from "../src/services/repairApiService";
import { assetDateRange } from "../src/services/assetDateRange";

test("stock-in pages map server timestamps to the actual Thai receipt date", async (t) => {
  t.mock.method(apiClient, "get", async () => ({ data: {
    data: [{ id: 1, sparepartId: 1, qty: 2, totalPrice: 20, sparepartAddDoc: "TEST", createdAt: "2026-12-31T17:30:00Z" }],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  } }));
  const page = await getPartOrdersPage({ page: 1 });
  assert.equal(page.data[0].orderDate, "2027-01-01");
});

test("updating an order status sends today's Thai calendar date", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  let sent: unknown;
  t.mock.method(apiClient, "patch", async (_path: string, payload: unknown) => { sent = payload; return { data: { id: 1 } }; });
  await updateOrderStatus(1, "RECEIVED");
  assert.deepEqual(sent, { status: "RECEIVED", orderDate: "2027-01-01" });
});

test("repair completion is mapped to the Thai day without shifting warranty date-only fields", () => {
  const job: ApiRepairJob = {
    id: "job-1", jobNo: "TEST", assetId: "asset-1", sectionId: "section-1", reporterId: "user-1",
    createdAt: "2026-12-31T16:00:00Z", updatedAt: "2026-12-31T17:30:00Z",
    returnDate: "2026-12-31T17:30:00Z", warrantyDate: "2027-07-01",
    jobStatus: { id: 1, code: "COMPLETED", name: "ปิดงาน" },
    receiver: { id: "user-1", firstname: "Test", lastname: "User" },
  };
  const mapped = mapApiRepairJob(job);
  assert.equal(mapped.confirmation?.completedDate, "2027-01-01");
  assert.equal(mapped.confirmation?.warrantyEndDate, "2027-07-01");
  assert.equal(mapped.confirmation?.warrantyMonths, 6);
});

test("asset day filters cover exactly the selected Thai day in every host timezone", () => {
  assert.deepEqual(assetDateRange(new Date(2027, 0, 1), "1/1/2570", true), {
    updatedAtFrom: "2026-12-31T17:00:00.000Z", updatedAtTo: "2027-01-01T16:59:59.999Z",
  });
});

test("this-month filters use the Thai month when UTC is still in last year", () => {
  assert.deepEqual(assetDateRange(null, "เดือนนี้", true, new Date("2026-12-31T17:30:00Z")), {
    updatedAtFrom: "2026-12-31T17:00:00.000Z", updatedAtTo: "2027-01-31T16:59:59.999Z",
  });
});
