import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "../../types/TypeUser";
import { getUserById, updateUserById, type UserUpdateDto } from "../../services/userService";
import { getSections } from "../../services/assetService";
import { ROLES, ROLE_LABELS, type RoleType } from "../../router/roles";
import { ROLE_OPTIONS } from "./DialogAddUser";
import { useAuthStore } from "../../stores/authStore";
import { useImageUploadSelection } from "../../hooks/useImageUploadSelection";
import { useEmployeePhoto } from "../../hooks/useEmployeePhoto";
import ImageUploadField from "../shared/ImageUploadField";
import {
  clearEmployeePhotoGrantCache,
  imageOperationErrorMessage,
  saveImageAwareForm,
  type VerifiedImageUpload,
} from "../../services/imageUploadService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const EDIT_ROLE_OPTIONS = [
  ...ROLE_OPTIONS,
  {
    value: ROLES.MAINTENANCE_HEAD,
    label: ROLE_LABELS.MAINTENANCE_HEAD,
    description: "สิทธิ์การใช้งาน: มอบหมายและกำกับดูแลงานซ่อมบำรุง",
  },
];

function editErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { code?: string; message?: string } } })
    .response?.data;
  if (data?.code === "LAST_ACTIVE_ENROLLED_ADMIN") {
    return "บันทึกไม่ได้ เพราะไม่สามารถลดสิทธิ์หรือระงับ ADMIN คนสุดท้ายที่เปิดใช้ 2FA ได้";
  }
  return typeof data?.message === "string"
    ? data.message
    : "บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}

const toForm = (user: User) => ({
  firstname: user.firstname ?? "",
  lastname: user.lastname ?? "",
  userName: user.userName ?? "",
  email: user.email ?? "",
  sectionId: user.section_id ?? "",
  role: user.role as RoleType,
  banned: user.banned === true,
});

export default function DialogEditUser({ isOpen, onClose, user }: Props) {
  const [form, setForm] = useState(() => toForm(user));
  const [error, setError] = useState("");
  const [saveOutcomeUnknown, setSaveOutcomeUnknown] = useState(false);
  const submitStartedRef = useRef(false);
  const wasOpenRef = useRef(false);

  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const imageSelection = useImageUploadSelection({
    purpose: "EMPLOYEE_PHOTO",
    targetId: user.id,
    enabled: isOpen,
  });
  const currentPhoto = useEmployeePhoto(
    user.id,
    user.hasEmployeePhoto,
    user.photoRevision,
    isOpen,
  );

  // รีเซ็ตฟอร์มให้ตรงกับข้อมูลผู้ใช้ล่าสุดทุกครั้งที่เปิด dialog
  useEffect(() => {
    if (isOpen) {
      setForm(toForm(user));
      setError("");
      if (!wasOpenRef.current) {
        setSaveOutcomeUnknown(false);
        submitStartedRef.current = false;
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, user]);

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => getSections(),
    enabled: isOpen,
  });

  const { mutate: editUser, isPending } = useMutation({
    mutationFn: async (input: { payload: UserUpdateDto; upload: VerifiedImageUpload | null }) => {
      if (!accountId || useAuthStore.getState().user?.id !== accountId) {
        throw new Error("เซสชันผู้ใช้เปลี่ยนแล้ว กรุณาเปิดฟอร์มอีกครั้งก่อนบันทึก");
      }
      return saveImageAwareForm({
        creating: false,
        targetId: user.id,
        payload: input.payload as unknown as Record<string, unknown>,
        upload: input.upload,
        create: (payload) => updateUserById(user.id, payload as never),
        update: (id, payload) => updateUserById(id, payload as never),
        loadRecord: getUserById,
      });
    },
    onSuccess: async (savedUser) => {
      submitStartedRef.current = false;
      setSaveOutcomeUnknown(false);
      imageSelection.clearSelection();
      clearEmployeePhotoGrantCache(accountId, user.id);
      if (accountId === user.id) {
        useAuthStore.getState().updateUserPhoto({
          hasEmployeePhoto: savedUser.hasEmployeePhoto,
          photoRevision: savedUser.photoRevision,
          imageUrl: savedUser.imageUrl,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (cause) => {
      submitStartedRef.current = false;
      setSaveOutcomeUnknown((cause as { code?: string })?.code === "IMAGE_SAVE_OUTCOME_UNKNOWN");
      const code = (cause as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const message = imageOperationErrorMessage(cause, editErrorMessage(cause));
      if (code === "UPLOAD_EXPIRED" || code === "UPLOAD_NOT_FOUND") {
        imageSelection.markSelectionError(message);
      }
      setError(message);
    },
  });

  if (!isOpen) return null;

  const selectedRole =
    EDIT_ROLE_OPTIONS.find((option) => option.value === form.role) ?? EDIT_ROLE_OPTIONS[0];

  // ผู้ดูแลระบบไม่จำเป็นต้องสังกัดหน่วยงาน
  const isSectionRequired = form.role !== ROLES.ADMIN;
  const securityChange =
    form.role !== user.role || form.banned !== (user.banned === true);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    imageSelection.clearSelection();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitStartedRef.current || isPending || saveOutcomeUnknown) return;
    setError("");

    if (["uploading", "verifying", "error"].includes(imageSelection.state.status)) {
      setError("รูปที่เลือกยังไม่พร้อม กรุณารอการตรวจสอบหรือยกเลิกรูปใหม่ก่อนบันทึก");
      return;
    }
    if (!accountId || useAuthStore.getState().user?.id !== accountId) {
      setError("เซสชันผู้ใช้เปลี่ยนแล้ว กรุณาเปิดฟอร์มอีกครั้งก่อนบันทึก");
      return;
    }

    const upload = imageSelection.state.status === "ready"
      ? imageSelection.state.upload
      : null;
    const payload = {
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      userName: form.userName.trim(),
      email: form.email.trim(),
      role: form.role,
      banned: form.banned,
      ...(isSectionRequired && form.sectionId && { sectionId: form.sectionId }),
    } as UserUpdateDto;

    submitStartedRef.current = true;
    editUser({ payload, upload });
  };

  const handleImageChange = (file: File) => {
    void imageSelection.selectFile(file);
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm text-gray-900 placeholder-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-2xl font-bold text-[#1F2937]">
              แก้ไขข้อมูลผู้ใช้งาน
            </h3>
            <p className="mt-1 text-sm text-[#1F2937]/60">
              รหัสพนักงาน{" "}
              <span className="font-mono font-semibold">
                {user.employeeId || "-"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-8 space-y-5"
        >
          <fieldset disabled={isPending} className="contents">
          <div className="grid grid-cols-2 gap-5">
            {/* ชื่อ */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ชื่อ <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="firstname"
                required
                value={form.firstname}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* นามสกุล */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                นามสกุล
              </label>
              <input
                type="text"
                name="lastname"
                value={form.lastname}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* ชื่อผู้ใช้ */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                ชื่อผู้ใช้ (Username) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                name="userName"
                required
                value={form.userName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* อีเมล */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
                อีเมล (Email) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="email@company.com"
                className={inputClass}
              />
            </div>
          </div>

          {/* หน่วยงาน/แผนก */}
          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
              หน่วยงาน/แผนก{" "}
              {isSectionRequired ? (
                <span className="text-emerald-600">*</span>
              ) : (
                <span className="text-xs font-normal text-gray-400">
                  (ไม่ต้องระบุ)
                </span>
              )}
            </label>
            <select
              name="sectionId"
              required={isSectionRequired}
              disabled={!isSectionRequired}
              value={isSectionRequired ? form.sectionId : ""}
              onChange={handleChange}
              className={`${inputClass} bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
            >
              <option value="" disabled={isSectionRequired}>
                {isSectionRequired
                  ? "-- โปรดเลือกหน่วยงาน --"
                  : "-- ผู้ดูแลระบบไม่ต้องระบุหน่วยงาน --"}
              </option>
              {sections?.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          <ImageUploadField
            label="รูปพนักงาน"
            state={imageSelection.state}
            currentPreviewUrl={currentPhoto.status === "ready" ? currentPhoto.objectUrl : null}
            currentStatus={currentPhoto.status === "ready" ? "idle" : currentPhoto.status}
            currentError={currentPhoto.status === "error" ? currentPhoto.message : undefined}
            onSelectFile={handleImageChange}
            onCancelSelection={imageSelection.clearSelection}
            disabled={isPending}
          />

          {/* ระดับผู้ใช้งาน (Role) */}
          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-1.5">
              ระดับผู้ใช้งาน (Role) <span className="text-emerald-600">*</span>
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-700"
            >
              {EDIT_ROLE_OPTIONS.map((option, index) => (
                <option key={option.value} value={option.value}>
                  {`${index + 1}. ${option.label}`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[#1F2937]/70">
              {selectedRole.description}
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.banned}
              onChange={(event) =>
                setForm((current) => ({ ...current, banned: event.target.checked }))
              }
              className="h-4 w-4 accent-emerald-600"
            />
            <span>ระงับบัญชีผู้ใช้นี้</span>
          </label>

          {securityChange && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              การเปลี่ยน Role หรือสถานะจะออกจากระบบทุกอุปกรณ์และเพิกถอน Trusted Browser ของบัญชีนี้
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          )}

          </fieldset>

          {/* Footer Buttons */}
          <div className="pt-6 flex items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700/70 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending || saveOutcomeUnknown || ["uploading", "verifying", "error"].includes(imageSelection.state.status)}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
