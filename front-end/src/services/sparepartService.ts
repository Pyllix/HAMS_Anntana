import axios from "axios";
import type {
  Sparepart,
  SparepartGroup,
  CreateSparepartDto,
  UpdateSparepartDto,
  StockInSparepartDto,
} from "../Types/TypeSparePart";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// Local store for fallback/offline persistence
let localSpareparts: Sparepart[] = [];

// ─── Spare Part Groups ────────────────────────────────────────────────────────

const defaultGroups: SparepartGroup[] = [
  { id: 1, name: "ไฟฟ้า" },
  { id: 2, name: "เครื่องมือแพทย์" },
  { id: 3, name: "อิเล็กทรอนิกส์" },
  { id: 4, name: "กลไก/เครื่องกล" },
];

export async function getSparepartGroups(): Promise<SparepartGroup[]> {
  try {
    const res = await axios.get(
      `${BASE_URL}/spare-part-groups?limit=100`,
      getHeaders(),
    );
    const data = res.data;
    const items = Array.isArray(data) ? data : (data?.data ?? []);
    return items.length > 0 ? items : defaultGroups;
  } catch (err) {
    console.warn("Using default spare part groups:", err);
    return defaultGroups;
  }
}

// ─── Spare Parts CRUD ─────────────────────────────────────────────────────────

export async function getSpareParts(): Promise<Sparepart[]> {
  try {
    const res = await axios.get(
      `${BASE_URL}/spare-parts?limit=100`,
      getHeaders(),
    );
    const data = res.data;
    const items: Sparepart[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) {
      const backendIds = new Set(items.map((i) => i.id));
      const newLocals = localSpareparts.filter((l) => !backendIds.has(l.id));
      return [...items, ...newLocals];
    }
    return localSpareparts;
  } catch (err) {
    console.warn("Backend spare-parts query error, using local fallback:", err);
    return localSpareparts;
  }
}

export async function getSparepartById(id: number): Promise<Sparepart> {
  try {
    const res = await axios.get(
      `${BASE_URL}/spare-parts/${id}`,
      getHeaders(),
    );
    return res.data;
  } catch {
    const found = localSpareparts.find((i) => i.id === id);
    if (!found) throw new Error("Item not found");
    return found;
  }
}

export async function createSparepart(
  dto: CreateSparepartDto,
): Promise<Sparepart> {
  const payload = {
    code: dto.code,
    name: dto.name,
    unit: dto.unit || "ชิ้น",
    price: Number(dto.price),
    minStock: Number(dto.minStock ?? 0),
    qtyInStock: Number(dto.qtyInStock ?? 0),
    groupId: Number(dto.groupId || 1),
  };

  try {
    const res = await axios.post(
      `${BASE_URL}/spare-parts`,
      payload,
      getHeaders(),
    );
    const saved: Sparepart = {
      ...res.data,
      category: dto.category || res.data?.group?.name || "ไฟฟ้า",
    };
    localSpareparts = [saved, ...localSpareparts.filter((i) => i.id !== saved.id)];
    return saved;
  } catch (err) {
    console.warn("Backend create spare part failed, saving locally:", err);
    const fallbackItem: Sparepart = {
      id: Date.now(),
      code: dto.code,
      name: dto.name,
      unit: dto.unit || "ชิ้น",
      price: Number(dto.price),
      minStock: Number(dto.minStock ?? 0),
      qtyInStock: Number(dto.qtyInStock ?? 0),
      groupId: Number(dto.groupId || 1),
      category: dto.category || "ไฟฟ้า",
    };
    localSpareparts = [fallbackItem, ...localSpareparts];
    return fallbackItem;
  }
}

export async function updateSparepart(
  id: number,
  dto: UpdateSparepartDto,
): Promise<Sparepart> {
  const payload: Record<string, any> = {};
  if (dto.code !== undefined) payload.code = dto.code;
  if (dto.name !== undefined) payload.name = dto.name;
  if (dto.unit !== undefined) payload.unit = dto.unit;
  if (dto.price !== undefined) payload.price = Number(dto.price);
  if (dto.minStock !== undefined) payload.minStock = Number(dto.minStock);
  if (dto.qtyInStock !== undefined) payload.qtyInStock = Number(dto.qtyInStock);
  if (dto.groupId !== undefined) payload.groupId = Number(dto.groupId);

  try {
    const res = await axios.patch(
      `${BASE_URL}/spare-parts/${id}`,
      payload,
      getHeaders(),
    );
    const updated: Sparepart = {
      ...res.data,
      ...dto,
    };
    localSpareparts = localSpareparts.map((i) => (i.id === id ? { ...i, ...updated } : i));
    return updated;
  } catch (err) {
    console.warn("Backend update failed, updating locally:", err);
    localSpareparts = localSpareparts.map((i) =>
      i.id === id ? ({ ...i, ...dto } as Sparepart) : i,
    );
    const item = localSpareparts.find((i) => i.id === id);
    return item!;
  }
}

export async function deleteSparepart(id: number): Promise<void> {
  try {
    await axios.delete(
      `${BASE_URL}/spare-parts/${id}`,
      getHeaders(),
    );
  } catch (err) {
    console.warn("Backend delete failed, removing locally:", err);
  }
  localSpareparts = localSpareparts.filter((i) => i.id !== id);
}

// ─── Stock In & Reports ───────────────────────────────────────────────────────

export async function stockInSparepart(
  dto: StockInSparepartDto,
): Promise<any> {
  const res = await axios.post(
    `${BASE_URL}/spare-parts/stock-in`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function getLowStockSummary(): Promise<any> {
  const res = await axios.get(
    `${BASE_URL}/spare-parts/low-stock`,
    getHeaders(),
  );
  return res.data;
}

export async function getSparepartTransactions(id: number): Promise<any[]> {
  const res = await axios.get(
    `${BASE_URL}/spare-parts/${id}/transactions`,
    getHeaders(),
  );
  const data = res.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}
