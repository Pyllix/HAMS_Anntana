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
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
  return "";
}
function calendar(minDate?: string, value?: string) {
  const sourceUrl = new URL("../src/components/borrow-return/ThaiDatePicker.tsx", import.meta.url);
  const requireSource = createRequire(sourceUrl);
  const states: unknown[] = [];
  let index = 0;
  let selected: string | undefined;
  const jsx = (type: unknown, props: Element["props"]) => ({ type, props });
  const requireMock = (name: string): unknown => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return {
      useState(initial: unknown) {
        const i = index++;
        // Supply the portal position; geometry and browser event wiring aren't under test.
        if (!(i in states)) states[i] = i === 2 ? { top: 0, left: 0 } : initial;
        return [states[i], (next: unknown) => {
          states[i] = typeof next === "function" ? next(states[i]) : next;
        }];
      },
      useRef: () => ({ current: null }), useEffect() {}, useLayoutEffect() {},
    };
    if (name === "react-dom") return { createPortal: (node: Element) => node };
    if (name === "lucide-react") return {};
    return requireSource(name);
  };
  const code = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as { default: (props: unknown) => Element } };
  new Function("require", "module", "exports", "document", code)(requireMock, module, module.exports, { body: {} });
  const render = () => {
    index = 0;
    return module.exports.default({ minDate, value, onChange: (date: string) => { selected = date; } });
  };
  const trigger = elements(render()).find(n => n.type === "button");
  assert.ok(trigger);
  (trigger.props.onClick as () => void)();
  return { render, get selected() { return selected; } };
}

test("calendar opens on the Thai month and highlights Thai today across a year boundary", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  const picker = calendar();
  const tree = picker.render();
  assert.match(text(tree), /มกราคม 2570/);
  const today = elements(tree).find(n => n.type === "button" && n.props.children === 1);
  assert.ok(today);
  assert.match(String(today.props.className), /border-emerald-500/);
});

test("calendar enforces the provided minimum and emits calendar dates without a timezone shift", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T17:30:00Z") });
  const picker = calendar("2027-01-02");
  const buttons = elements(picker.render());
  const first = buttons.find(n => n.type === "button" && n.props.children === 1);
  const second = buttons.find(n => n.type === "button" && n.props.children === 2);
  assert.equal(first?.props.disabled, true);
  assert.equal(second?.props.disabled, false);
  (second?.props.onClick as () => void)();
  assert.equal(picker.selected, "2027-01-02");

  const selected = calendar(undefined, "2026-12-31");
  assert.match(text(selected.render()), /31 ธันวาคม 2569/);
  const nextMonth = elements(selected.render()).find(n => n.props["aria-label"] === "เดือนถัดไป");
  (nextMonth?.props.onClick as () => void)();
  assert.match(text(selected.render()), /มกราคม 2570/);
});
