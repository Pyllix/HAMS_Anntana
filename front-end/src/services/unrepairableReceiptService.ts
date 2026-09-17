import axios from "axios";
import type { ConfirmUnrepairableReceiptDto, UnrepairableJobDto, UnrepairableReceipt } from "../Types/TypeUnrepairableReceipt";
import { mapUnrepairableReceipt } from "./unrepairableReceiptMapper";

const BASE_URL = "https://hams-anntana.onrender.com";
const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

function config(signal?: AbortSignal) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการ");
  return { signal, headers: { Authorization: `Bearer ${token}` } };
}

export async function getUnrepairableReceipt(id: string, signal?: AbortSignal): Promise<UnrepairableReceipt> {
  const { data } = await api.get<UnrepairableJobDto>(`/repairs/${encodeURIComponent(id)}`, config(signal));
  const receipt = mapUnrepairableReceipt(data);
  if (!receipt) throw new Error("งานนี้ยังไม่ได้ส่งคืน ถูกยกเลิก หรือมีเจ้าหน้าที่รับคืนแล้ว กรุณารีเฟรชรายการ");
  return receipt;
}

export async function getUnrepairableReceipts(signal?: AbortSignal): Promise<UnrepairableReceipt[]> {
  // The list endpoint omits steps; load details in bounded batches to verify handover.
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<{ data: { id: string }[]; meta: { totalPages: number } }>("/repairs", {
      ...config(signal),
      params: { page, limit: 100, statusCode: "UNREPAIRABLE", stepActionType: "UNREPAIRABLE" },
    });
    if (!Array.isArray(data.data) || !Number.isInteger(data.meta?.totalPages)) {
      throw new Error("รูปแบบข้อมูลรายการรับคืนไม่ตรงกับ API กรุณาติดต่อผู้ดูแลระบบ");
    }
    data.data.forEach((job) => ids.add(job.id));
    if (page >= data.meta.totalPages || data.data.length === 0) break;
  }
  const jobs: UnrepairableReceipt[] = [];
  const uniqueIds = [...ids];
  for (let offset = 0; offset < uniqueIds.length; offset += 6) {
    const batch = await Promise.all(uniqueIds.slice(offset, offset + 6).map(async (id) => {
      const { data } = await api.get<UnrepairableJobDto>(`/repairs/${encodeURIComponent(id)}`, config(signal));
      return mapUnrepairableReceipt(data);
    }));
    batch.forEach((job) => { if (job) jobs.push(job); });
  }
  return jobs.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
}

export async function confirmUnrepairableReceipt(id: string, dto: ConfirmUnrepairableReceiptDto): Promise<void> {
  const storageLocation = dto.storageLocation.trim();
  if (!storageLocation) throw new Error("กรุณาระบุสถานที่เก็บรอจำหน่าย");
  // Recheck immediately before writing; backend remains authoritative.
  await getUnrepairableReceipt(id);
  await api.patch(`/repairs/${encodeURIComponent(id)}/complete-unrepairable`, {
    storageLocation, note: dto.note?.trim() || undefined,
  }, config());
}

export function receiptError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
    if (error.response?.status === 403) return "บัญชีนี้ไม่มีสิทธิ์รับคืนครุภัณฑ์ กรุณาใช้บัญชีเจ้าหน้าที่พัสดุ";
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(" / ");
    if (typeof message === "string") return message;
    return "ติดต่อระบบไม่ได้ หากเพิ่งกดยืนยัน กรุณารีเฟรชตรวจสอบสถานะก่อนทำรายการซ้ำ";
  }
  return error instanceof Error ? error.message : "ไม่สามารถทำรายการได้ กรุณาลองใหม่";
}
