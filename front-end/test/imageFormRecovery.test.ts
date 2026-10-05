import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

interface Element { type: unknown; props: Record<string, unknown> & { children?: unknown }; }
interface SaveOptions { payload: Record<string, unknown>; upload: unknown; }

function renderForm(file: string, props: Record<string, unknown>) {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let mutation: { mutationFn: (input?: unknown) => Promise<unknown>; onError: (error: unknown) => void };
  let recoveries = 0;
  let mutationInput: unknown;
  let mutationCalls = 0;
  let snapshot: SaveOptions | undefined;
  const imageState = { status: "ready", upload: { uploadId: "upload-1", creationContextToken: "context-1" }, previewUrl: "https://images.test/preview.jpg", fileName: "image.jpg", error: "", accountId: "actor-1" };
  const react = {
    useState(initial: unknown) {
      const i = stateIndex++;
      if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
      return [states[i], (value: unknown) => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useRef(initial: unknown) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); },
    useEffect() {},
    useMemo(fn: () => unknown) { return fn(); },
  };
  const unknownError = Object.assign(new Error("save outcome unknown"), { code: "IMAGE_SAVE_OUTCOME_UNKNOWN" });
  const auth = Object.assign((selector: (state: unknown) => unknown) => selector({ user: { id: "actor-1" } }), { getState: () => ({ user: { id: "actor-1" } }) });
  const roles = { ADMIN: "ADMIN", MANAGER: "MANAGER", ASSET_CENTER_STAFF: "ASSET_CENTER_STAFF", MAINTENANCE_STAFF: "MAINTENANCE_STAFF", PARCEL_STAFF: "PARCEL_STAFF", DEPARTMENT_STAFF: "DEPARTMENT_STAFF", MAINTENANCE_HEAD: "MAINTENANCE_HEAD" };
  function requireMock(name: string): unknown {
    if (name === "react") return { ...react, default: react };
    if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: Element["props"]) => ({ type, props }), jsxs: (type: unknown, props: Element["props"]) => ({ type, props }) };
    if (name === "@tanstack/react-query") return { useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries() {} }), useMutation(options: typeof mutation) { mutation = options; return { isPending: false, mutate(input: unknown) { mutationInput = input; mutationCalls += 1; } }; } };
    if (name.endsWith("useEquipmentModalStore")) return { useEquipmentModalStore: () => ({ isOpen: true, mode: "edit", selectedAsset: { id: "asset-1" }, closeModal() {} }) };
    if (name.endsWith("authStore")) return { useAuthStore: auth };
    if (name.endsWith("useImageUploadSelection")) return { useImageUploadSelection: () => ({ state: imageState, clearSelection() {}, selectFile() {}, markSelectionError() {} }) };
    if (name.endsWith("useEmployeePhoto")) return { useEmployeePhoto: () => ({ status: "missing", url: null }) };
    if (name.endsWith("/roles")) return { ROLES: roles, ROLE_LABELS: {} };
    if (name.endsWith("DialogAddUser")) return { ROLE_OPTIONS: [{ value: "ADMIN", label: "Admin" }] };
    if (name.endsWith("imageUploadService")) return {
      imageOperationErrorMessage: () => "save outcome unknown",
      saveImageAwareForm: async () => { throw unknownError; },
      createImageSaveAttempt(options: SaveOptions) {
        snapshot = options;
        return { hasUpload: Boolean(options.upload), save: async () => { throw unknownError; }, recover: async () => { recoveries += 1; return { id: "saved-1" }; } };
      },
    };
    return new Proxy({ __esModule: true }, { get: (_, key) => key === "__esModule" ? true : () => {} });
  }
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { default?: (props: Record<string, unknown>) => Element } };
  new Function("require", "module", "exports", code)(requireMock, module, module.exports);
  function render(): Element { stateIndex = 0; refIndex = 0; return module.exports.default!(props); }
  return {
    render, imageState,
    async failSave(input?: unknown) { try { await mutation.mutationFn(input); } catch (error) { mutation.onError(error); } },
    async recover() {
      const tree = render();
      const submitForm = elements(tree).find(node => node.type === "form");
      assert.ok(submitForm);
      (submitForm.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
      assert.equal(mutationCalls, 1, "the recovery submit handler must dispatch exactly once");
      return mutation.mutationFn(mutationInput);
    },
    fillAsset() { Object.assign(states[0] as object, { name: "Synthetic", model: "Model", price: "1", receivedDate: "2026-10-05", type_id: "1", section_id: "section-1", company_id: "company-1", owner_id: "actor-1" }); },
    get recoveries() { return recoveries; },
    get snapshot() { return snapshot; },
  };
}

function elements(value: unknown): Element[] {
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...[node.props.children].flat(Infinity).flatMap(elements)];
}

for (const fixture of [
  { name: "Asset", file: "../src/components/equipment-stock/AssetFormModal.tsx", props: {}, asset: true },
  { name: "User create", file: "../src/components/user-management/DialogAddUser.tsx", props: { isOpenAdd: true, onClose() {} }, asset: false },
  { name: "User edit", file: "../src/components/user-management/DialogEditUser.tsx", props: { isOpen: true, onClose() {}, user: { id: "user-1", role: "ADMIN", hasEmployeePhoto: false, photoRevision: null } }, asset: false },
]) {
  test(`${fixture.name} keeps the ready image and offers recovery after an uncertain save`, async () => {
    const form = renderForm(fixture.file, fixture.props);
    form.render();
    if (fixture.asset) form.fillAsset();
    await form.failSave(fixture.asset ? undefined : { payload: { firstname: "Synthetic" }, upload: form.imageState.upload });
    const tree = form.render();
    const submit = elements(tree).find(node => node.type === "button" && node.props.type === "submit");
    assert.ok(submit);
    assert.equal(form.imageState.status, "ready");
    assert.equal(submit.props.disabled, false, "a retained ready upload must have a recovery action");
    assert.match(String(submit.props.children), /ตรวจสอบ.*บันทึก/);
    assert.equal(elements(tree).find(node => node.type === "fieldset")?.props.disabled, true, "the original request stays unchanged during recovery");
    assert.deepEqual(await form.recover(), { id: "saved-1" });
    assert.equal(form.recoveries, 1);
    assert.equal((form.snapshot?.upload as { uploadId: string }).uploadId, "upload-1");
  });
}
