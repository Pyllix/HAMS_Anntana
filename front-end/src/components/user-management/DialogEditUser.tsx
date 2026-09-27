import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { User } from "../../types/TypeUser";
import { ROLES, type RoleType } from "../../router/roles";
import { updateUserById } from "../../services/userService";
import { getSections } from "../../services/assetService";

const ROLE_LABELS: Record<RoleType, string> = {
  [ROLES.ADMIN]: "ผู้ดูแลระบบ",
  [ROLES.MANAGER]: "ผู้จัดการ / หัวหน้างาน",
  [ROLES.MAINTENANCE_HEAD]: "หัวหน้าช่าง",
  [ROLES.MAINTENANCE_STAFF]: "ช่างซ่อมบำรุง",
  [ROLES.ASSET_CENTER_STAFF]: "เจ้าหน้าที่ศูนย์สินทรัพย์",
  [ROLES.PARCEL_STAFF]: "เจ้าหน้าที่พัสดุ",
  [ROLES.DEPARTMENT_STAFF]: "เจ้าหน้าที่ประจำแผนก",
};

function friendlyError(error: unknown): string {
  const data = (error as { response?: { data?: { code?: string; message?: string } } }).response?.data;
  if (data?.code === "LAST_ACTIVE_ENROLLED_ADMIN") {
    return "บันทึกไม่ได้ เพราะไม่สามารถลดสิทธิ์หรือระงับ ADMIN คนสุดท้ายที่เปิดใช้ 2FA ได้";
  }
  if (data?.message && typeof data.message === "string") return data.message;
  return "บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}

export default function DialogEditUser({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}) {
  const queryClient = useQueryClient();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [role, setRole] = useState<RoleType>(ROLES.DEPARTMENT_STAFF);
  const [banned, setBanned] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !user) return;
    setFirstname(user.firstname ?? "");
    setLastname(user.lastname ?? "");
    setEmail(user.email ?? "");
    setUserName(user.userName ?? "");
    setSectionId(user.section_id ?? "");
    setRole(user.role);
    setBanned(user.banned === true);
    setError("");
  }, [isOpen, user]);

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return updateUserById(user.id, {
        firstname,
        lastname,
        email,
        userName,
        sectionId,
        role,
        banned,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (cause) => setError(friendlyError(cause)),
  });

  if (!isOpen || !user) return null;

  const securityChange = role !== user.role || banned !== (user.banned === true);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="edit-user-title" className="text-xl font-bold text-slate-900">แก้ไขบัญชีผู้ใช้</h2>
            <p className="mt-1 text-sm text-slate-500">{user.employeeId} · {user.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">ชื่อ<input required value={firstname} onChange={(event) => setFirstname(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700">นามสกุล<input required value={lastname} onChange={(event) => setLastname(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700">อีเมล<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700">ชื่อผู้ใช้<input value={userName} onChange={(event) => setUserName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700">หน่วยงาน<select required value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">เลือกหน่วยงาน</option>{sections?.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Role<select value={role} onChange={(event) => setRole(event.target.value as RoleType)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={banned} onChange={(event) => setBanned(event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
            <span><strong>ระงับบัญชี</strong><span className="mt-0.5 block text-slate-500">ผู้ใช้จะเข้าใช้งานไม่ได้</span></span>
          </label>
          {securityChange && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">การเปลี่ยน Role หรือสถานะจะออกจากระบบทุกอุปกรณ์และเพิกถอน Trusted Browser ของบัญชีนี้ การสร้างบัญชีและเปลี่ยน Role ไม่ต้องยืนยัน TOTP เพิ่ม</p>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">ยกเลิก</button>
            <button disabled={mutation.isPending} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "กำลังบันทึก..." : "บันทึกบัญชี"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
