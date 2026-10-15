import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createServer, type ViteDevServer } from "vite";
import type { TrackRes } from "../src/services/trackingService.ts";

type RepairDetail = Pick<TrackRes,
  "jobNo" | "asset" | "section" | "reporter" | "symptom" | "jobStatus" |
  "createdAt" | "returnDate" | "receiver" | "unrepairableReason"
>;

let vite: ViteDevServer;
let DetailDialog: ComponentType<{
  resourceType: string;
  resourceId: string;
  notificationType: string;
  onClose: () => void;
}>;
let TrackingPage: ComponentType;

before(async () => {
  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  });
  ({ default: DetailDialog } = await vite.ssrLoadModule(
    "/src/components/notifications/NotificationResourceDialog.tsx",
  ));
  ({ default: TrackingPage } = await vite.ssrLoadModule("/src/pages/TrackingAssetCenter.tsx"));
});

after(async () => { await vite?.close(); });

function renderDetail(notificationType: string, overrides: Partial<RepairDetail> = {}, throughTrackingPage = false) {
  const job: RepairDetail = {
    jobNo: "REP-202610-0001",
    asset: { id: "asset-1", name: "เครื่องทดสอบ", noid: "EQ-001", model: "A", serialNo: "S1", imageUrl: "" },
    section: { id: "section-1", code: "ICU", name: "หอผู้ป่วยวิกฤต" },
    reporter: { id: "reporter-1", firstname: "ผู้แจ้ง", lastname: "ทดสอบ", email: "reporter@example.test" },
    symptom: "เปิดไม่ติด",
    jobStatus: { id: 1, code: "COMPLETED", name: "ซ่อมเสร็จสิ้น", createdAt: "", updatedAt: "", deletedAt: null },
    createdAt: "2026-10-14T08:00:00.000Z",
    returnDate: "2026-10-15T08:00:00.000Z",
    unrepairableReason: "อะไหล่เลิกผลิต",
    receiver: { id: "parcel-1", firstname: "พัสดุ", lastname: "ทดสอบ" },
    ...overrides,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: Infinity } } });
  client.setQueryData(["notification-resource", undefined, "REPAIR_JOB", "job-1"], {
    kind: "REPAIR_JOB", data: job,
  });
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", { value: { visibilityState: "visible" }, configurable: true, writable: true });
  try {
    const content = throughTrackingPage
      ? createElement(MemoryRouter, {
          initialEntries: [`/track-status?notificationResourceType=REPAIR_JOB&notificationResourceId=job-1&notificationType=${notificationType}`],
        }, createElement(TrackingPage))
      : createElement(DetailDialog, {
          resourceType: "REPAIR_JOB", resourceId: "job-1", notificationType, onClose: () => {},
        });
    return renderToStaticMarkup(createElement(QueryClientProvider, { client }, content));
  } finally {
    client.clear();
    Object.defineProperty(globalThis, "document", { value: previousDocument, configurable: true, writable: true });
  }
}

test("unrepairable notification details show the failed repair and actual parcel receipt", () => {
  const markup = renderDetail("REPAIR_UNREPAIRABLE_RECEIVED");
  for (const text of ["REP-202610-0001", "EQ-001", "ซ่อมไม่ได้ / พัสดุรับมอบแล้ว", "อะไหล่เลิกผลิต", "พัสดุ ทดสอบ", "วันที่พัสดุรับมอบ"]) {
    assert.ok(markup.includes(text), text);
  }
  assert.ok(!markup.includes("ซ่อมเสร็จสิ้น"));
});

test("missing optional receipt details display a fallback", () => {
  const markup = renderDetail("REPAIR_UNREPAIRABLE_RECEIVED", {
    unrepairableReason: null,
    receiver: null,
    returnDate: null,
  });
  assert.ok(markup.includes("เหตุผลที่ซ่อมไม่ได้"));
  assert.ok(!markup.includes("undefined"));
  assert.ok(!markup.includes("Invalid Date"));
});

test("existing repair notifications keep the latest repair status", () => {
  const markup = renderDetail("REPAIR_READY_FOR_COLLECTION");
  assert.ok(markup.includes("ซ่อมเสร็จสิ้น"));
  assert.ok(!markup.includes("พัสดุรับมอบแล้ว"));
  assert.ok(!markup.includes("วันที่พัสดุรับมอบ"));
});

test("the notification query alone cannot label a successful repair as unrepairable", () => {
  const markup = renderDetail("REPAIR_UNREPAIRABLE_RECEIVED", { unrepairableReason: null });
  assert.ok(markup.includes("ซ่อมเสร็จสิ้น"));
  assert.ok(!markup.includes("ซ่อมไม่ได้ / พัสดุรับมอบแล้ว"));
});

test("tracking page passes the notification type through to the receipt details", () => {
  const markup = renderDetail("REPAIR_UNREPAIRABLE_RECEIVED", {}, true);
  assert.ok(markup.includes("ซ่อมไม่ได้ / พัสดุรับมอบแล้ว"));
  assert.ok(markup.includes("อะไหล่เลิกผลิต"));
  assert.ok(markup.includes("พัสดุ ทดสอบ"));
});
