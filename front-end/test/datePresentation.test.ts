import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as thaiDates from "../src/services/thaiDate";
import { repairDueDate } from "../src/services/repairDates";

// Execute the real presentation function while leaving unrelated page queries unmounted.
function presentation(file: string, name: string): (...args: unknown[]) => any {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | ts.VariableDeclaration | undefined;
  function walk(node: ts.Node) {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(tree) === name) declaration = node;
    ts.forEachChild(node, walk);
  }
  walk(tree);
  assert.ok(declaration, `${file}: ${name} exists`);
  const snippet = ts.isVariableDeclaration(declaration) ? `const ${declaration.getText(tree)};` : declaration.getText(tree);
  const code = ts.transpileModule(snippet, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(thaiDates), `${code}\nreturn ${name};`)(...Object.values(thaiDates));
}

for (const [file, name, args] of [
  ["components/accept-work/PendingEvaluationTable.tsx", "formatDateTH", []],
  ["components/asset-stock/AssetRepairHistoryModal.tsx", "formatThaiDate", []],
  ["components/repair-history/RepairHistoryTable.tsx", "formatDateTH", []],
  ["components/spare-part/SparePartModals.tsx", "formatDateTime", []],
  ["pages/WithdrawalReport.tsx", "formatDateTimeTH", []],
  ["services/assetPrintService.ts", "formatDate", [true]],
  ["services/maintenanceReportPrintService.ts", "formatDate", [true]],
  ["components/borrow-return/RequestExtensionModal.tsx", "formatThaiDate", []],
] as const) {
  test(`${file} shows the Thai day at a UTC year boundary`, () => {
    const format = presentation(file, name);
    const result = String(format("2026-12-31T17:30:00Z", ...args));
    assert.match(result, /2570/);
    assert.match(result, /ม\.ค\.|มกราคม/);
    if (args.length) assert.match(result, /00:30/);
  });
}

test("maintenance period dates and report labels cover the Thai day and leap month", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  assert.equal(presentation("pages/MaintenanceReports.tsx", "localDateValue")(), "2027-01-01");
  assert.equal(presentation("pages/MaintenanceReports.tsx", "localMonthValue")(), "2027-01");
  const build = presentation("pages/MaintenanceReports.tsx", "buildPeriod");
  const day = build("DAY", "2027-01-01");
  assert.equal(day.startDate.toISOString(), "2026-12-31T17:00:00.000Z");
  assert.equal(day.endDate.toISOString(), "2027-01-01T16:59:59.999Z");
  const month = build("MONTH", "2028-02");
  assert.equal(month.startDate.toISOString(), "2028-01-31T17:00:00.000Z");
  assert.equal(month.endDate.toISOString(), "2028-02-29T16:59:59.999Z");
  assert.match(month.label, /กุมภาพันธ์ 2571/);
});

test("repair assessment adds calendar days from Thai today, preserving explicit date selections", () => {
  const now = new Date("2026-12-31T17:30:00Z");
  assert.equal(repairDueDate("", now), "2027-01-01");
  assert.equal(repairDueDate("2", now), "2027-01-03");
  assert.equal(repairDueDate(2, now), "2027-01-03");
  assert.equal(repairDueDate("2028-02-29", now), "2028-02-29");
});

test("repair confirmation default and print warranty expiry use the Thai calendar", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-23T16:59:59.999Z") });
  assert.equal(presentation("components/confirm-repair/ConfirmRepairDialog.tsx", "localDateString")(), "2026-10-23");
  const warranty = presentation("services/assetPrintService.ts", "getWarrantyHtml");
  assert.match(warranty("2026-10-23"), /ในประกัน/);
  t.mock.timers.setTime(new Date("2026-10-23T17:00:00Z").getTime());
  assert.match(warranty("2026-10-23"), /หมดประกัน/);
});
