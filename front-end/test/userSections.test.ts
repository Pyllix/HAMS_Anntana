import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { ROLES } from "../src/router/roles";

interface Element {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

const sectionId = "94037db6-e299-49de-98a1-bfc82a9f5ecb";
const sections = [{ id: sectionId, name: "หน่วยงานทดสอบ" }];

function elements(value: unknown): Element[] {
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...[node.props.children].flat(Infinity).flatMap(elements)];
}

function harness(file: string, initialProps: Record<string, unknown>) {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const lookups: unknown[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let payload: Record<string, unknown> | undefined;
  let tree: Element | null;
  let props = initialProps;
  const account = { user: { id: "actor-1" } };
  const auth = Object.assign((select: (state: typeof account) => unknown) => select(account), {
    getState: () => account,
  });
  const react = {
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useEffect() {},
  };
  const jsx = (type: unknown, elementProps: Element["props"]) => ({ type, props: elementProps });
  const requireMock = (name: string): unknown => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "lucide-react") return { X() {}, Eye() {}, EyeOff() {} };
    if (name === "@tanstack/react-query") return {
      useQuery(options: { queryKey: unknown[]; enabled?: boolean; queryFn(): unknown }) {
        if (options.enabled !== false) options.queryFn();
        return { data: options.queryKey[0] === "sections" ? sections : options.queryKey[1] ? sections[0] : undefined };
      },
      useQueryClient: () => ({ invalidateQueries() {} }),
      useMutation: () => ({
        isPending: false,
        mutate(input: { payload: Record<string, unknown> }) { payload = input.payload; },
      }),
    };
    if (name.endsWith("sectionService")) return {
      getSectionById(id: unknown) { lookups.push(id); return sections[0]; },
    };
    if (name.endsWith("assetService")) return { getSections: () => sections };
    if (name.endsWith("userService")) return {};
    if (name.endsWith("/roles")) return { ROLES, ROLE_LABELS: {} };
    if (name.endsWith("DialogAddUser")) return {
      ROLE_OPTIONS: Object.values(ROLES).map(value => ({ value, label: value })),
    };
    if (name.endsWith("authStore")) return { useAuthStore: auth };
    if (name.endsWith("useImageUploadSelection")) return {
      useImageUploadSelection: () => ({ state: { status: "idle" }, clearSelection() {} }),
    };
    if (name.endsWith("useEmployeePhoto")) return { useEmployeePhoto: () => ({ status: "missing" }) };
    if (name.endsWith("imageUploadService")) return {};
    if (name.endsWith("ImageUploadField") || name.endsWith("EmployeePhotoDisplay")) return { default() {} };
    throw new Error(`Unexpected import: ${name}`);
  };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as { default: (props: Record<string, unknown>) => Element | null } };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  function render(nextProps = props) {
    props = nextProps;
    stateIndex = refIndex = 0;
    tree = module.exports.default(props);
    return tree;
  }
  function field(name: string) {
    const element = elements(tree).find(node => node.props.name === name);
    assert.ok(element, `Missing field: ${name}`);
    return element;
  }
  return {
    render, lookups, field,
    change(name: string, value: string) {
      const input = field(name);
      (input.props.onChange as (event: unknown) => void)({ target: { name, value } });
      render();
    },
    submit() {
      const form = elements(tree).find(node => node.type === "form");
      assert.ok(form);
      (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
      render();
      return payload;
    },
  };
}

for (const mode of ["create", "edit"] as const) {
  function form(role: string = ROLES.ADMIN, savedSection: string | null = null) {
    const result = harness(`../src/components/user-management/Dialog${mode === "create" ? "Add" : "Edit"}User.tsx`,
      mode === "create" ? { isOpenAdd: true, onClose() {} } : {
        isOpen: true, onClose() {}, user: {
          id: "user-1", role, section_id: savedSection, firstname: "Test", lastname: "Admin",
          userName: "test-admin", email: "admin@example.test",
        },
      });
    result.render();
    if (mode === "create") result.change("role", role);
    return result;
  }

  test(`${mode}: ADMIN can select an optional section and submit it`, () => {
    const dialog = form();
    assert.notEqual(dialog.field("sectionId").props.disabled, true);
    assert.equal(dialog.field("sectionId").props.required, false);
    dialog.change("sectionId", sectionId);
    assert.equal(dialog.field("sectionId").props.value, sectionId);
    assert.equal(dialog.submit()?.sectionId, sectionId);
  });

  test(`${mode}: ADMIN can save without a section`, () => {
    const payload = form().submit();
    assert.ok(payload);
    assert.equal(payload.sectionId, mode === "create" ? undefined : null);
  });

  for (const role of Object.values(ROLES).filter(role => role !== ROLES.ADMIN)) {
    test(`${mode}: ${role} still requires a section`, () => {
      const dialog = form(role);
      assert.equal(dialog.field("sectionId").props.required, true);
      assert.equal(dialog.submit(), undefined);
      dialog.change("sectionId", sectionId);
      assert.equal(dialog.submit()?.sectionId, sectionId);
    });
  }

  if (mode === "edit") {
    test("edit: ADMIN's saved section stays visible and is preserved on save", () => {
      const dialog = form(ROLES.ADMIN, sectionId);
      assert.equal(dialog.field("sectionId").props.value, sectionId);
      assert.equal(dialog.submit()?.sectionId, sectionId);
    });
    test("edit: ADMIN can clear a saved section with explicit null", () => {
      const dialog = form(ROLES.ADMIN, sectionId);
      dialog.change("sectionId", "");
      assert.equal(dialog.submit()?.sectionId, null);
    });
    test("edit: switching a sectionless ADMIN to a staff role requires selecting a section", () => {
      const dialog = form();
      dialog.change("role", ROLES.DEPARTMENT_STAFF);
      assert.equal(dialog.submit(), undefined);
      dialog.change("sectionId", sectionId);
      assert.equal(dialog.submit()?.sectionId, sectionId);
    });
  }
}

for (const component of ["table-compnent/Section", "DialogDetailUser"]) {
  const props = (id: string | null | undefined) => component === "DialogDetailUser"
    ? { isOpen: true, onClose() {}, user: { id: "user-1", role: ROLES.ADMIN, section_id: id } }
    : { sectionId: id };
  for (const id of [null, undefined, ""]) {
    test(`${component}: missing section (${String(id)}) does not fetch /sections/${String(id)}`, () => {
      const view = harness(`../src/components/user-management/${component}.tsx`, props(id));
      const tree = view.render();
      assert.deepEqual(view.lookups, []);
      assert.ok(elements(tree).some(node => node.props.children === "ไม่ระบุหน่วยงาน"));
    });
  }
  test(`${component}: a real section ID is fetched and its name is displayed`, () => {
    const view = harness(`../src/components/user-management/${component}.tsx`, props(sectionId));
    const tree = view.render();
    assert.deepEqual(view.lookups, [sectionId]);
    assert.ok(elements(tree).some(node => node.props.children === sections[0].name));
  });
}

test("closed user details does not fetch the section", () => {
  const view = harness("../src/components/user-management/DialogDetailUser.tsx", {
    isOpen: false, user: { section_id: sectionId }, onClose() {},
  });
  assert.equal(view.render(), null);
  assert.deepEqual(view.lookups, []);
});

test("user details handles closing and reopening without a selected user", () => {
  const view = harness("../src/components/user-management/DialogDetailUser.tsx", {
    isOpen: false, user: null, onClose() {},
  });
  assert.equal(view.render(), null);
  assert.deepEqual(view.lookups, []);
  view.render({ isOpen: true, user: { role: ROLES.ADMIN, section_id: sectionId }, onClose() {} });
  assert.deepEqual(view.lookups, [sectionId]);
  const tree = view.render({ isOpen: true, user: { role: ROLES.ADMIN, section_id: null }, onClose() {} });
  assert.deepEqual(view.lookups, [sectionId]);
  assert.ok(elements(tree).some(node => node.props.children === "ไม่ระบุหน่วยงาน"));
});
