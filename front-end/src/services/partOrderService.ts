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
const initialOrders: PartOrder[] = [
  {
    id: 1,
    orderNo: "PO-499",
    partName: "หลอดนีออน 20 W PH",
    quantity: 10,
    unit: "หลอด",
    category: "วัสดุไฟฟ้า",
    urgency: "EMERGENCY",
    requesterName: "นายมานะ อดทน",
    department: "ช่าง",
    brandModel: "Philips Super 80 T8 20W",
    supplier: "ร้านไฟฟ้าแสงทอง พลาซ่า",
    unitPrice: 65.0,
    totalPrice: 650.0,
    orderDate: "",
    status: "PENDING_PURCHASE_INFO",
  },
  {
    id: 2,
    orderNo: "PO-498",
    partName: "แบตเตอรี่เครื่องกระตุกหัวใจ (Li-ion 14.4V)",
    quantity: 2,
    unit: "ก้อน",
    category: "อะไหล่เครื่องมือแพทย์",
    urgency: "NORMAL",
    requesterName: "นส. ใจดี รักเรียน",
    department: "เจ้าหน้าที่ศูนย์",
    brandModel: "Mindray รุ่น LI24I001A (Original Part)",
    supplier: "บริษัท เอสแพคกรุ๊ป(ประเทศไทย) จำกัด",
    unitPrice: 8500.0,
    totalPrice: 17000.0,
    orderDate: "",
    status: "PENDING_PURCHASE_INFO",
  },
  {
    id: 3,
    orderNo: "PO-497",
    partName: "รางปลั๊กไฟ 5 ช่อง (สายยาว 5 เมตร)",
    quantity: 5,
    unit: "ชุด",
    category: "วัสดุไฟฟ้า",
    urgency: "EMERGENCY",
    requesterName: "นายสมชาย รักเรียน",
    department: "ช่าง",
    brandModel: "TOSHINO รุ่น ET-9155M",
    supplier: "บริษัท อมร อีเล็คโทรนิคส์ จำกัด",
    unitPrice: 450.0,
    totalPrice: 4500.0,
    orderDate: "2026-03-21",
    status: "APPROVED",
  },
  {
    id: 4,
    orderNo: "PO-496",
    partName: "ลำโพงคอมพิวเตอร์ 2.1 Channel (มี Subwoofer)",
    quantity: 2,
    unit: "เครื่อง",
    category: "วัสดุคอมพิวเตอร์",
    urgency: "NORMAL",
    requesterName: "นส. ใจดี รักเรียน",
    department: "เจ้าหน้าที่ศูนย์",
    brandModel: "Microlab รุ่น X2",
    supplier: "บริษัท แอดไวซ์ไอทีอินฟินิทจำกัด(มหาชน)",
    unitPrice: 1590.0,
    totalPrice: 3180.0,
    orderDate: "2026-03-10",
    status: "ORDERING",
  },
  {
    id: 5,
    orderNo: "PO-495",
    partName: "สาย SpO2 Sensor Finger Probe ผู้ใหญ่",
    quantity: 4,
    unit: "เส้น",
    category: "อะไหล่เครื่องมือแพทย์",
    urgency: "URGENT",
    requesterName: "นายธนากร สมบูรณ์",
    department: "ศูนย์ครุภัณฑ์",
    brandModel: "Nellcor DOC-10 OxiMax Compatible",
    supplier: "บริษัท เมดิคอลซัพพลาย จำกัด",
    unitPrice: 2400.0,
    totalPrice: 9600.0,
    orderDate: "2026-03-05",
    status: "RECEIVED",
  },
  {
    id: 6,
    orderNo: "PO-494",
    partName: "ชุดปั๊มสูญญากาศ Suction Diaphragm Pump",
    quantity: 1,
    unit: "ชุด",
    category: "กลไก/เครื่องกล",
    urgency: "NORMAL",
    requesterName: "นายมานะ อดทน",
    department: "ช่าง",
    brandModel: "KNF Neuberger NMP830",
    supplier: "บริษัท ไทยเมดิคอลเทค จำกัด",
    unitPrice: 8900.0,
    totalPrice: 8900.0,
    orderDate: "",
    status: "PENDING_APPROVAL",
  },
];

let localOrders: PartOrder[] = [...initialOrders];

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
    return localOrders;
  } catch {
    return localOrders;
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
