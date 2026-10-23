import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

interface CellContext {
  getValue(): string | null;
  row: { original: Record<string, unknown> };
}
interface Column { id?: string; accessorKey?: string; cell(info: CellContext): unknown; }
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object" && "props" in value) {
    return text((value as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function tableColumns(file: string): Column[] {
  const sourceUrl = new URL(`../src/components/${file}.tsx`, import.meta.url);
  const requireSource = createRequire(sourceUrl);
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const requireMock = (name: string): unknown => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-table") return { tableFeatures: () => ({}), createPaginatedRowModel: () => ({}) };
    if (name.endsWith("/thaiDate")) return requireSource(name);
    // Column renderers are exercised without mounting table queries or action buttons.
    return {};
  };
  const code = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as { dateColumns: Column[] } };
  new Function("require", "module", "exports", code + "\nexports.dateColumns = columns;")(requireMock, module, module.exports);
  return module.exports.dateColumns;
}

const tables = [
  { file: "borrow-return/DepartmentBorrowingsTable", ids: ["borrow_date", "due_date"], time: false },
  { file: "borrow-return/PendingApprovalTable", ids: ["createdAt", "expectedReturnDate"], time: true },
  { file: "borrow-return/PendingHandoverTable", ids: ["approved_at", "expectedReturnDate"], time: true },
  { file: "borrow-return/PendingPickupTable", ids: ["return_date"], time: true },
  { file: "borrow-return/PendingCompleteReturnTable", ids: ["return_date"], time: true },
  { file: "borrow-return/PendingExtensionTable", ids: ["dates"], time: false },
  { file: "borrow-history/AssetsHistoryTable", ids: ["handover_date", "return_date"], time: true },
];

for (const { file, ids, time } of tables) {
  test(`${file} renders actual date cells in Thailand including midnight and missing values`, () => {
    const columns = tableColumns(file);
    for (const id of ids) {
      const column = columns.find(c => (c.accessorKey ?? c.id) === id);
      assert.ok(column, `date column ${id} exists`);
      for (const [value, date, clock] of [
        ["2026-12-31T17:30:00.000Z", "01 ม.ค. 2570", "00:30"],
        ["2026-10-25T16:59:59.999Z", "25 ต.ค. 2569", "23:59"],
      ]) {
        const output = renderCell(column, value);
        assert.ok(output.includes(date), `${id}: ${output} must include ${date}`);
        if (time) assert.ok(output.includes(clock), `${id}: ${output} must include ${clock}`);
      }
      for (const value of [null, "invalid"]) {
        const output = renderCell(column, value);
        assert.match(output, /^-+$/, `${id}: missing or invalid dates show a dash`);
      }
    }
  });
}

function renderCell(column: Column, value: string | null): string {
  const row = Object.fromEntries([
    "handover_date", "createdAt", "expectedReturnDate", "currentReturnDate", "requestedReturnDate",
  ].map(key => [key, value]));
  return text(column.cell({ getValue: () => value, row: { original: row } })).replace(/\s+/g, " ").trim();
}
