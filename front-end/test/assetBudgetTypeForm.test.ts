import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

interface Element { type: unknown; props: Record<string, unknown> & { children?: unknown }; }
const budgets = [{ id: 1, name: "เงินรายได้" }, { id: 2, name: "เงินบริจาค" }];
function elements(value: unknown): Element[] {
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...[node.props.children].flat(Infinity).flatMap(elements)];
}
function formHarness(mode: "create" | "edit" = "create", savedBudget = "เงินบริจาค") {
  const states: unknown[] = [], refs: Array<{ current: unknown }> = [];
  const effectDeps: Array<readonly unknown[] | undefined> = [];
  let si = 0, ri = 0, ei = 0, dirty = false;
  let effects: Array<() => void> = [];
  let status: "pending" | "success" | "error" = "pending";
  let rows: typeof budgets = [];
  let payload: Record<string, unknown> | undefined;
  let mutation: { mutationFn(): Promise<unknown> };
  const selectedAsset = mode === "edit" ? { id: "asset-1", budgetType: savedBudget } : null;
  const lookups: Record<string, unknown[]> = {
    assetTypes: [{ id: 1 }], assetStatuses: [{ id: 1, code: "NORMAL" }],
    availabilities: [{ id: 1, code: "AVAILABLE" }], sections: [{ id: "section-1" }],
    companies: [{ id: "company-1" }], acqTypes: [{ id: 1, name: "จัดซื้อ" }],
    equipmentTypes: [], users: [{ id: "actor-1" }],
  };
  const react = {
    useState(initial: unknown) {
      const i = si++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (value: unknown) => {
        const next = typeof value === "function" ? value(states[i]) : value;
        if (!Object.is(next, states[i])) { states[i] = next; dirty = true; }
      }];
    },
    useRef(initial: unknown) { const i = ri++; return refs[i] ?? (refs[i] = { current: initial }); },
    useMemo(fn: () => unknown) { return fn(); },
    useEffect(fn: () => void, deps?: readonly unknown[]) {
      const i = ei++, previous = effectDeps[i];
      if (!deps || !previous || deps.some((v, n) => !Object.is(v, previous[n]))) effects.push(fn);
      effectDeps[i] = deps;
    },
  };
  const auth = Object.assign((select: (s: unknown) => unknown) => select({ user: { id: "actor-1" } }), { getState: () => ({ user: { id: "actor-1" } }) });
  function requireMock(name: string): unknown {
    if (name === "react") return { ...react, default: react };
    if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: Element["props"]) => ({ type, props }), jsxs: (type: unknown, props: Element["props"]) => ({ type, props }) };
    if (name === "@tanstack/react-query") return {
      useQuery({ queryKey }: { queryKey: string[] }) {
        return queryKey[0] === "budgetTypes" ? {
          data: rows, isSuccess: status === "success", isError: status === "error", isPending: status === "pending", refetch() {},
        } : { data: lookups[queryKey[0]] };
      },
      useQueryClient: () => ({ invalidateQueries() {} }),
      useMutation(options: typeof mutation) { mutation = options; return { isPending: false, mutate() {} }; },
    };
    if (name.endsWith("useEquipmentModalStore")) return { useEquipmentModalStore: () => ({ isOpen: true, mode, selectedAsset, closeModal() {} }) };
    if (name.endsWith("authStore")) return { useAuthStore: auth };
    if (name.endsWith("useImageUploadSelection")) return { useImageUploadSelection: () => ({ state: { status: "idle" } }) };
    if (name.endsWith("imageUploadService")) return {
      createImageSaveAttempt(options: { payload: Record<string, unknown> }) {
        payload = options.payload;
        return { save: async () => ({ id: "saved-1" }) };
      },
    };
    return new Proxy({ __esModule: true }, { get: (_, key) => key === "__esModule" ? true : () => {} });
  }
  const source = readFileSync(new URL("../src/components/equipment-stock/AssetFormModal.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { default: () => Element } };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  function render(): Element {
    for (let count = 0; count < 30; count++) {
      si = ri = ei = 0; dirty = false; effects = [];
      const tree = module.exports.default();
      effects.forEach(fn => fn());
      if (!dirty) return tree;
    }
    throw new Error("Form effects did not settle");
  }
  function budgetSelect(): Element {
    const select = elements(render()).find(n => n.type === "select" && elements(n).some(o => o.type === "option" && (o.props.value === "เงินรายได้" || o.props.value === savedBudget)));
    assert.ok(select); return select;
  }
  return {
    render, budgetSelect,
    load(next = budgets) { rows = next; status = "success"; return render(); },
    fail() { status = "error"; return render(); },
    choose(value: string) { (budgetSelect().props.onChange as (e: unknown) => void)({ target: { value } }); render(); },
    fill() { Object.assign(states[0] as object, { name: "Synthetic", model: "Model", price: "25", receivedDate: "2026-10-23", type_id: "1", section_id: "section-1", company_id: "company-1", owner_id: "actor-1" }); render(); },
    save() { render(); return mutation.mutationFn(); },
    get payload() { return payload; },
  };
}
function submitDisabled(tree: Element) {
  return elements(tree).find(n => n.type === "button" && n.props.type === "submit")?.props.disabled;
}

test("late budget lookup uses the displayed real option in the create payload", async () => {
  const form = formHarness(); form.render(); form.fill(); form.load();
  assert.equal(form.budgetSelect().props.value, "เงินรายได้");
  await form.save();
  assert.equal(form.payload?.budgetType, "เงินรายได้");
});
test("loading, lookup errors and an empty budget catalog block saves without inventing a value", async () => {
  const form = formHarness(); form.render(); form.fill();
  assert.equal(submitDisabled(form.render()), true);
  await assert.rejects(form.save(), /ประเภทเงิน/);
  assert.equal(submitDisabled(form.fail()), true);
  await assert.rejects(form.save(), /ประเภทเงิน/);
  assert.equal(submitDisabled(form.load([])), true);
  await assert.rejects(form.save(), /ประเภทเงิน/);
  assert.equal(form.payload, undefined);
});
test("a user selection survives lookup refresh and is the exact submitted value", async () => {
  const form = formHarness(); form.render(); form.load(); form.fill(); form.choose("เงินบริจาค");
  form.load([...budgets].reverse());
  assert.equal(form.budgetSelect().props.value, "เงินบริจาค");
  await form.save(); assert.equal(form.payload?.budgetType, "เงินบริจาค");
});
test("edit preserves the stored budget when lookups arrive later", async () => {
  const form = formHarness("edit"); form.render(); form.fill(); form.load();
  assert.equal(form.budgetSelect().props.value, "เงินบริจาค");
  await form.save(); assert.equal(form.payload?.budgetType, "เงินบริจาค");
});
test("an old budget absent from the catalog stays visible until the user corrects it", async () => {
  const form = formHarness("edit", "เงินงบประมาณ"); form.render(); form.fill(); form.load();
  const select = form.budgetSelect();
  assert.equal(select.props.value, "เงินงบประมาณ");
  assert.ok(elements(select).some(n => n.type === "option" && n.props.value === "เงินงบประมาณ"));
  assert.equal(submitDisabled(form.render()), true);
  await assert.rejects(form.save(), /ประเภทเงิน/);
  form.choose("เงินบริจาค"); await form.save();
  assert.equal(form.payload?.budgetType, "เงินบริจาค");
});
