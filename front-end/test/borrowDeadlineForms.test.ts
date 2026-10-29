import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

interface Element {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function elements(value: unknown): Element[] {
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...[node.props.children].flat(Infinity).flatMap(elements)];
}

// Exercise each real form's date selection and submit handler, capturing its API payload.
function borrowFormHarness(formName: string, currentReturnDate = "2026-10-24T16:59:59.999Z") {
  const sourceUrl = new URL(`../src/components/borrow-return/${formName}.tsx`, import.meta.url);
  const requireSource = createRequire(sourceUrl);
  const states: unknown[] = [];
  let stateIndex = 0;
  let payload: Record<string, unknown> | undefined;
  const user = { id: "borrower-1", firstname: "Test", lastname: "Borrower", section_id: "center" };
  const asset = { id: "asset-1", name: "Test device", section: { name: "Center" } };
  const store = {
    user, selectedAsset: asset, closeForm() {},
    selectedTransaction: { id: "borrow-1", asset, expectedReturnDate: currentReturnDate },
  };
  const useStore = (select?: (s: typeof store) => unknown) => select ? select(store) : store;
  function requireMock(name: string): unknown {
    if (name === "react") return {
      useMemo: (fn: () => unknown) => fn(),
      useState(initial: unknown) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], (value: unknown) => { states[index] = value; }];
      },
    };
    if (name === "react/jsx-runtime") {
      const jsx = (type: unknown, props: Element["props"]) => ({ type, props });
      return { jsx, jsxs: jsx };
    }
    if (name === "lucide-react") return {};
    if (name === "@tanstack/react-query") return {
      useQueryClient: () => ({ invalidateQueries() {} }),
      useQuery: ({ queryKey }: { queryKey: string[] }) => ({
        data: queryKey[0] === "user" ? user : [{ id: "center", name: "Center" }], refetch() {},
      }),
      useMutation: () => ({
        isPending: false,
        mutate(value: Record<string, unknown>) { payload = value; },
      }),
    };
    if (name.includes("/stores/")) {
      const exportedName = name.slice(name.lastIndexOf("/") + 1);
      if (exportedName === "authStore") return { useAuthStore: useStore };
      if (exportedName === "useToastStore") return { useToastStore: () => () => {} };
      return { [exportedName]: useStore };
    }
    if (name.endsWith("/borrowService")) return { DELIVERY_METHOD_LABELS: {} };
    if (name.endsWith("/userService")) return { getUserById() {} };
    if (name.endsWith("/assetService")) return { getSections() {} };
    if (name.endsWith("/sessionDraftStorage")) return { clearSessionDraft() {} };
    if (name.endsWith("/useSessionDraft")) return { useSessionDraft() {} };
    if (name === "./ThaiDatePicker") return { default: "date-picker" };
    return requireSource(name);
  }
  const code = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as { default: () => Element } };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  const render = () => { stateIndex = 0; return module.exports.default(); };
  return { render, get payload() { return payload; } };
}

function submitDeadline(formName: string, selectedDate: string): string {
  const harness = borrowFormHarness(formName);
  const render = harness.render;
  let tree = render();
  const picker = elements(tree).find(n => n.props.id === "expectedReturnDate" || n.props.id === "requestedReturnDate");
  assert.ok(picker, "date picker is rendered");
  (picker.props.onChange as (value: string) => void)(selectedDate);
  const reason = elements(tree).find(n => n.type === "textarea");
  if (reason) (reason.props.onChange as (e: unknown) => void)({ target: { value: "Extend for testing" } });
  tree = render();
  const form = elements(tree).find(n => n.type === "form");
  assert.ok(form, "submit form is rendered");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  const payload = harness.payload;
  assert.ok(payload, "API mutation was called");
  const data = payload.data as Record<string, unknown> | undefined;
  return String(data?.requestedReturnDate ?? payload.expectedReturnDate);
}

test("borrow and return form defaults use today's date and time in Thailand", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  const borrowing = elements(borrowFormHarness("BorrowModal").render());
  assert.equal(borrowing.find(n => n.type === "input" && n.props.type === "date")?.props.defaultValue, "2027-01-01");
  assert.equal(borrowing.find(n => n.type === "input" && n.props.type === "time")?.props.defaultValue, "00:30");
  const returning = elements(borrowFormHarness("ReturnModal").render());
  assert.equal(returning.find(n => n.type === "input" && n.props.type === "date")?.props.value, "2027-01-01");
  assert.equal(returning.find(n => n.type === "input" && n.props.type === "time")?.props.value, "00:30");
});

test("self borrowing starts tomorrow in Thailand across midnight, year and leap-day boundaries", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  for (const [now, tomorrow] of [
    ["2026-10-22T17:00:00Z", "2026-10-24"],
    ["2026-10-23T01:00:00Z", "2026-10-24"],
    ["2026-12-31T17:30:00Z", "2027-01-02"],
    ["2028-02-28T17:00:00Z", "2028-03-01"],
  ]) {
    t.mock.timers.setTime(new Date(now).getTime());
    const tree = borrowFormHarness("SelfBorrowModal").render();
    assert.equal(elements(tree).find(n => n.props.id === "expectedReturnDate")?.props.minDate, tomorrow);
  }
});

test("extension minimum is the Thai calendar day after the later of today and the current deadline", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  for (const [current, minimum] of [
    ["2027-01-03T16:59:59.999Z", "2027-01-04"],
    ["2027-01-01T16:59:59.999Z", "2027-01-02"],
    ["2026-12-30T16:59:59.999Z", "2027-01-02"],
    ["", "2027-01-02"],
    ["invalid", "2027-01-02"],
  ]) {
    const tree = borrowFormHarness("RequestExtensionModal", current).render();
    assert.equal(elements(tree).find(n => n.props.id === "requestedReturnDate")?.props.minDate, minimum);
  }
});

for (const form of ["SelfBorrowModal", "BorrowModal", "RequestExtensionModal"]) {
  test(`${form} submits the selected Thai calendar day's final instant`, () => {
    for (const [day, utc] of [
      ["2026-10-25", "2026-10-25T16:59:59.999Z"],
      ["2026-12-31", "2026-12-31T16:59:59.999Z"],
      ["2028-02-29", "2028-02-29T16:59:59.999Z"],
    ]) {
      const actual = submitDeadline(form, day);
      assert.equal(actual, utc);
      const deadline = new Date(actual);
      const thaiDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(date);
      assert.equal(thaiDay(deadline), day, "displayed Thai date matches the selected date");
      assert.notEqual(thaiDay(new Date(deadline.getTime() + 1)), day, "overdue boundary is next day's midnight");
    }
  });
}
