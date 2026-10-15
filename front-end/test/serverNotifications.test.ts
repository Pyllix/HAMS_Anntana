import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createNotificationStream,
  parseCreatedNotification,
  reconnectDelayMs,
  type NotificationEventSource,
  type NotificationStreamStatus,
} from "../src/services/notificationStream.ts";
import {
  flattenNotificationPages,
  markAllReadInPages,
  markNotificationReadInPages,
  prependNotification,
  replaceNotificationInPages,
  unreadCountAfterCreated,
  type NotificationPages,
} from "../src/services/serverNotificationCache.ts";
import {
  assetCenterTabForNotification,
  formatNotificationRelativeTime,
  isActionAlreadyHandled,
  isActionRequiredNotification,
  notificationTone,
  readNotificationResourceParams,
  readNotificationTypeParam,
  relatedQueryRoots,
  resolveAssetCenterNotificationTarget,
  resolveDepartmentNotificationTarget,
  resolveParcelNotificationTarget,
} from "../src/services/notificationTargets.ts";
import type {
  ServerNotification,
  ServerNotificationPage,
} from "../src/types/TypeServerNotification.ts";

class FakeEventSource implements NotificationEventSource {
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: unknown = {}): void {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function fakeScheduler() {
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  let nextId = 1;
  return {
    timers,
    schedule: (callback: () => void, delayMs: number) => {
      const id = nextId++;
      timers.set(id, { callback, delayMs });
      return id;
    },
    cancel: (handle: unknown) => timers.delete(handle as number),
    runNext: () => {
      const [id, timer] = [...timers.entries()][0];
      timers.delete(id);
      timer.callback();
      return timer.delayMs;
    },
  };
}

function notification(
  id: string,
  overrides: Partial<ServerNotification> = {},
): ServerNotification {
  return {
    id,
    type: "BORROW_APPROVED",
    title: `title-${id}`,
    message: `message-${id}`,
    resourceType: "BORROW_TRANSACTION",
    resourceId: `resource-${id}`,
    readAt: null,
    createdAt: "2026-10-14T08:00:00.000Z",
    ...overrides,
  };
}

function page(items: ServerNotification[], pageNumber = 1, hasNextPage = false): ServerNotificationPage {
  return {
    data: items,
    meta: {
      page: pageNumber,
      limit: 20,
      total: items.length,
      totalPages: 1,
      hasNextPage,
      hasPrevPage: pageNumber > 1,
    },
  };
}

function pages(...pageList: ServerNotificationPage[]): NotificationPages {
  return { pages: pageList, pageParams: pageList.map((_, index) => index + 1) };
}

test("reconnect delay grows exponentially, is capped and jittered", () => {
  assert.equal(reconnectDelayMs(0, () => 1), 1_000);
  assert.equal(reconnectDelayMs(0, () => 0), 500);
  assert.equal(reconnectDelayMs(3, () => 1), 8_000);
  assert.equal(reconnectDelayMs(20, () => 1), 30_000);
  assert.equal(reconnectDelayMs(20, () => 0), 15_000);
});

test("stream dispatches events, reconnects with backoff and resets after open", () => {
  const sources: FakeEventSource[] = [];
  const scheduler = fakeScheduler();
  const created: string[] = [];
  const statuses: NotificationStreamStatus[] = [];
  let syncCount = 0;
  let changedCount = 0;

  const connection = createNotificationStream({
    open: () => {
      const source = new FakeEventSource();
      sources.push(source);
      return source;
    },
    onCreated: (item) => created.push(item.id),
    onSyncRequired: () => syncCount++,
    onChanged: () => changedCount++,
    onStatusChange: (status) => statuses.push(status),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    random: () => 1,
  });

  sources[0].onopen?.(new Event("open"));
  sources[0].emit("notifications.sync_required", { reason: "connected" });
  sources[0].emit("notification.created", notification("n1"));
  sources[0].emit("notifications.changed", { reason: "read_state" });
  sources[0].emit("notification.created", "not-json");
  assert.deepEqual(created, ["n1"]);
  assert.equal(syncCount, 2, "malformed payload falls back to a REST sync");
  assert.equal(changedCount, 1);

  sources[0].onerror?.(new Event("error"));
  assert.equal(sources[0].closed, true, "broken source is closed before retrying");
  assert.equal(scheduler.runNext(), 1_000);
  sources[1].onerror?.(new Event("error"));
  assert.equal(scheduler.runNext(), 2_000);
  sources[2].onopen?.(new Event("open"));
  sources[2].onerror?.(new Event("error"));
  assert.equal(scheduler.runNext(), 1_000, "backoff resets after a successful open");

  // event จาก source เก่าที่ถูกแทนที่แล้วต้องถูกทิ้ง
  sources[0].emit("notification.created", notification("stale"));
  assert.deepEqual(created, ["n1"]);
  assert.deepEqual(statuses.slice(0, 3), ["CONNECTING", "CONNECTED", "RECONNECTING"]);

  connection.close();
});

test("closing the stream leaves no open source, pending retry or late events", () => {
  const sources: FakeEventSource[] = [];
  const scheduler = fakeScheduler();
  const created: string[] = [];
  const connection = createNotificationStream({
    open: () => {
      const source = new FakeEventSource();
      sources.push(source);
      return source;
    },
    onCreated: (item) => created.push(item.id),
    onSyncRequired: () => {},
    onChanged: () => {},
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  sources[0].onerror?.(new Event("error"));
  assert.equal(scheduler.timers.size, 1);
  connection.close();
  assert.equal(scheduler.timers.size, 0, "pending reconnect is cancelled");
  assert.ok(sources.every((source) => source.closed));

  connection.reconnectNow();
  assert.equal(sources.length, 1, "a closed stream never reopens");
  sources[0].emit("notification.created", notification("late"));
  assert.deepEqual(created, []);
});

test("created payload parser rejects malformed data", () => {
  assert.equal(parseCreatedNotification("{}"), null);
  assert.equal(parseCreatedNotification("nope"), null);
  assert.equal(parseCreatedNotification(undefined), null);
  assert.equal(parseCreatedNotification(JSON.stringify(notification("a")))?.id, "a");
});

test("new notifications are prepended once and unread count only grows for unseen unread items", () => {
  const data = pages(page([notification("b"), notification("c")]));
  const withNew = prependNotification(data, notification("a"));
  assert.deepEqual(flattenNotificationPages(withNew).map((item) => item.id), ["a", "b", "c"]);
  assert.equal(prependNotification(withNew, notification("a")), withNew, "duplicate id is ignored");

  assert.equal(unreadCountAfterCreated(2, data, notification("a")), 3);
  assert.equal(unreadCountAfterCreated(3, withNew, notification("a")), 3);
  assert.equal(unreadCountAfterCreated(2, data, notification("x", { readAt: "2026-10-14T09:00:00.000Z" })), 2);
  assert.equal(unreadCountAfterCreated(undefined, data, notification("a")), undefined);
  assert.equal(prependNotification(undefined, notification("a")), undefined);
});

test("flattening load-more pages removes ids shifted in by realtime inserts", () => {
  const data = pages(
    page([notification("new"), notification("a"), notification("b")]),
    page([notification("b"), notification("c")], 2),
  );
  assert.deepEqual(flattenNotificationPages(data).map((item) => item.id), ["new", "a", "b", "c"]);
});

test("optimistic read can be rolled back for just that item", () => {
  const original = notification("a");
  const data = pages(page([original, notification("b")]));
  const optimistic = markNotificationReadInPages(data, "a", "2026-10-14T09:00:00.000Z");
  assert.equal(flattenNotificationPages(optimistic)[0].readAt, "2026-10-14T09:00:00.000Z");
  assert.equal(flattenNotificationPages(optimistic)[1].readAt, null);

  // ระหว่างรอ API มีรายการใหม่เข้ามา แล้ว API error
  const withRealtime = prependNotification(optimistic, notification("new"));
  const rolledBack = replaceNotificationInPages(withRealtime, original);
  const items = flattenNotificationPages(rolledBack);
  assert.deepEqual(items.map((item) => item.id), ["new", "a", "b"]);
  assert.equal(items[1].readAt, null);
});

test("read-all marks every loaded item read and keeps existing read times", () => {
  const data = pages(
    page([notification("a"), notification("b", { readAt: "2026-10-13T00:00:00.000Z" })]),
    page([notification("c")], 2),
  );
  const items = flattenNotificationPages(markAllReadInPages(data, "2026-10-14T10:00:00.000Z"));
  assert.ok(items.every((item) => item.readAt));
  assert.equal(items[1].readAt, "2026-10-13T00:00:00.000Z");
});

test("department staff notifications open the matching page with the resource id", () => {
  const cases = [
    ["BORROW_APPROVED", "BORROW_TRANSACTION", "/borrow-request"],
    ["BORROW_DUE_SOON", "BORROW_TRANSACTION", "/borrow-request"],
    ["BORROW_OVERDUE", "BORROW_TRANSACTION", "/borrow-request"],
    ["BORROW_EXTENSION_APPROVED", "BORROW_EXTENSION", "/borrow-request"],
    ["BORROW_EXTENSION_REJECTED", "BORROW_EXTENSION", "/borrow-request"],
    ["REPAIR_READY_FOR_COLLECTION", "REPAIR_JOB", "/track-status"],
    ["REPAIR_UNREPAIRABLE_RECEIVED", "REPAIR_JOB", "/track-status"],
  ] as const;

  for (const [type, resourceType, path] of cases) {
    const target = resolveDepartmentNotificationTarget(
      notification("n", { type, resourceType, resourceId: "id-1" }),
    );
    assert.ok(target, type);
    const url = new URL(target, "https://hams.local");
    assert.equal(url.pathname, path, type);
    assert.deepEqual(readNotificationResourceParams(url.searchParams), {
      resourceType,
      resourceId: "id-1",
    });
  }

  assert.equal(
    resolveParcelNotificationTarget(notification("n", { resourceType: "REPAIR_JOB" }))?.split("?")[0],
    "/parcel-repair-operations",
  );
});

test("unknown resource types resolve to no target instead of throwing", () => {
  const unknown = notification("n", {
    resourceType: "SOMETHING_NEW" as ServerNotification["resourceType"],
  });
  assert.equal(resolveDepartmentNotificationTarget(unknown), null);
  assert.equal(
    resolveDepartmentNotificationTarget(
      notification("n", { resourceType: "toString" as ServerNotification["resourceType"] }),
    ),
    null,
  );
  assert.equal(resolveDepartmentNotificationTarget(notification("n", { resourceId: "" })), null);
  assert.equal(readNotificationResourceParams(new URLSearchParams("notificationResourceType=X")), null);
});

test("asset center notifications open the matching page, tab and resource", () => {
  const cases = [
    // แจ้งเตือนแบบกลุ่มของศูนย์
    ["BORROW_APPROVAL_REQUIRED", "BORROW_TRANSACTION", "/borrow-return-assets_center", "approve"],
    ["BORROW_EXTENSION_APPROVAL_REQUIRED", "BORROW_EXTENSION", "/borrow-return-assets_center", "extension"],
    ["BORROW_OVERDUE", "BORROW_TRANSACTION", "/borrow-return-assets_center", null],
    ["REPAIR_READY_FOR_COLLECTION", "REPAIR_JOB", "/track-status", null],
    ["REPAIR_UNREPAIRABLE_RECEIVED", "REPAIR_JOB", "/track-status", null],
    // แจ้งเตือนฝั่งผู้ยืม เมื่อเจ้าหน้าที่ศูนย์เป็นผู้ยืมเอง
    ["BORROW_APPROVED", "BORROW_TRANSACTION", "/borrow-return-assets_center", null],
    ["BORROW_DUE_SOON", "BORROW_TRANSACTION", "/borrow-return-assets_center", null],
    ["BORROW_EXTENSION_APPROVED", "BORROW_EXTENSION", "/borrow-return-assets_center", null],
    ["BORROW_EXTENSION_REJECTED", "BORROW_EXTENSION", "/borrow-return-assets_center", null],
  ] as const;

  for (const [type, resourceType, path, tab] of cases) {
    const target = resolveAssetCenterNotificationTarget(
      notification("n", { type, resourceType, resourceId: "id-1" }),
    );
    assert.ok(target, type);
    const url = new URL(target, "https://hams.local");
    assert.equal(url.pathname, path, type);
    assert.deepEqual(readNotificationResourceParams(url.searchParams), {
      resourceType,
      resourceId: "id-1",
    });
    assert.equal(readNotificationTypeParam(url.searchParams), type);
    assert.equal(assetCenterTabForNotification(readNotificationTypeParam(url.searchParams)), tab, type);
  }

  assert.equal(
    resolveAssetCenterNotificationTarget(
      notification("n", { resourceType: "SOMETHING_NEW" as ServerNotification["resourceType"] }),
    ),
    null,
  );
  assert.equal(assetCenterTabForNotification(null), null);
});

test("action notifications are flagged and stale ones are detected from the latest status", () => {
  assert.equal(isActionRequiredNotification("BORROW_APPROVAL_REQUIRED"), true);
  assert.equal(isActionRequiredNotification("BORROW_EXTENSION_APPROVAL_REQUIRED"), true);
  assert.equal(isActionRequiredNotification("BORROW_OVERDUE"), false);

  // ยังรออยู่ -> ไม่แสดงว่าดำเนินการแล้ว
  assert.equal(isActionAlreadyHandled("BORROW_APPROVAL_REQUIRED", "PENDING_APPROVE"), false);
  assert.equal(isActionAlreadyHandled("BORROW_EXTENSION_APPROVAL_REQUIRED", "PENDING"), false);
  // คนอื่นในศูนย์อนุมัติ/ปฏิเสธไปแล้ว
  assert.equal(isActionAlreadyHandled("BORROW_APPROVAL_REQUIRED", "APPROVED"), true);
  assert.equal(isActionAlreadyHandled("BORROW_EXTENSION_APPROVAL_REQUIRED", "REJECTED"), true);
  // ไม่ใช่แจ้งเตือนที่ต้องดำเนินการ หรือยังไม่รู้สถานะ
  assert.equal(isActionAlreadyHandled("BORROW_OVERDUE", "BORROWED"), false);
  assert.equal(isActionAlreadyHandled("BORROW_APPROVAL_REQUIRED", undefined), false);
  assert.equal(isActionAlreadyHandled(null, "APPROVED"), false);
});

test("new notifications refresh only the lists related to their resource", () => {
  assert.deepEqual(relatedQueryRoots("BORROW_TRANSACTION"), ["borrowHistory"]);
  assert.deepEqual(relatedQueryRoots("BORROW_EXTENSION"), ["borrowExtensions", "borrowHistory"]);
  assert.deepEqual(relatedQueryRoots("REPAIR_JOB"), ["repairsHistory"]);
  assert.deepEqual(relatedQueryRoots("SOMETHING_NEW"), []);
  assert.deepEqual(relatedQueryRoots("toString"), []);
  assert.deepEqual(relatedQueryRoots(undefined), []);
});

test("overdue is danger, due soon is warning, approvals are action, everything else default", () => {
  assert.equal(notificationTone("BORROW_OVERDUE"), "danger");
  assert.equal(notificationTone("BORROW_DUE_SOON"), "warning");
  assert.equal(notificationTone("BORROW_APPROVAL_REQUIRED"), "action");
  assert.equal(notificationTone("BORROW_EXTENSION_APPROVAL_REQUIRED"), "action");
  assert.equal(notificationTone("BORROW_APPROVED"), "default");
  assert.equal(notificationTone("REPAIR_UNREPAIRABLE_RECEIVED"), "default");
  assert.equal(notificationTone("UNKNOWN"), "default");
});

test("relative time is rendered in Thai", () => {
  const now = Date.parse("2026-10-14T12:00:00.000Z");
  assert.equal(formatNotificationRelativeTime("2026-10-14T11:59:30.000Z", now), "เมื่อสักครู่");
  assert.equal(formatNotificationRelativeTime("2026-10-14T11:55:00.000Z", now), "5 นาทีที่แล้ว");
  assert.equal(formatNotificationRelativeTime("2026-10-14T09:00:00.000Z", now), "3 ชั่วโมงที่แล้ว");
  assert.equal(formatNotificationRelativeTime("2026-10-12T12:00:00.000Z", now), "2 วันที่แล้ว");
  assert.equal(formatNotificationRelativeTime("invalid", now), "-");
});
