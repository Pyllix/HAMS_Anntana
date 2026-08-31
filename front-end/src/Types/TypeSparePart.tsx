// ─── Spare Part Group ────────────────────────────────────────────────────────

export interface SparepartGroup {
  id: number;
  name: string;
}

// ─── Spare Part Item ──────────────────────────────────────────────────────────

export interface Sparepart {
  id: number;
  code: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  price: number;
  minStock: number;
  qtyInStock: number;
  imageUrl?: string | null;
  compatibleModel?: string;
  lifespan?: string;
  purchaseDate?: string;
  storageLocation?: string;
  group?: SparepartGroup;
}

// ─── Stock Status Helper ──────────────────────────────────────────────────────

export type SparePartStockStatus = "NORMAL" | "LOW" | "OUT";

export function getSparePartStatus(item: Sparepart): SparePartStockStatus {
  if (item.qtyInStock <= 0) return "OUT";
  if (item.qtyInStock <= item.minStock) return "LOW";
  return "NORMAL";
}

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface CreateSparepartDto {
  code: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  minStock: number;
  qtyInStock: number;
  imageUrl?: string | null;
  compatibleModel?: string;
  lifespan?: string;
  purchaseDate?: string;
  storageLocation?: string;
}

export interface UpdateSparepartDto extends Partial<CreateSparepartDto> {}
