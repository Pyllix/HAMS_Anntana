import axios from "axios";
import type {
  PartOrder,
  UpdatePurchasingInfoDto,
  PartOrderStatus,
} from "../Types/TypePartOrder";

const BASE_URL = "https://hams-anntana.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// ─── Initial Part Orders ──────────────────────────────────────────────────────
const defaultFallbackOrders: PartOrder[] = [
  {
    id: 101,
    orderNo: "PO-499",
    partName: "ฟิวส์เซรามิก 10A 250V (แพ็ก 10 ชิ้น)",
    quantity: 10,
    unit: "แพ็ก",
    category: "อะไหล่ระบบไฟฟ้าและแหล่งจ่ายไฟ",
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    unitPrice: 150.0,
    totalPrice: 1500.0,
    orderDate: "2026-03-20",
    status: "RECEIVED",
    sparepart_id: 1,
  },
  {
    id: 102,
    orderNo: "PO-498",
    partName: "แบตเตอรี่สำรองฉุกเฉินสำหรับ Defibrillator 12V 4.5Ah",
    quantity: 2,
    unit: "ก้อน",
    category: "อะไหล่ระบบไฟฟ้าและแหล่งจ่ายไฟ",
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    unitPrice: 3200.0,
    totalPrice: 6400.0,
    orderDate: "2026-03-18",
    status: "RECEIVED",
    sparepart_id: 2,
  },
  {
    id: 103,
    orderNo: "PO-497",
    partName: "วาล์วควบคุมแรงดันออกซิเจนความแม่นยำสูง (O2 Regulator Valve)",
    quantity: 5,
    unit: "ชุด",
    category: "อะไหล่ระบบท่อและก๊าซทางการแพทย์",
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    unitPrice: 4500.0,
    totalPrice: 22500.0,
    orderDate: "2026-03-15",
    status: "RECEIVED",
    sparepart_id: 3,
  },
  {
    id: 104,
    orderNo: "PO-496",
    partName: "ท่อสายส่งก๊าซทางการแพทย์แรงดันสูง (High-Pressure Hose)",
    quantity: 3,
    unit: "เส้น",
    category: "อะไหล่ระบบท่อและก๊าซทางการแพทย์",
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    unitPrice: 1200.0,
    totalPrice: 3600.0,
    orderDate: "2026-03-10",
    status: "RECEIVED",
    sparepart_id: 4,
  },
  {
    id: 105,
    orderNo: "PO-495",
    partName: "เซนเซอร์วัดค่าออกซิเจนในเลือด SpO2 Reusable Finger Probe",
    quantity: 4,
    unit: "เส้น",
    category: "อุปกรณ์ เซนเซอร์ และหัววัด",
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    unitPrice: 2800.0,
    totalPrice: 11200.0,
    orderDate: "2026-03-05",
    status: "RECEIVED",
    sparepart_id: 5,
  },
];

const ORDER_STORAGE_KEY = "hams_part_orders_storage_v2";

function loadSavedOrders(): PartOrder[] {
  try {
    const saved = localStorage.getItem(ORDER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Error reading orders from localStorage:", e);
  }
  return defaultFallbackOrders;
}

function saveOrdersToStorage(list: PartOrder[]) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Error saving orders to localStorage:", e);
  }
}

let localOrders: PartOrder[] = loadSavedOrders();

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getPartOrders(): Promise<PartOrder[]> {
  try {
    const res = await axios.get(
      `${BASE_URL}/part-orders?limit=100`,
      getHeaders(),
    );
    const data = res.data;
    const items = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) return items;
    return loadSavedOrders();
  } catch {
    return loadSavedOrders();
  }
}

export async function getPartOrderById(id: number): Promise<PartOrder> {
  try {
    const res = await axios.get(
      `${BASE_URL}/part-orders/${id}`,
      getHeaders(),
    );
    return res.data;
  } catch {
    const found = localOrders.find((o) => o.id === id);
    if (!found) throw new Error("Order not found");
    return found;
  }
}

export async function updatePurchasingInfo(
  id: number,
  dto: UpdatePurchasingInfoDto,
): Promise<PartOrder> {
  try {
    const res = await axios.patch(
      `${BASE_URL}/part-orders/${id}/purchasing-info`,
      dto,
      getHeaders(),
    );
    const updated = res.data;
    localOrders = localOrders.map((o) => (o.id === id ? { ...o, ...updated } : o));
    return updated;
  } catch {
    localOrders = localOrders.map((o) =>
      o.id === id
        ? {
          ...o,
          ...dto,
          status: "PENDING_APPROVAL" as PartOrderStatus,
        }
        : o,
    );
    const item = localOrders.find((o) => o.id === id);
    return item!;
  }
}

export async function updateOrderStatus(
  id: number,
  status: PartOrderStatus,
): Promise<PartOrder> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const res = await axios.patch(
      `${BASE_URL}/part-orders/${id}/status`,
      { status, orderDate: today },
      getHeaders(),
    );
    const updated = res.data;
    localOrders = localOrders.map((o) => (o.id === id ? { ...o, ...updated } : o));
    return updated;
  } catch {
    localOrders = localOrders.map((o) =>
      o.id === id
        ? {
          ...o,
          status,
          orderDate: o.orderDate || today,
        }
        : o,
    );
    const item = localOrders.find((o) => o.id === id);
    return item!;
  }
}

export async function createPartOrder(data: {
  sparepartId: number;
  partName: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderNo: string;
}): Promise<PartOrder> {
  const newOrder: PartOrder = {
    id: Date.now(),
    orderNo: data.orderNo,
    partName: data.partName,
    quantity: data.quantity,
    unit: data.unit,
    category: data.category,
    urgency: "NORMAL",
    requesterName: "เจ้าหน้าที่พัสดุ",
    department: "แผนกพัสดุ",
    sparepart_id: data.sparepartId,
    unitPrice: data.unitPrice,
    totalPrice: data.totalPrice,
    sparepart_add_doc: data.orderNo,
    orderDate: new Date().toISOString().split("T")[0],
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
  };

  const current = loadSavedOrders();
  const updated = [newOrder, ...current];
  localOrders = updated;
  saveOrdersToStorage(updated);
  return newOrder;
}
