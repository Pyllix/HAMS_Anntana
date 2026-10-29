import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { apiClient } from "../src/services/apiClient";
import {
  getSparepartGroupsPage, createSparepartGroup, updateSparepartGroup, deleteSparepartGroup,
} from "../src/services/sparepartGroupService";

interface Element { type: unknown; props: Record<string, unknown> & { children?: unknown }; }
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...elements(node.props.children)];
}
function text(tree: Element): string {
  const collect = (value: unknown): string => Array.isArray(value) ? value.map(collect).join(" ")
    : value && typeof value === "object" && "props" in value ? collect((value as Element).props.children)
      : typeof value === "string" ? value : "";
  return collect(tree);
}
function handler(node: Element, name: string) {
  return node.props[name] as (event?: unknown) => void;
}
const group = { id: 47, name: "ระบบไฟฟ้า", sparepartsCount: 0 };

// Run the real component handlers; only hooks, stores and API boundaries are simulated.
function formHarness(file: string, exportName = "default", props: Record<string, unknown> = {}) {
  const sourceUrl = new URL(`../src/components/${file}.tsx`, import.meta.url);
  const requireSource = createRequire(sourceUrl);
  const slots: unknown[] = [];
  const dependencies: unknown[][] = [];
  let index = 0;
  let effectIndex = 0;
  let effects: Array<() => void> = [];
  let busy = false;
  let pending = Promise.resolve();
  let failure: unknown;
  const calls: Array<{ operation: string; args: unknown[] }> = [];
  const invalidations: unknown[] = [];
  let closed = 0;
  const query = {
    data: [group] as Array<typeof group>, isLoading: false, isError: false,
    isSuccess: true, isFetching: false, refetch() { calls.push({ operation: "refetch", args: [] }); },
  };
  const store: Record<string, unknown> = { isOpen: true, editItem: null, closeModal() { closed++; } };
  const call = (operation: string) => async (...args: unknown[]) => {
    calls.push({ operation, args });
    if (failure) throw failure;
    return group;
  };
  const react = {
    useId: () => "test-id",
    useState(initial: unknown) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (next: unknown) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
    },
    useRef(initial: unknown) {
      const i = index++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn: () => void, deps: unknown[]) {
      const i = effectIndex++;
      if (!dependencies[i] || deps.some((dep, n) => dep !== dependencies[i][n])) {
        dependencies[i] = deps;
        effects.push(fn);
      }
    },
  };
  const jsx = (type: unknown, elementProps: Element["props"]) => ({ type, props: elementProps });
  function requireMock(name: string): unknown {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "axios") return requireSource(name);
    if (name === "@tanstack/react-query") return {
      useQuery: () => query,
      useQueryClient: () => ({ invalidateQueries(value: unknown) { invalidations.push(value); return Promise.resolve(); } }),
      useMutation: (options: {
        mutationFn(value: unknown): Promise<unknown>;
        onMutate?(): void; onSuccess?(): void; onError?(error: unknown): void; onSettled?(): void;
      }) => ({
        isLoading: busy,
        mutate(value: unknown) {
          busy = true;
          options.onMutate?.();
          pending = Promise.resolve().then(() => options.mutationFn(value)).then(
            () => { options.onSuccess?.(); },
            (error: unknown) => { options.onError?.(error); },
          ).finally(() => { busy = false; options.onSettled?.(); });
        },
      }),
    };
    if (name.endsWith("/sparepartGroupService")) return {
      createSparepartGroup: call("createGroup"), updateSparepartGroup: call("updateGroup"), deleteSparepartGroup: call("deleteGroup"),
    };
    if (name.endsWith("/sparepartService")) return {
      createSparepart: call("createPart"), updateSparepart: call("updatePart"),
    };
    if (name.endsWith("/useSparePartModalStore")) return { useSparePartFormModalStore: () => store };
    return {};
  }
  const code = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, (props: Record<string, unknown>) => Element> };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  const render = () => {
    const draw = () => {
      index = 0; effectIndex = 0;
      let tree = module.exports[exportName]({ onClose() { closed++; }, ...props });
      // The dialog wrapper mounts its private form component.
      if (tree && typeof tree.type === "function") tree = tree.type(tree.props);
      return tree;
    };
    let tree = draw();
    while (effects.length) {
      const queued = effects; effects = []; queued.forEach(fn => fn()); tree = draw();
    }
    return tree;
  };
  return { render, calls, invalidations, query, store, settled: () => pending,
    fail(status: number) { failure = { isAxiosError: true, response: { status } }; },
    get closed() { return closed; },
  };
}

test("group list preserves pagination, search, cancellation and the server's active part count", async (t) => {
  const signal = new AbortController().signal;
  t.mock.method(apiClient, "get", async (url: string, config: { params: unknown; signal: unknown }) => {
    assert.equal(url, "/spare-part-groups");
    assert.deepEqual(config.params, { page: 2, limit: 10, search: "ไฟฟ้า" });
    assert.equal(config.signal, signal);
    return { data: { data: [{ ...group, _count: { spareparts: 8 } }], meta: { page: 2, total: 11, totalPages: 2, limit: 10 } } };
  });
  const result = await getSparepartGroupsPage({ page: 2, limit: 10, search: "ไฟฟ้า" }, signal);
  assert.equal(result.data[0].id, 47);
  assert.equal(result.data[0].sparepartsCount, 8);
  assert.equal(result.meta.total, 11);
});

test("group writes use the real numeric ID, trim names and propagate server rejection", async (t) => {
  t.mock.method(apiClient, "post", async (url: string, payload: unknown) => {
    assert.equal(url, "/spare-part-groups"); assert.deepEqual(payload, { name: group.name }); return { data: group };
  });
  t.mock.method(apiClient, "patch", async (url: string, payload: unknown) => {
    assert.equal(url, "/spare-part-groups/47"); assert.deepEqual(payload, { name: group.name }); return { data: group };
  });
  assert.deepEqual(await createSparepartGroup({ name: ` ${group.name} ` }), group);
  assert.deepEqual(await updateSparepartGroup(47, { name: ` ${group.name} ` }), group);
  const rejection = new Error("Group still contains parts");
  t.mock.method(apiClient, "delete", async (url: string) => { assert.equal(url, "/spare-part-groups/47"); throw rejection; });
  await assert.rejects(deleteSparepartGroup(47), error => error === rejection);
});

for (const editing of [false, true]) {
  test(`group ${editing ? "edit" : "create"} rejects blank names and prevents duplicate submission`, async () => {
    const harness = formHarness("spare-part-group/SparepartGroupFormDialog", "default", { isOpen: true, group: editing ? group : null });
    let tree = harness.render();
    handler(elements(tree).find(n => n.type === "input")!, "onChange")({ target: { value: "   " } });
    tree = harness.render();
    handler(elements(tree).find(n => n.type === "form")!, "onSubmit")({ preventDefault() {} });
    assert.equal(harness.calls.length, 0);
    assert.match(text(harness.render()), /1–100/);
    handler(elements(harness.render()).find(n => n.type === "input")!, "onChange")({ target: { value: "  New group  " } });
    tree = harness.render();
    const submit = handler(elements(tree).find(n => n.type === "form")!, "onSubmit");
    submit({ preventDefault() {} }); submit({ preventDefault() {} });
    await harness.settled();
    assert.deepEqual(harness.calls, [{ operation: editing ? "updateGroup" : "createGroup", args: editing ? [47, { name: "New group" }] : [{ name: "New group" }] }]);
    assert.equal(harness.closed, 1);
    assert.deepEqual(harness.invalidations, [{ queryKey: ["sparepartGroups"] }, { queryKey: ["spareParts"] }]);
  });
}

test("duplicate group name retains the typed value and keeps the dialog open", async () => {
  const harness = formHarness("spare-part-group/SparepartGroupFormDialog", "default", { isOpen: true });
  harness.fail(409);
  handler(elements(harness.render()).find(n => n.type === "input")!, "onChange")({ target: { value: "Duplicate" } });
  handler(elements(harness.render()).find(n => n.type === "form")!, "onSubmit")({ preventDefault() {} });
  await harness.settled();
  const tree = harness.render();
  assert.match(text(tree), /มีอยู่แล้ว/);
  assert.equal(elements(tree).find(n => n.type === "input")?.props.value, "Duplicate");
  assert.equal(harness.closed, 0);
});

test("deletion blocks groups containing parts and handles a newly added part rejected by the server", async () => {
  for (const count of [3, 0]) {
    const harness = formHarness("spare-part-group/SparepartGroupDeleteDialog", "default", { isOpen: true, group: { ...group, sparepartsCount: count } });
    harness.fail(400);
    const button = elements(harness.render()).find(n => n.type === "button" && text(n).includes("ยืนยันการลบ"))!;
    assert.equal(button.props.disabled, count > 0);
    handler(button, "onClick")();
    await harness.settled();
    assert.equal(harness.calls.length, count > 0 ? 0 : 1);
    assert.equal(harness.closed, 0);
    assert.match(text(harness.render()), /อะไหล่ผูก/);
  }
});

test("successful deletion submits once and refreshes group lookups", async () => {
  const harness = formHarness("spare-part-group/SparepartGroupDeleteDialog", "default", { isOpen: true, group });
  const button = elements(harness.render()).find(n => n.type === "button" && text(n).includes("ยืนยันการลบ"))!;
  handler(button, "onClick")(); handler(button, "onClick")();
  await harness.settled();
  assert.deepEqual(harness.calls, [{ operation: "deleteGroup", args: [47] }]);
  assert.equal(harness.closed, 1);
  assert.deepEqual(harness.invalidations, [{ queryKey: ["sparepartGroups"] }]);
});

for (const editing of [false, true]) {
  test(`part ${editing ? "edit" : "create"} blocks missing groups, preserves input on refresh, and sends the selected database ID`, async () => {
    const harness = formHarness("spare-part/SparePartModals", "SparePartFormModal");
    if (editing) harness.store.editItem = { id: 91, name: "Existing", groupId: 47, price: 50, unit: "ชิ้น" };
    harness.query.data = [];
    let tree = harness.render();
    assert.match(text(tree), /ยังไม่มีกลุ่มอะไหล่/);
    const nameInput = elements(tree).find(n => n.type === "input" && n.props.required && !n.props.inputMode)!;
    handler(nameInput, "onChange")({ target: { value: "Typed part" } });
    tree = harness.render();
    handler(elements(tree).find(n => n.type === "form")!, "onSubmit")({ preventDefault() {} });
    assert.equal(harness.calls.length, 0);
    harness.query.data = [group];
    tree = harness.render();
    assert.ok(elements(tree).some(n => n.type === "input" && n.props.value === "Typed part"));
    const select = elements(tree).find(n => n.type === "select")!;
    assert.deepEqual(elements(select).filter(n => n.type === "option" && n.props.value !== "").map(n => n.props.value), [47]);
    handler(select, "onChange")({ target: { value: "47" } });
    tree = harness.render();
    const submit = handler(elements(tree).find(n => n.type === "form")!, "onSubmit");
    submit({ preventDefault() {} }); submit({ preventDefault() {} });
    await harness.settled();
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].operation, editing ? "updatePart" : "createPart");
    const payload = harness.calls[0].args[editing ? 1 : 0] as Record<string, unknown>;
    assert.equal(payload.groupId, 47); assert.equal(payload.category, group.name); assert.equal(payload.name, "Typed part");
  });
}

test("part form never saves cached groups after a lookup error and offers retry", () => {
  const harness = formHarness("spare-part/SparePartModals", "SparePartFormModal");
  harness.store.editItem = { id: 91, name: "Existing", groupId: 47, price: 50 };
  harness.query.isError = true; harness.query.isSuccess = false;
  const tree = harness.render();
  assert.match(text(tree), /โหลดกลุ่มอะไหล่ไม่สำเร็จ/);
  assert.equal(elements(tree).find(n => n.type === "select")?.props.disabled, true);
  assert.equal(elements(tree).find(n => n.props.type === "submit")?.props.disabled, true);
  handler(elements(tree).find(n => n.type === "form")!, "onSubmit")({ preventDefault() {} });
  assert.equal(harness.calls.length, 0);
  handler(elements(tree).find(n => n.type === "button" && text(n).includes("ลองอีกครั้ง"))!, "onClick")();
  assert.equal(harness.calls[0].operation, "refetch");
});
