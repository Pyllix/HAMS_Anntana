// ─── Spare Part Group ────────────────────────────────────────────────────────

export interface SparepartGroup {
  id: number;
  name: string;
  description?: string | null;
  sparepartsCount?: number;
}

// ─── Spare Part Item ──────────────────────────────────────────────────────────

export interface Sparepart {
  id: number;
  code: string;
  name: string;
  unit: string;
  price: number;
  minStock: number;
  qtyInStock: number;
  groupId: number;
  group?: SparepartGroup;
  brand?: string;
  category?: string;
  imageUrl?: string | null;
  compatibleModel?: string;
  lifespan?: string;
  purchaseDate?: string;
  storageLocation?: string;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Stock Status Helper ──────────────────────────────────────────────────────

export type SparePartStockStatus = "NORMAL" | "LOW" | "OUT";

export function getSparePartStatus(item: Sparepart): SparePartStockStatus {
  if (item.qtyInStock <= 0) return "OUT";
  if (item.qtyInStock <= item.minStock) return "LOW";
  return "NORMAL";
}

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateSparepartDto {
  code: string;
  name: string;
  groupId: number;
  price: number;
  unit?: string;
  minStock?: number;
  qtyInStock?: number;
  category?: string;
  brand?: string;
  imageUrl?: string | null;
  compatibleModel?: string;
  lifespan?: string;
  purchaseDate?: string;
  storageLocation?: string;
}

export interface UpdateSparepartDto extends Partial<CreateSparepartDto> {}

export interface StockInSparepartDto {
  sparepartId: number;
  qty: number;
  totalPrice?: number;
  sparepartAddDoc: string;
}
