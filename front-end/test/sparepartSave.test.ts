import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import { apiClient } from "../src/services/apiClient";
import {
  createSparepart,
  updateSparepart,
  getLocalSparepartDrafts,
  getSparePartTimestamp,
} from "../src/services/sparepartService";
import type { Sparepart } from "../src/types/TypeSparePart";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
  };
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let storage: Storage;
let accountKey: string;
let nextAccount = 0;
const legacyDraft = { id: 1_700_000_000_000, name: "Existing unsaved draft", localDraft: true };
const serverPart: Sparepart = {
  id: 42, code: "SP01-0042", name: "Server name", unit: "ชิ้น",
  groupId: 7, group: { id: 7, name: "Server group" },
  price: 25, minStock: 1, qtyInStock: 4,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
};
const form = {
  name: "Form name", code: "DISPLAY-ONLY", category: "Old group name",
  groupId: 7, unit: "ชิ้น", price: 25, minStock: 1, qtyInStock: 4,
};

beforeEach(() => {
  storage = memoryStorage();
  const sessionStorage = memoryStorage();
  const account = `sparepart-save-${++nextAccount}`;
  sessionStorage.setItem("hams.sessionDraft:account", account);
  accountKey = `hams_spareparts_storage_v1:${account}`;
  storage.setItem(accountKey, JSON.stringify([legacyDraft]));
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", { value: { sessionStorage }, configurable: true });
});

afterEach(() => {
  for (const [key, descriptor] of [["window", originalWindow], ["localStorage", originalLocalStorage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

for (const operation of ["create", "update"] as const) {
  test(`${operation} sends writable fields only and keeps the server's saved values`, async (t) => {
    const method = operation === "create" ? "post" : "patch";
    t.mock.method(apiClient, method, async (url: string, payload: Record<string, unknown>) => {
      assert.equal(url, operation === "create" ? "/spare-parts" : "/spare-parts/42");
      assert.deepEqual(payload, {
        name: form.name, groupId: 7, unit: "ชิ้น", price: 25, minStock: 1, qtyInStock: 4,
      });
      return { data: serverPart };
    });
    const saved = operation === "create" ? await createSparepart(form) : await updateSparepart(42, form);
    assert.equal(saved.id, 42);
    assert.equal(saved.code, serverPart.code);
    assert.equal(saved.name, serverPart.name);
    assert.equal(saved.category, "Server group");
    assert.equal(saved.localDraft, false);
    assert.deepEqual(getSparePartTimestamp(42), {
      createdAt: serverPart.createdAt, updatedAt: serverPart.updatedAt,
    });
    assert.deepEqual(getLocalSparepartDrafts(), [legacyDraft]);
    assert.deepEqual(JSON.parse(storage.getItem(accountKey)!).find((p: Sparepart) => p.id === 42), saved);
  });

  for (const status of [400, 502]) {
    test(`${operation} rejects HTTP ${status} without changing saved data or creating a local draft`, async (t) => {
      const error = Object.assign(new Error("Save failed"), { response: { status } });
      const before = storage.getItem(accountKey);
      t.mock.method(apiClient, operation === "create" ? "post" : "patch", async () => { throw error; });
      await assert.rejects(
        operation === "create" ? createSparepart(form) : updateSparepart(42, form),
        (caught) => caught === error,
      );
      assert.equal(storage.getItem(accountKey), before);
      assert.equal(getSparePartTimestamp(42), undefined);
      assert.deepEqual(getLocalSparepartDrafts(), [legacyDraft]);
    });
  }
}

test("a partial update leaves omitted stock and group fields out of the request", async (t) => {
  t.mock.method(apiClient, "patch", async (_url: string, payload: unknown) => {
    assert.deepEqual(payload, { price: 30 });
    return { data: { ...serverPart, price: 30 } };
  });
  const saved = await updateSparepart(42, { price: 30 });
  assert.equal(saved.qtyInStock, serverPart.qtyInStock);
  assert.equal(saved.price, 30);
});
