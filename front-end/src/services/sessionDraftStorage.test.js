import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  associateSessionDraftAccount,
  clearSessionDraft,
  clearSessionDrafts,
  hasSessionDrafts,
  hasSessionDraftAccountChanged,
  getAccountStorageKey,
  initializeSessionDraftTab,
  loadSessionDraft,
  saveSessionDraft,
} from "./sessionDraftStorage.js";

class MemoryStorage {
  values = new Map();

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class SharedLocalStorage {
  values = new Map();
  windows = new Set();
  pendingEvents = [];

  createView(owner) {
    return {
      getItem: (key) => this.values.get(key) ?? null,
      setItem: (key, value) => {
        const oldValue = this.values.get(key) ?? null;
        const newValue = String(value);
        this.values.set(key, newValue);
        this.queueEvent(owner, { key, oldValue, newValue });
      },
      removeItem: (key) => {
        const oldValue = this.values.get(key) ?? null;
        this.values.delete(key);
        this.queueEvent(owner, { key, oldValue, newValue: null });
      },
    };
  }

  queueEvent(owner, event) {
    for (const target of this.windows) {
      if (target !== owner) this.pendingEvents.push({ target, event });
    }
  }

  flush(target) {
    const remaining = [];
    for (const pending of this.pendingEvents) {
      if (pending.target === target) target.dispatchStorage(pending.event);
      else remaining.push(pending);
    }
    this.pendingEvents = remaining;
  }
}

function createStorageEventWindow(sharedStorage, tabSessionStorage) {
  const listeners = new Map();
  const target = {
    document: {},
    sessionStorage: tabSessionStorage,
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
    dispatchStorage(event) {
      for (const callback of listeners.get("storage") ?? []) {
        callback(event);
      }
    },
  };
  target.localStorage = sharedStorage.createView(target);
  sharedStorage.windows.add(target);
  return target;
}
let sessionStorage;
let localStorage;

beforeEach(() => {
  sessionStorage = new MemoryStorage();
  localStorage = new MemoryStorage();
  globalThis.window = { sessionStorage, localStorage };
});

test("drafts stay in this tab and reload only for the bound account", () => {
  associateSessionDraftAccount("user-a");
  const draft = { symptom: "screen cracked", urgency: "URGENT" };

  saveSessionDraft("repair-request", "user-a", draft);

  assert.deepEqual(loadSessionDraft("repair-request", "user-a"), draft);
  assert.equal(loadSessionDraft("repair-request", "user-b"), null);
  assert.equal(hasSessionDrafts("user-a"), true);
  assert.equal(hasSessionDrafts("user-b"), false);
});

test("switching accounts discards all prior account drafts", () => {
  associateSessionDraftAccount("user-a");
  saveSessionDraft("asset-create", "user-a", { name: "private asset" });

  assert.equal(associateSessionDraftAccount("user-b"), true);
  assert.equal(loadSessionDraft("asset-create", "user-b"), null);
  assert.equal(hasSessionDrafts("user-b"), false);
});

test("re-authenticating the same account keeps its current-tab draft", () => {
  associateSessionDraftAccount("user-a");
  saveSessionDraft("borrow:asset-1", "user-a", { expectedReturnDate: "2026-10-01" });

  assert.equal(associateSessionDraftAccount("user-a"), false);
  assert.deepEqual(loadSessionDraft("borrow:asset-1", "user-a"), {
    expectedReturnDate: "2026-10-01",
  });
});

test("account changes compare against the draft owner after local session expiry", () => {
  associateSessionDraftAccount("user-a");
  saveSessionDraft("repair-request", "user-a", { symptom: "noise" });

  assert.equal(hasSessionDraftAccountChanged(null, "user-a"), false);
  assert.equal(hasSessionDraftAccountChanged(null, "user-b"), true);
});
test("explicit sign-out clears drafts and account binding", () => {
  associateSessionDraftAccount("user-a");
  saveSessionDraft("assessment:job-1", "user-a", { diagnosis: "repair" });

  clearSessionDrafts();

  assert.equal(loadSessionDraft("assessment:job-1", "user-a"), null);
  assert.equal(hasSessionDrafts("user-a"), false);
  assert.equal(associateSessionDraftAccount("user-a"), false);
});

test("a single draft can be discarded after its form is submitted", () => {
  associateSessionDraftAccount("user-a");
  saveSessionDraft("borrow:asset-1", "user-a", { expectedReturnDate: "2026-10-01" });

  clearSessionDraft("borrow:asset-1");

  assert.equal(loadSessionDraft("borrow:asset-1", "user-a"), null);
  assert.equal(hasSessionDrafts("user-a"), false);
});
test("account-local cache keys differ by authenticated account", () => {
  associateSessionDraftAccount("user-a");
  assert.equal(
    getAccountStorageKey("orders"),
    "orders:user-a",
  );

  associateSessionDraftAccount("user-b");
  assert.equal(
    getAccountStorageKey("orders"),
    "orders:user-b",
  );

  clearSessionDrafts();
  assert.equal(getAccountStorageKey("orders"), null);
});
test("unbound legacy assessment drafts stay stored but are never restored", async () => {
  const legacyValue = JSON.stringify({ assessmentId: 7, diagnosis: "old draft" });
  localStorage.setItem("draft_assessment_7", legacyValue);

  await initializeSessionDraftTab();
  associateSessionDraftAccount("user-a");

  assert.equal(loadSessionDraft("assessment:7", "user-a"), null);
  assert.equal(localStorage.getItem("draft_assessment_7"), legacyValue);

  clearSessionDrafts();

  assert.equal(localStorage.getItem("draft_assessment_7"), legacyValue);
});
test("duplicate tabs clear copied drafts without BroadcastChannel", async () => {
  const previousWindow = globalThis.window;
  const previousBroadcastChannel = globalThis.BroadcastChannel;
  const sharedStorage = new SharedLocalStorage();
  const originalSessionStorage = new MemoryStorage();
  const originalWindow = createStorageEventWindow(sharedStorage, originalSessionStorage);
  globalThis.BroadcastChannel = undefined;
  globalThis.window = originalWindow;

  try {
    const original = await import("./sessionDraftStorage.js?ticket06-original");
    original.associateSessionDraftAccount("user-a");
    original.saveSessionDraft("repair-request", "user-a", { symptom: "noise" });
    await original.initializeSessionDraftTab();

    const clonedSessionStorage = new MemoryStorage();
    clonedSessionStorage.values = new Map(originalSessionStorage.values);
    const clonedWindow = createStorageEventWindow(sharedStorage, clonedSessionStorage);
    const cloned = await import("./sessionDraftStorage.js?ticket06-clone");
    globalThis.window = clonedWindow;

    const cloneInitialization = cloned.initializeSessionDraftTab();
    globalThis.window = originalWindow;
    sharedStorage.flush(originalWindow);
    globalThis.window = clonedWindow;
    sharedStorage.flush(clonedWindow);
    await cloneInitialization;

    assert.equal(cloned.loadSessionDraft("repair-request", "user-a"), null);
    globalThis.window = originalWindow;
    assert.deepEqual(
      original.loadSessionDraft("repair-request", "user-a"),
      { symptom: "noise" },
    );
  } finally {
    globalThis.window = previousWindow;
    globalThis.BroadcastChannel = previousBroadcastChannel;
  }
});