import { getAllPages, getPage } from "./pagedApi";
import type { Filters, Page } from "./pagedApi";
import { apiClient } from "./apiClient";
import { isSessionExpiredApiError } from "./serviceErrorPolicy";
import type {
  Sparepart,
  SparepartGroup,
  CreateSparepartDto,
  UpdateSparepartDto,
  StockInSparepartDto,
  ReturnSparepartDto,
} from "../types/TypeSparePart";
import {
  getAccountStorageKey,
  getCurrentSessionDraftAccountId,
} from "./sessionDraftStorage";


const STORAGE_KEY = "hams_spareparts_storage_v1";

function loadSavedSpareparts(): Sparepart[] {
  try {
    const storageKey = getAccountStorageKey(STORAGE_KEY);
    if (!storageKey) return [];
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSparepartsToStorage(items: Sparepart[]) {
  try {
    const storageKey = getAccountStorageKey(STORAGE_KEY);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // ignore
  }
}

// Local store for fallback/offline persistence, isolated per authenticated account.
let localSparepartsAccountId: string | null | undefined;
let localSpareparts: Sparepart[] = [];

function ensureLocalSparepartsForCurrentAccount(): void {
  const accountId = getCurrentSessionDraftAccountId();
  if (localSparepartsAccountId === accountId) return;
  localSparepartsAccountId = accountId;
  localSpareparts = loadSavedSpareparts();
}

// ─── Spare Part Groups ────────────────────────────────────────────────────────

const defaultGroups: SparepartGroup[] = [
  { id: 1, name: "ไฟฟ้า" },
  { id: 2, name: "เครื่องมือแพทย์" },
  { id: 3, name: "อิเล็กทรอนิกส์" },
  { id: 4, name: "กลไก/เครื่องกล" },
];

export async function getSparepartGroups(): Promise<SparepartGroup[]> {
  return getAllPages<SparepartGroup>("/spare-part-groups");
}

const TIMESTAMPS_KEY = "hams_spareparts_timestamps_v1";

function getSavedTimestamps(): Record<string, { createdAt?: string; updatedAt?: string }> {
  try {
    const raw = localStorage.getItem(TIMESTAMPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSparepartTimestamp(id: number | string, data: { createdAt?: string; updatedAt?: string }) {
  try {
    const all = getSavedTimestamps();
    const prev = all[String(id)] || {};
    all[String(id)] = {
      createdAt: data.createdAt || prev.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || prev.updatedAt || data.createdAt || new Date().toISOString(),
    };
    localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function getSparePartTimestamp(id: number | string): { createdAt?: string; updatedAt?: string } | undefined {
  const all = getSavedTimestamps();
  return all[String(id)];
}

function enrichTimestamps(item: Sparepart): Sparepart {
  const ts = getSparePartTimestamp(item.id);
  const now = new Date().toISOString();
  const createdAt = item.createdAt || ts?.createdAt || now;
  const updatedAt = item.updatedAt || ts?.updatedAt || createdAt;
  if (!ts) {
    saveSparepartTimestamp(item.id, { createdAt, updatedAt });
  }
  return {
    ...item,
    createdAt,
    updatedAt,
  };
}

// ─── Spare Parts CRUD ─────────────────────────────────────────────────────────

export async function getSpareParts(): Promise<Sparepart[]> {
  ensureLocalSparepartsForCurrentAccount();
  try {
    const res = await apiClient.get(
      `/spare-parts?limit=100`,
    );
    const data = res.data;
    const items: Sparepart[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) {
      const localMap = new Map(localSpareparts.map((l) => [l.id, l]));
      // Merge: take backend item, but override with local changes if edited
      const merged = items.map((item) => {
        const local = localMap.get(item.id);
        const resolved = local ? { ...item, ...local } : item;
        return enrichTimestamps(resolved);
      });
      const backendIds = new Set(items.map((i) => i.id));
      const newLocals = localSpareparts
        .filter((l) => !backendIds.has(l.id))
        .map(enrichTimestamps);
      return [...merged, ...newLocals];
    }
    return localSpareparts.map(enrichTimestamps);
  } catch (err) {
    console.warn("Backend spare-parts query error, using local fallback:", err);
    return localSpareparts.map(enrichTimestamps);
  }
}

export async function getSparepartById(id: number): Promise<Sparepart> {
  ensureLocalSparepartsForCurrentAccount();
  try {
    const res = await apiClient.get(
      `/spare-parts/${id}`,
    );
    return enrichTimestamps(res.data);
  } catch {
    const found = localSpareparts.find((i) => i.id === id);
    if (!found) throw new Error("Item not found");
    return enrichTimestamps(found);
  }
}

export async function createSparepart(
  dto: CreateSparepartDto,
): Promise<Sparepart> {
  ensureLocalSparepartsForCurrentAccount();
  const payload = {
    name: dto.name,
    unit: dto.unit || "ชิ้น",
    price: Number(dto.price),
    minStock: Number(dto.minStock ?? 0),
    qtyInStock: Number(dto.qtyInStock ?? 0),
    groupId: Number(dto.groupId),
  };

  // Codes and timestamps belong to the server. Failed saves must reach the form.
  const res = await apiClient.post<Sparepart>("/spare-parts", payload);
  const saved: Sparepart = {
    ...res.data,
    localDraft: false,
    category: res.data.group?.name ?? dto.category,
  };
  saveSparepartTimestamp(saved.id, { createdAt: saved.createdAt, updatedAt: saved.updatedAt });
  localSpareparts = [saved, ...localSpareparts.filter((i) => i.id !== saved.id)];
  saveSparepartsToStorage(localSpareparts);
  return saved;
}

export async function updateSparepart(
  id: number,
  dto: UpdateSparepartDto,
): Promise<Sparepart> {
  ensureLocalSparepartsForCurrentAccount();
  const payload: Record<string, string | number> = {};
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.unit !== undefined) payload.unit = dto.unit;
  if (dto.price !== undefined) payload.price = Number(dto.price);
  if (dto.minStock !== undefined) payload.minStock = Number(dto.minStock);
  if (dto.qtyInStock !== undefined) payload.qtyInStock = Number(dto.qtyInStock);
  if (dto.groupId !== undefined) payload.groupId = Number(dto.groupId);

  const res = await apiClient.patch<Sparepart>(`/spare-parts/${id}`, payload);
  const updated: Sparepart = {
    ...res.data,
    localDraft: false,
    category: res.data.group?.name ?? dto.category,
  };
  saveSparepartTimestamp(id, { createdAt: updated.createdAt, updatedAt: updated.updatedAt });
  localSpareparts = [updated, ...localSpareparts.filter((i) => i.id !== id)];
  saveSparepartsToStorage(localSpareparts);
  return updated;
}

export async function deleteSparepart(id: number): Promise<void> {
  ensureLocalSparepartsForCurrentAccount();
  try {
    await apiClient.delete(
      `/spare-parts/${id}`,
    );
  } catch (err) {
    if (isSessionExpiredApiError(err)) throw err;
    console.warn("Backend delete failed, removing locally:", err);
  }
  localSpareparts = localSpareparts.filter((i) => i.id !== id);
  saveSparepartsToStorage(localSpareparts);
}

// ─── Stock In & Reports ───────────────────────────────────────────────────────

export async function stockInSparepart(
  dto: StockInSparepartDto,
): Promise<any> {
  const res = await apiClient.post(
    `/spare-parts/stock-in`,
    dto,
  );
  return res.data;
}

export async function getLowStockSummary(): Promise<any> {
  const res = await apiClient.get(
    `/spare-parts/low-stock`,
  );
  return res.data;
}

export async function getSparepartTransactions(id: number): Promise<any[]> {
  const res = await apiClient.get(
    `/spare-parts/${id}/transactions`,
  );
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function getRepairByJobNo(jobNo: string): Promise<any> {
  if (!jobNo || !jobNo.trim()) {
    return null;
  }

  const query = jobNo.trim();

  try {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)) {
      const detail = (await apiClient.get("/repairs/" + query)).data;
      const completedJobsKey = getAccountStorageKey("completed_return_jobs");
      const completedJobs: string[] = JSON.parse((completedJobsKey && localStorage.getItem(completedJobsKey)) || "[]");
      return { ...detail, isCompleted: completedJobs.includes(query) };
    }
    const res = await apiClient.get("/repairs", { params: { search: query.replace(/^(REQ|OUT)-/i, "REP-"), page: 1, limit: 20 } });
    const data = res.data;
    const items = Array.isArray(data) ? data : (data?.data ?? []);

    const found = items.find(
      (item: any) =>
        String(item.id) === query ||
        item.jobNo === query ||
        item.code === query ||
        item.repairCode === query ||
        String(item.jobNo ?? "").replace(/^REP-/i, "") === query.replace(/^(REQ|OUT|REP)-/i, ""),
    );

    if (!found) {
      return null;
    }

    // ดึงรายละเอียดข้อมูลเต็ม
    let repairData = found;
    try {
      const fullDetailRes = await apiClient.get(
        `/repairs/${found.id}`,
      );
      repairData = fullDetailRes.data || found;
    } catch (err) {
      console.warn("Could not fetch full detail, using list item:", err);
    }

    // ตรวจสอบว่า Job นี้เคยทำรายการแล้วหรือไม่
    // Ignore the legacy unbound key because it may belong to another account.
    const completedJobsKey = getAccountStorageKey("completed_return_jobs");
    const completedJobs: string[] = JSON.parse(
      (completedJobsKey && localStorage.getItem(completedJobsKey)) || "[]",
    );

    const isAlreadyCompleted = completedJobs.includes(String(found.id));

    return {
      ...repairData,
      isCompleted: isAlreadyCompleted,
    };
  } catch (err) {
    console.warn("Error fetching repair data:", err);
    return null;
  }
}

export async function returnSparepart(
  repairId: string,
  dto: ReturnSparepartDto,
): Promise<any> {
  if (!repairId || String(repairId).trim() === "" || repairId === "undefined") {
    throw new Error("ไม่พบรหัสใบแจ้งซ่อม (repairId)");
  }

  const rawId =
    (dto as any).sparepartId ?? (dto as any).sparePartId ?? (dto as any).id;

  const parsedSparepartId = Number(rawId);
  const parsedQty = Number(dto.qty ?? (dto as any).quantity ?? 0);

  if (
    isNaN(parsedSparepartId) ||
    !Number.isInteger(parsedSparepartId) ||
    parsedSparepartId <= 0
  ) {
    throw new Error(`รหัสอะไหล่ต้องเป็นจำนวนเต็มบวก (sparepartId: ${rawId})`);
  }

  if (isNaN(parsedQty) || parsedQty <= 0) {
    throw new Error(`จำนวนคืนต้องมากกว่า 0 (qty: ${dto.qty})`);
  }

  const payload = {
    sparepartId: parsedSparepartId,
    qty: parsedQty,
  };

  const res = await apiClient.post(
    `/repairs/${repairId}/spare-parts/return`,
    payload,
  );
  return res.data;
}

export async function getSparePartsPage(filters: Filters, signal?: AbortSignal): Promise<Page<Sparepart>> {
  return getPage<Sparepart>("/spare-parts", filters, signal);
}
export function getLocalSparepartDrafts(): Sparepart[] {
  ensureLocalSparepartsForCurrentAccount();
  return localSpareparts.filter((part) => part.localDraft === true || part.id >= 1_000_000_000_000);
}
