import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

interface Element { type: unknown; props: Record<string, unknown> & { children?: unknown }; }
function elements(value: unknown): Element[] {
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...[node.props.children].flat(Infinity).flatMap(elements)];
}

function load(file: string, names: string[]) {
  const sourceUrl = new URL(`../src/components/${file}.tsx`, import.meta.url);
  const requireSource = createRequire(sourceUrl);
  const states: unknown[] = [];
  const updates: Array<{ id: string; payload: unknown }> = [];
  let save: Promise<unknown> | undefined;
  let index = 0;
  let firstRender = true;
  const effects: Array<() => void> = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const react = {
    useState(initial: unknown) {
      const i = index++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (value: unknown) => { states[i] = value; }];
    },
    useEffect(fn: () => void) { if (firstRender) effects.push(fn); },
  };
  function requireMock(name: string): unknown {
    if (name === "react") return { ...react, default: react };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name.endsWith("/thaiDate")) return requireSource(name);
    if (name.endsWith("/useDisposalModalStore")) return {
      useDisposalModalStore: () => ({ isMarkLostOpen: true, markLostAsset: { id: "asset-1", name: "Test" } }),
    };
    if (name === "@tanstack/react-query") return {
      useQueryClient: () => ({}),
      useMutation: (options: { mutationFn(): Promise<unknown> }) => ({ mutate() { save = options.mutationFn(); } }),
    };
    if (name.endsWith("/assetService")) return {
      getAssetStatuses: async () => [{ id: 6, code: "LOST" }],
      updateAsset: async (id: string, payload: unknown) => { updates.push({ id, payload }); },
    };
    return {};
  }
  const code = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  new Function("require", "module", "exports", code + names.map(n => `\nexports.${n} = ${n};`).join(""))(requireMock, module, module.exports);
  return {
    functions: module.exports,
    updates,
    saved: () => save,
    render() {
      index = 0;
      module.exports.default();
      if (firstRender) effects.forEach(fn => fn());
      firstRender = false;
      index = 0;
      return module.exports.default() as Element;
    },
  };
}

test("lost asset form has no unsupported date field and still submits location and reason", async () => {
  const modal = load("equipment-stock/ConfirmLostModal", []);
  let nodes = elements(modal.render());
  assert.equal(nodes.some(n => n.type === "input" && n.props.type === "date"), false);
  const location = nodes.find(n => n.type === "input" && n.props.type === "text");
  const reason = nodes.find(n => n.type === "textarea");
  assert.ok(location);
  assert.ok(reason);
  assert.equal(location.props.required, true);
  assert.equal(reason.props.required, true);
  (location.props.onChange as (event: unknown) => void)({ target: { value: "  ICU  " } });
  (reason.props.onChange as (event: unknown) => void)({ target: { value: "  หาไม่พบระหว่างตรวจนับ  " } });
  nodes = elements(modal.render());
  const form = nodes.find(n => n.type === "form");
  assert.ok(form);
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await modal.saved();
  assert.deepEqual(modal.updates, [{ id: "asset-1", payload: {
    asset_status_id: 6,
    remark: "หาไม่พบระหว่างตรวจนับ | สถานที่ล่าสุด: ICU",
  } }]);
});

for (const file of ["equipment-stock/ConfirmLostModal", "equipment-stock/EquipmentDetailModal", "asset-stock/AssetDetailModal"]) {
  test(`${file} preserves receipt and warranty calendar dates independently of the machine timezone`, () => {
    const { formatThaiDate } = load(file, ["formatThaiDate"]).functions;
    for (const value of ["2026-10-23", "2026-10-23T00:00:00.000Z"]) {
      assert.match(formatThaiDate(value), /23/);
      assert.match(formatThaiDate(value), /2569/);
    }
    for (const value of [null, "invalid", "2026-02-30"]) assert.equal(formatThaiDate(value), "-");
  });
}

test("equipment warranty uses a full Thai calendar date while repair history uses the actual timestamp", () => {
  const { formatThaiFullDate, formatHistoryDate } = load("equipment-stock/EquipmentDetailModal", ["formatThaiFullDate", "formatHistoryDate"]).functions;
  assert.equal(formatThaiFullDate("2028-02-29"), "29 กุมภาพันธ์ 2571");
  assert.equal(formatHistoryDate("2026-12-31T17:30:00.000Z"), "01 ม.ค. 2570");
});

test("warranty stays active through its selected Thai calendar day", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-23T16:59:59.999Z") });
  const { isWarrantyActive } = load("asset-stock/AssetDetailModal", ["isWarrantyActive"]).functions;
  assert.equal(isWarrantyActive("2026-10-23"), true);
  t.mock.timers.setTime(new Date("2026-10-23T17:00:00Z").getTime());
  assert.equal(isWarrantyActive("2026-10-23"), false);
  assert.equal(isWarrantyActive("invalid"), false);
});

test("asset usage year and month follow the Thai calendar at a year boundary", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  const { calculateUsageTime } = load("asset-stock/AssetDetailModal", ["calculateUsageTime"]).functions;
  assert.equal(calculateUsageTime("2026-01-01T00:00:00.000Z"), "1 ปี");
});
