import axios from "axios";
import type {
  Sparepart,
  SparepartGroup,
  CreateSparepartDto,
  UpdateSparepartDto,
} from "../types/TypeSparePart";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// ─── Spare Part Groups ────────────────────────────────────────────────────────

export async function getSparepartGroups(): Promise<SparepartGroup[]> {
  const res = await axios.get(
    `${BASE_URL}/sparepart-groups`,
    getHeaders(),
  );
  return res.data;
}

// ─── Spare Parts ─────────────────────────────────────────────────────────────

export async function getSpareParts(): Promise<Sparepart[]> {
  const res = await axios.get(
    `${BASE_URL}/spareparts`,
    getHeaders(),
  );
  return res.data;
}

export async function getSparepartById(id: number): Promise<Sparepart> {
  const res = await axios.get(
    `${BASE_URL}/spareparts/${id}`,
    getHeaders(),
  );
  return res.data;
}

export async function createSparepart(
  dto: CreateSparepartDto,
): Promise<Sparepart> {
  const res = await axios.post(
    `${BASE_URL}/spareparts`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function updateSparepart(
  id: number,
  dto: UpdateSparepartDto,
): Promise<Sparepart> {
  const res = await axios.patch(
    `${BASE_URL}/spareparts/${id}`,
    dto,
    getHeaders(),
  );
  return res.data;
}

export async function deleteSparepart(id: number): Promise<void> {
  await axios.delete(
    `${BASE_URL}/spareparts/${id}`,
    getHeaders(),
  );
}
